import json
import time
from pathlib import Path

from google import genai
from google.genai import types
from google.genai.errors import ClientError

# ─────────────────────────────────────────────────────────────
# CLIENT
# ─────────────────────────────────────────────────────────────

client = genai.Client()
MODEL = "gemini-2.5-flash"

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

RULES:
- Never invent products
- Never include prices
- Never translate into English
- Always normalize to natural German grocery terminology
- Keep names short and standard (supermarket style)
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
}

# ─────────────────────────────────────────────────────────────
# CORE FUNCTION
# ─────────────────────────────────────────────────────────────

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

            return json.loads(response.text)

        except ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                time.sleep(2 ** attempt)
                continue

            return {"error": str(e)}

        except json.JSONDecodeError:
            return {"error": "Invalid JSON returned by Gemini"}

    return {"error": "Maximum retries exceeded"}