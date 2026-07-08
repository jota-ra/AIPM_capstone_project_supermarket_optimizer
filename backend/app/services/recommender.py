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
    AgeRange,
    ActivityLevel,
    DietaryPattern,
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

_RECOMMENDATIONS_PATH = Path(__file__).resolve().parents[1] / "data" / "recommendations.json"

ProfileLike = Union[Profile, ProfileCreate]


def _load_recommendations() -> dict:
    return json.loads(_RECOMMENDATIONS_PATH.read_text(encoding="utf-8"))


# Loaded once at import time: the table is static data, not a live resource.
RECOMMENDATIONS = _load_recommendations()


def default_profile() -> ProfileCreate:
    """
    Used when no profile is available yet, so recommendations still work
    before the user completes onboarding. No exclusions -> nothing is
    filtered out.
    """

    return ProfileCreate(
        goal=Goal.EAT_HEALTHIER,
        age_range=AgeRange.R25_34,
        activity_level=ActivityLevel.MODERATE,
        dietary_pattern=DietaryPattern.OMNIVORE,
    )


def _candidates_for(gap: Gap) -> List[dict]:
    return RECOMMENDATIONS.get(f"{gap.dimension}:{gap.status.value}", [])


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

    for gap in gaps:  # already ranked worst-first by the gap detector
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
