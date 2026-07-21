from typing import Optional

from pydantic import BaseModel


class PantryItem(BaseModel):
    """
    One product's running stock for a session (Task: Lager/Bestand).

    Cumulative, not a time-window snapshot: every receipt upload adds to
    `quantity_available`; it only ever decreases via an explicit
    confirm-consumption or mark-unavailable action (services/pantry.py).
    """

    id: str
    user_id: str
    normalized_name: str
    quantity_available: float
    unit: Optional[str] = None
    category: Optional[str] = None
    last_replenished_at: Optional[str] = None
    # Computed on read from last_replenished_at + services/shelf_life.py's
    # category-average estimate — never persisted, always a fresh
    # approximation as of "now".
    estimated_expiry: Optional[str] = None
    days_until_expiry: Optional[int] = None


class ConsumptionEvent(BaseModel):
    """
    One user-confirmed consumption of a pantry item — the actual "Ist"
    signal for intake_estimator.py. Deliberately separate from
    PantryItem: being in stock isn't the same as having been eaten.
    """

    id: str
    user_id: str
    normalized_name: str
    quantity_consumed: float
    consumed_at: str
