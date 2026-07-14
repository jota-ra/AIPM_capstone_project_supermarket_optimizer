from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from backend.app.models.analytics import ProgressReport
from backend.app.models.snapshot import ConfidenceLevel
from backend.app.nutrition_model import DISCLAIMER


class Recipe(BaseModel):
    """One recipe suggestion matched to a Next Cart item (MVP summary
    point 5, Should Have)."""

    title: str
    description: str
    prep_minutes: Optional[int] = None


class EasySwap(BaseModel):
    """
    One easy, low-effort addition/swap suggestion — cheap, quick, few
    ingredients, in season — as opposed to the single Next Cart pick
    above. Several of these can be shown together (see
    services/easy_swaps.py), unlike the one deliberate Next Cart choice.
    """

    item: str
    targets_gap: str
    cost: str  # "low" | "medium" | "high"
    rationale: str


class PantryMatch(BaseModel):
    """
    "Use what you already have" — a pantry item that already targets an
    open gap, shown ALONGSIDE (not instead of) the Next Cart purchase
    pick below, so the user can choose either (docs/architektur_entscheidungen.md,
    ToDo 2). `urgent` is set when the item is expiring soon or already
    past its estimated shelf life (services/shelf_life.py) — still
    suggested, never hidden, since "abgelaufen" doesn't mean "unusable",
    just "use it now or throw it out".
    """

    item: str
    targets_gap: str
    days_until_expiry: Optional[int] = None
    urgent: bool
    message: str


class ActionType(str, Enum):
    ADD = "add"
    REPLACE = "replace"
    REDUCE = "reduce"
    NONE = "none"  # nothing to recommend right now


class RecommendationStatus(str, Enum):
    RECOMMENDED = "recommended"                    # a specific item was chosen
    NO_GAPS = "no_gaps"                             # basket is balanced
    NO_SUITABLE_CANDIDATE = "no_suitable_candidate"  # every candidate conflicted with the profile


class EvaluatedCandidate(BaseModel):
    """
    One candidate the engine considered, for transparency (Story 5.3: the
    logic must be grounded and auditable, not a black box).
    """

    item: str
    targets_gap: str
    allowed: bool
    reason: Optional[str] = None  # set when blocked


class ScoredRecommendation(BaseModel):
    """One scored Next-Cart suggestion (E8, BR-S1)."""

    item: str
    action_type: ActionType
    targets_gap: str            # e.g. "protein:low"
    score: float
    severity: float
    goal_relevance: float
    rationale: Optional[str] = None


class StructuredNextCart(BaseModel):
    """E8 output structure (BR-S1): 1 primary + ≤2 alternatives + ≤2 reduce,
    or a no-suitable / no-gaps state."""

    status: RecommendationStatus
    primary: Optional[ScoredRecommendation] = None
    alternatives: List[ScoredRecommendation] = Field(default_factory=list)  # ≤2
    reduce: List[str] = Field(default_factory=list)                          # ≤2 red-tier item names
    message: str
    confidence: ConfidenceLevel
    evaluated_candidates: List[EvaluatedCandidate] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER


class NextCartRecommendation(BaseModel):
    """
    Output Formatter (Task 5.3): the single, UI-ready Next Cart result.

    Exactly one item is recommended per Story 5.1, or `status` explains
    why not (Story 5.2: say so rather than force a poor suggestion).
    """

    status: RecommendationStatus
    action_type: ActionType
    item: Optional[str] = None
    targets_gap: Optional[str] = None
    gap_status: Optional[str] = None  # "low" | "high"
    message: str
    reasoning: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None  # personalized "why this fits you" (Story 6.1)
    confidence: ConfidenceLevel
    evaluated_candidates: List[EvaluatedCandidate] = Field(default_factory=list)
    # Up to 3 recipes matched to `item` (MVP summary point 5, Should Have).
    recipes: List[Recipe] = Field(default_factory=list)
    # NutriWise Agent - modified: added for Progress Tracking (addendum).
    # None when the session doesn't have a prior receipt to compare against.
    progress: Optional[ProgressReport] = None
    # Story 6.3: always present, never optional to include in a response.
    disclaimer: str = DISCLAIMER
