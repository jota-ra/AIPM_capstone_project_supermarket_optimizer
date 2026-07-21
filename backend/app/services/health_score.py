"""
Health Score: one composite "status quo" number + plain-language summary
for the top of the Results page.

Rule-based, built entirely from data Epic 4 (density dimensions) and the
absolute Bedarf-vs-Ist gaps already computed — nothing here fabricates a
new fact. A dimension flagged by BOTH systems (protein can be) is only
penalized once, using whichever signal is worse, so the same underlying
deficiency doesn't get double-counted.
"""

from typing import List, Tuple

from backend.app.models.absolute_gap import AbsoluteGap
from backend.app.models.health_score import HealthScore, HealthScoreLabel
from backend.app.models.snapshot import DimensionSnapshot
from backend.app.services import i18n

# Points deducted per flagged dimension at maximum severity (100%
# deviation from its reference); scaled down for smaller deviations.
# Chosen so a basket with everything flagged at max severity bottoms out
# well below 0 before clamping — a couple of real issues shouldn't
# already read as "poor".
_POINTS_PER_DIMENSION = 15.0

_SCORE_BANDS = [
    (80, HealthScoreLabel.GREAT),
    (60, HealthScoreLabel.GOOD),
    (40, HealthScoreLabel.NEEDS_IMPROVEMENT),
]


def _severity(ratio) -> float:
    """How far off the reference this is, 0 (spot on) to 1 (100%+ off)."""

    if ratio is None:
        return 0.0
    return min(abs(1.0 - ratio), 1.0)


def _label_for(value: int) -> HealthScoreLabel:
    for threshold, label in _SCORE_BANDS:
        if value >= threshold:
            return label
    return HealthScoreLabel.POOR


def _build_summary(flagged: List[Tuple[str, str]], lang: str = "en") -> str:
    if not flagged:
        return i18n.t(lang, "hs.balanced")

    low = [name for name, status in flagged if status == "low"]
    high = [name for name, status in flagged if status == "high"]

    if low and high:
        return i18n.t(lang, "hs.low_and_high",
                      low=i18n.join_nutrients(lang, low), high=i18n.join_nutrients(lang, high))
    if low:
        return i18n.t(lang, "hs.low_only", low=i18n.join_nutrients(lang, low))
    return i18n.t(lang, "hs.high_only", high=i18n.join_nutrients(lang, high))


def compute_health_score(
    dimensions: List[DimensionSnapshot], absolute_gaps: List[AbsoluteGap], lang: str = "en"
) -> HealthScore:
    """
    `dimensions` should be the full Epic 4 dimension list (fiber, protein,
    sugar, processed, calories) — using all of them, not just the top-3
    `gaps`, so a mild 4th issue outside the top 3 still counts toward the
    score. `absolute_gaps` are always "low" by construction (see
    absolute_gap_detector.py) and only added for dimensions the density
    check didn't already flag.
    """

    flagged: List[Tuple[str, str]] = []
    seen = set()
    deduction = 0.0

    for dim in dimensions:
        if dim.status not in ("low", "high"):
            continue
        deduction += _severity(dim.ratio) * _POINTS_PER_DIMENSION
        flagged.append((dim.dimension, dim.status))
        seen.add(dim.dimension)

    for gap in absolute_gaps:
        if gap.dimension in seen:
            continue
        deduction += _severity(gap.ratio) * _POINTS_PER_DIMENSION
        flagged.append((gap.dimension, gap.status.value))
        seen.add(gap.dimension)

    value = max(0, min(100, round(100 - deduction)))

    return HealthScore(
        value=value,
        label=_label_for(value),
        summary=_build_summary(flagged, lang),
    )
