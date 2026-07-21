from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.services.auth import get_current_user
from backend.app.services.pantry import (
    get_pantry,
    confirm_consumption,
    mark_unavailable,
    log_manual_consumption,
    get_consumption_log_for_date,
    update_pantry_item_metadata,
    days_since_last_confirmation,
)
from backend.app.services.nutrition_mapping import map_item
from backend.app.models.nutrition import MatchType

router = APIRouter()


class PantryQuantity(BaseModel):
    quantity: float = Field(gt=0)
    # ISO datetime — lets the Tages-Log retroactively confirm a past day
    # instead of always meaning "just now". Omit for the original
    # real-time behavior.
    consumed_at: Optional[str] = None


class ManualLogEntry(BaseModel):
    name: str
    quantity: float = Field(gt=0)
    unit: Optional[str] = None
    category: Optional[str] = None
    consumed_at: Optional[str] = None


class PantryItemMetadata(BaseModel):
    unit: Optional[str] = None
    category: Optional[str] = None


@router.get("/pantry")
def read_pantry(user_id: str = Depends(get_current_user)):
    """
    Current running stock for this session — what's still in the
    pantry after every receipt upload and every consume/remove action
    so far. Used by the frontend to let the user confirm what's
    actually left before an intake estimate is computed.
    """

    return {
        "user_id": user_id,
        "items": get_pantry(user_id),
        # Epic 13.1: lets the frontend show a "you haven't logged in a
        # while" nudge — None if nothing's ever been confirmed.
        "days_since_last_confirmation": days_since_last_confirmation(user_id),
    }


@router.post("/pantry/items/{normalized_name}/consume")
def consume_pantry_item(
    normalized_name: str,
    body: PantryQuantity,
    user_id: str = Depends(get_current_user),
):
    """
    User confirms they actually ate `quantity` of this item. This is
    the real "Ist" signal for the intake estimate — it's not inferred
    from purchase quantity or time elapsed.
    """

    applied = confirm_consumption(user_id, normalized_name, body.quantity, body.consumed_at)
    if applied is None:
        raise HTTPException(
            status_code=404,
            detail="Item not found in this session's pantry.",
        )
    return {"user_id": user_id, "normalized_name": normalized_name, "consumed": applied}


@router.post("/pantry/items/{normalized_name}/remove")
def remove_pantry_item(
    normalized_name: str,
    body: PantryQuantity,
    user_id: str = Depends(get_current_user),
):
    """
    User marks `quantity` of this item as no longer available (thrown
    out, spoiled, etc.) without having eaten it — reduces the pantry but
    contributes nothing to the intake estimate.
    """

    applied = mark_unavailable(user_id, normalized_name, body.quantity)
    if applied is None:
        raise HTTPException(
            status_code=404,
            detail="Item not found in this session's pantry.",
        )
    return {"user_id": user_id, "normalized_name": normalized_name, "removed": applied}


@router.patch("/pantry/items/{normalized_name}")
def edit_pantry_item(
    normalized_name: str,
    body: PantryItemMetadata,
    user_id: str = Depends(get_current_user),
):
    """
    Correct a pantry item's unit/category after the fact (Epic 12.3) —
    e.g. the receipt OCR mis-categorized something, which would
    otherwise silently skew its shelf-life estimate and gram-conversion.
    Only fields provided in the body are changed.
    """

    updated = update_pantry_item_metadata(user_id, normalized_name, unit=body.unit, category=body.category)
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Item not found in this session's pantry.",
        )
    return {"user_id": user_id, "normalized_name": normalized_name, "item": updated}


@router.post("/pantry/log")
def log_food(body: ManualLogEntry, user_id: str = Depends(get_current_user)):
    """
    Tages-Log: log food eaten that may or may not be in the pantry.
    Matches an existing pantry item by name if one exists (behaves like
    a normal consume — reduces stock); otherwise logs a standalone
    entry, covering food that never came from an uploaded receipt
    (restaurant meals, snacks bought elsewhere, etc.).
    """

    applied = log_manual_consumption(
        user_id,
        body.name,
        body.quantity,
        unit=body.unit,
        category=body.category,
        consumed_at=body.consumed_at,
    )

    # Match-transparency (Epic 12.2): a real OFF/generic-name match vs. a
    # rough category fallback — surfaced so the user knows how reliable
    # this entry's nutrition contribution is, without affecting what got
    # logged above (read-only lookup, same pipeline receipts already use).
    matched_product = map_item({"normalized_name": body.name, "category": body.category})
    matched = matched_product.match_type in (MatchType.EXACT, MatchType.FUZZY)

    return {
        "user_id": user_id,
        "name": body.name,
        "logged": applied,
        "matched": matched,
    }


@router.get("/pantry/log")
def read_food_log(date: date, user_id: str = Depends(get_current_user)):
    """Everything logged (pantry-based or manual) on `date`
    (query param, YYYY-MM-DD), for the Tages-Log's per-day view."""

    return {
        "user_id": user_id,
        "date": date.isoformat(),
        "entries": get_consumption_log_for_date(user_id, date),
    }
