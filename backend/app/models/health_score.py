from enum import Enum

from pydantic import BaseModel


class HealthScoreLabel(str, Enum):
    GREAT = "great"
    GOOD = "good"
    NEEDS_IMPROVEMENT = "needs_improvement"
    POOR = "poor"


class HealthScore(BaseModel):
    """
    A single composite "how's your basket doing" number (Task: Status
    Quo / Health Score). Rule-based, derived entirely from already-
    computed dimension/gap data — no new facts, no ML, same anti-
    hallucination stance as gap_detector.py and recommender.py.
    """

    value: int  # 0-100
    label: HealthScoreLabel
    summary: str
