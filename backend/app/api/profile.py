from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends

from backend.app.services.auth import get_current_user
from backend.app.services.ideal_profile import compute_ideal_profile
from backend.app.db.supabase import (
    create_profile_row,
    get_profile,
    get_profile_by_user,
    delete_profile,
    update_profile_row,
)
from backend.app.models.profile import ProfileCreate, ProfileUpdate, Profile, Level2Submit

router = APIRouter()


def _profile_response(row: dict) -> dict:
    """
    Normalize a stored row (DB column is `id`) to the shape every profile
    endpoint uses (`profile_id`), matching the frontend's `Profile` type,
    and attach the computed Ideal Profile (E2) when the Level-1 biometrics
    are present — so completing onboarding immediately yields personalized
    targets (E1-S6 -> E2 handoff). `ideal_profile` is null until enough of
    the profile is filled in.
    """

    ideal = None
    try:
        profile = Profile.model_validate(row)
        ideal_obj = compute_ideal_profile(profile)
        ideal = ideal_obj.model_dump() if ideal_obj else None
    except Exception:
        # A legacy row saved under an older enum set shouldn't 500 a read;
        # personalization just stays off until the profile is re-saved.
        ideal = None

    return {
        "profile_id": row["id"],
        **{k: v for k, v in row.items() if k != "id"},
        "ideal_profile": ideal,
    }


def _assert_owner(row: dict, user_id: str) -> None:
    """Reject access to a profile owned by another user. A row with no
    user_id on record (legacy/pre-auth data) is treated as unowned and
    still accessible, matching the codebase's migration-window safety nets."""

    owner = row.get("user_id")
    if owner is not None and owner != user_id:
        raise HTTPException(status_code=403, detail="This profile belongs to a different user.")


@router.post("/profile")
def create_profile(profile: ProfileCreate, user_id: str = Depends(get_current_user)):
    """
    Create the authenticated user's Level-1 profile (E1-S5).

    Scoped to the caller's `user_id` (from the Supabase access token), so
    every downstream read (`/profile/me`, receipts, snapshot, next-cart)
    resolves to the right person. `profile_complete` on the body drives
    the resume-vs-dashboard decision at next login (E1-S6).
    """

    profile_id = str(uuid4())
    fields = profile.model_dump(mode="json")
    create_profile_row(profile_id, {**fields, "user_id": user_id})

    row = get_profile(profile_id) or {"id": profile_id, "user_id": user_id, **fields}
    return _profile_response(row)


@router.get("/profile/me")
def read_my_profile(user_id: str = Depends(get_current_user)):
    """
    The authenticated user's profile (E1-S6 resume). 404 means this user
    hasn't started onboarding yet — a normal state the frontend handles by
    starting the walk-through, not an error.
    """

    row = get_profile_by_user(user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No profile found for this user.")
    return _profile_response(row)


@router.get("/profile/{profile_id}")
def read_profile(profile_id: str, user_id: str = Depends(get_current_user)):
    """Fetch a stored profile (ownership-checked)."""

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    _assert_owner(row, user_id)
    return _profile_response(row)


@router.patch("/profile/{profile_id}")
def edit_profile(
    profile_id: str,
    updates: ProfileUpdate,
    user_id: str = Depends(get_current_user),
):
    """
    Edit a stored profile in place (profile summary / edit screen, and
    incremental saves during onboarding for resume — E1-S6).

    Only the fields present in the request body are touched
    (`exclude_unset`), so editing one answer never clobbers the rest.
    Changing any Level-1 field recomputes the Ideal Profile on the next
    read (R-RECALC, via `_profile_response`).
    """

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    _assert_owner(row, user_id)

    fields = updates.model_dump(mode="json", exclude_unset=True)
    if fields:
        update_profile_row(profile_id, fields)
        row = get_profile(profile_id)

    return _profile_response(row)


@router.post("/profile/{profile_id}/level2")
def submit_level2(
    profile_id: str,
    submission: Level2Submit,
    user_id: str = Depends(get_current_user),
):
    """
    Record Level-2 health-data consent + symptom answers (E9-S1/S2).

    Health data is GDPR Art. 9 special-category (BR-P1): the consent record
    (bool + server-stamped timestamp + consent-text version) is stored, and
    the symptom answers are persisted ONLY when consent is granted. A
    decline records consent=false and stores no answers — the app stays
    fully usable and all symptom multipliers stay 1.0 (BR-S4).
    """

    from datetime import datetime, timezone

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    _assert_owner(row, user_id)

    fields = {
        "consent_level2": submission.consent,
        "consent_at": datetime.now(timezone.utc).isoformat(),
        "consent_text_version": submission.consent_text_version,
    }
    if submission.consent:
        for f in ("l2_bowel_frequency", "l2_bloating", "l2_hunger", "l2_energy",
                  "l2_sleep", "l2_hydration", "l2_alcohol", "l2_muscle_soreness"):
            fields[f] = getattr(submission, f)

    update_profile_row(profile_id, fields)
    return _profile_response(get_profile(profile_id) or row)


@router.delete("/profile/{profile_id}")
def erase_profile(profile_id: str, user_id: str = Depends(get_current_user)):
    """
    Delete a single profile row (narrow operation, ownership-checked).

    For full GDPR erasure of the whole account, use `DELETE /account`
    (E12-S3) — this endpoint only removes the profile record itself.
    """

    row = get_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    _assert_owner(row, user_id)

    delete_profile(profile_id)
    return {"profile_id": profile_id, "deleted": True}


@router.get("/profile/me/export")
def export_my_data(user_id: str = Depends(get_current_user)):
    """
    E12-S2 / FR-12.4 / BR-P3: export the user's full record (profile, every
    receipt + its line items, and the derived ideal profile) as one JSON
    bundle. Read-only. The client offers it as a download.
    """

    from backend.app.services.account import export_user

    return export_user(user_id)


@router.delete("/account")
def delete_account(user_id: str = Depends(get_current_user)):
    """
    E12-S3 / FR-12.3 / BR-P3: hard cascade-delete ALL of the authenticated
    user's personal data — receipts + items + stored images, pantry,
    recommendations, feedback, analytics events, profile(s), and the user's
    verified-match votes — then delete the Supabase Auth user itself. The
    de-identified verified-match aggregate is retained (no personal data).
    The client signs out after this returns.
    """

    from backend.app.services.account import erase_user

    return erase_user(user_id)
