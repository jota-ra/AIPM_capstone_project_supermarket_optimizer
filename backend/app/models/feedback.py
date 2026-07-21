from enum import Enum
from typing import Optional

from pydantic import BaseModel


class FeedbackResponse(str, Enum):
    """Story 8.1: one-tap feedback, no extra effort."""

    YES = "yes"
    NO = "no"
    MAYBE = "maybe"


class FeedbackCreate(BaseModel):
    """
    Input for "Would you consider buying this next time?" (Story 8.1).

    recommendation_id ties this back to the exact Next Cart output shown
    (Task 8.2), so feedback is traceable rather than floating free.
    """

    recommendation_id: str
    response: FeedbackResponse
    comment: Optional[str] = None


class Feedback(FeedbackCreate):
    """Stored feedback record (Task 8.2)."""

    id: str
    user_id: str
    created_at: Optional[str] = None
