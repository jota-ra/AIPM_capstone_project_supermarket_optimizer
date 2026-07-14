import json
import time
from pathlib import Path

from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError
import os
from dotenv import load_dotenv

from backend.app.services.units import normalize_unit, normalize_quantity

# ─────────────────────────────────────────────────────────────
# CLIENT
# ─────────────────────────────────────────────────────────────

load_dotenv()

# Offline / no-quota mode (E3): when RECEIPT_PARSER_MOCK is truthy, the
# parser returns a deterministic fixture instead of calling Gemini, so the
# whole receipt flow (upload → normalize → classify → store → review) can
# be exercised without spending the daily Gemini free-tier quota. Off by
# default; the real Gemini path is unchanged.
MOCK_MODE = os.environ.get("RECEIPT_PARSER_MOCK", "").strip().lower() in {"1", "true", "yes", "on"}
_MOCK_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "mock_receipt.json"

# The client is only needed for real calls. In mock mode we skip building
# it so the flow works even without a GEMINI_API_KEY configured.
client = None if MOCK_MODE else genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-2.5-flash"

# Typed extraction error codes (E3-S5). The API layer maps these to HTTP
# statuses (rate_limited→429, unavailable→503, invalid→422).
ERROR_RATE_LIMITED = "rate_limited"
ERROR_UNAVAILABLE = "unavailable"
ERROR_INVALID = "invalid"


# ─────────────────────────────────────────────────────────────
# SYSTEM PROMPT (FIXED: enforce German output)
# ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are the Receipt Scanner Agent for NutriWise.

You analyze German supermarket receipts (Rewe, Edeka, Aldi, Lidl, Penny, Netto, Norma).

CRITICAL LANGUAGE RULE:
- ALL product names MUST be in GERMAN
- NEVER output English product names
- If the receipt is already abbreviated, expand it into natural German
  Examples:
  "milk" -> "Milch"
  "bread" -> "Brot"
  "banana" -> "Bananen"
  "organic eggs" -> "Bio Eier"

WHAT TO EXTRACT (E3 / R-EXTRACT):
- The purchase date as ISO "YYYY-MM-DD" in the `date` field (null if not printed).
- The store name.
- For each FOOD line: name, original_text, quantity, unit, price (in EUR, as a
  number), category, and an `uncertain` flag when the line is hard to read.

FOOD vs NON-FOOD (R-NONFOOD):
- Classify each line. Only actual food/drink groceries go in `items`.
- Deposits (Pfand), discounts (Rabatt), bags (Tragetasche/Tüte), coupons,
  and other non-food lines go in `non_food_items_ignored` (as their raw
  text) — never in `items`, so they can't pollute nutrition.

