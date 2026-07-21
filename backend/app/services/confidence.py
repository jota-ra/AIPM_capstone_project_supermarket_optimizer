"""
Confidence tagging (Task 6.3 / Story 6.2).

Converts a raw OpenFoodFacts match (score + match type, from Epic 2's
matcher/fallback) into a plain low/medium/high label the user can act on.
Rule-based only, using the same thresholds the matcher itself already
applies, so a product's confidence tag never contradicts why it was
matched the way it was.
"""

from backend.app.models.nutrition import MatchedProduct, MatchType
from backend.app.models.snapshot import ConfidenceLevel
from backend.app.services.matcher import EXACT_THRESHOLD

# Fuzzy matches at or above this score are trusted enough to call
# "medium" rather than "low" -- covers both a strong direct fuzzy hit and
# a generalised produce match (capped at 0.7 by nutrition_mapping.py).
_MEDIUM_THRESHOLD = 0.65


def confidence_from_match(match_type: MatchType, score: float) -> ConfidenceLevel:
    """
    Tag a single match.

    - fallback / no match -> LOW (it's a category estimate, not real data)
    - exact match (score >= EXACT_THRESHOLD) -> HIGH
    - fuzzy match >= _MEDIUM_THRESHOLD -> MEDIUM
    - anything weaker -> LOW
    """

    if match_type in (MatchType.FALLBACK, MatchType.NONE):
        return ConfidenceLevel.LOW
    # A learned verified match (Tier-0) is confirmed data → always HIGH.
    if match_type == MatchType.LEARNED:
        return ConfidenceLevel.HIGH
    if match_type == MatchType.EXACT and score >= EXACT_THRESHOLD:
        return ConfidenceLevel.HIGH
    if score >= _MEDIUM_THRESHOLD:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def confidence_for_product(product: MatchedProduct) -> ConfidenceLevel:
    """Convenience wrapper: tag a MatchedProduct directly."""

    return confidence_from_match(product.match_type, product.confidence)
