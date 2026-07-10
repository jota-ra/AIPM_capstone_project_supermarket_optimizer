from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends

from backend.app.services.session import get_session_id
from backend.app.analytics.events import log_event
from backend.app.db.supabase import get_profile, create_recommendation_row
from backend.app.models.profile import Profile
from backend.app.services.nutrition_snapshot import build_snapshot_from_db
from backend.app.services.progress_tracker import compute_session_progress
from backend.app.services.recommender import recommend_next_cart, default_profile

router = APIRouter()


@router.get("/next-cart")
def next_cart(profile_id: Optional[str] = None, session_id: str = Depends(get_session_id)):
    """
    The single Next Cart recommendation (Epic 5), grounded in the
    aggregated gaps from Epic 4 across this session's saved receipts
    (scoped per Story 8.3), and constrained by the given profile's
    dietary pattern + exclusions (Epic 3).

    profile_id is optional: without one, a neutral no-exclusions profile
    is used so the endpoint still works before onboarding is complete.

    The computed recommendation is persisted (Task 8.5) so feedback
    (Task 8.2) has a stable `recommendation_id` to reference — otherwise
    "would you buy this?" would have nothing to point back to, since
    Next Cart is computed fresh on every call rather than stored ahead
    of time.
    """

    profile = None
    if profile_id is not None:
        row = get_profile(profile_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Profile not found.")
        profile = Profile.model_validate(row)
    else:
        profile = default_profile()

    # Profile loaded first (not after, as before) so its gaps and the
    # recommendation below use the same personalized protein reference —
    # see nutrition_personalization.py — instead of two different ones.
    snapshot = build_snapshot_from_db(session_id, user_profile=profile)
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )

    recommendation = recommend_next_cart(
        gaps=snapshot.gaps,
        profile=profile,
        confidence=snapshot.confidence,
    )
    # NutriWise Agent - modified: added for Progress Tracking (addendum).
    # has_history=False (not an error) when this session only has one
    # receipt so far, so Next Cart still works before any history exists.
    recommendation.progress = compute_session_progress(session_id)

    recommendation_id = str(uuid4())
    payload = recommendation.model_dump(mode="json")
    create_recommendation_row(recommendation_id, session_id, payload)
    log_event(
        "recommendation_viewed",
        {"recommendation_id": recommendation_id, "status": payload["status"], "action_type": payload["action_type"]},
        session_id,
    )

    return {"recommendation_id": recommendation_id, "session_id": session_id, **payload}
