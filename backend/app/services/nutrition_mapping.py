"""
Nutrition mapping orchestrator (Epic 2 glue).

Ties together the matcher (2.1/2.2), the category fallback (2.3), and the
match-quality logger (2.5) into one call. Given a receipt's items, it
produces the `MatchedProduct[]` + `MatchQuality` result that Epic 4
consumes to build the nutrition profile.

Item dicts are the shape stored in `receipt_items` (normalized_name,
category, ...) or the parser item shape (name, category). Both are handled.
"""

from typing import List, Dict

from backend.app.models.nutrition import (
    MatchedProduct,
    ReceiptMapping,
)
from backend.app.services import resolver
from backend.app.services.nutrition_profile import grams_for
from backend.app.analytics.match_quality import compute_match_quality

# Public re-export: the item-name helper lives in the resolver now, but
# build_bls_off_dataset.py and other callers import it from here.
_item_name = resolver._item_name

_MACRO_FIELDS = ("protein_g", "fat_g", "carbs_g", "saturated_fat_g", "fiber_g", "sugar_g", "calories_kcal")


def map_item(item: dict) -> MatchedProduct:
    """Resolve a single item to nutrition data via the tiered resolver
    (Epic 4): Tier-0 learned → OFF (+BLS bridge) → BLS whole-food →
    category fallback."""

    return resolver.resolve_item(item)


def compute_receipt_totals(items: List[dict], matched: List[MatchedProduct]) -> Dict[str, float]:
    """E4-S6: absolute per-receipt nutrient totals, each item's per-100g
    values scaled by its purchased grams. Micros are summed under their
    own keys alongside the macros/kcal."""

    totals: Dict[str, float] = {}
    for item, mp in zip(items, matched):
        if mp.nutrition is None:
            continue
        grams = grams_for(item.get("quantity"), item.get("unit"), item.get("category"), _item_name(item))
        factor = grams / 100.0
        for f in _MACRO_FIELDS:
            v = getattr(mp.nutrition, f)
            if v is not None:
                totals[f] = round(totals.get(f, 0.0) + v * factor, 2)
        for k, v in (mp.nutrition.micros or {}).items():
            totals[k] = round(totals.get(k, 0.0) + v * factor, 2)
    return totals


def map_items(items: List[dict]) -> ReceiptMapping:
    """Map every item, attach aggregate match-quality metrics and the
    per-receipt nutrition totals (E4-S6)."""

    matched_products = [map_item(item) for item in items]
    match_quality = compute_match_quality(matched_products)
    return ReceiptMapping(
        matched_products=matched_products,
        match_quality=match_quality,
        nutrition_totals=compute_receipt_totals(items, matched_products),
    )
