"""
Fallback category mapper (Task 2.3 / Story 2.2).

When OpenFoodFacts has no confident match for an item, we still keep the
pipeline moving by approximating nutrition from a coarse food category.
These are deliberately rough per-100g estimates and are always tagged
with low confidence so downstream trust/confidence labels stay honest.
"""

import re
from typing import Optional

from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues

# Confidence assigned to any category-based estimate.
FALLBACK_CONFIDENCE = 0.30

# Canonical categories -> rough per-100g nutrition (protein, fiber, sugar,
# kcal, NOVA-ish processed score). Intentionally approximate.
CATEGORY_NUTRITION = {
    "dairy":     NutritionValues(protein_g=6.0, fiber_g=0.0, sugar_g=5.0, calories_kcal=90, processed_score=2),
    "grain":     NutritionValues(protein_g=9.0, fiber_g=7.0, sugar_g=2.0, calories_kcal=340, processed_score=2),
    "vegetable": NutritionValues(protein_g=2.0, fiber_g=3.0, sugar_g=3.0, calories_kcal=40, processed_score=1),
    "fruit":     NutritionValues(protein_g=1.0, fiber_g=2.5, sugar_g=12.0, calories_kcal=60, processed_score=1),
    "protein":   NutritionValues(protein_g=20.0, fiber_g=0.0, sugar_g=0.0, calories_kcal=180, processed_score=2),
    "snack":     NutritionValues(protein_g=6.0, fiber_g=3.0, sugar_g=25.0, calories_kcal=470, processed_score=4),
    "drink":     NutritionValues(protein_g=0.0, fiber_g=0.0, sugar_g=9.0, calories_kcal=42, processed_score=4),
    "other":     NutritionValues(protein_g=3.0, fiber_g=1.0, sugar_g=5.0, calories_kcal=150, processed_score=3),
}

# German parser categories (and common terms) -> canonical category.
_GERMAN_CATEGORY_MAP = {
    "milchprodukte": "dairy",
    "milch": "dairy",
    "käse": "dairy",
    "joghurt": "dairy",
    "eier": "protein",
    "fleisch": "protein",
    "wurst": "protein",
    "fisch": "protein",
    "hülsenfrüchte": "protein",
    "obst": "fruit",
    "früchte": "fruit",
    "gemüse": "vegetable",
    "salat": "vegetable",
    "backwaren": "grain",
    "brot": "grain",
    "getreide": "grain",
    "nudeln": "grain",
    "reis": "grain",
    "süßwaren": "snack",
    "snacks": "snack",
    "knabberartikel": "snack",
    "getränke": "drink",
    "saft": "drink",
    "limonade": "drink",
}

# Keyword hints applied to the product name when the category is unknown.
_NAME_KEYWORDS = {
    "dairy": ["milch", "käse", "joghurt", "quark", "sahne", "butter"],
    "protein": ["ei", "eier", "hähnchen", "huhn", "rind", "schwein", "fisch", "lachs", "linsen", "bohnen", "tofu"],
    "fruit": ["apfel", "banane", "beere", "orange", "traube", "birne"],
    "vegetable": ["tomate", "gurke", "salat", "karotte", "möhre", "zwiebel", "paprika", "kartoffel"],
    "grain": ["brot", "brötchen", "haferflocken", "müsli", "nudel", "reis", "mehl"],
    "drink": ["cola", "saft", "wasser", "limo", "bier", "sprudel"],
    "snack": ["chips", "schokolade", "keks", "riegel", "gummi"],
}


def _canonical_category(category: Optional[str], name: str) -> str:
    """Resolve a canonical category from the parser category, then the name."""

    if category:
        cat = category.strip().lower()
        if cat in _GERMAN_CATEGORY_MAP:
            return _GERMAN_CATEGORY_MAP[cat]
        # partial contains match (e.g. "Bio Milchprodukte")
        for german, canonical in _GERMAN_CATEGORY_MAP.items():
            if german in cat:
                return canonical

    name_l = (name or "").lower()
    tokens = set(re.findall(r"[a-zäöüß]+", name_l))
    for canonical, keywords in _NAME_KEYWORDS.items():
        for kw in keywords:
            # Short keywords (e.g. "ei") only match a whole word, so they
            # don't fire inside unrelated words ("irgendein"). Longer
            # keywords may match as substrings to catch German compounds
            # ("milch" inside "vollmilch").
            if kw in tokens or (len(kw) >= 4 and kw in name_l):
                return canonical

    return "other"


def fallback_nutrition(name: str, category: Optional[str] = None) -> MatchedProduct:
    """
    Build a low-confidence, category-based MatchedProduct for an item
    that OpenFoodFacts could not match.
    """

    canonical = _canonical_category(category, name)
    nutrition = CATEGORY_NUTRITION.get(canonical, CATEGORY_NUTRITION["other"])

    return MatchedProduct(
        parsed_item_name=name,
        matched_name=None,
        off_id=None,
        fallback_category=canonical,
        match_type=MatchType.FALLBACK,
        confidence=FALLBACK_CONFIDENCE,
        data_source=f"fallback_category:{canonical}",
        nutrition=nutrition,
    )
