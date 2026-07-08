from typing import Optional

from fastapi import APIRouter, HTTPException

from backend.app.db.supabase import get_profile
from backend.app.models.profile import Profile
from backend.app.services.nutrition_snapshot import build_snapshot_from_db
from backend.app.services.recommender import recommend_next_cart, default_profile

router = APIRouter()


@router.get("/next-cart")
def next_cart(profile_id: Optional[str] = None):
    """
    The single Next Cart recommendation (Epic 5), grounded in the
    aggregated gaps from Epic 4 across ALL saved receipts, and constrained
    by the given profile's dietary pattern + exclusions (Epic 3).

    profile_id is optional: without one, a neutral no-exclusions profile
    is used so the endpoint still works before onboarding is complete.
    """

    snapshot = build_snapshot_from_db()
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )

    profile = None
    if profile_id is not None:
        row = get_profile(profile_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Profile not found.")
        profile = Profile.model_validate(row)
    else:
        profile = default_profile()

    recommendation = recommend_next_cart(
        gaps=snapshot.gaps,
        profile=profile,
        confidence=snapshot.confidence,
    )
    return recommendation.model_dump()
