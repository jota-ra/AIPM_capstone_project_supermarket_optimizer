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

from typing import Optional

from backend.app.analytics.nutrition_delta import compute_nutrition_delta
from backend.app.models.analytics import ProgressReport
from backend.app.models.snapshot import NutritionProfile
from backend.app.services.nutrition_mapping import map_items
from backend.app.services.nutrition_profile import build_profile

DISCLAIMER = "Based on estimated consumption from shopping habits only."

MESSAGES = {
    "improving": "Your nutrition profile looks better compared to your last receipt — keep it up.",
    "stable": "Your shopping habits look similar to last time — small changes add up over time.",
    "declining": "A few dimensions look lower than last time — your next receipt will show if it evens out.",
    "insufficient_data": "Upload another receipt next time you shop to start tracking your progress.",
}


def _no_history_report(receipts_compared: int = 1) -> ProgressReport:
    return ProgressReport(
        has_history=False,
        receipts_compared=receipts_compared,
        deltas=[],
        trend="insufficient_data",
        addressed_gap_improved=None,
        message=MESSAGES["insufficient_data"],
        disclaimer=DISCLAIMER,
    )


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


def _last_recommended_gap(session_id: str, before_receipt_created_at: Optional[str]) -> Optional[str]:
    """
    The `targets_gap` of the most recent "recommended" Next Cart shown
    before the receipt being compared, so we can say whether that
    specific recommendation actually landed.
    """

    from backend.app.db.supabase import get_recommendations_by_session

    recommendations = get_recommendations_by_session(session_id)  # oldest-first
    for rec in reversed(recommendations):  # walk newest-first to find the most recent match
        if before_receipt_created_at and rec.get("created_at", "") >= before_receipt_created_at:
            continue
        payload = rec.get("payload") or {}
        if payload.get("status") == "recommended" and payload.get("targets_gap"):
            return payload["targets_gap"]
    return None


def compute_session_progress(session_id: str) -> ProgressReport:
    """
    Compare this session's newest receipt against the one right before
    it. Returns has_history=False (not an error) when there's only one
    receipt so far — Progress Tracking is opt-in context, not a
    required part of the pipeline.
    """

    from backend.app.db.supabase import get_receipts_by_session

    receipts = get_receipts_by_session(session_id)  # newest-first (Task 8.4)
    if len(receipts) < 2:
        return _no_history_report(receipts_compared=len(receipts))

    current_receipt, previous_receipt, *_ = receipts

    current_profile = _build_receipt_profile(current_receipt["id"])
    previous_profile = _build_receipt_profile(previous_receipt["id"])

    delta = compute_nutrition_delta(before=previous_profile, after=current_profile)
    trend = _trend_from_deltas(delta.deltas)

    addressed_gap = _last_recommended_gap(session_id, current_receipt.get("created_at"))
    addressed_gap_improved = _addressed_gap_improved(delta.deltas, addressed_gap)

    return ProgressReport(
        has_history=True,
        receipts_compared=2,
        deltas=delta.deltas,
        trend=trend,
        addressed_gap_improved=addressed_gap_improved,
        message=MESSAGES[trend],
        disclaimer=DISCLAIMER,
    )
