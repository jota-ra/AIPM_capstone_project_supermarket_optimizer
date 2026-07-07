"""
Fuzzy product matcher (Task 2.2).

Takes a (normalized) product string, searches OpenFoodFacts, and picks
the best candidate by name similarity. Returns a MatchedProduct with a
confidence score, or None when no candidate is similar enough — in which
case the caller falls back to category-based nutrition (Task 2.3).

Uses stdlib difflib for similarity, so there is no extra dependency.
"""

import re
from difflib import SequenceMatcher
from typing import Optional

from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues
from backend.app.services import off_api

# Similarity thresholds on a 0..1 scale.
EXACT_THRESHOLD = 0.90   # >= this -> treat as an exact match
FUZZY_THRESHOLD = 0.60   # >= this (and < exact) -> fuzzy match; below -> no match

# Score for a token that is contained in the other name (e.g. "joghurt"
# inside "naturjoghurt"): high, but capped below EXACT so a containment
# match is honestly labelled "fuzzy" rather than "exact".
_CONTAINMENT_SCORE = 0.85

_TOKEN_RE = re.compile(r"[a-zäöüß0-9]+")


def _tokens(s: str) -> list:
    return [t for t in _TOKEN_RE.findall(s.lower()) if len(t) >= 3]


def _similarity(query: str, candidate: str) -> float:
    """
    Similarity between a query and a candidate product name (0..1).

    Takes the best of a full-string ratio and a token-level score, so a
    short query still scores high against a long, verbose OFF product
    name ("Gouda" vs "Queso Gouda", "Naturjoghurt" vs "Joghurt mild ...").
    """

    q = (query or "").strip().lower()
    c = (candidate or "").strip().lower()
    if not q or not c:
        return 0.0

    best = SequenceMatcher(None, q, c).ratio()

    q_tokens = _tokens(q)
    c_tokens = _tokens(c)
    for qt in q_tokens:
        for ct in c_tokens:
            if len(qt) >= 4 and (qt in ct or ct in qt):
                best = max(best, _CONTAINMENT_SCORE)
            else:
                best = max(best, SequenceMatcher(None, qt, ct).ratio())

    return best


def _has_usable_nutrition(nutrition: NutritionValues) -> bool:
    """True if at least one real macro/energy value is present."""

    return any(
        v is not None
        for v in (
            nutrition.protein_g,
            nutrition.fiber_g,
            nutrition.sugar_g,
            nutrition.calories_kcal,
        )
    )


def match_product(
    name: str,
    page_size: int = 5,
    prefer_low_processed: bool = False,
) -> Optional[MatchedProduct]:
    """
    Resolve one product name to an OpenFoodFacts match.

    Only candidates that clear FUZZY_THRESHOLD *and* carry usable
    nutrition data are considered — a name match with all-null nutrition
    is not useful downstream, so it is rejected (caller then generalises
    or falls back to a category estimate).

    With prefer_low_processed=True (used when retrying a generalised
    produce term), the freshest candidate (lowest NOVA/processed score)
    is preferred over the highest name similarity, so "pfirsich" resolves
    to a fresh peach rather than a peach-flavoured yoghurt.

    Returns None when no candidate qualifies.
    """

    candidates = off_api.search_products(name, page_size=page_size)
    if not candidates:
        return None

    scored = []
    for product in candidates:
        score = _similarity(name, off_api.product_display_name(product))
        if score < FUZZY_THRESHOLD:
            continue
        nutrition = off_api.extract_nutrition(product)
        if not _has_usable_nutrition(nutrition):
            continue
        # When generalising a produce term, an ultra-processed hit (NOVA 4,
        # e.g. a cucumber spread for "Gurke") is a worse proxy than the
        # category estimate, so drop it and let the caller fall back.
        if (
            prefer_low_processed
            and nutrition.processed_score is not None
            and nutrition.processed_score >= 4
        ):
            continue
        scored.append((score, product, nutrition))

    if not scored:
        return None

    if prefer_low_processed:
        # Freshest first (missing processed score sorts last), then best name match.
        scored.sort(
            key=lambda t: (
                t[2].processed_score if t[2].processed_score is not None else 99,
                -t[0],
            )
        )
    else:
        scored.sort(key=lambda t: -t[0])

    best_score, best_product, best_nutrition = scored[0]
    match_type = MatchType.EXACT if best_score >= EXACT_THRESHOLD else MatchType.FUZZY

    return MatchedProduct(
        parsed_item_name=name,
        matched_name=off_api.product_display_name(best_product) or None,
        off_id=str(best_product.get("code")) if best_product.get("code") else None,
        fallback_category=None,
        match_type=match_type,
        confidence=round(best_score, 3),
        data_source="OpenFoodFacts",
        nutrition=best_nutrition,
    )
