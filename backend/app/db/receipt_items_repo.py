from uuid import uuid4
from backend.app.db.supabase import supabase


def insert_receipt_items(receipt_id: str, parsed: dict):
    """
    Takes Gemini parsed receipt JSON and inserts rows into receipt_items table.
    """

    items = parsed.get("items", [])
    rows = []

    for item in items:
        rows.append({
            "id": str(uuid4()),
            "receipt_id": receipt_id,

            # ─────────────────────────────
            # Core NLP outputs
            # ─────────────────────────────
            "raw_name": item.get("original_text") or item.get("name"),
            "normalized_name": item.get("name"),

            # ─────────────────────────────
            # Quantitative data
            # ─────────────────────────────
            "quantity": item.get("quantity"),
            "unit": item.get("unit"),  # NEW

            # ─────────────────────────────
            # Semantic grouping
            # ─────────────────────────────
            "category": item.get("category"),  # NEW

            # ─────────────────────────────
            # Enrichment fields
            # ─────────────────────────────
            "price": item.get("price"),  # E3-S2: per-item price (EUR), when legible
            "matched_product_id": None,

            # ─────────────────────────────
            # Confidence signal
            # ─────────────────────────────
            "confidence": 0.5 if item.get("uncertain") else 0.9,
        })

    if not rows:
        return {"inserted": 0}

    result = supabase.table("receipt_items").insert(rows).execute()

    return {
        "inserted": len(rows),
        "data": result.data
    }