from supabase import create_client
from postgrest.exceptions import APIError

from backend.app.core.config import settings

supabase = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)

_MISSING_COLUMN_CODE = "PGRST204"
_MISSING_TABLE_CODE = "PGRST205"


def _insert_tolerant(table: str, record: dict):
    """
    Insert `record`, stripping any column Postgrest reports as missing
    and retrying.

    SAFETY NET, kept intentionally (not a "remove me" shim): the prod
    Supabase instance has run the Epic 8 migration in
    roadmap_consolidated.md, but any other environment (a teammate's
    local DB, a fresh clone, a future re-deploy) that hasn't yet would
    otherwise hard-500 on every receipt/profile write instead of Epic
    1/3's already-shipped flows degrading gracefully. It only ever
    silently drops `session_id` — until that environment is migrated,
    its requests just aren't session-scoped.
    """

    remaining = dict(record)
    for _ in range(len(record)):
        try:
            return supabase.table(table).insert(remaining).execute()
        except APIError as e:
            if e.code != _MISSING_COLUMN_CODE:
                raise
            missing = next(
                (key for key in remaining if f"'{key}' column" in (e.message or "")),
                None,
            )
            if missing is None:
                raise
            print(f"[db] '{table}.{missing}' column missing (migration pending?) — inserting without it")
            remaining.pop(missing)
    return supabase.table(table).insert(remaining).execute()


def _update_tolerant(table: str, record_id: str, fields: dict):
    """Same missing-column safety net as `_insert_tolerant`, for updates
    (profile editing) instead of inserts."""

    remaining = dict(fields)
    for _ in range(len(fields) or 1):
        try:
            return supabase.table(table).update(remaining).eq("id", record_id).execute()
        except APIError as e:
            if e.code != _MISSING_COLUMN_CODE:
                raise
            missing = next(
                (key for key in remaining if f"'{key}' column" in (e.message or "")),
                None,
            )
            if missing is None:
                raise
            print(f"[db] '{table}.{missing}' column missing (migration pending?) — updating without it")
            remaining.pop(missing)
    return supabase.table(table).update(remaining).eq("id", record_id).execute()


def create_receipt_row(receipt_id, file_name, file_type, storage_path, session_id=None, user_id=None):
    return _insert_tolerant("receipts", {
        "id": receipt_id,
        "user_id": user_id,
        "file_name": file_name,
        "file_type": file_type,
        "storage_path": storage_path,
        "status": "uploaded",
        "session_id": session_id,
    })


