from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from backend.app.models.snapshot import ConfidenceLevel
from backend.app.nutrition_model import DISCLAIMER


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
    # Story 6.3: always present, never optional to include in a response.
    disclaimer: str = DISCLAIMER
