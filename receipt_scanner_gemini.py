"""
Receipt Scanner Agent für NutriWise — Gemini Edition
======================================================

Analysiert Fotos von Kassenbons und extrahiert alle Lebensmittel als
strukturiertes JSON. Nutzt die Google Gemini API (Modell: gemini-2.5-flash),
die im kostenlosen Kontingent (Free Tier, kein Kreditkarte nötig) läuft.

SETUP
-----
1. API-Key kostenlos erstellen: https://aistudio.google.com/apikey
2. Als Umgebungsvariable setzen:
     export GEMINI_API_KEY="dein-key"      (Linux/macOS)
     setx GEMINI_API_KEY "dein-key"        (Windows)
3. SDK installieren (nur das neue, offizielle Paket — NICHT das alte
   'google-generativeai', das ist deprecated):
     pip install google-genai

Hinweis Free Tier: gemini-2.5-flash hat ein großzügiges kostenloses
Kontingent (Requests/Minute & pro Tag). Für sehr hohe Volumina ggf.
auf gemini-2.5-flash-lite wechseln oder Billing aktivieren.
"""

import io
import json
import os
import time
from pathlib import Path


from google import genai
from google.genai import types
from google.genai.errors import ClientError

# ── 1. CLIENT ───────────────────────────────────────────────────────────────
# Liest GEMINI_API_KEY automatisch aus der Umgebung
client = genai.Client()

MODEL = "gemini-2.5-flash"  # kostenloses Kontingent, multimodal, schnell

# ── 2. SYSTEM PROMPT ────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are the Receipt Scanner Agent for NutriWise.
You analyze photos of supermarket receipts and extract all purchased
food items in a clean, structured JSON format.

You are an expert at reading German supermarket receipts from
Rewe, Edeka, Aldi, Lidl, Penny, etc.

YOUR RESPONSIBILITIES:
1. Read the receipt image carefully
2. Identify ALL food and grocery items
3. Decode abbreviated product names in german
   (e.g. "Bio Sp'gel 500g" -> "Bio Spargel 500g")
4. Ignore non-food items (cleaning products, toiletries)
5. Estimate quantity if not shown (default: 1)
6. Categorize each item by food group

STRICT RULES:
- NEVER invent items not visible on receipt
- ALWAYS flag uncertainty with "uncertain": true
- NEVER include prices in output (privacy)
- ALWAYS use standard product names (not abbreviated)
- If image is unreadable, return a clear error message
- Return JSON only, matching the given schema exactly
"""

# JSON-Schema, das Gemini erzwingen soll (structured output)
RECEIPT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "store": {"type": "STRING", "enum": ["Rewe", "Edeka", "Aldi", "Netto", "Norma", "Lidl", "Penny", "Kaufland", "unknown"]},
        "scan_quality": {"type": "STRING", "enum": ["good", "medium", "poor"]},
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


# ── 3. MAIN FUNCTION ─────────────────────────────────────────────────────────
def scan_receipt(image_path: str, max_retries: int = 3) -> dict:
    """
    Liest ein Kassenbon-Bild ein und gibt strukturierte Lebensmitteldaten zurück.
    Enthält Retry mit exponentiellem Backoff für Free-Tier-Rate-Limits (429).
    """
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}

    suffix = Path(image_path).suffix.lower()
    media_type = MEDIA_TYPE_MAP.get(suffix, "image/jpeg")

    print(f"📷  Scanning: {image_path}")
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    contents = [
        types.Part.from_bytes(data=image_bytes, mime_type=media_type),
        "Please scan this supermarket receipt. Extract all food items as JSON.",
    ]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=RECEIPT_SCHEMA,
        temperature=0.1,  # deterministisch, wichtig für Datenextraktion
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
            # 429 = Rate Limit (typisch im Free Tier) -> Backoff & Retry
            if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e):
                wait = 2 ** attempt
                print(f"⏳  Rate-Limit erreicht, warte {wait}s...")
                time.sleep(wait)
                continue
            return {"error": f"Gemini API error: {e}"}

        except json.JSONDecodeError:
            return {"error": "Antwort konnte nicht als JSON geparst werden."}

    return {"error": "Max. Wiederholungen erreicht (Rate Limit)."}


# ── 4. PRETTY PRINT HELPER ───────────────────────────────────────────────────
def print_result(result: dict) -> None:
    print("\n" + "─" * 50)
    if result.get("error"):
        print(f"❌  Error: {result['error']}")
        return

    print(f"🏪  Store:        {result.get('store', 'unknown')}")
    print(f"📊  Scan quality: {result.get('scan_quality', '?')}")
    print(f"🛒  Items found:  {result.get('items_count', len(result.get('items', [])))}")
    print()

    for item in result.get("items", []):
        flag = "⚠️ " if item.get("uncertain") else "✅ "
        menge = f"{item.get('quantity', '')} {item.get('unit', '')}".strip()
        print(f"{flag} {item['name']:<30} {menge:<10} [{item.get('category', '?')}]")

    ignored = result.get("non_food_items_ignored", [])
    if ignored:
        print(f"\n🚫  Non-food ignored: {', '.join(ignored)}")
    print("─" * 50)


# ── 5. STREAMLIT INTEGRATION (optional) ─────────────────────────────────────
def streamlit_receipt_upload():
    """In eine Streamlit-App einbaubar: Upload-Widget + automatischer Scan."""
    import tempfile

    import streamlit as st

    st.subheader("📷 Scan your grocery receipt")
    uploaded_file = st.file_uploader(
        "Upload a photo of your receipt",
        type=["jpg", "jpeg", "png", "webp"],
        help="Works with Rewe, Edeka, Aldi, Lidl, Penny receipts",
    )

    if uploaded_file is not None:
        st.image(uploaded_file, caption="Your receipt", width=300)

        with st.spinner("🔍 Scanning receipt with Gemini..."):
            suffix = Path(uploaded_file.name).suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(uploaded_file.getbuffer())
                tmp_path = tmp.name

            result = scan_receipt(tmp_path)
            os.remove(tmp_path)  # GDPR: sofort löschen

        if result.get("error"):
            st.error(f"❌ Scan failed: {result['error']}")
        else:
            st.success(f"✅ Found {result['items_count']} food items!")
            st.json(result)

        return result

    return None


# ── 6. RUN ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python receipt_scanner_gemini.py <path_to_receipt_image>")
        print("Example: python receipt_scanner_gemini.py rewe_receipt.jpg")
        sys.exit(1)

    image_path = sys.argv[1]
    result = scan_receipt(image_path)
    print_result(result)

    output_path = "receipt_output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n💾  Saved to: {output_path}")
