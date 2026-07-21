"""
Progress Tracking (integration briefing addendum).

Compares the session's most recent receipt's nutrition profile against
the receipt immediately before it, so a second upload can show whether
the diet is trending in a healthier direction. Deliberately built as a
thin orchestration layer over what Epic 8 v2 already computes —
analytics/nutrition_delta.py for the per-dimension comparison,
services/nutrition_profile.py + services/nutrition_mapping.py for
building a profile from one receipt's items — rather than a second,
parallel delta implementation.

No LLM call: trend + message are template-based, same anti-hallucination
stance as services/explainer.py.
"""

from typing import List, Optional

from backend.app.analytics.nutrition_delta import compute_nutrition_delta
from backend.app.analytics.absolute_nutrition_delta import compute_absolute_deltas
from backend.app.models.analytics import DimensionDelta, ProgressReport
from backend.app.models.snapshot import NutritionProfile
from backend.app.services.nutrition_mapping import map_items
from backend.app.services.nutrition_profile import build_profile
from backend.app.services.intake_estimator import (
    DEFAULT_WINDOW_DAYS,
    estimate_daily_iron_mg,
    estimate_daily_protein_g,
    estimate_daily_calcium_mg,
)
from backend.app.services import i18n

DISCLAIMER = "Based on estimated consumption from shopping habits only."

_ABSOLUTE_ESTIMATORS = {
    "iron": estimate_daily_iron_mg,
    "protein": estimate_daily_protein_g,
    "calcium": estimate_daily_calcium_mg,
}


def _no_history_report(receipts_compared: int = 1, absolute_deltas: Optional[List[DimensionDelta]] = None, lang: str = "en") -> ProgressReport:
    return ProgressReport(
        has_history=False,
        receipts_compared=receipts_compared,
        deltas=[],
        trend="insufficient_data",
        addressed_gap_improved=None,
        message=i18n.t(lang, "prog.insufficient_data"),
        disclaimer=i18n.t(lang, "prog.disclaimer"),
        absolute_deltas=absolute_deltas or [],
    )


def compute_absolute_progress(user_id: str) -> List[DimensionDelta]:
    """
    This week's (last DEFAULT_WINDOW_DAYS) estimated daily intake vs. the
    week before it, per absolute nutrient — independent of receipt count,
    since it's built from confirmed ConsumptionEvents (services/pantry.py)
    rather than receipts. Reuses each estimator's own `offset_days`
    instead of a second, parallel estimation path.
    """

    current = {}
    previous = {}
    for dimension, estimate_fn in _ABSOLUTE_ESTIMATORS.items():
        current[dimension] = estimate_fn(user_id).daily_estimate
        previous[dimension] = estimate_fn(user_id, offset_days=DEFAULT_WINDOW_DAYS).daily_estimate

    return compute_absolute_deltas(before=previous, after=current)


def _build_receipt_profile(receipt_id: str) -> NutritionProfile:
    from backend.app.db.supabase import get_receipt_items

    items = get_receipt_items(receipt_id)
    matched = map_items(items).matched_products
    return build_profile(items, matched)


def _trend_from_deltas(deltas) -> str:
    judged = [d.is_improvement for d in deltas if d.is_improvement is not None]
    if not judged:
        return "stable"
    improving = sum(1 for v in judged if v)
    declining = len(judged) - improving
    if improving > declining:
        return "improving"
    if declining > improving:
        return "declining"
    return "stable"


def _addressed_gap_improved(deltas, addressed_gap: Optional[str]) -> Optional[bool]:
    if not addressed_gap:
        return None
    for delta in deltas:
        if delta.dimension == addressed_gap:
            return delta.is_improvement
    return None


def _last_recommended_gap(user_id: str, before_receipt_created_at: Optional[str]) -> Optional[str]:
    """
    The `targets_gap` of the most recent "recommended" Next Cart shown
    before the receipt being compared, so we can say whether that
    specific recommendation actually landed.
    """

    from backend.app.db.supabase import get_recommendations_by_user

    recommendations = get_recommendations_by_user(user_id)  # oldest-first
    for rec in reversed(recommendations):  # walk newest-first to find the most recent match
        if before_receipt_created_at and rec.get("created_at", "") >= before_receipt_created_at:
            continue
        payload = rec.get("payload") or {}
        if payload.get("status") == "recommended" and payload.get("targets_gap"):
            return payload["targets_gap"]
    return None


def compute_session_progress(user_id: str, lang: str = "en") -> ProgressReport:
    """
    Compare this session's newest receipt against the one right before
    it. Returns has_history=False (not an error) when there's only one
    receipt so far — Progress Tracking is opt-in context, not a
    required part of the pipeline.

    `absolute_deltas` (iron/protein/calcium) are computed regardless of
    receipt count — they come from confirmed ConsumptionEvents over
    time, not from having a second receipt to compare against.
    """

    from backend.app.db.supabase import get_receipts_by_user

    absolute_deltas = compute_absolute_progress(user_id)

    receipts = get_receipts_by_user(user_id)  # newest-first (Task 8.4)
    if len(receipts) < 2:
        return _no_history_report(receipts_compared=len(receipts), absolute_deltas=absolute_deltas, lang=lang)

    current_receipt, previous_receipt, *_ = receipts

    current_profile = _build_receipt_profile(current_receipt["id"])
    previous_profile = _build_receipt_profile(previous_receipt["id"])

    delta = compute_nutrition_delta(before=previous_profile, after=current_profile)
    trend = _trend_from_deltas(delta.deltas)

    addressed_gap = _last_recommended_gap(user_id, current_receipt.get("created_at"))
    addressed_gap_improved = _addressed_gap_improved(delta.deltas, addressed_gap)

    return ProgressReport(
        absolute_deltas=absolute_deltas,
        has_history=True,
        receipts_compared=2,
        deltas=delta.deltas,
        trend=trend,
        addressed_gap_improved=addressed_gap_improved,
        message=i18n.t(lang, f"prog.{trend}"),
        disclaimer=i18n.t(lang, "prog.disclaimer"),
    )
