from fastapi import APIRouter, HTTPException

from backend.app.services.nutrition_snapshot import build_snapshot_from_db

router = APIRouter()


@router.get("/nutrition/snapshot")
def nutrition_snapshot():
    """
    Aggregated nutrition snapshot + top gaps across ALL saved receipts
    (Epic 4). Density-based, rule-driven, with a confidence label and the
    "estimated, not actual intake" disclaimer.
    """

    snapshot = build_snapshot_from_db()
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )
    return snapshot.model_dump()
