"""
Absolute Nutrition Delta Calculator — the Bedarf-vs-Ist analog of
nutrition_delta.py. Compares two daily-intake-estimate windows (mg/day,
g/day — see intake_estimator.py) for the same nutrient, instead of two
receipts' density profiles. Kept as a separate, parallel calculator
(not folded into nutrition_delta.py) for the same reason AbsoluteGap is
kept separate from Gap: different units, different confidence basis,
built on confirmed ConsumptionEvents rather than receipt contents.
"""

from typing import Dict, List, Optional

from backend.app.models.analytics import DimensionDelta

# All three tracked absolute nutrients are deficiency-only today (no
# "too much" upper-bound nutrient like sodium is tracked) — more is
# always the improvement direction. Kept as a dict (not a bare constant)
# so a future upper-bound nutrient just adds a `False` entry here,
# mirroring nutrition_delta.py's _UP_IS_IMPROVEMENT.
_UP_IS_IMPROVEMENT = {
    "iron": True,
    "protein": True,
    "calcium": True,
}


def _direction(change: Optional[float]) -> str:
    if change is None:
        return "unknown"
    if abs(change) < 1e-9:
        return "flat"
    return "up" if change > 0 else "down"


def _is_improvement(dimension: str, direction: str) -> Optional[bool]:
    up_is_good = _UP_IS_IMPROVEMENT.get(dimension)
    if up_is_good is None or direction not in ("up", "down"):
        return None
    return (direction == "up") == up_is_good


def compute_absolute_deltas(
    before: Dict[str, Optional[float]], after: Dict[str, Optional[float]]
) -> List[DimensionDelta]:
    """
    `before`/`after` map dimension name -> daily estimate for that
    window (e.g. {"iron": 8.2, "protein": 45.0}), None where that
    window had no confirmed consumption to estimate from. Always
    returns one DimensionDelta per tracked nutrient (change/direction
    "unknown" when either side is None) — same convention as
    nutrition_delta.compute_nutrition_delta.
    """

    deltas = []
    for dimension in _UP_IS_IMPROVEMENT:
        before_value = before.get(dimension)
        after_value = after.get(dimension)
        change = (
            round(after_value - before_value, 2)
            if before_value is not None and after_value is not None
            else None
        )
        direction = _direction(change)
        deltas.append(DimensionDelta(
            dimension=dimension,
            before=before_value,
            after=after_value,
            change=change,
            direction=direction,
            is_improvement=_is_improvement(dimension, direction),
        ))
    return deltas
