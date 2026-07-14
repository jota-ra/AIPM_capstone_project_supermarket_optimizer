"""
Pantry / running stock service (Lager-Bestand).

The pantry is cumulative, not a rolling time-window snapshot: every
receipt upload adds to it, and it only shrinks through an explicit user
action — confirming actual consumption or marking an item as no longer
available (thrown out, never really there). That confirmation *is* the
real intake signal consumed by intake_estimator.py; nothing here infers
consumption from purchase quantity or elapsed time.
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from backend.app.db.pantry_repo import (
    get_pantry_items_by_user,
    get_pantry_item,
    upsert_pantry_item_quantity,
    update_pantry_item_fields,
    insert_consumption_event,
    get_consumption_events_by_user,
    get_consumption_events_by_user_and_date,
)
from backend.app.services.shelf_life import estimate_expiry, days_until_expiry
from backend.app.services.fallback_categories import _canonical_category, CATEGORY_NUTRITION


def add_items_to_pantry(user_id: str, items: List[dict]) -> None:
    """
    Add a freshly-parsed receipt's items to the session's running stock.

    `items` uses the same shape as receipt_items rows: normalized_name
    (or name), quantity, unit, category. Items with no name or a
    non-positive quantity are skipped (nothing to stock).

    Bug fix: this used to store the parser's raw category verbatim (e.g.
    German "Getränke", "Hülsenfrüchte") instead of running it through
    fallback_categories' canonical category mapping (dairy/grain/
    vegetable/fruit/protein/snack/drink/other). Every category-keyed
    lookup on a pantry item — intake_estimator.py's per-unit gram
    weights AND shelf_life.py's shelf-life table — silently fell back to
    their "other"/default entry for almost everything, since the raw
    category never matched their canonical keys.
    """

    for item in items:
        name = item.get("normalized_name") or item.get("name")
        quantity = item.get("quantity")
        if not name or not quantity or quantity <= 0:
            continue
        upsert_pantry_item_quantity(
            user_id,
            name,
            delta=float(quantity),
            unit=item.get("unit"),
            category=_canonical_category(item.get("category"), name),
        )


def _with_expiry(item: dict) -> dict:
    """Annotate a pantry row with an estimated expiry, computed fresh
    from last_replenished_at + category (see services/shelf_life.py) —
    never persisted, so it's always accurate as of "now"."""

    expiry = estimate_expiry(item.get("last_replenished_at"), item.get("category"))
    return {
        **item,
        "estimated_expiry": expiry.isoformat() if expiry else None,
        "days_until_expiry": days_until_expiry(item.get("last_replenished_at"), item.get("category")),
    }


def get_pantry(user_id: str) -> List[dict]:
    """Current running stock for a session, only items still in stock."""

    return [
        _with_expiry(item)
        for item in get_pantry_items_by_user(user_id)
        if item.get("quantity_available", 0) > 0
    ]


def confirm_consumption(
    user_id: str,
    normalized_name: str,
    quantity: float,
    consumed_at: Optional[str] = None,
) -> Optional[float]:
    """
    Record that `quantity` of `normalized_name` was actually eaten (a
    partial amount — e.g. 5 of 10 tomatoes, one glass of a 1L milk — is
    the normal case, not just "all of it"). This both logs the
    ConsumptionEvent (the real "Ist" data point) and reduces the
    pantry's running stock.

    `consumed_at` (ISO datetime) lets the Tages-Log retroactively log a
    past day instead of "just now" — omit it for the original
    real-time-confirmation behavior.

    Returns the quantity actually applied (clamped to what was on hand
    — see below), or None if the item isn't in this session's pantry at
    all — can't confirm consuming something never tracked as available.
    """

    existing = get_pantry_item(user_id, normalized_name)
    if existing is None:
        return None

    # Clamped to what's actually on hand: a typo'd or stale quantity
    # (more than `quantity_available`) would otherwise inflate the
    # intake estimate beyond what was ever in the pantry.
    quantity = min(quantity, existing["quantity_available"])
    insert_consumption_event(user_id, normalized_name, quantity, consumed_at)
    upsert_pantry_item_quantity(user_id, normalized_name, delta=-quantity)
    return quantity


