"""
Account-level GDPR operations (E12) — data export (BR-P3 portability) and
account erasure (BR-P3 right to erasure).

Both walk every table that holds a user's personal data. Export assembles
them into one JSON bundle; erasure hard-deletes them (plus the stored
receipt images and the Supabase Auth user), while deliberately RETAINING
the de-identified verified-match aggregate — only the user's own vote rows
are removed (BR-P3).

Erasure is best-effort per step (a missing/unmigrated table is skipped, a
storage hiccup on one image doesn't abort the rest) and returns a summary
of what happened, so a partial failure is visible rather than silent.
"""

from datetime import datetime, timezone
from typing import Optional

from backend.app.services import verified_matches
from backend.app.services.storage import delete_receipt_bytes
from backend.app.services.ideal_profile import compute_ideal_profile
from backend.app.models.profile import Profile
from backend.app.db.supabase import (
    get_profile_by_user,
    get_receipts_by_user,
    get_receipt_items,
    delete_receipt,
    delete_recommendations_by_user,
    delete_feedback_by_user,
    delete_pantry_by_user,
    delete_events_by_user,
    delete_profiles_by_user,
    delete_auth_user,
    get_recommendations_by_user,
)


def _safe(fn, *args, label: str = "", errors: Optional[list] = None):
    """Run a cleanup/read step, capturing (not raising) any failure so the
    rest of the operation still completes."""
    try:
        return fn(*args)
    except Exception as e:  # noqa: BLE001
        msg = f"{label or getattr(fn, '__name__', 'step')}: {type(e).__name__}: {e}"
        print(f"[account] {msg}")
        if errors is not None:
            errors.append(msg)
        return None


def export_user(user_id: str) -> dict:
    """
    E12-S2 / FR-12.4 / BR-P3 portability: the user's full record as one
    JSON-serializable bundle — profile, every receipt with its line items,
    and the derived ideal profile (E2). Read-only; never mutates anything.
    """

    profile_row = get_profile_by_user(user_id)

    receipts = _safe(get_receipts_by_user, user_id, label="receipts") or []
    receipts_out = []
    for r in receipts:
        items = _safe(get_receipt_items, r["id"], label="receipt_items") or []
        receipts_out.append({"receipt": r, "items": items})

    recommendations = _safe(get_recommendations_by_user, user_id, label="recommendations") or []

    # Derived profile (E2): recompute from the stored profile so the export
    # reflects exactly what the app would show, without persisting anything.
    ideal_profile = None
    if profile_row is not None:
        try:
            ideal = compute_ideal_profile(Profile.model_validate(profile_row))
            ideal_profile = ideal.model_dump() if ideal is not None else None
        except Exception:
            ideal_profile = None

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "profile": profile_row,
        "receipts": receipts_out,
        "recommendations": recommendations,
        "derived": {"ideal_profile": ideal_profile},
        "notice": (
            "Export of all personal data held for this account (GDPR Art. 15/20). "
            "The de-identified verified-match aggregate is global reference data and "
            "is not part of a personal export."
        ),
    }


def erase_user(user_id: str) -> dict:
    """
    E12-S3 / FR-12.3 / BR-P3 erasure: hard cascade-delete every piece of
    this user's personal data — receipts + line items + stored images,
    recommendations, feedback, pantry stock + consumption events, analytics
    events, the profile(s), the user's verified-match votes — and finally
    the Supabase Auth user. The de-identified verified-match aggregate is
    retained (only this user's votes are removed).

    Auth-user deletion is intentionally LAST: if it fails, the personal data
    is already gone (the part that matters), and the summary reports it so
    the caller can surface/retry.
    """

    errors: list = []

    # 1) Receipts: stored image (best-effort) + items + row, one at a time.
    receipts = _safe(get_receipts_by_user, user_id, label="receipts", errors=errors) or []
    receipts_deleted = 0
    for r in receipts:
        storage_path = r.get("storage_path")
        if storage_path:
            _safe(delete_receipt_bytes, storage_path, label="delete_image", errors=errors)
        if _safe(delete_receipt, r["id"], label="delete_receipt", errors=errors) is not None:
            receipts_deleted += 1

    # 2) Other per-user tables.
    _safe(delete_recommendations_by_user, user_id, label="recommendations", errors=errors)
    _safe(delete_feedback_by_user, user_id, label="feedback", errors=errors)
    _safe(delete_pantry_by_user, user_id, label="pantry", errors=errors)
    _safe(delete_events_by_user, user_id, label="events", errors=errors)

    # 3) Verified-match votes (aggregate retained — see verified_matches).
    votes_removed = _safe(verified_matches.delete_user_votes, user_id, label="votes", errors=errors)

    # 4) Profile row(s).
    _safe(delete_profiles_by_user, user_id, label="profiles", errors=errors)

    # 5) Auth user last (full erasure).
    auth_deleted = bool(_safe(delete_auth_user, user_id, label="auth_user", errors=errors))

    return {
        "user_id": user_id,
        "receipts_deleted": receipts_deleted,
        "verified_votes_removed": votes_removed or 0,
        "auth_user_deleted": auth_deleted,
        "errors": errors,
    }
