import anthropic
import base64
import json
import os
from pathlib import Path
 
# ── 1. CLIENT ──────────────────────────────────────────────────────────────────
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from environment
 
# ── 2. SYSTEM PROMPT ───────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are the Receipt Scanner Agent for NutriWise.
You analyze photos of supermarket receipts and extract all purchased
food items in a clean, structured JSON format.
 
You are an expert at reading German supermarket receipts from
Rewe, Edeka, Aldi, Lidl, Penny, etc..
 
YOUR RESPONSIBILITIES:
1. Read the receipt image carefully
2. Identify ALL food and grocery items
3. Decode abbreviated product names
   (e.g. "Bio Sp'gel 500g" → "Bio Spinach 500g")
4. Ignore non-food items (cleaning products, toiletries)
5. Estimate quantity if not shown (default: 1)
6. Categorize each item by food group
 
STRICT RULES:
- NEVER invent items not visible on receipt
- ALWAYS flag uncertainty with "uncertain": true
- NEVER include prices in output (privacy)
- ALWAYS use standard product names (not abbreviated)
- If image is unreadable, return a clear error message
- Return JSON only — no markdown, no preamble
 
OUTPUT FORMAT:
{
  "store": "Rewe | Edeka | Aldi | Lidl | unknown",
  "scan_quality": "good | medium | poor",
  "items": [
    {
      "name": "Bio Spinach",
      "original_text": "Bio Sp'gel",
      "quantity": 1,
      "unit": "500g",
      "category": "vegetables",
      "uncertain": false
    }
  ],
  "non_food_items_ignored": ["Spülmittel"],
  "items_count": 0,
  "error": null
}
"""
 
# ── 3. HELPER: IMAGE → BASE64 ──────────────────────────────────────────────────
def encode_image(image_path: str) -> tuple[str, str]:
    """
    Reads an image file and returns (base64_string, media_type).
    Supports jpg, jpeg, png, webp.
    """
    suffix = Path(image_path).suffix.lower()
    media_type_map = {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".webp": "image/webp",
    }
    media_type = media_type_map.get(suffix, "image/jpeg")
 
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
 
    return image_data, media_type
 
 
# ── 4. MAIN FUNCTION ───────────────────────────────────────────────────────────
def scan_receipt(image_path: str) -> dict:
    """
    Main entry point.
    Pass the path to a receipt image → returns structured dict of food items.
    """
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}
 
    print(f"📷  Scanning: {image_path}")
    image_data, media_type = encode_image(image_path)
 
    # ── Claude Vision API call ─────────────────────────────────────────────────
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type":       "base64",
                            "media_type": media_type,
                            "data":       image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Please scan this supermarket receipt. "
                            "Extract all food items and return JSON only."
                        ),
                    },
                ],
            }
        ],
    )
 
    # ── Parse response ─────────────────────────────────────────────────────────
    raw_text = response.content[0].text
    clean_text = raw_text.replace("```json", "").replace("```", "").strip()
 
    result = json.loads(clean_text)
 
    # GDPR: delete temp file immediately if it was a temp upload
    # os.remove(image_path)  # ← uncomment when used in Streamlit upload flow
 
    return result
 
 
# ── 5. PRETTY PRINT HELPER ─────────────────────────────────────────────────────
def print_result(result: dict) -> None:
    print("\n" + "─" * 50)
    if result.get("error"):
        print(f"❌  Error: {result['error']}")
        return
 
    print(f"🏪  Store:        {result.get('store', 'unknown')}")
    print(f"📊  Scan quality: {result.get('scan_quality', '?')}")
    print(f"🛒  Items found:  {result.get('items_count', 0)}")
    print()
 
    for item in result.get("items", []):
        flag = "⚠️ " if item.get("uncertain") else "✅ "
        print(
            f"{flag} {item['name']:<30} "
            f"{str(item.get('quantity','')) + ' ' + str(item.get('unit','')):<10} "
            f"[{item.get('category', '?')}]"
        )
 
    ignored = result.get("non_food_items_ignored", [])
    if ignored:
        print(f"\n🚫  Non-food ignored: {', '.join(ignored)}")
    print("─" * 50)
 
 
# ── 6. STREAMLIT INTEGRATION (optional) ───────────────────────────────────────
def streamlit_receipt_upload():
    """
    Drop this function into your Streamlit app.
    Adds a file uploader widget and triggers the scan automatically.
    """
    import streamlit as st
    import tempfile
 
    st.subheader("📷 Scan your grocery receipt")
    uploaded_file = st.file_uploader(
        "Upload a photo of your receipt",
        type=["jpg", "jpeg", "png", "webp"],
        help="Works with Rewe, Edeka, Aldi, Lidl, Penny receipts",
    )
 
    if uploaded_file is not None:
        st.image(uploaded_file, caption="Your receipt", width=300)
 
        with st.spinner("🔍 Scanning receipt with Claude Vision..."):
            # Save to temp file
            suffix = Path(uploaded_file.name).suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(uploaded_file.getbuffer())
                tmp_path = tmp.name
 
            result = scan_receipt(tmp_path)
 
            # GDPR: delete immediately after scan
            os.remove(tmp_path)
 
        if result.get("error"):
            st.error(f"❌ Scan failed: {result['error']}")
        else:
            st.success(f"✅ Found {result['items_count']} food items!")
            st.json(result)
 
        return result
 
    return None
 
 
# ── 7. RUN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
 
    if len(sys.argv) < 2:
        print("Usage: python receipt_scanner.py <path_to_receipt_image>")
        print("Example: python receipt_scanner.py rewe_receipt.jpg")
        sys.exit(1)
 
    image_path = sys.argv[1]
    result = scan_receipt(image_path)
    print_result(result)
 
    # Optionally save JSON output
    output_path = "receipt_output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n💾  Saved to: {output_path}")