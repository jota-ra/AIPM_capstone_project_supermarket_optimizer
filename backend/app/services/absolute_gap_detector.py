"""
Absolute (Bedarf vs. Ist) gap detection — iron, protein, calcium and
calories.

Rule-based, same spirit as gap_detector.py, but compares a real daily
estimate (intake_estimator.py, built from confirmed pantry consumption)
against a real daily requirement (nutrient_requirements.py) instead of a
density ratio. Returns no gap at all for a nutrient with not enough
pantry data to say anything — never fabricates a gap from an assumption,
matching this codebase's anti-hallucination stance (see recommender.py,
profile.py).

Calories are handled separately from the _NUTRIENTS table below (see
detect_calorie_gap): iron/protein/calcium are all "more is better, up to
the requirement" — a single one-sided LOW check. Calories aren't — being
below target can be the *goal* (a deficit) and being above it can too (a
surplus) — so calories need a goal-aware, two-sided (LOW or HIGH) check
instead of the generic table's one-sided assumption.
"""

from typing import List, Optional, Union

from backend.app.models.absolute_gap import AbsoluteGap
from backend.app.models.snapshot import GapStatus
from backend.app.models.profile import Goal, Profile, ProfileCreate
from backend.app.services.intake_estimator import (
    estimate_daily_iron_mg,
    estimate_daily_protein_g,
    estimate_daily_calcium_mg,
    estimate_daily_calories_kcal,
)
from backend.app.services.nutrient_requirements import (
    personalized_iron_ref_mg_per_day,
    IRON_REF_DEFAULT_MG_PER_DAY,
    personalized_protein_grams_per_day,
    PROTEIN_REF_DEFAULT_G_PER_DAY,
    personalized_calcium_ref_mg_per_day,
    CALCIUM_REF_MG_PER_DAY,
)
from backend.app.services.nutrition_personalization import (
    personalized_calorie_target_kcal,
    CALORIE_TARGET_DEFAULT_KCAL,
)
from backend.app.services import i18n

ProfileLike = Union[Profile, ProfileCreate]


def has_sufficient_data(user_id: str) -> bool:
    """
    True if this session has ANY confirmed consumption at all —
    distinguishes "nothing confirmed yet, so absolute_gaps is empty
    because we can't say anything" from "confirmed, and everything's
    within range" for the frontend's empty state (Epic 11.1). A single
    ConsumptionEvent is enough to answer this, so this is a cheap check,
    not a re-run of every nutrient's estimate.
    """

    from backend.app.services.pantry import get_consumption_events

    return len(get_consumption_events(user_id)) > 0

# How far estimate/target may deviate (either direction) before it's
# worth mentioning — a rough band, not a precise clinical threshold.
_CALORIE_TOLERANCE = 0.10

# One entry per tracked nutrient: (dimension, estimate_fn, requirement_fn,
# default_requirement, message_key). The localized message template lives
# in services/i18n.py under `message_key` (E13). Adding a nutrient here is
# the only step needed once its intake_estimator/nutrient_requirements
# functions exist — detect_absolute_gaps itself stays generic.
_NUTRIENTS = [
    ("iron", estimate_daily_iron_mg, personalized_iron_ref_mg_per_day, IRON_REF_DEFAULT_MG_PER_DAY, "abs.iron"),
    ("protein", estimate_daily_protein_g, personalized_protein_grams_per_day, PROTEIN_REF_DEFAULT_G_PER_DAY, "abs.protein"),
    ("calcium", estimate_daily_calcium_mg, personalized_calcium_ref_mg_per_day, CALCIUM_REF_MG_PER_DAY, "abs.calcium"),
]


def detect_calorie_gap(
    user_id: str, profile: Optional[ProfileLike] = None, lang: str = "en"
) -> Optional[AbsoluteGap]:
    """
    Goal-aware, two-sided calorie gap: unlike iron/protein/calcium, being
    below target isn't automatically bad (a deficit is the point for
    Goal.LOSE_WEIGHT_GRADUALLY) and being above isn't automatically bad
    either (a surplus is the point for Goal.BUILD_MUSCLE). Within
    _CALORIE_TOLERANCE of the target, nothing is reported at all — not
    every minor fluctuation is worth flagging.
    """

    estimate = estimate_daily_calories_kcal(user_id)
    if estimate.daily_estimate is None:
        return None

    target = personalized_calorie_target_kcal(profile) or CALORIE_TARGET_DEFAULT_KCAL
    if target <= 0:
        return None

    ratio = round(estimate.daily_estimate / target, 2)
    if (1 - _CALORIE_TOLERANCE) <= ratio <= (1 + _CALORIE_TOLERANCE):
        return None

    goal = getattr(profile, "goal", None)

    # `target` is already goal-adjusted (personalized_calorie_target_kcal
    # applies the deficit/surplus). Deviating further in the direction the
    # goal already wants isn't a problem to flag — only deviating the
    # "wrong" way, or having no specific goal at all, is.
    if ratio < 1:
        if goal == Goal.LOSE_WEIGHT_GRADUALLY:
            return None
        status = GapStatus.LOW
        message = i18n.t(lang, "abs.calories_low", estimate=estimate.daily_estimate, target=target)
    else:
        if goal == Goal.BUILD_MUSCLE:
            return None
        status = GapStatus.HIGH
        message = i18n.t(lang, "abs.calories_high", estimate=estimate.daily_estimate, target=target)

    return AbsoluteGap(
        dimension="calories",
        status=status,
        daily_estimate=estimate.daily_estimate,
        daily_requirement=target,
        ratio=ratio,
        message=message,
        confidence=estimate.confidence,
    )


def detect_absolute_gaps(
    user_id: str, profile: Optional[ProfileLike] = None, lang: str = "en"
) -> List[AbsoluteGap]:
    """
    Return the absolute gaps this session has enough confirmed pantry
    consumption to say something about, worst (furthest from target)
    first — [] for any nutrient with no confirmed consumption yet, since
    an untouched pantry says nothing about actual intake.
    """

    candidates = []  # (severity, AbsoluteGap)

    for dimension, estimate_fn, requirement_fn, default_requirement, message_key in _NUTRIENTS:
        estimate = estimate_fn(user_id)
        if estimate.daily_estimate is None:
            continue

        requirement = requirement_fn(profile) or default_requirement
        if requirement <= 0 or estimate.daily_estimate >= requirement:
            continue

        ratio = round(estimate.daily_estimate / requirement, 2)
        severity = 1 - ratio
        candidates.append((severity, AbsoluteGap(
            dimension=dimension,
            status=GapStatus.LOW,
            daily_estimate=estimate.daily_estimate,
            daily_requirement=requirement,
            ratio=ratio,
            message=i18n.t(lang, message_key, estimate=estimate.daily_estimate, requirement=requirement),
            confidence=estimate.confidence,
        )))

    calorie_gap = detect_calorie_gap(user_id, profile, lang)
    if calorie_gap is not None:
        candidates.append((abs(1 - calorie_gap.ratio), calorie_gap))

    candidates.sort(key=lambda pair: pair[0], reverse=True)
    return [gap for _, gap in candidates]
