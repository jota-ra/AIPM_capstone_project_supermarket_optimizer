from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends

from backend.app.services.session import get_session_id
from backend.app.db.supabase import (
    create_profile_row,
    get_profile,
    get_profile_by_session,
    delete_profile,
    update_profile_row,
)
from backend.app.models.profile import ProfileCreate, ProfileUpdate

router = APIRouter()


def _profile_response(row: dict) -> dict:
    """
    Normalize a stored row (DB column is `id`) to the shape every other
    profile endpoint uses (`profile_id`), so GET/PATCH match POST's
    response and the frontend's `Profile` type (which has `profile_id`,
    not `id`).
    """

    return {"profile_id": row["id"], **{k: v for k, v in row.items() if k != "id"}}


@router.post("/profile")
def create_profile(profile: ProfileCreate, session_id: str = Depends(get_session_id)):
    """
    Create a user profile (Story 3.1, extended for chat onboarding).

    Goal, eating style, allergies and exclusions (Story 3.2) are stored
    as-is for later use by the exclusion filter (Task 3.3) and the
    recommender (Epic 5).

    Tagged with `session_id` (Story 8.3) for consistency with receipts;
    nothing currently looks profiles up by session, but this keeps the
    door open without needing a schema change later.
    """

    profile_id = str(uuid4())
    fields = profile.model_dump(mode="json")
    create_profile_row(profile_id, {**fields, "session_id": session_id})

    return {"profile_id": profile_id, "session_id": session_id, **fields}


@router.get("/profile/by-session/{session_id}")
def read_profile_by_session(session_id: str):
    """
    The most recent profile created under a given session_id (demo
    account picker, see LandingStep/AccountPickerStep in the frontend) —
    lets a fixed, shared session_id ("Jennifer", "Stuart") resolve to
    whichever profile that identity last set up, without the frontend
    needing to remember a separate profile_id per demo account.

    404 just means this session hasn't onboarded yet, which is a normal,
    expected state (not an error) — the frontend falls back to onboarding.
    """

    row = get_profile_by_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No profile found for this session.")
    return _profile_response(row)


@router.get("/profile/{profile_id}")
def read_profile(profile_id: str):
    """Fetch a stored profile, e.g. to reuse across a session."""

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return _profile_response(row)


@router.patch("/profile/{profile_id}")
def edit_profile(
    profile_id: str,
    updates: ProfileUpdate,
    session_id: str = Depends(get_session_id),
):
    """
    Edit a stored profile in place (profile summary/edit screen) —
    users can revisit and change any answer from the chat onboarding.

    Only the fields present in the request body are touched
    (`exclude_unset`), so editing one answer never clobbers the rest.
    Same session-ownership rule as `erase_profile`.
    """

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")

    owner_session_id = row.get("session_id")
    if owner_session_id is not None and owner_session_id != session_id:
        raise HTTPException(status_code=403, detail="This profile belongs to a different session.")

    fields = updates.model_dump(mode="json", exclude_unset=True)
    if fields:
        update_profile_row(profile_id, fields)
        row = get_profile(profile_id)

    return _profile_response(row)


@router.delete("/profile/{profile_id}")
def erase_profile(profile_id: str, session_id: str = Depends(get_session_id)):
    """
    Permanently delete a profile (GDPR user-initiated erasure, Story 7.3).
    Hard delete, on request — no broader auth system exists to hang an
    automatic TTL off of.

    Restricted to the session that created the profile (bug fix: this
    used to delete by profile_id alone, so anyone who obtained an ID
    could erase another session's profile). A row with no session_id on
    record (pre-migration environment) is treated as unowned and still
    deletable, matching this codebase's other migration-window safety nets.
    """

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")

    owner_session_id = row.get("session_id")
    if owner_session_id is not None and owner_session_id != session_id:
        raise HTTPException(status_code=403, detail="This profile belongs to a different session.")

    delete_profile(profile_id)
    return {"profile_id": profile_id, "deleted": True}
