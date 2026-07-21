"""
Rough shelf-life estimation for pantry items — used to nudge "use this
before it goes bad" and to prefer the soonest-expiring match in
recommender.py's Lager-first logic.

Deliberately approximate, same spirit as fallback_categories.py's
per-category nutrition estimates: a single category-average shelf life
in days, not a per-product lookup. No new data source needed — anchored
on PantryItem.last_replenished_at (already recorded on every pantry
add/restock), not a receipt's actual purchase date.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

# Rough average shelf life (days) by category, from the moment an item
# was added/restocked in the pantry. A single product can deviate a lot
# from its category average — this is a coarse "expiring soon" signal,
# not food-safety guidance.
SHELF_LIFE_DAYS = {
    "dairy": 10,
    "grain": 180,
    "vegetable": 7,
    "fruit": 10,
    "protein": 4,
    "snack": 60,
    "drink": 30,
    "other": 14,
}
_DEFAULT_SHELF_LIFE_DAYS = SHELF_LIFE_DAYS["other"]

# "Expiring soon" nudges kick in within this many days of the estimate.
EXPIRING_SOON_WITHIN_DAYS = 2


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value)


def estimate_expiry(last_replenished_at: Optional[str], category: Optional[str]) -> Optional[datetime]:
    """Estimated expiry timestamp, or None if there's no replenish
    timestamp to anchor on (e.g. an item added before this field existed)."""

    replenished = _parse_ts(last_replenished_at)
    if replenished is None:
        return None

    shelf_life = SHELF_LIFE_DAYS.get(category, _DEFAULT_SHELF_LIFE_DAYS)
    return replenished + timedelta(days=shelf_life)


def days_until_expiry(last_replenished_at: Optional[str], category: Optional[str]) -> Optional[int]:
    """Days until the estimated expiry (negative = already past it), or
    None if it can't be estimated."""

    expiry = estimate_expiry(last_replenished_at, category)
    if expiry is None:
        return None

    delta = expiry - datetime.now(timezone.utc)
    return delta.days
