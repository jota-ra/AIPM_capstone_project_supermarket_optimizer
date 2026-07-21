"""
P1.1 — rule-based candidate re-weighting from past feedback.

Explicitly NOT a trained model (see docs/architektur_entscheidungen.md,
P1.1): with two testers over two weeks there isn't enough data for that
to be meaningful, and it would break the anti-hallucination line the
rest of the recommendation engine follows (recommender.py's own
docstring: "no LLM call, no randomness"). Instead this re-orders each
gap's existing, fixed candidate list using the session's own feedback
history — it never invents a new candidate and never hard-excludes one,
since a single "no" shouldn't permanently rule out an otherwise valid
suggestion (e.g. the user was just out of pantry space that week).

Architecturally the same pattern as recommender.py's
_SYMPTOM_PRIORITY_BOOST: a boost can reorder what's already there, it
can't add a fact that isn't already computed elsewhere.
"""

from backend.app.db.supabase import get_recommendations_by_user, get_feedback_by_user

_SCORE_BY_RESPONSE = {"yes": 1, "no": -1, "maybe": 0}


def item_preference_scores(user_id: str) -> dict:
    """
    Net feedback score per recommended item name for this session: +1
    per "yes", -1 per "no", "maybe" is neutral. Only items that were
    both actually recommended (so we know their name) and received
    feedback show up here — everything else is untouched (score 0).
    """

    recommendations = get_recommendations_by_user(user_id) or []
    item_by_recommendation_id = {
        row["id"]: row.get("payload", {}).get("item")
        for row in recommendations
        if row.get("payload", {}).get("item")
    }

    scores: dict = {}
    for row in get_feedback_by_user(user_id) or []:
        item = item_by_recommendation_id.get(row.get("recommendation_id"))
        delta = _SCORE_BY_RESPONSE.get(row.get("response"), 0)
        if item and delta:
            scores[item] = scores.get(item, 0) + delta
    return scores
