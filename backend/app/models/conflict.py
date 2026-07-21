from pydantic import BaseModel


class Conflict(BaseModel):
    """
    A purchased item that conflicts with the user's stated dietary
    pattern, an allergy, or a dislike (see services/conflict_detector.py).
    Surfaced so the user can confirm/clarify — never auto-changes the
    profile or the analysis on its own.
    """

    item: str
    blocked_by: str
    blocked_by_type: str  # "diet" | "allergy" | "dislike"
    message: str