RULES:
- Never invent products; only extract what is printed.
- Include the per-item price when it is legible; use null when it is not.
- Never translate into English.
- Always normalize to natural German grocery terminology.
- Keep names short and standard (supermarket style).
"""

# ─────────────────────────────────────────────────────────────
# JSON SCHEMA (unchanged)
# ─────────────────────────────────────────────────────────────

RECEIPT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "store": {
            "type": "STRING",
            "enum": ["Rewe", "Edeka", "Aldi", "Netto", "Norma", "Lidl", "Penny", "unknown"]
        },
        "date": {"type": "STRING", "nullable": True},
        "scan_quality": {
            "type": "STRING",
            "enum": ["good", "medium", "poor"]
        },
        "items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "original_text": {"type": "STRING"},
                    "quantity": {"type": "NUMBER"},
                    "unit": {"type": "STRING"},
                    "price": {"type": "NUMBER", "nullable": True},
                    "category": {"type": "STRING"},
                    "uncertain": {"type": "BOOLEAN"},
                },
                "required": ["name", "quantity", "category", "uncertain"],
            },
        },
        "non_food_items_ignored": {"type": "ARRAY", "items": {"type": "STRING"}},
        "items_count": {"type": "INTEGER"},
        "error": {"type": "STRING", "nullable": True},
    },
    "required": ["store", "scan_quality", "items", "items_count"],
}

MEDIA_TYPE_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}

# ─────────────────────────────────────────────────────────────
# CORE FUNCTIONS
# ─────────────────────────────────────────────────────────────

def _normalize_parsed(parsed: dict) -> dict:
    """
    Canonicalize a successfully-parsed receipt (E3-S3): map every item's
    free-form unit to the {g,kg,ml,l,piece} enum (scaling the quantity when
    the source unit isn't 1:1, e.g. cl→ml). Non-destructive on error dicts.
    """

    if not isinstance(parsed, dict) or parsed.get("error"):
        return parsed

    for item in parsed.get("items", []) or []:
        raw_unit = item.get("unit")
        item["quantity"] = normalize_quantity(item.get("quantity"), raw_unit)
        item["unit"] = normalize_unit(raw_unit)
    return parsed


def _load_mock() -> dict:
    """Deterministic parsed receipt for RECEIPT_PARSER_MOCK mode (E3)."""

    with open(_MOCK_FIXTURE, encoding="utf-8") as fh:
        return _normalize_parsed(json.load(fh))


def _extract_items(contents, max_retries: int = 3) -> dict:
    """
    Sends prepared `contents` to Gemini and returns structured JSON.

    Shared by both the image path (scan_receipt_bytes) and the text
    fallback path (scan_receipt_text) so retry/backoff and error handling
    stay identical across inputs. Failures return a typed error (E3-S5):
    `error_code` is one of rate_limited / unavailable / invalid so the API
    can map it to the right HTTP status instead of a blanket 502.
    """

    if MOCK_MODE:
        return _load_mock()

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=RECEIPT_SCHEMA,
        temperature=0.1,
    )

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=contents,
                config=config,
            )
            return _normalize_parsed(json.loads(response.text))

        except ClientError as e:
            # 429 / quota is transient within a window — back off and retry;
            # a persistent daily quota exhausts the retries and surfaces as a
            # typed rate_limited error (not an opaque 502).
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                time.sleep(2 ** attempt)
                continue
            # Any other client-side error (bad MIME, malformed request) means
            # the input can't be parsed as a receipt.
            return {"error": str(e), "error_code": ERROR_INVALID}

        except ServerError as e:
            # Gemini 5xx — the service is temporarily unavailable.
            return {"error": str(e), "error_code": ERROR_UNAVAILABLE}

        except json.JSONDecodeError:
            return {"error": "Invalid JSON returned by Gemini", "error_code": ERROR_INVALID}

    return {"error": "Rate limit / quota exceeded — please try again later.", "error_code": ERROR_RATE_LIMITED}


def scan_receipt_bytes(
    file_bytes: bytes,
    filename: str,
    max_retries: int = 3,
) -> dict:
    """
    Parses a receipt image from bytes and returns structured JSON.
    """

    suffix = Path(filename).suffix.lower()
    media_type = MEDIA_TYPE_MAP.get(suffix, "image/jpeg")

    contents = [
        types.Part.from_bytes(
            data=file_bytes,
            mime_type=media_type,
        ),
        "Extract all grocery items from this German supermarket receipt.",
    ]

    return _extract_items(contents, max_retries=max_retries)


def scan_receipt_text(
    raw_text: str,
    max_retries: int = 3,
) -> dict:
    """
    Parses pasted receipt text into the same structured schema as
    scan_receipt_bytes — but fully OFFLINE (deterministic regex, no Gemini),
    so the "paste text" fallback always works regardless of API quota/keys
    (E3). `max_retries` is accepted for call-site symmetry but unused here.

    The image path still uses the vision model; only this text path is
    offline. In mock mode it returns the shared fixture for deterministic
    end-to-end tests.
    """

    if MOCK_MODE:
        return _load_mock()

    from backend.app.services.receipt_text_parser import parse_receipt_text_offline

    return _normalize_parsed(parse_receipt_text_offline(raw_text))