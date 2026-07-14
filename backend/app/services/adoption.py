"""
Session-level adoption & nutrition-delta orchestration (Epic 8 v2
groundwork, Tasks 8.7/8.8).

Pulls a session's stored recommendations and receipts together and
applies the pure analytics/adoption_score.py + analytics/nutrition_delta.py
functions to them — kept separate so those stay unit-testable without a
DB, the same split services/nutrition_snapshot.py uses for Epic 4's pure
nutrition_model.py functions.
"""

from datetime import datetime
from typing import List

from backend.app.analytics.comparator import did_purchase_item
from backend.app.analytics.nutrition_delta import compute_nutrition_delta
from backend.app.models.analytics import AdoptionScore, NutritionDelta
from backend.app.services.nutrition_mapping import map_items
from backend.app.services.nutrition_profile import build_profile


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def compute_session_adoption(user_id: str) -> AdoptionScore:
    """
    For every "recommended" Next Cart shown to this session, check
    whether its item shows up in any receipt uploaded strictly AFTER
    that recommendation — i.e. did the user actually buy it next time,
    the MVP's core hypothesis metric.
    """

    from backend.app.db.supabase import (
        get_recommendations_by_user,
        get_receipts_by_user,
        get_receipt_items,
    )

    recommendations = get_recommendations_by_user(user_id)
    receipts = get_receipts_by_user(user_id)

    recommended_items: List[str] = []
    adopted_items: List[str] = []

    for rec in recommendations:
        payload = rec.get("payload") or {}
        item = payload.get("item")
        if payload.get("status") != "recommended" or not item:
            continue
        recommended_items.append(item)

        rec_time = _parse_timestamp(rec["created_at"])
        later_receipts = [
            r for r in receipts
            if r.get("created_at") and _parse_timestamp(r["created_at"]) > rec_time
        ]
        if any(did_purchase_item(item, get_receipt_items(r["id"])) for r in later_receipts):
            adopted_items.append(item)

    return AdoptionScore(
        recommended_count=len(recommended_items),
        adopted_count=len(adopted_items),
        adopted_items=adopted_items,
        adoption_score=(
            round(len(adopted_items) / len(recommended_items), 3) if recommended_items else 0.0
        ),
    )


def compute_session_nutrition_delta(user_id: str) -> NutritionDelta:
    """
    "before" = nutrition profile from only the session's first receipt.
    "after" = nutrition profile from every receipt uploaded so far.

    Shows how the basket's nutrition composition evolved across the
    session, not just whether one specific item was purchased.

    Raises ValueError if the session has no receipts yet.
    """

    from backend.app.db.supabase import get_receipts_by_user, get_receipt_items

    receipts = get_receipts_by_user(user_id)
    if not receipts:
        raise ValueError("No receipts for this session yet.")

    # get_receipts_by_user orders newest-first for display (Task 8.4);
    # "before" needs the session's oldest receipt, so re-sort locally.
    receipts_oldest_first = sorted(receipts, key=lambda r: r["created_at"])

    first_items = get_receipt_items(receipts_oldest_first[0]["id"])
    before_profile = build_profile(first_items, map_items(first_items).matched_products)

    all_items = [
        item
        for receipt in receipts_oldest_first
        for item in get_receipt_items(receipt["id"])
    ]
    after_profile = build_profile(all_items, map_items(all_items).matched_products)

    return compute_nutrition_delta(before_profile, after_profile)
