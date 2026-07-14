from uuid import uuid4
from datetime import date, datetime, timezone
from typing import Optional

from postgrest.exceptions import APIError

from backend.app.db.supabase import supabase, _MISSING_TABLE_CODE

_PANTRY_ITEMS_TABLE = "pantry_items"
_CONSUMPTION_EVENTS_TABLE = "pantry_consumption_events"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_pantry_items_by_user(user_id: str):
    """Current running stock for a session. [] if the table isn't
    migrated yet in this environment, matching the tolerant-failure
    pattern used elsewhere in db/supabase.py for optional tables."""

    try:
        result = (
            supabase.table(_PANTRY_ITEMS_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] '{_PANTRY_ITEMS_TABLE}' table missing (migration pending?) — returning empty pantry")
        return []
    return result.data


def get_pantry_item(user_id: str, normalized_name: str):
    items = get_pantry_items_by_user(user_id)
    return next((i for i in items if i["normalized_name"] == normalized_name), None)


def upsert_pantry_item_quantity(user_id: str, normalized_name: str, delta: float, unit=None, category=None):
    """
    Add `delta` (positive on replenish, negative on consume/remove) to
    the item's running stock, creating the row on first sight.
    """

    existing = get_pantry_item(user_id, normalized_name)

    if existing is None:
        row = {
            "id": str(uuid4()),
            "user_id": user_id,
            "normalized_name": normalized_name,
            "quantity_available": max(delta, 0.0),
            "unit": unit,
            "category": category,
            "last_replenished_at": _now_iso() if delta > 0 else None,
        }
        try:
            return supabase.table(_PANTRY_ITEMS_TABLE).insert(row).execute()
        except APIError as e:
            if e.code != _MISSING_TABLE_CODE:
                raise
            print(f"[db] '{_PANTRY_ITEMS_TABLE}' table missing (migration pending?) — pantry not persisted")
            return None

    new_quantity = max(existing["quantity_available"] + delta, 0.0)
    fields = {"quantity_available": new_quantity}
    if delta > 0:
        fields["last_replenished_at"] = _now_iso()

    try:
        return (
            supabase.table(_PANTRY_ITEMS_TABLE)
            .update(fields)
            .eq("id", existing["id"])
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] '{_PANTRY_ITEMS_TABLE}' table missing (migration pending?) — pantry not persisted")
        return None


def update_pantry_item_fields(user_id: str, normalized_name: str, fields: dict):
    """Partial update of a pantry row's own fields (unit/category) — for
    correcting OCR mis-categorization after the fact (Epic 12.3), not for
    quantity changes (see upsert_pantry_item_quantity for that)."""

    existing = get_pantry_item(user_id, normalized_name)
    if existing is None:
        return None

    try:
        return (
            supabase.table(_PANTRY_ITEMS_TABLE)
            .update(fields)
            .eq("id", existing["id"])
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] '{_PANTRY_ITEMS_TABLE}' table missing (migration pending?) — pantry not persisted")
        return None


def insert_consumption_event(
    user_id: str,
    normalized_name: str,
    quantity_consumed: float,
    consumed_at: Optional[str] = None,
):
    """`consumed_at` lets the Tages-Log retroactively log a past day
    instead of always stamping "now" — omit it for the original
    real-time-confirmation behavior."""

    row = {
        "id": str(uuid4()),
        "user_id": user_id,
        "normalized_name": normalized_name,
        "quantity_consumed": quantity_consumed,
        "consumed_at": consumed_at or _now_iso(),
    }
    try:
        return supabase.table(_CONSUMPTION_EVENTS_TABLE).insert(row).execute()
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] '{_CONSUMPTION_EVENTS_TABLE}' table missing (migration pending?) — consumption not persisted")
        return None


def get_consumption_events_by_user(user_id: str):
    try:
        result = (
            supabase.table(_CONSUMPTION_EVENTS_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("consumed_at")
            .execute()
        )
    except APIError as e:
        if e.code != _MISSING_TABLE_CODE:
            raise
        print(f"[db] '{_CONSUMPTION_EVENTS_TABLE}' table missing (migration pending?) — returning no consumption events")
        return []
    return result.data


def get_consumption_events_by_user_and_date(user_id: str, log_date: date):
    """Every consumption event (pantry-based or manual) whose consumed_at
    falls on `log_date` — the Tages-Log's per-day view. Filters in
    Python rather than in the query since consumed_at is a plain ISO
    string column, not a typed date/timestamp we can range-filter
    portably across the tolerant-table-missing path below."""

    events = get_consumption_events_by_user(user_id)
    return [
        e for e in events
        if e.get("consumed_at") and datetime.fromisoformat(e["consumed_at"]).date() == log_date
    ]
