"""
Recipe suggestions (MVP summary point 5 / Should Have): "Up to 3 matching
recipes for the recommended product."

A static, curated lookup keyed by the Next Cart item's exact name — the
same shape as Task 5.1's recommendation table (`data/recommendations.json`),
not a live external API or an LLM call. This keeps the same "no invented
facts" guarantee the rest of the recommendation pipeline relies on: a
recipe either exists in the table for this exact item, or none are
returned, rather than fabricating a plausible-sounding one or a fake URL.
"""

import json
from pathlib import Path
from typing import List, Optional

from backend.app.models.next_cart import Recipe

_RECIPES_PATH = Path(__file__).resolve().parents[1] / "data" / "recipes.json"


def _load_recipes() -> dict:
    """
    Bug fix: this used to have no error handling, and since it runs at
    import time (below), a missing/corrupted recipes.json would crash
    the entire app at startup — every route, not just recipe
    suggestions. A "should-have" garnish feature shouldn't be able to
    take down receipt upload; degrade to no recipes instead.
    """

    try:
        return json.loads(_RECIPES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[recipe_suggester] could not load recipes.json, recipe suggestions disabled: {e}")
        return {}


# Loaded once at import time: the table is static data, not a live resource.
RECIPES = _load_recipes()


def _localized_recipe(raw: dict, lang: str) -> Recipe:
    """Pick the German title/description (E13) when lang is 'de' and they
    exist, else the English originals. Extra `*_de` keys are ignored by the
    model, so we remap them onto `title`/`description` explicitly."""

    if str(lang).lower().startswith("de"):
        raw = {
            **raw,
            "title": raw.get("title_de") or raw.get("title"),
            "description": raw.get("description_de") or raw.get("description"),
        }
    return Recipe.model_validate(raw)


def suggest_recipes(item: Optional[str], lang: str = "en", limit: int = 3) -> List[Recipe]:
    """Up to `limit` recipes for `item`; empty if none are known or item is None."""

    if not item:
        return []
    return [_localized_recipe(r, lang) for r in RECIPES.get(item, [])[:limit]]


def suggest_recipes_from_pantry(pantry_item_names, gap, lang: str = "en", limit: int = 3) -> List[Recipe]:
    """
    "Cook with what you have": recipes buildable from items already in
    the pantry that also target `gap` (e.g. egg is in stock + an iron
    gap is open -> suggest an egg-based recipe from the iron candidate
    list, not a generic one). Only considers items that are BOTH a
    real recommendation candidate for this gap (data/recommendations.json)
    AND present in the pantry — same "no invented facts" guarantee as
    suggest_recipes(): a suggestion always traces back to a real
    recipes.json entry for a real, currently-available product.

    Imported here (not at module level) to avoid a recommender.py <->
    recipe_suggester.py import cycle, since recommender.py already
    imports suggest_recipes().
    """

    if not pantry_item_names:
        return []

    from backend.app.services.recommender import RECOMMENDATIONS

    normalized_pantry = {name.strip().lower() for name in pantry_item_names}
    candidates = RECOMMENDATIONS.get(f"{gap.dimension}:{gap.status.value}", [])

    recipes: List[Recipe] = []
    for candidate in candidates:
        if candidate["item"].strip().lower() not in normalized_pantry:
            continue
        recipes.extend(suggest_recipes(candidate["item"], lang, limit=limit - len(recipes)))
        if len(recipes) >= limit:
            break

    return recipes