def log_manual_consumption(
    user_id: str,
    name: str,
    quantity: float,
    unit: Optional[str] = None,
    category: Optional[str] = None,
    consumed_at: Optional[str] = None,
) -> float:
    """
    Log food eaten that never came from an uploaded receipt (e.g.
    restaurant food, a snack bought elsewhere) — the "Vollständigkeit"
    gap a pure pantry-only log can't cover.

    If `name` matches an existing pantry item, this behaves exactly like
    confirm_consumption (clamped, reduces stock) — a free-text entry for
    something already in stock is just a normal consumption confirmation,
    not a separate concept. Only when there's no matching pantry item does
    this log a standalone ConsumptionEvent with nothing to reduce.
    """

    existing = get_pantry_item(user_id, name)
    if existing is not None:
        applied = confirm_consumption(user_id, name, quantity, consumed_at)
        return applied if applied is not None else 0.0

    insert_consumption_event(user_id, name, quantity, consumed_at)
    return quantity


def mark_unavailable(user_id: str, normalized_name: str, quantity: float) -> Optional[float]:
    """
    Record that `quantity` of `normalized_name` is no longer available
    (thrown out, spoiled, etc.) WITHOUT it having been eaten — reduces
    the pantry but does not create a ConsumptionEvent, so it never
    contributes to the estimated daily intake. Same clamping (and same
    return shape) as confirm_consumption, for the same reason.
    """

    existing = get_pantry_item(user_id, normalized_name)
    if existing is None:
        return None

    quantity = min(quantity, existing["quantity_available"])
    upsert_pantry_item_quantity(user_id, normalized_name, delta=-quantity)
    return quantity


def update_pantry_item_metadata(
    user_id: str,
    normalized_name: str,
    unit: Optional[str] = None,
    category: Optional[str] = None,
) -> Optional[dict]:
    """
    Correct a pantry item's unit/category after the fact (Epic 12.3) —
    e.g. the OCR mis-categorized something, which would otherwise
    silently skew its shelf-life estimate (services/shelf_life.py) and
    gram-conversion (intake_estimator.py's per-unit weights). Only the
    fields actually provided are touched.

    `category`, if given, is expected to already be one of the 8
    canonical categories (dairy/grain/vegetable/fruit/protein/snack/
    drink/other) — the same set a correction UI would offer as a
    dropdown. Bug fix: this used to run the value through
    `_canonical_category`, which translates raw German parser text
    ("Gemüse") INTO a canonical category — passed an already-canonical
    English value like "vegetable", it doesn't match any of that
    function's (German) lookup keys and silently falls back to "other".
    An unrecognized value here falls back to "other" directly instead.

    Returns the updated fields dict, or None if the item doesn't exist.
    """

    existing = get_pantry_item(user_id, normalized_name)
    if existing is None:
        return None

    fields = {}
    if unit is not None:
        fields["unit"] = unit
    if category is not None:
        canonical = category.strip().lower()
        fields["category"] = canonical if canonical in CATEGORY_NUTRITION else "other"

    if not fields:
        return existing

    update_pantry_item_fields(user_id, normalized_name, fields)
    return {**existing, **fields}


def get_consumption_events(user_id: str) -> List[dict]:
    return get_consumption_events_by_user(user_id)


def get_consumption_log_for_date(user_id: str, log_date: date) -> List[dict]:
    """Every consumption event (pantry-based or manual) logged on
    `log_date` — the Tages-Log's per-day view."""

    return get_consumption_events_by_user_and_date(user_id, log_date)


def days_since_last_confirmation(user_id: str) -> Optional[int]:
    """
    Days since this session's most recent ConsumptionEvent — None if
    nothing has ever been confirmed. Used for the Epic 13.1 "you haven't
    logged in a while" in-app nudge; not tied to any email/push
    infrastructure (deliberately out of scope, see
    docs/architektur_entscheidungen.md).
    """

    events = get_consumption_events(user_id)
    if not events:
        return None

    latest = max(datetime.fromisoformat(e["consumed_at"]) for e in events if e.get("consumed_at"))
    return (datetime.now(timezone.utc) - latest).days
