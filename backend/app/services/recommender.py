"""
Next Cart recommendation engine (Task 5.2).

Turns Epic 4's gaps into exactly one prioritized, profile-safe grocery
action. Fully rule-based and deterministic — no LLM call, no randomness —
per the roadmap's explicit risk: "the LLM must not invent nutrition
facts." Every fact in the output (the gap message, the candidate's
rationale) is pulled verbatim from the recommendation mapping table
(Task 5.1) or Epic 4's own gap output; nothing is generated at runtime.

Algorithm: walk the gaps in the order Epic 4 ranked them (worst first),
and for each gap's candidate list (in the table's fixed order), keep the
first candidate the exclusion filter (Epic 3) allows. Same gaps + same
profile always yields the same recommendation.
"""

import json
from pathlib import Path
from typing import List, Optional, Union

from backend.app.models.profile import (
    ProfileCreate,
    Profile,
    Goal,
    ActivityLevel,
    DietaryPattern,
    Digestion,
)
from backend.app.models.snapshot import Gap, ConfidenceLevel
from backend.app.models.next_cart import (
    NextCartRecommendation,
    EvaluatedCandidate,
    ActionType,
    RecommendationStatus,
)
from backend.app.services.exclusion_filter import ExclusionCandidate, check_candidate
from backend.app.services.explainer import generate_explanation
from backend.app.services.recipe_suggester import suggest_recipes

_RECOMMENDATIONS_PATH = Path(__file__).resolve().parents[1] / "data" / "recommendations.json"

ProfileLike = Union[Profile, ProfileCreate]


def _load_recommendations() -> dict:
    """
    Bug fix: this used to have no error handling, and since it runs at
    import time (below), a missing/corrupted recommendations.json would
    crash the ENTIRE app at startup — receipt upload, profiles, everything
    — not just Next Cart. Degrade to "no candidates for any gap" instead;
    recommend_next_cart already has a defined NO_SUITABLE_CANDIDATE path
    for exactly that case.
    """

    try:
        return json.loads(_RECOMMENDATIONS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[recommender] could not load recommendations.json, Next Cart disabled: {e}")
        return {}


# Loaded once at import time: the table is static data, not a live resource.
RECOMMENDATIONS = _load_recommendations()


def default_profile() -> ProfileCreate:
    """
    Used when no profile is available yet, so recommendations still work
    before the user completes onboarding. No exclusions -> nothing is
    filtered out.
    """

    return ProfileCreate(
        goal=Goal.EAT_BALANCED,
        activity_level=ActivityLevel.MODERATELY_ACTIVE,
        dietary_pattern=DietaryPattern.NO_SPECIFIC_DIET,
    )


def _candidates_for(gap: Gap) -> List[dict]:
    return RECOMMENDATIONS.get(f"{gap.dimension}:{gap.status.value}", [])


# Chat onboarding Q6/Q7 (symptoms, digestion) -> which already-tracked
# gap dimension to prioritize. Deliberately limited to dimensions this
# app actually measures (fiber, protein, processed) — the Q6 table's
# iron/B12/magnesium/omega-3/vitamin-D/biotin links aren't wired here
# because nothing in this app's data model measures those; fabricating
# a gap for them would violate this file's own anti-hallucination rule.
# See models/profile.py's ProfileCreate docstring.
_SYMPTOM_PRIORITY_BOOST = {
    "muscle_weakness": {"protein"},
    "hair_nails": {"protein"},
    "often_cold": {"protein"},
}
_DIGESTION_PRIORITY_BOOST = {
    Digestion.BLOATED: {"fiber"},
    Digestion.SLOW: {"fiber"},
    Digestion.SENSITIVE: {"processed"},
}


def _boosted_dimensions(profile: ProfileLike) -> set:
    boosted = set()
    for symptom in getattr(profile, "symptoms", None) or []:
        boosted |= _SYMPTOM_PRIORITY_BOOST.get(symptom, set())
    digestion = getattr(profile, "digestion", None)
    if digestion is not None:
        boosted |= _DIGESTION_PRIORITY_BOOST.get(digestion, set())
    return boosted


def _prioritize_gaps(gaps: List[Gap], profile: ProfileLike) -> List[Gap]:
    """
    Move gaps matching a Q6/Q7 signal ahead of the rest, otherwise
    keeping Epic 4's severity-based order (stable sort). A boosted gap
    still has to actually exist — this reorders, it never invents one.
    """

    boosted = _boosted_dimensions(profile)
    if not boosted:
        return gaps
    ranked = sorted(
        enumerate(gaps),
        key=lambda pair: (0 if pair[1].dimension in boosted else 1, pair[0]),
    )
    return [gap for _, gap in ranked]


def recommend_next_cart(
    gaps: List[Gap],
    profile: Optional[ProfileLike],
    confidence: ConfidenceLevel,
) -> NextCartRecommendation:
    """
    Build the single Next Cart recommendation for this basket + profile.

    Story 5.1: exactly one recommendation, framed as add/replace/reduce.
    Story 5.2: never suggests something the profile excludes; says so
    explicitly if nothing in the table fits.
    """

    if profile is None:
        profile = default_profile()

    if not gaps:
        return NextCartRecommendation(
            status=RecommendationStatus.NO_GAPS,
            action_type=ActionType.NONE,
            message="Your basket looks balanced across the tracked dimensions "
                    "— no specific action needed right now.",
            confidence=confidence,
        )

    evaluated: List[EvaluatedCandidate] = []
    gaps = _prioritize_gaps(gaps, profile)

    for gap in gaps:  # ranked worst-first by the gap detector, then Q6/Q7-boosted
        for candidate in _candidates_for(gap):
            check = check_candidate(
                profile,
                ExclusionCandidate(name=candidate["item"], tags=candidate["tags"]),
            )
            evaluated.append(EvaluatedCandidate(
                item=candidate["item"],
                targets_gap=gap.dimension,
                allowed=check.allowed,
                reason=None if check.allowed else check.reason,
            ))

            if check.allowed:
                return NextCartRecommendation(
                    status=RecommendationStatus.RECOMMENDED,
                    action_type=ActionType(candidate["action_type"]),
                    item=candidate["item"],
                    targets_gap=gap.dimension,
                    gap_status=gap.status.value,
                    message=f"{candidate['action_type'].capitalize()}: {candidate['item']}",
                    reasoning=[gap.message, candidate["rationale"]],
                    explanation=generate_explanation(gap, candidate, profile),
                    confidence=confidence,
                    evaluated_candidates=evaluated,
                    recipes=suggest_recipes(candidate["item"]),
                )

    # Every candidate for every gap conflicted with the profile.
    return NextCartRecommendation(
        status=RecommendationStatus.NO_SUITABLE_CANDIDATE,
        action_type=ActionType.NONE,
        message="We couldn't find a recommendation that fits your dietary "
                "profile right now.",
        reasoning=[gap.message for gap in gaps],
        confidence=confidence,
        evaluated_candidates=evaluated,
    )
