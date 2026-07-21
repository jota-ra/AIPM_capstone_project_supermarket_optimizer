"""
Eaten / consumption feedback — Epic 10 (F10, FR-8, FR-11.7).

Closes the loop: the user tells us how much of a prior shop they actually
threw away, and that `waste_fraction` flows into the E6 status-quo rollup
(Σ item_nutrient × share × (1 − waste) ÷ consumption_days), sharpening gap
detection and the health score on the next analysis (BR-I1/I3/I5, BR-T3).

A/B (R-EATEN): each user is deterministically in variant A (prompted at the
next upload) or B (a card on the dashboard); the surfaces call the same two
endpoints here — only *where* the prompt appears differs. The frontend
gates each surface on the returned `variant`.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.services.auth import get_current_user
from backend.app.services.ab_assignment import assign_variant
from backend.app.analytics.events import log_event
from backend.app.db.supabase import (
    get_receipts_by_user,
    get_receipt_items,
    get_receipt_items_by_user,
    get_profile_by_user,
    set_receipt_item_waste,
)

router = APIRouter()


class ItemWaste(BaseModel):
    item_id: str
    waste_fraction: float = Field(ge=0.0, le=1.0)


class ConsumptionFeedback(BaseModel):
    """
    Feedback on one prior receipt. BR-I3: named items are reduced
    individually (`items`), otherwise a single fraction is applied uniformly
    across that receipt's items (`waste_fraction`). Provide exactly one.
    """

    receipt_id: str
    items: Optional[List[ItemWaste]] = None
    waste_fraction: Optional[float] = Field(default=None, ge=0.0, le=1.0)


def _prior_receipt(user_id: str) -> Optional[dict]:
    """The user's most recent receipt (newest-first from the DB). For
    variant A this is the receipt *before* the one being uploaded; for
    variant B it's simply the latest shop. None → no prompt (E10-S2)."""

    receipts = get_receipts_by_user(user_id)
    return receipts[0] if receipts else None


def _recompute_daily_intake(user_id: str) -> dict:
    """Convenience echo so the caller can show the loop closing immediately.
    Uses category-default windows; the authoritative recompute (with repeat-
    purchase refinement) happens on the next GET /nutrition/analysis."""

    from backend.app.services.nutrition_mapping import map_items
    from backend.app.services.status_quo import build_status_quo

    items = get_receipt_items_by_user(user_id)
    if not items:
        return {}
    matched = map_items(items).matched_products
    profile = get_profile_by_user(user_id)
    return build_status_quo(items, matched, profile).daily_intake


@router.get("/consumption/context")
def consumption_context(user_id: str = Depends(get_current_user)):
    """
    Everything a feedback surface needs: the user's sticky variant and the
    prior receipt to give feedback on (its items + any waste already set).
    `prior_receipt` is null when the user has no receipts yet — in which
    case variant A shows nothing (E10-S2 "no prior receipt → no prompt").
    """

    variant = assign_variant(user_id)
    receipt = _prior_receipt(user_id)

    prior = None
    if receipt is not None:
        rid = receipt["id"]
        items = get_receipt_items(rid)
        prior = {
            "receipt_id": rid,
            "store": receipt.get("store"),
            "purchase_date": receipt.get("purchase_date"),
            "uploaded_at": receipt.get("created_at"),
            "items": [
                {
                    "item_id": it["id"],
                    "name": it.get("normalized_name") or it.get("raw_name") or "",
                    "quantity": it.get("quantity"),
                    "unit": it.get("unit"),
                    "category": it.get("category"),
                    "waste_fraction": float(it.get("waste_fraction") or 0.0),
                }
                for it in items
            ],
        }

    return {"user_id": user_id, "variant": variant, "prior_receipt": prior}


@router.post("/consumption/feedback")
def submit_consumption_feedback(
    body: ConsumptionFeedback,
    user_id: str = Depends(get_current_user),
):
    """
    Record eaten-feedback for a prior receipt (E10-S4). "Thrown away" becomes
    the item's `waste_fraction`; eaten / still-have are non-waste (BR-I1).
    Writing it recomputes the status-quo on the next analysis automatically;
    we also echo the freshly recomputed daily intake here.
    """

    # Ownership: the receipt must belong to this user.
    if not any(r["id"] == body.receipt_id for r in get_receipts_by_user(user_id)):
        raise HTTPException(status_code=404, detail="Receipt not found for this user.")

    items = get_receipt_items(body.receipt_id)
    if not items:
        raise HTTPException(status_code=409, detail="Receipt has no items to give feedback on.")

    updated = 0
    if body.items is not None:
        valid_ids = {it["id"] for it in items}
        for iw in body.items:
            if iw.item_id in valid_ids:
                set_receipt_item_waste(iw.item_id, iw.waste_fraction)
                updated += 1
    elif body.waste_fraction is not None:
        # BR-I3 "else uniform": apply the one fraction across every item.
        for it in items:
            set_receipt_item_waste(it["id"], body.waste_fraction)
            updated += 1
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either per-item `items` or a uniform `waste_fraction`.",
        )

    # SM5 engagement metric (A/B completion rate).
    log_event(
        "consumption_feedback_submitted",
        {"receipt_id": body.receipt_id, "variant": assign_variant(user_id), "items_updated": updated},
        user_id,
    )

    return {
        "user_id": user_id,
        "receipt_id": body.receipt_id,
        "items_updated": updated,
        "daily_intake": _recompute_daily_intake(user_id),
    }
