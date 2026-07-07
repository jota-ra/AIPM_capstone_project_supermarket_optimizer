from enum import Enum
from typing import Optional, List

from pydantic import BaseModel


class GapStatus(str, Enum):
    LOW = "low"
    HIGH = "high"


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class NutritionProfile(BaseModel):
    """
    Aggregated, density-based nutrition picture across all analysed items
    (Task 4.2). Values are day-agnostic ratios so they can be compared to
    standard references without knowing how many days the basket covers.
    """

    total_calories_kcal: float
    total_grams: float
    fiber_per_1000kcal: Optional[float] = None
    protein_per_1000kcal: Optional[float] = None
    sugar_pct_energy: Optional[float] = None
    processed_avg: Optional[float] = None

    items_total: int
    items_with_nutrition: int
    items_matched: int   # exact or fuzzy OFF match
    items_fallback: int  # category estimate


class DimensionSnapshot(BaseModel):
    """One row of the snapshot for display (Story 4.1)."""

    dimension: str
    value: Optional[float] = None
    unit: str
    reference: Optional[float] = None
    ratio: Optional[float] = None      # value / reference, for a progress bar
    status: str                        # "low" | "ok" | "high" | "info"
    what_this_means: str


class Gap(BaseModel):
    """A single detected gap vs a baseline (Story 4.2)."""

    dimension: str
    status: GapStatus
    current_value: float
    reference_value: float
    message: str
    confidence: ConfidenceLevel


class NutritionSnapshot(BaseModel):
    """Full Epic 4 output: snapshot + top gaps + uncertainty framing."""

    receipts_analyzed: int
    items_analyzed: int
    profile: NutritionProfile
    dimensions: List[DimensionSnapshot]
    gaps: List[Gap]
    confidence: ConfidenceLevel
    disclaimer: str
