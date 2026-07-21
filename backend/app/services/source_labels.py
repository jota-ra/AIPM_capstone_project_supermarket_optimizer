"""
Data source labeling (Task 6.2 / Story 6.2).

Turns a MatchedProduct's internal `data_source` into a clean, user-facing
label. OpenFoodFacts-backed matches are already readable as-is; the only
one that needs prettifying is the raw fallback-category tag
("fallback_category:vegetable" -> "Estimated from category: vegetable").
"""

from backend.app.models.nutrition import MatchedProduct, MatchType
from backend.app.services import i18n


def source_label(product: MatchedProduct, lang: str = "en") -> str:
    if product.match_type == MatchType.FALLBACK:
        category = product.fallback_category or "general"
        return i18n.t(lang, "src.category", category=category)
    if product.match_type == MatchType.LEARNED:
        return i18n.t(lang, "src.verified")
    if product.match_type == MatchType.BLS:
        return product.data_source or i18n.t(lang, "src.bls")
    if product.match_type in (MatchType.EXACT, MatchType.FUZZY):
        # data_source already reflects OFF, or "OpenFoodFacts + BLS bridge (…)"
        return product.data_source or i18n.t(lang, "src.off")
    return i18n.t(lang, "src.none")
