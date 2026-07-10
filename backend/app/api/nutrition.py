from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from backend.app.services.session import get_session_id
from backend.app.services.nutrition_snapshot import build_snapshot_from_db
from backend.app.db.supabase import get_profile
from backend.app.models.profile import Profile

router = APIRouter()


@router.get("/nutrition/snapshot")
def nutrition_snapshot(profile_id: Optional[str] = None, session_id: str = Depends(get_session_id)):
    """
    Aggregated nutrition snapshot + top gaps across this session's saved
    receipts (Epic 4, scoped per Story 8.3). Density-based, rule-driven,
    with a confidence label and the "estimated, not actual intake"
    disclaimer.

    `profile_id` is optional, same as /next-cart: when given, the
    protein reference/gap is personalized from that profile's
    weight/height/gender/activity (see nutrition_personalization.py);
    without one, the fixed density guideline is used, as before.
    """

    profile = None
    if profile_id is not None:
        row = get_profile(profile_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Profile not found.")
        profile = Profile.model_validate(row)

    snapshot = build_snapshot_from_db(session_id, user_profile=profile)
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )
    return {"session_id": session_id, **snapshot.model_dump()}
