from fastapi import APIRouter, HTTPException, Query

from backend.app.services import off_api, bls_matcher

router = APIRouter()


def _has_nutrition(protein, fiber, sugar, kcal) -> bool:
    # E5-S2 / FR-6.2: "has nutritional data" = at least one of
    # {kcal, protein, fat, carbs} present and numeric.
    return any(v is not None for v in (protein, fiber, sugar, kcal))


@router.get("/off/search")
def search_openfoodfacts(q: str = Query(..., min_length=2), limit: int = Query(8, ge=1, le=20)):
    """
    Direct OpenFoodFacts search for the review step (E5-S2): lets the user
    find the right product themselves when the automatic match is wrong,
    then pin it via POST /receipts/{id}/items/{item_id}/match.

    Only candidates that carry usable nutrition are returned (E5-S2): a
    name hit with all-null nutrition is useless downstream.
    """

    candidates = off_api.search_products(q, page_size=limit * 2)
    results = []
    for product in candidates:
        nutrition = off_api.extract_nutrition(product)
        if not _has_nutrition(nutrition.protein_g, nutrition.fiber_g, nutrition.sugar_g, nutrition.calories_kcal):
            continue
        results.append({
            "source": "off",
            "off_id": str(product.get("code")) if product.get("code") else None,
            "name": off_api.product_display_name(product) or "(unnamed product)",
            "brand": (product.get("brands") or "").split(",")[0].strip() or None,
            "nutrition": nutrition.model_dump(),
        })
        if len(results) >= limit:
            break

    return {"query": q, "results": results}


@router.get("/bls/search")
def search_bls(q: str = Query(..., min_length=2), limit: int = Query(8, ge=1, le=20)):
    """
    Direct BLS (German food-composition table) search for the review step
    (E5-S2). Generic whole foods with near-complete macros + micros; only
    nutrition-bearing rows are returned (top_records already enforces this).
    """

    results = []
    for rec in bls_matcher.top_records(q, limit=limit):
        nut = bls_matcher.record_nutrition(rec)
        results.append({
            "source": "bls",
            "bls_code": rec["code"],
            "name": rec["name_de"],
            "brand": None,
            "nutrition": nut,
        })
    return {"query": q, "results": results}
