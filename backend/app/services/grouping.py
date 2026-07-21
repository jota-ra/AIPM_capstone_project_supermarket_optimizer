"""
Item health grouping (Epic 7-S4, BR-G1..G6).

Sorts each purchased item into Healthy / OK / Unhealthy by NOVA processing
level and sugar, with an honest grey "not enough data" bucket:

  red   = NOVA ≥ 4  OR  sugar ≥ 20 g/100g
  green = NOVA ≤ 2  AND sugar < 10 g/100g
  ok    = otherwise
  grey  = no nutrition at all (never guessed)                       (BR-G1..G4)

Missing NOVA (e.g. a BLS-only item) groups on sugar alone: green < 10,
red ≥ 20, else OK (BR-G6). Total sugar is the MVP proxy for added sugar
(BR-G5, Q4).
"""

from typing import List, Optional

from backend.app.models.nutrition import MatchedProduct

TIER_HEALTHY = "Healthy"
TIER_OK = "OK"
TIER_UNHEALTHY = "Unhealthy"
TIER_GREY = "not enough data"

_SUGAR_RED = 20.0
_SUGAR_GREEN = 10.0
_NOVA_RED = 4.0
_NOVA_GREEN = 2.0


def group_item(nova: Optional[float], sugar_g: Optional[float]) -> str:
    """Classify one item by NOVA + sugar/100g (BR-G1..G6)."""

    has_nova = nova is not None
    has_sugar = sugar_g is not None

    if not has_nova and not has_sugar:
        return TIER_GREY  # BR-G1: no nutrition → grey, never guessed

    if not has_nova:
        # BR-G6: sugar alone
        if sugar_g >= _SUGAR_RED:
            return TIER_UNHEALTHY
        if sugar_g < _SUGAR_GREEN:
            return TIER_HEALTHY
        return TIER_OK

    # NOVA present (sugar may or may not be)
    sugar = sugar_g if has_sugar else 0.0
    if nova >= _NOVA_RED or sugar >= _SUGAR_RED:
        return TIER_UNHEALTHY
    if nova <= _NOVA_GREEN and sugar < _SUGAR_GREEN:
        return TIER_HEALTHY
    return TIER_OK


def group_products(matched: List[MatchedProduct]) -> dict:
    """Group a basket's matched products into the three tiers + grey."""

    tiers = {TIER_HEALTHY: [], TIER_OK: [], TIER_UNHEALTHY: [], TIER_GREY: []}
    for mp in matched:
        nut = mp.nutrition
        nova = nut.processed_score if nut else None
        sugar = nut.sugar_g if nut else None
        tier = group_item(nova, sugar)
        tiers[tier].append({
            "name": mp.matched_name or mp.parsed_item_name,
            "nova": nova,
            "sugar_g": sugar,
            "source_tier": tier,
        })
    return tiers
