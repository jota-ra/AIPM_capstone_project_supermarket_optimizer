from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field


class MatchType(str, Enum):
    """How a receipt item was resolved to nutrition data."""

    EXACT = "exact"        # high-confidence OpenFoodFacts match
    FUZZY = "fuzzy"        # OpenFoodFacts match via fuzzy name similarity
    FALLBACK = "fallback"  # no OFF match; approximated from a food category
    NONE = "none"          # could not be matched or categorised at all


class NutritionValues(BaseModel):
    """
    Per-100g nutrition for a single product (Task 2.4).

    All values optional because OpenFoodFacts data is frequently
    incomplete; downstream code must tolerate missing dimensions.
    processed_score follows the NOVA scale (1 = unprocessed, 4 = ultra).
    """

    protein_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    calories_kcal: Optional[float] = None
    processed_score: Optional[float] = None


class MatchedProduct(BaseModel):
    """
    The `MatchedProduct` contract (sprint plan Day-1 contract), produced
    by Epic 2 and consumed by Epic 4.

    Exactly one of `off_id` (OFF match) or `fallback_category`
    (category approximation) is expected to be set, except for
    match_type == NONE where both are null.
    """

    parsed_item_name: str
    matched_name: Optional[str] = None
    off_id: Optional[str] = None
    fallback_category: Optional[str] = None
    match_type: MatchType
    confidence: float = Field(ge=0.0, le=1.0)
    data_source: str
    nutrition: Optional[NutritionValues] = None


class MatchQuality(BaseModel):
    """
    Aggregate match quality for one receipt processing run (Task 2.5).

    match_rate = confident OFF matches / total (the ≥60% target).
    coverage_rate = (matches + fallbacks) / total, i.e. how many items
    ended up usable for the nutrition profile at all.
    """

    total_items: int
    matched_items: int
    fallback_items: int
    failed_items: int
    match_rate: float
    coverage_rate: float


class ReceiptMapping(BaseModel):
    """Full result of mapping one receipt's items to nutrition data."""

    matched_products: List[MatchedProduct]
    match_quality: MatchQuality
