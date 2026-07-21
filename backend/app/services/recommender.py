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
from backend.app.models.absolute_gap import AbsoluteGap
from backend.app.models.next_cart import (
    NextCartRecommendation,
    EvaluatedCandidate,
    ActionType,
    RecommendationStatus,
    PantryMatch,
)
from backend.app.services.exclusion_filter import ExclusionCandidate, check_candidate
from backend.app.services.explainer import generate_explanation
from backend.app.services.recipe_suggester import suggest_recipes
from backend.app.services.shelf_life import EXPIRING_SOON_WITHIN_DAYS
from backend.app.services import i18n
from backend.app.services.preference_learning import item_preference_scores

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
        goal=Goal.MAINTAIN,
        activity_level=ActivityLevel.MODERATELY_ACTIVE,
        dietary_pattern=DietaryPattern.NO_SPECIFIC_DIET,
    )


def _candidates_for(gap: Gap) -> List[dict]:
    return RECOMMENDATIONS.get(f"{gap.dimension}:{gap.status.value}", [])


def gap_from_absolute(absolute_gap: AbsoluteGap) -> Gap:
    """
    Bridge an AbsoluteGap (real daily units, e.g. mg/day iron) into the
    Gap shape recommend_next_cart() consumes. Only the fields the
    candidate-lookup/exclusion-filter path actually uses are carried
    over (dimension, status, message, confidence) — current/reference
    values keep their absolute units rather than being forced into the
    density Gap's semantics, since nothing downstream of this bridge
    recomputes a ratio from them.
    """

    return Gap(
        dimension=absolute_gap.dimension,
        status=absolute_gap.status,
        current_value=absolute_gap.daily_estimate,
        reference_value=absolute_gap.daily_requirement,
        message=absolute_gap.message,
        confidence=absolute_gap.confidence,
    )


