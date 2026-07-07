from uuid import uuid4

from fastapi import APIRouter, HTTPException

from backend.app.db.supabase import create_profile_row, get_profile
from backend.app.models.profile import ProfileCreate

router = APIRouter()


@router.post("/profile")
def create_profile(profile: ProfileCreate):
    """
    Create a lightweight user profile (Story 3.1).

    Only the 4 required fields (goal, age range, activity level, dietary
    pattern) plus optional exclusions are accepted — schema validation
    itself enforces the <=5 question budget. Dietary pattern and
    exclusions (Story 3.2) are stored as-is for later use by the
    exclusion filter (Task 3.3) and, eventually, the recommender (Epic 5).
    """

    profile_id = str(uuid4())
    fields = profile.model_dump()
    create_profile_row(profile_id, fields)

    return {"profile_id": profile_id, **fields}


@router.get("/profile/{profile_id}")
def read_profile(profile_id: str):
    """Fetch a stored profile, e.g. to reuse across a session."""

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return row
