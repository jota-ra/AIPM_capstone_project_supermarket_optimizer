from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends

from backend.app.services.auth import get_current_user
from backend.app.analytics.events import log_event
from backend.app.db.supabase import (
    get_recommendation,
    create_feedback_row,
    get_feedback_by_recommendation,
)
from backend.app.models.feedback import FeedbackCreate

router = APIRouter()


@router.post("/feedback")
def submit_feedback(feedback: FeedbackCreate, user_id: str = Depends(get_current_user)):
    """
    Record "Would you consider buying this next time?" (Story 8.1).

    Requires the recommendation to actually exist (Task 8.2: traceable,
    not floating free) — a typo'd or made-up recommendation_id is
    rejected rather than silently stored.

    Bug fix (1): this used to ignore create_feedback_row's return value
    and always report success, even when the write silently failed (the
    `feedback` table missing in an unmigrated environment). Now a failed
    write is reported as a real error instead of a false "saved".

    Bug fix (2): recommendation_id is echoed back in plaintext by
    GET /next-cart, so any session that obtained one (browser history,
    a shared screenshot, a leaked log line) could previously submit
    feedback attributed to another session's recommendation — polluting
    the exact signal Story 8.1 exists to measure (whether a real user
    would act on it). Now restricted to the session that received the
    recommendation, same as the GDPR delete endpoints' ownership check.
    """

    recommendation = get_recommendation(feedback.recommendation_id)
    if recommendation is None:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    owner_session_id = recommendation.get("user_id")
    if owner_session_id is not None and owner_session_id != user_id:
        raise HTTPException(status_code=403, detail="This recommendation belongs to a different session.")

    feedback_id = str(uuid4())
    fields = feedback.model_dump()
    stored = create_feedback_row(feedback_id, user_id, fields)
    if stored is None:
        raise HTTPException(
            status_code=503,
            detail="Feedback could not be saved right now. Please try again later.",
        )

    log_event(
        "feedback_submitted",
        {"recommendation_id": feedback.recommendation_id, "response": feedback.response.value},
        user_id,
    )

    return {"id": feedback_id, "user_id": user_id, **fields}


@router.get("/feedback/{recommendation_id}")
def list_feedback(recommendation_id: str):
    """All feedback recorded for one recommendation (mainly for verification)."""

    if get_recommendation(recommendation_id) is None:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    return {"recommendation_id": recommendation_id, "feedback": get_feedback_by_recommendation(recommendation_id)}
