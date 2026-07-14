from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import ValidationError

from backend.app.services.auth import get_current_user
from backend.app.services.nutrition_snapshot import build_snapshot_from_db
from backend.app.services.absolute_gap_detector import detect_absolute_gaps, has_sufficient_data
from backend.app.services.health_score import compute_health_score
from backend.app.services.conflict_detector import detect_conflicts
from backend.app.db.supabase import get_profile
from backend.app.models.profile import Profile

router = APIRouter()


@router.get("/nutrition/snapshot")
def nutrition_snapshot(profile_id: Optional[str] = None, user_id: str = Depends(get_current_user)):
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
        try:
            profile = Profile.model_validate(row)
        except ValidationError:
            # Bug fix: a profile row written under an older enum set
            # (e.g. "eat_healthier"/"25-34"/"moderate" from before the
            # chat onboarding's option strings were renamed) used to
            # 500 the entire Results page instead of just skipping
            # personalization. profile_id is optional everywhere it's
            # used precisely so this can degrade to the same behavior
            # as "no profile given" rather than hard-failing.
            print(f"[api] profile {profile_id} failed validation (stale schema?) — continuing without personalization")
            profile = None

    snapshot = build_snapshot_from_db(user_id, user_profile=profile)
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )

    # Absolute (Bedarf vs. Ist) gaps, e.g. iron — separate from the
    # density-based `gaps` above since they compare real daily units
    # against confirmed pantry consumption, not a receipt's basket
    # ratios. [] until the user has confirmed any consumption/removal.
    absolute_gaps = detect_absolute_gaps(user_id, profile)
    health_score = compute_health_score(snapshot.dimensions, absolute_gaps)

    # Purchased items that conflict with the profile (e.g. meat bought by
    # a self-described vegan) — [] without a profile to check against.
    # Never changes the profile or the analysis itself; just surfaced so
    # the user can clarify (see conflict_detector.py's docstring).
    conflicts = detect_conflicts(user_id, profile)

    return {
        "user_id": user_id,
        **snapshot.model_dump(),
        "absolute_gaps": [gap.model_dump() for gap in absolute_gaps],
        # Distinguishes "absolute_gaps is [] because nothing's been
        # confirmed yet" from "[] because everything's within range" —
        # otherwise both look identical to the frontend (Epic 11.1).
        "has_sufficient_data": has_sufficient_data(user_id),
        "health_score": health_score.model_dump(),
        "conflicts": [conflict.model_dump() for conflict in conflicts],
    }
