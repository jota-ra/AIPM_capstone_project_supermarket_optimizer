from fastapi import APIRouter, HTTPException, Query

from backend.app.services import off_api

router = APIRouter()


@router.get("/off/search")
def search_openfoodfacts(q: str = Query(..., min_length=2), limit: int = Query(8, ge=1, le=20)):
    """
    Direct OpenFoodFacts search for the review step (REV-2): lets the
    user find the right product themselves when the automatic match is
    wrong, then pin it via POST /receipts/{id}/items/{item_id}/match.

    Returns slim candidates; ones without any usable nutrition are still
    listed (flagged) so the user understands why they'd be a poor pick.
    """

    candidates = off_api.search_products(q, page_size=limit)
    if not candidates:
        raise HTTPException(
            status_code=404,
            detail=f"OpenFoodFacts returned no products for '{q}'. "
                   "Try a shorter or more generic term.",
        )

    results = []
    for product in candidates:
        nutrition = off_api.extract_nutrition(product)
        has_nutrition = any(
            v is not None
            for v in (nutrition.protein_g, nutrition.fiber_g, nutrition.sugar_g, nutrition.calories_kcal)
        )
        results.append({
            "off_id": str(product.get("code")) if product.get("code") else None,
            "name": off_api.product_display_name(product) or "(unnamed product)",
            "brand": product.get("brands") or None,
            "has_nutrition": has_nutrition,
            "nutrition": nutrition.model_dump(),
        })

    return {"query": q, "results": results}
