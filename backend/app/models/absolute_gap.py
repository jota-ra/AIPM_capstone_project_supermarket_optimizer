from typing import Optional

from pydantic import BaseModel

from backend.app.models.snapshot import GapStatus, ConfidenceLevel


class AbsoluteGap(BaseModel):
    """
    A gap expressed in real daily units (e.g. mg/day), as opposed to the
    day-agnostic density Gap in models/snapshot.py. Kept as a separate
    model rather than folded into Gap: the two aren't comparable
    (different units, different confidence basis — pantry confirmation
    density here vs. OFF match rate there) and mixing them would make a
    "worst gap first" ranking meaningless.
    """

    dimension: str
    status: GapStatus
    daily_estimate: float
    daily_requirement: float
    ratio: float
    message: str
    confidence: ConfidenceLevel