def get_receipts_by_session(session_id: str):
    """Every receipt uploaded in this session (Task 8.4), newest first."""

    result = (
        supabase.table("receipts")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def update_receipt_with_parse(receipt_id, parsed_data: dict):
    return supabase.table("receipts").update({
        "raw_text": parsed_data,
        "status": "processed",
    }).eq("id", receipt_id).execute()


def get_receipt(receipt_id):
    result = (
        supabase.table("receipts")
        .select("*")
        .eq("id", receipt_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_receipt_items(receipt_id):
    result = (
        supabase.table("receipt_items")
        .select("*")
        .eq("receipt_id", receipt_id)
        .execute()
    )
    return result.data


def get_all_receipt_items():
    """Every receipt item across all receipts (for aggregated analysis)."""
    result = supabase.table("receipt_items").select("*").execute()
    return result.data


UNDEFINED_COLUMN_CODE = "42703"


def get_receipt_items_by_session(session_id: str):
    """
    Every receipt item across this session's receipts only (Story 8.3
    groundwork). Used to scope the nutrition snapshot / Next Cart to one
    session instead of aggregating every receipt in the database.

    SAFETY NET, kept intentionally: if `receipts.session_id` doesn't
    exist in whichever environment is calling this (Epic 8 migration
    pending there), querying by it raises `42703 undefined_column`
    rather than the "missing column" schema-cache error inserts get, so
    it needs its own fallback here. Falling back to EVERY receipt
    restores the exact pre-Epic-8 behavior (the nutrition snapshot and
    Next Cart still work, just unscoped) instead of the core Results
    page 500ing or silently showing zero data.
    """

    try:
        receipts = get_receipts_by_session(session_id)
    except APIError as e:
        if e.code != UNDEFINED_COLUMN_CODE:
            raise
        print(f"[db] 'receipts.session_id' column missing (migration pending?) — falling back to ALL receipts, unscoped")
        return get_all_receipt_items()

    receipt_ids = [r["id"] for r in receipts]
    if not receipt_ids:
        return []

    result = (
        supabase.table("receipt_items")
        .select("*")
        .in_("receipt_id", receipt_ids)
        .execute()
    )
    return result.data


def update_receipt_item(item_id, fields: dict):
    return (
        supabase.table("receipt_items")
        .update(fields)
        .eq("id", item_id)
        .execute()
    )


def delete_receipt_items(receipt_id):
    return (
        supabase.table("receipt_items")
        .delete()
        .eq("receipt_id", receipt_id)
        .execute()
    )


def delete_receipt(receipt_id):
    """
    Hard-delete a receipt and its items (GDPR: user-initiated erasure,
    Story 7.3). Items are removed first since they reference the receipt.
    """

    delete_receipt_items(receipt_id)
    return (
        supabase.table("receipts")
        .delete()
        .eq("id", receipt_id)
        .execute()
    )


def create_profile_row(profile_id: str, fields: dict):
    return _insert_tolerant("profiles", {
        "id": profile_id,
        **fields,
    })


def get_profile(profile_id: str):
    result = (
        supabase.table("profiles")
        .select("*")
        .eq("id", profile_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def update_profile_row(profile_id: str, fields: dict):
    """Partial update — only the keys present in `fields` are touched."""

    return _update_tolerant("profiles", profile_id, fields)


def get_profile_by_session(session_id: str):
    """
    Most recently created profile tagged with this session_id (demo
    account picker groundwork — see api/profile.py's `/profile/by-session`).
    None if this session has never completed onboarding yet, which is a
    normal state (not an error): the caller creates a fresh profile under
    the same session_id in that case.
    """

    result = (
        supabase.table("profiles")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def delete_profile(profile_id: str):
    """Hard-delete a profile (GDPR: user-initiated erasure, Story 7.3)."""

    return (
        supabase.table("profiles")
        .delete()
        .eq("id", profile_id)
        .execute()
    )


def create_recommendation_row(recommendation_id: str, session_id: str, payload: dict):
    """
    Persist a computed Next Cart recommendation (Task 8.5), so feedback
    (Task 8.2) has something stable to reference by ID. `payload` is the
    full NextCartRecommendation dict, stored as-is; nothing is
    recomputed from it later, it's just the record of what was shown.

    SAFETY NET, kept intentionally: if the `recommendations` table
    doesn't exist in whichever environment is calling this, this logs
    and gives up quietly rather than 500ing the whole /next-cart
    response over a persistence side-effect — the recommendation is
    still returned to the caller, it just won't be findable by ID (so
    feedback on it will correctly 404) until that environment migrates.

    Only the "table doesn't exist" case (PGRST205) is tolerated here —
    bug fix: this used to catch every APIError, silently discarding real
    write failures (bad payload, RLS rejection, transient errors) as if
    they were the same "not migrated yet" case. Anything else re-raises.
    """

    try:
        return supabase.table("recommendations").insert({
            "id": recommendation_id,
            "session_id": session_id,
            "payload": payload,
        }).execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'recommendations' table missing (migration pending?) — recommendation not persisted")
        return None


def get_recommendation(recommendation_id: str):
    try:
        result = (
            supabase.table("recommendations")
            .select("*")
            .eq("id", recommendation_id)
            .limit(1)
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'recommendations' table missing (migration pending?) — treating lookup as not-found")
        return None
    return result.data[0] if result.data else None


def get_recommendations_by_session(session_id: str):
    """Every recommendation shown to this session (Task 8.8 groundwork), oldest first."""

    try:
        result = (
            supabase.table("recommendations")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'recommendations' table missing (migration pending?) — returning no recommendations")
        return []
    return result.data


def create_feedback_row(feedback_id: str, session_id: str, fields: dict):
    """
    Store one feedback response (Task 8.2), linked to its recommendation.

    SAFETY NET, kept intentionally: same tolerant-failure shim as
    create_recommendation_row, for the `feedback` table. Only PGRST205
    (table missing) is tolerated; every other error re-raises so a real
    write failure surfaces as a 500 instead of a silently-lost record —
    see the caller in api/feedback.py, which now checks this return
    value instead of assuming a truthy response.
    """

    try:
        return supabase.table("feedback").insert({
            "id": feedback_id,
            "session_id": session_id,
            **fields,
        }).execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'feedback' table missing (migration pending?) — feedback not persisted")
        return None


def get_feedback_by_recommendation(recommendation_id: str):
    try:
        result = (
            supabase.table("feedback")
            .select("*")
            .eq("recommendation_id", recommendation_id)
            .order("created_at", desc=True)
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'feedback' table missing (migration pending?) — returning no feedback")
        return []
    return result.data


def get_feedback_by_session(session_id: str):
    """Every feedback row this session has ever submitted (P1.1 groundwork, preference re-weighting)."""

    try:
        result = (
            supabase.table("feedback")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'feedback' table missing (migration pending?) — returning no feedback")
        return []
    return result.data