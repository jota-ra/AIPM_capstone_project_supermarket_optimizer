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
    Supabase instance has run the Epic 8 migration (backend/db/migrations/),
    but any other environment (a teammate's
    local DB, a fresh clone, a future re-deploy) that hasn't yet would
    otherwise hard-500 on every receipt/profile write instead of Epic
    1/3's already-shipped flows degrading gracefully. It only ever
    silently drops `user_id` — until that environment is migrated,
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


def create_receipt_row(receipt_id, file_name, file_type, storage_path, user_id=None):
    return _insert_tolerant("receipts", {
        "id": receipt_id,
        "user_id": user_id,
        "file_name": file_name,
        "file_type": file_type,
        "storage_path": storage_path,
        "status": "uploaded",
    })


def get_receipts_by_user(user_id: str):
    """Every receipt uploaded by this user (Task 8.4), newest first.

    E1 full-replacement: scoped by the authenticated `user_id` (was the
    anonymous user_id). Rows tagged only with a legacy user_id keep
    user_id = NULL and no longer surface ("leave old data behind")."""

    result = (
        supabase.table("receipts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def update_receipt_with_parse(receipt_id, parsed_data: dict):
    # `raw_text` keeps the full parsed JSON (store/date/items all live here,
    # so nothing is lost even on an unmigrated DB). `store`/`purchase_date`
    # are additionally promoted to dedicated columns for querying (E3-S2,
    # trends in E7) via the tolerant update, which drops them silently where
    # those columns don't exist yet.
    fields = {
        "raw_text": parsed_data,
        "status": "processed",
    }
    if isinstance(parsed_data, dict):
        if parsed_data.get("store"):
            fields["store"] = parsed_data["store"]
        if parsed_data.get("date"):
            fields["purchase_date"] = parsed_data["date"]
    return _update_tolerant("receipts", receipt_id, fields)


def clear_receipt_storage_path(receipt_id):
    """E12-S5 / BR-P4: null the storage_path once the raw image has been
    deleted post-processing. Tolerant so it degrades on an unmigrated DB."""

    return _update_tolerant("receipts", receipt_id, {"storage_path": None})


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


def get_receipt_items_by_user(user_id: str):
    """
    Every receipt item across this session's receipts only (Story 8.3
    groundwork). Used to scope the nutrition snapshot / Next Cart to one
    session instead of aggregating every receipt in the database.

    SAFETY NET, kept intentionally: if `receipts.user_id` doesn't
    exist in whichever environment is calling this (Epic 8 migration
    pending there), querying by it raises `42703 undefined_column`
    rather than the "missing column" schema-cache error inserts get, so
    it needs its own fallback here. Falling back to EVERY receipt
    restores the exact pre-Epic-8 behavior (the nutrition snapshot and
    Next Cart still work, just unscoped) instead of the core Results
    page 500ing or silently showing zero data.
    """

    try:
        receipts = get_receipts_by_user(user_id)
    except APIError as e:
        if e.code != UNDEFINED_COLUMN_CODE:
            raise
        print(f"[db] 'receipts.user_id' column missing (migration pending?) — falling back to ALL receipts, unscoped")
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


def set_receipt_item_waste(item_id: str, waste_fraction: float):
    """
    Persist a receipt item's eaten-feedback waste share (E10 / BR-I3).

    Uses the tolerant update so that, in an environment where the v12
    migration hasn't been run yet, the write degrades to a logged no-op
    (`receipt_items.waste_fraction` column missing) instead of 500ing the
    feedback flow — matching every other migration-window safety net here.
    Until that environment migrates, status-quo simply keeps treating waste
    as 0, which is exactly its pre-E10 behaviour.
    """

    return _update_tolerant("receipt_items", item_id, {"waste_fraction": waste_fraction})


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


def get_profile_by_user(user_id: str):
    """
    The authenticated user's profile (most recent if several exist) —
    used to resume onboarding or route straight to the dashboard on
    login (E1-S6). None if this user hasn't started onboarding yet, which
    is a normal state (not an error), not an error the caller should 500 on.
    """

    result = (
        supabase.table("profiles")
        .select("*")
        .eq("user_id", user_id)
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


# ── E12-S3 account-erasure helpers (delete all of a user's rows) ─────────
# Each is tolerant: a table/column that doesn't exist in this environment
# (migration pending) is skipped, not fatal — erasure must complete across
# whatever tables DO exist rather than aborting on the first gap.

def _delete_by(table: str, column: str, value: str):
    try:
        return supabase.table(table).delete().eq(column, value).execute()
    except APIError as e:
        if e.code not in (_MISSING_TABLE_CODE, _MISSING_COLUMN_CODE, UNDEFINED_COLUMN_CODE):
            raise
        print(f"[db] {table}.{column} missing (migration pending?) — skipping erase")
        return None


def delete_recommendations_by_user(user_id: str):
    return _delete_by("recommendations", "user_id", user_id)


def delete_feedback_by_user(user_id: str):
    return _delete_by("feedback", "user_id", user_id)


def delete_pantry_by_user(user_id: str):
    _delete_by("pantry_consumption_events", "user_id", user_id)
    return _delete_by("pantry_items", "user_id", user_id)


def delete_events_by_user(user_id: str):
    return _delete_by("events", "user_id", user_id)


def delete_profiles_by_user(user_id: str):
    return _delete_by("profiles", "user_id", user_id)


def delete_verified_votes_by_user(user_id: str):
    """E12-S3: remove only THIS user's vote rows. The de-identified
    aggregate (winner per key, computed from the remaining votes) is
    retained — other users' votes are never touched (BR-P3)."""

    return _delete_by("verified_matches", "user_id", user_id)


def delete_auth_user(user_id: str) -> bool:
    """Delete the Supabase Auth user itself (the login/email is personal
    data too — full GDPR erasure). Requires the service-role key, which is
    what this client is built with. Returns True on success."""

    try:
        supabase.auth.admin.delete_user(user_id)
        return True
    except Exception as e:  # noqa: BLE001 — report, don't crash the erasure
        print(f"[db] auth user delete failed for {user_id}: {e}")
        return False


def create_recommendation_row(recommendation_id: str, user_id: str, payload: dict):
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
            "user_id": user_id,
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


def get_recommendations_by_user(user_id: str):
    """Every recommendation shown to this session (Task 8.8 groundwork), oldest first."""

    try:
        result = (
            supabase.table("recommendations")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'recommendations' table missing (migration pending?) — returning no recommendations")
        return []
    return result.data


def create_feedback_row(feedback_id: str, user_id: str, fields: dict):
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
            "user_id": user_id,
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


def get_feedback_by_user(user_id: str):
    """Every feedback row this session has ever submitted (P1.1 groundwork, preference re-weighting)."""

    try:
        result = (
            supabase.table("feedback")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] 'feedback' table missing (migration pending?) — returning no feedback")
        return []
    return result.data

# ── Verified-match store (Epic 5, Tier-0) ────────────────────────────────
# Used only when the local JSON dev-store is off (services/verified_matches.py).
# All tolerant: an unmigrated DB degrades to "no learned matches" rather than
# 500-ing, matching every other flow's migration-window safety net.

def get_verified_votes(key: str):
    """Every vote row for a normalized match key (across stores)."""

    try:
        result = supabase.table("verified_matches").select("*").eq("key", key).execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        return []
    return result.data


def upsert_verified_vote(vote: dict):
    """Insert or replace this user's vote for (key, store, user_id).
    Requires a unique constraint on those three columns (see migration)."""

    try:
        return (
            supabase.table("verified_matches")
            .upsert(vote, on_conflict="key,store,user_id")
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print("[db] 'verified_matches' table missing (migration pending?) — vote dropped")
        return None


def log_no_match_row(entry: dict):
    """Increment the no-match frequency for (key, store), or insert it."""

    key, store = entry.get("key"), entry.get("store") or ""
    try:
        existing = (
            supabase.table("no_match_queue")
            .select("*").eq("key", key).eq("store", store).execute()
        ).data
        if existing:
            row = existing[0]
            return (
                supabase.table("no_match_queue")
                .update({"count": (row.get("count") or 1) + 1})
                .eq("id", row["id"]).execute()
            )
        return supabase.table("no_match_queue").insert({**entry, "count": 1}).execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print("[db] 'no_match_queue' table missing (migration pending?) — not logged")
        return None


# ── Learned non-food terms (E3-S4 follow-up) ─────────────────────────────
# Same tolerant-degrade pattern as verified_matches/no_match_queue above:
# an unmigrated DB just means nothing's been learned yet, not a 500.

def get_all_non_food_keys() -> list:
    """Every learned non-food key, for the upload-time filter pass."""

    try:
        result = supabase.table("non_food_terms").select("key").execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        return []
    return [row["key"] for row in result.data]


def upsert_non_food_term(key: str, raw_text: str):
    """Record (or bump the report count for) a learned non-food key."""

    from datetime import datetime, timezone

    try:
        existing = supabase.table("non_food_terms").select("*").eq("key", key).execute().data
        if existing:
            row = existing[0]
            return (
                supabase.table("non_food_terms")
                .update({
                    "raw_text": raw_text,
                    "times_reported": (row.get("times_reported") or 1) + 1,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", row["id"]).execute()
            )
        return supabase.table("non_food_terms").insert({
            "key": key, "raw_text": raw_text, "times_reported": 1,
        }).execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print("[db] 'non_food_terms' table missing (migration pending?) — not learned")
        return None
