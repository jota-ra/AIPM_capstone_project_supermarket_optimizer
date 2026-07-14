"""
Product registry (MATCH-3): DB-backed persistence of match outcomes.

Epic 2 shipped stateless matching (recompute per request, cache OFF
responses in a local JSON file). This module commits to the DB-backed
design the schema always had waiting: every OpenFoodFacts match is
upserted into the `products` table (deduped by `off_id`) and the item's
`receipt_items.matched_product_id` points at it. That gives us:

  - a persistent registry of products actually seen in receipts
  - a stable FK that accuracy tracking (MATCH-4) can measure against
  - the ground-truth hook for manual corrections (REV-2)

Fails soft on purpose: match persistence is an enrichment side-effect,
never a reason for an upload to 500.
"""

from typing import List, Optional

from backend.app.models.nutrition import MatchedProduct, MatchType
from backend.app.db.supabase import (
    get_product_by_off_id,
    create_product_row,
    set_receipt_item_match,
)


def get_or_create_product(matched: MatchedProduct) -> Optional[str]:
    """Return the products-table id for this OFF match, creating the row
    on first sight. None when the match has no off_id to key on."""

    if not matched.off_id:
        return None

    existing = get_product_by_off_id(matched.off_id)
    if existing is not None:
        return existing["id"]

    nutrition = matched.nutrition.model_dump() if matched.nutrition else None
    return create_product_row(
        off_id=matched.off_id,
        name=matched.matched_name,
        brand=matched.brand,
        nutrition=nutrition,
    )


def persist_match_for_item(item_id: str, matched: MatchedProduct) -> Optional[str]:
    """
    Write one item's match outcome. OFF matches get a product row + FK;
    fallback/none clears the FK (an old link must not survive a rematch
    that no longer supports it).
    """

    product_id = None
    if matched.match_type in (MatchType.EXACT, MatchType.FUZZY):
        product_id = get_or_create_product(matched)
    set_receipt_item_match(item_id, product_id)
    return product_id


def persist_matches(item_rows: List[dict], matched: List[MatchedProduct]) -> int:
    """
    Persist match outcomes for freshly inserted receipt items (aligned by
    index, same convention as build_profile). Returns how many items got
    a product link. Any per-item failure is logged and skipped.
    """

    linked = 0
    for row, mp in zip(item_rows, matched):
        item_id = row.get("id")
        if not item_id:
            continue
        try:
            if persist_match_for_item(item_id, mp):
                linked += 1
        except Exception as e:  # noqa: BLE001 — enrichment must not break upload
            print(f"[product_registry] could not persist match for item {item_id}: {e}")
    return linked
