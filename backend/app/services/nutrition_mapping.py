"""
Nutrition mapping orchestrator (Epic 2 glue).

Ties together the matcher (2.1/2.2), the category fallback (2.3), and the
match-quality logger (2.5) into one call. Given a receipt's items, it
produces the `MatchedProduct[]` + `MatchQuality` result that Epic 4
consumes to build the nutrition profile.

Item dicts are the shape stored in `receipt_items` (normalized_name,
category, ...) or the parser item shape (name, category). Both are handled.
"""

from typing import List

from backend.app.models.nutrition import (
    MatchedProduct,
    MatchType,
    ReceiptMapping,
)
from backend.app.services import matcher, fallback_categories, base_terms
from backend.app.analytics.match_quality import compute_match_quality

# Generalised (head-noun) matches are less precise than a direct hit, so
# their confidence is capped to keep the trust layer honest.
_GENERIC_CONFIDENCE_CAP = 0.7


def _item_name(item: dict) -> str:
    """Prefer the normalized/cleaned name, fall back to the raw name."""

    return (
        item.get("normalized_name")
        or item.get("name")
        or item.get("raw_name")
        or ""
    ).strip()


def map_item(item: dict) -> MatchedProduct:
    """Resolve a single item to nutrition data: OFF match, else fallback."""

    name = _item_name(item)
    category = item.get("category")

    if not name:
        return MatchedProduct(
            parsed_item_name="",
            match_type=MatchType.NONE,
            confidence=0.0,
            data_source="none",
            nutrition=None,
        )

    # Tier 1: match on the full normalized name.
    matched = matcher.match_product(name)
    if matched is not None:
        return matched

    # Tier 2: reduce a specific compound to its head noun and retry
    # ("Rispentomaten" -> "Tomate"), so we get real product nutrition
    # instead of a broad category estimate.
    generic = base_terms.generic_term(name)
    if generic:
        generic_match = matcher.match_product(generic, prefer_low_processed=True)
        if generic_match is not None:
            generic_match.parsed_item_name = name
            generic_match.match_type = MatchType.FUZZY
            generic_match.confidence = round(
                min(generic_match.confidence, _GENERIC_CONFIDENCE_CAP), 3
            )
            generic_match.data_source = f"OpenFoodFacts (generic: {generic})"
            return generic_match

    # Tier 3: no confident OFF match -> category-based approximation.
    return fallback_categories.fallback_nutrition(name, category)


def map_items(items: List[dict]) -> ReceiptMapping:
    """Map every item and attach aggregate match-quality metrics."""

    matched_products = [map_item(item) for item in items]
    match_quality = compute_match_quality(matched_products)
    return ReceiptMapping(
        matched_products=matched_products,
        match_quality=match_quality,
    )