# Chat onboarding Q6/Q7 (symptoms, digestion) -> which already-tracked
# gap dimension to prioritize. Iron is now wired in (see
# absolute_gap_detector.py) alongside fiber/protein/processed — the Q6
# table's B12/magnesium/omega-3/vitamin-D/biotin links stay unwired
# because nothing in this app's data model measures those; fabricating
# a gap for them would still violate this file's anti-hallucination
# rule. See models/profile.py's ProfileCreate docstring.
_SYMPTOM_PRIORITY_BOOST = {
    "muscle_weakness": {"protein"},
    "hair_nails": {"protein", "iron"},
    "often_cold": {"protein", "iron"},
    "fatigue": {"iron"},
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


def _apply_preference_scores(candidates: List[dict], scores: dict) -> List[dict]:
    """
    Stable-reorder a gap's fixed candidate list (highest net feedback
    score first, table order as tiebreaker) — same pattern as
    _prioritize_gaps above. Never adds or removes a candidate; a
    candidate with no feedback history keeps its original position
    relative to other zero-score candidates.
    """

    if not scores:
        return candidates
    ranked = sorted(
        enumerate(candidates),
        key=lambda pair: (-scores.get(pair[1]["item"], 0), pair[0]),
    )
    return [candidate for _, candidate in ranked]


def find_pantry_match(
    gaps: List[Gap],
    pantry_items: List[dict],
    profile: Optional[ProfileLike],
    user_id: Optional[str] = None,
    lang: str = "en",
) -> Optional[PantryMatch]:
    """
    "Use what you already have" — walk gaps worst-first (same order
    recommend_next_cart uses), and for each gap's candidate list, check
    whether a matching item is already in the pantry and allowed under
    the profile's exclusions. Among matches, prefer the soonest-expiring
    one (services/shelf_life.py) — a side benefit of reducing food waste.

    Shown ALONGSIDE recommend_next_cart's purchase pick, never replacing
    it — the user gets both and chooses (docs/architektur_entscheidungen.md,
    ToDo 2). Already-expired items are still returned (urgent=True), not
    hidden — "past its estimate" means "use it now or toss it", not
    "pretend it isn't there".

    user_id is optional (P1.1): when given, past feedback for this
    session re-orders each gap's candidate list before matching against
    the pantry, same rule-based boost as recommend_next_cart below.
    """

    if profile is None:
        profile = default_profile()

    scores = item_preference_scores(user_id) if user_id else {}

    for gap in gaps:
        matches = []
        for candidate in _apply_preference_scores(_candidates_for(gap), scores):
            # Bug fix: `pantry_items and next(...)` looks like a null-guard
            # but isn't one — when pantry_items is an empty list (falsy),
            # `and` short-circuits and returns `[]` itself, not None. That
            # `[]` then failed the `is None` check below and got appended
            # to `matches`, crashing `min()`'s key lookup with
            # "'list' object has no attribute 'get'" for any user with an
            # empty pantry. `next(genexpr, None)` already returns None on
            # an empty pantry_items on its own — no guard needed.
            pantry_item = next(
                (i for i in pantry_items if i["normalized_name"] == candidate["item"]), None
            )
            if pantry_item is None:
                continue
            check = check_candidate(
                profile,
                ExclusionCandidate(name=candidate["item"], tags=candidate["tags"]),
            )
            if check.allowed:
                matches.append(pantry_item)

        if not matches:
            continue

        best = min(
            matches,
            key=lambda item: (
                item["days_until_expiry"] if item.get("days_until_expiry") is not None else float("inf")
            ),
        )
        days = best.get("days_until_expiry")
        urgent = days is not None and days <= EXPIRING_SOON_WITHIN_DAYS

        nutrient_name = i18n.nutrient(lang, gap.dimension)
        if urgent and days is not None and days < 0:
            message = i18n.t(lang, "rec.pantry_expired", item=best["normalized_name"], nutrient=nutrient_name)
        elif urgent:
            message = i18n.t(lang, "rec.pantry_expiring", item=best["normalized_name"], nutrient=nutrient_name)
        else:
            message = i18n.t(lang, "rec.pantry_have", item=best["normalized_name"], nutrient=nutrient_name)

        return PantryMatch(
            item=best["normalized_name"],
            targets_gap=gap.dimension,
            days_until_expiry=days,
            urgent=urgent,
            message=message,
        )

    return None


def recommend_next_cart(
    gaps: List[Gap],
    profile: Optional[ProfileLike],
    confidence: ConfidenceLevel,
    user_id: Optional[str] = None,
    lang: str = "en",
) -> NextCartRecommendation:
    """
    Build the single Next Cart recommendation for this basket + profile.

    Story 5.1: exactly one recommendation, framed as add/replace/reduce.
    Story 5.2: never suggests something the profile excludes; says so
    explicitly if nothing in the table fits.

    user_id is optional (P1.1, rule-based preference re-weighting):
    when given, this session's past feedback ("would you buy this?")
    re-orders each gap's candidate list before the exclusion filter
    runs — a liked item is preferred over an equally-valid alternative,
    a disliked one is deprioritized but never removed outright.
    """

    if profile is None:
        profile = default_profile()

    if not gaps:
        return NextCartRecommendation(
            status=RecommendationStatus.NO_GAPS,
            action_type=ActionType.NONE,
            message=i18n.t(lang, "rec.no_gaps"),
            confidence=confidence,
        )

    evaluated: List[EvaluatedCandidate] = []
    gaps = _prioritize_gaps(gaps, profile)
    scores = item_preference_scores(user_id) if user_id else {}

    for gap in gaps:  # ranked worst-first by the gap detector, then Q6/Q7-boosted
        for candidate in _apply_preference_scores(_candidates_for(gap), scores):
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
                reasoning = [gap.message, i18n.rationale_for(candidate, lang)]
                if scores.get(candidate["item"], 0) > 0:
                    reasoning.append(i18n.t(lang, "rec.positive_history"))
                return NextCartRecommendation(
                    status=RecommendationStatus.RECOMMENDED,
                    action_type=ActionType(candidate["action_type"]),
                    item=candidate["item"],
                    targets_gap=gap.dimension,
                    gap_status=gap.status.value,
                    message=i18n.t(lang, "rec.action_item",
                                   verb=i18n.action_verb(lang, candidate["action_type"]),
                                   item=candidate["item"]),
                    reasoning=reasoning,
                    explanation=generate_explanation(gap, candidate, profile, lang),
                    confidence=confidence,
                    evaluated_candidates=evaluated,
                    recipes=suggest_recipes(candidate["item"], lang),
                )

    # Every candidate for every gap conflicted with the profile.
    return NextCartRecommendation(
        status=RecommendationStatus.NO_SUITABLE_CANDIDATE,
        action_type=ActionType.NONE,
        message=i18n.t(lang, "rec.no_suitable"),
        reasoning=[gap.message for gap in gaps],
        confidence=confidence,
        evaluated_candidates=evaluated,
    )
