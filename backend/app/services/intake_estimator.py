"""
Estimated daily nutrient intake from confirmed pantry consumption.

Deliberately built on ConsumptionEvents (services/pantry.py), not on
purchase quantity or an assumed "days this basket covers" — the
day-agnostic density model in nutrition_model.py exists precisely
because receipts alone don't carry that information (see
nutrition_personalization.py's docstring, backlog EXT-1/NUT-1). Here,
the user's own consume/remove confirmations supply the real per-day
signal instead of an assumption.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from pydantic import BaseModel

from backend.app.db.pantry_repo import get_pantry_items_by_user
from backend.app.models.snapshot import ConfidenceLevel
from backend.app.services.pantry import get_consumption_events
from backend.app.services.nutrition_mapping import map_items

DEFAULT_WINDOW_DAYS = 7

# Rough average edible weight (g) for unit-counted items ("Stk"), by
# fallback category — same "deliberately approximate" spirit as
# fallback_categories.CATEGORY_NUTRITION. Only used when a consumed
# quantity isn't already in a weight/volume unit.
_AVG_UNIT_WEIGHT_G = {
    "dairy": 150.0,
    "grain": 60.0,
    "vegetable": 100.0,
    "fruit": 120.0,
    "protein": 55.0,   # e.g. one egg
    "snack": 30.0,
    "drink": 250.0,
    "other": 80.0,
}
_DEFAULT_UNIT_WEIGHT_G = 80.0

_WEIGHT_UNITS_G = {"g": 1.0, "gramm": 1.0, "kg": 1000.0, "kilogramm": 1000.0}
_VOLUME_UNITS_G = {"ml": 1.0, "milliliter": 1.0, "l": 1000.0, "liter": 1000.0}


def _to_grams(quantity: float, unit: Optional[str], category: Optional[str]) -> float:
    unit_key = (unit or "").strip().lower()
    if unit_key in _WEIGHT_UNITS_G:
        return quantity * _WEIGHT_UNITS_G[unit_key]
    if unit_key in _VOLUME_UNITS_G:
        return quantity * _VOLUME_UNITS_G[unit_key]
    # Unit-counted ("Stk") or unknown unit -> approximate per-piece weight.
    per_unit = _AVG_UNIT_WEIGHT_G.get(category, _DEFAULT_UNIT_WEIGHT_G)
    return quantity * per_unit


class DailyIntakeEstimate(BaseModel):
    """Estimated average daily intake for one nutrient, over the
    confirmed-consumption window actually observed."""

    dimension: str
    daily_estimate: Optional[float] = None
    window_days: int
    events_considered: int
    confidence: ConfidenceLevel


def _confidence(events_considered: int, confirmed_names: int, total_names: int) -> ConfidenceLevel:
    """
    Trust in the estimate, driven by how much of the pantry has ever
    been confirmed (consumed or removed) rather than sitting untouched
    — an estimate built from 1 confirmed item out of 10 in the pantry
    is much shakier than one built from 8 out of 10.
    """

    if events_considered == 0:
        return ConfidenceLevel.LOW

    ratio = (confirmed_names / total_names) if total_names else 0.0
    if events_considered >= 5 and ratio >= 0.5:
        return ConfidenceLevel.HIGH
    if events_considered >= 2 and ratio >= 0.25:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def _estimate_daily_nutrient(
    user_id: str,
    dimension: str,
    nutrient_field: str,
    window_days: int = DEFAULT_WINDOW_DAYS,
    offset_days: int = 0,
) -> DailyIntakeEstimate:
    """
    Average daily intake of `nutrient_field` (a NutritionValues attribute,
    e.g. "iron_mg" or "protein_g") from this session's confirmed
    consumption in a `window_days`-long window. Shared by every
    absolute-gap nutrient (see estimate_daily_iron_mg/estimate_daily_protein_g
    below) — the per-100g-to-total math and confidence basis are identical,
    only which nutrient field is read differs.

    `offset_days` shifts the whole window that many days into the past
    (window ends at `now - offset_days` instead of `now`) — used by
    progress_tracker.py to compare "this week" (offset_days=0) against
    "the week before" (offset_days=window_days) without a second,
    parallel estimator.
    """

    window_end = datetime.now(timezone.utc) - timedelta(days=offset_days)
    window_start = window_end - timedelta(days=window_days)
    events = [
        e for e in get_consumption_events(user_id)
        if window_start <= _parse_ts(e.get("consumed_at")) < window_end
    ]

    if not events:
        pantry_items = get_pantry_items_by_user(user_id)
        return DailyIntakeEstimate(
            dimension=dimension,
            daily_estimate=None,
            window_days=window_days,
            events_considered=0,
            confidence=_confidence(0, 0, len(pantry_items)),
        )

    # Category + unit lookup from the pantry item itself — a
    # ConsumptionEvent only records the quantity confirmed, in whatever
    # unit that product is tracked in (see add_items_to_pantry).
    pantry_by_name = {
        item["normalized_name"]: item
        for item in get_pantry_items_by_user(user_id)
    }

    matched = map_items([
        {
            "normalized_name": e["normalized_name"],
            "category": pantry_by_name.get(e["normalized_name"], {}).get("category"),
        }
        for e in events
    ]).matched_products

    total = 0.0
    for event, product in zip(events, matched):
        value = getattr(product.nutrition, nutrient_field, None) if product.nutrition else None
        if value is None:
            continue
        pantry_item = pantry_by_name.get(event["normalized_name"], {})
        grams = _to_grams(
            event["quantity_consumed"],
            pantry_item.get("unit"),
            pantry_item.get("category"),
        )
        total += grams / 100.0 * value

    confirmed_names = len({e["normalized_name"] for e in events})
    pantry_items = get_pantry_items_by_user(user_id)

    return DailyIntakeEstimate(
        dimension=dimension,
        daily_estimate=round(total / window_days, 2),
        window_days=window_days,
        events_considered=len(events),
        confidence=_confidence(len(events), confirmed_names, len(pantry_items)),
    )


def estimate_daily_iron_mg(
    user_id: str, window_days: int = DEFAULT_WINDOW_DAYS, offset_days: int = 0
) -> DailyIntakeEstimate:
    """Average daily iron intake (mg/day) from confirmed consumption."""

    return _estimate_daily_nutrient(user_id, "iron", "iron_mg", window_days, offset_days)


def estimate_daily_protein_g(
    user_id: str, window_days: int = DEFAULT_WINDOW_DAYS, offset_days: int = 0
) -> DailyIntakeEstimate:
    """Average daily protein intake (g/day) from confirmed consumption."""

    return _estimate_daily_nutrient(user_id, "protein", "protein_g", window_days, offset_days)


def estimate_daily_calcium_mg(
    user_id: str, window_days: int = DEFAULT_WINDOW_DAYS, offset_days: int = 0
) -> DailyIntakeEstimate:
    """Average daily calcium intake (mg/day) from confirmed consumption."""

    return _estimate_daily_nutrient(user_id, "calcium", "calcium_mg", window_days, offset_days)


def estimate_daily_calories_kcal(
    user_id: str, window_days: int = DEFAULT_WINDOW_DAYS, offset_days: int = 0
) -> DailyIntakeEstimate:
    """Average daily calorie intake (kcal/day) from confirmed consumption."""

    return _estimate_daily_nutrient(user_id, "calories", "calories_kcal", window_days, offset_days)


def _parse_ts(value) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(value)
