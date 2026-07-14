"""
One-off backfill for MATCH-3: re-match every receipt item that has no
persisted product link yet and write the outcome (products registry +
receipt_items.matched_product_id).

Items from before the registry shipped otherwise count against the
MATCH-4 coverage metric forever. Safe to re-run — items that already
have a link are skipped.

Usage (run from the repo root; needs Supabase config + network for OFF):
    python -m backend.app.scripts.backfill_matches
"""

from backend.app.db.supabase import get_all_receipt_items
from backend.app.services.nutrition_mapping import map_item
from backend.app.services.product_registry import persist_match_for_item


def main():
    items = [i for i in get_all_receipt_items() if not i.get("matched_product_id")]
    print(f"Backfilling {len(items)} unlinked receipt items...")

    linked = fallback = 0
    for idx, item in enumerate(items, 1):
        try:
            matched = map_item(item)
            if persist_match_for_item(item["id"], matched):
                linked += 1
            else:
                fallback += 1
        except Exception as e:  # noqa: BLE001 — keep going, report at the end
            fallback += 1
            print(f"  ! {item.get('normalized_name')!r}: {type(e).__name__}: {e}")
        if idx % 20 == 0 or idx == len(items):
            print(f"  ...{idx}/{len(items)} (linked {linked}, no-link {fallback})")

    print(f"Done: {linked} items linked to products, {fallback} left unlinked (fallback/none).")


if __name__ == "__main__":
    main()
