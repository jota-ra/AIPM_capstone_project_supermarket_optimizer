"""
Status-quo profile & consumption model (Epic 6).

Estimates what the user actually consumes per day *from their receipts*
(BR-I1..I6) — distinct from the day-agnostic density snapshot
(nutrition_snapshot.py) and the confirmed-consumption estimator
(intake_estimator.py). This is the receipt-derived "status quo" that Epic 7
will compare against the E2 ideal profile.

Core formula (BR-I5):
    daily_intake[nutrient] = Σ (item_nutrient × share × (1 − waste)) ÷ item_consumption_days

where share is the household attribution (BR-I2), waste comes from
eaten-feedback (BR-I3, Epic 10 — 0 until then), and consumption_days is the
per-item window (consumption_timeframe.py). "Meals outside" and receipt
completeness DO NOT scale intake — they only discount confidence
(BR-I4/BR-C4). Pure/rule-based; the daily rollup is unit-testable offline.
"""

from typing import List, Optional, Dict

from pydantic import BaseModel, Field

from backend.app.models.nutrition import MatchedProduct
from backend.app.services.nutrition_profile import grams_for
from backend.app.services import consumption_timeframe as ctf

_MACRO_FIELDS = ("protein_g", "fat_g", "carbs_g", "saturated_fat_g", "fiber_g", "sugar_g", "calories_kcal")

# BR-I6 untracked-occasion share + BR-C4 meals-outside confidence discount.
_MEALS_OUTSIDE = {
    "never":     (0.00, 1.00),
    "rarely":    (0.05, 0.85),
    "sometimes": (0.20, 0.70),
    "often":     (0.40, 0.60),
    "daily":     (0.65, 0.60),
}
# BR-C4 receipts-completeness confidence discount.
_RECEIPTS_COMPLETE = {"all": 1.00, "most": 0.85, "some": 0.70, "few": 0.50}


def _attr(profile, name):
    """Read a field from a Profile model or a plain dict."""
    if profile is None:
        return None
    return getattr(profile, name, None) if not isinstance(profile, dict) else profile.get(name)


def user_share(profile) -> float:
    """BR-I2: not shared → 1.0; shared → 1/household_size (incl. user);
    an explicit user_share overrides. Defaults to 1.0 when unanswered."""

    override = _attr(profile, "user_share")
    if override is not None:
        return float(override)
    if not _attr(profile, "groceries_shared"):
        return 1.0
    n = _attr(profile, "household_size")
    return 1.0 / n if n and n >= 1 else 1.0


def external_intake_discount(profile) -> float:
    """BR-C4 / BR-I4: meals-outside × receipts-completeness — a confidence
    multiplier only, never applied to intake."""

    mo = _attr(profile, "meals_outside")
    mo = mo.value if hasattr(mo, "value") else mo
    rc = _attr(profile, "receipts_complete")
    rc = rc.value if hasattr(rc, "value") else rc
    meals_disc = _MEALS_OUTSIDE.get(mo, (0.0, 1.0))[1]
    receipts_disc = _RECEIPTS_COMPLETE.get(rc, 1.0)
    return round(meals_disc * receipts_disc, 3)


def occasion_coverage(profile) -> dict:
    """BR-I6: total occasions = meals + snacks; tracked = total × (1 −
    untracked_share) from the meals-outside answer. Does NOT scale intake."""

    meals = _attr(profile, "meals_per_day") or 0
    snacks = _attr(profile, "snacks_per_day") or 0
    total = meals + snacks
    mo = _attr(profile, "meals_outside")
    mo = mo.value if hasattr(mo, "value") else mo
    untracked = _MEALS_OUTSIDE.get(mo, (0.0, 1.0))[0]
    tracked = round(total * (1 - untracked), 1)
    return {
        "total_occasions": total,
        "tracked_occasions": tracked,
        "untracked_share": untracked,
    }


class StatusQuoProfile(BaseModel):
    """Receipt-derived estimated daily intake per nutrient (BR-I5) plus the
    attribution/coverage/confidence context that produced it."""

    daily_intake: Dict[str, float] = Field(default_factory=dict)
    user_share: float
    external_intake_discount: float
    coverage: dict
    items_considered: int


def build_status_quo(
    items: List[dict],
    matched: List[MatchedProduct],
    profile=None,
    purchase_dates_by_key: Optional[Dict[str, list]] = None,
) -> StatusQuoProfile:
    """
    BR-I5 daily rollup from receipt items + their matched nutrition.

    `purchase_dates_by_key` optionally maps a product key (matched_product_id
    or normalized name) to its purchase dates, enabling the BR-T2 repeat-
    purchase window refinement; without it, category defaults (BR-T1) apply.
    Per-item `waste_fraction` (BR-I3, Epic 10) defaults to 0.
    """

    share = user_share(profile)
    purchase_dates_by_key = purchase_dates_by_key or {}
    daily: Dict[str, float] = {}
    considered = 0

    for item, mp in zip(items, matched):
        if mp is None or mp.nutrition is None:
            continue
        name = item.get("normalized_name") or item.get("name") or item.get("raw_name") or ""
        category = item.get("category")
        grams = grams_for(item.get("quantity"), item.get("unit"), category, name)
        # BR-T2 repeat-purchase key = the product's normalized name (a stable
        # proxy for matched_product_id / raw_text+store across receipts).
        days = ctf.window_for(category, name, purchase_dates_by_key.get(name.lower()))
        waste = float(item.get("waste_fraction") or 0.0)
        # per-item daily contribution (BR-I5)
        factor = (grams / 100.0) * share * (1.0 - waste) / max(days, 1)
        considered += 1

        for f in _MACRO_FIELDS:
            v = getattr(mp.nutrition, f)
            if v is not None:
                daily[f] = round(daily.get(f, 0.0) + v * factor, 3)
        for k, v in (mp.nutrition.micros or {}).items():
            daily[k] = round(daily.get(k, 0.0) + v * factor, 3)

    return StatusQuoProfile(
        daily_intake=daily,
        user_share=round(share, 3),
        external_intake_discount=external_intake_discount(profile),
        coverage=occasion_coverage(profile),
        items_considered=considered,
    )
