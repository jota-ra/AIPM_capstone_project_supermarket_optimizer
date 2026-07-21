"""
Personalizes the protein reference baseline using weight, height,
gender and activity level, when a profile has enough of them.

Approach: Mifflin-St Jeor BMR x an activity-level TDEE multiplier gives
a personalized daily energy estimate; a goal-informed protein target
(g per kg bodyweight) divided by that TDEE gives a personalized protein
density (g per 1000 kcal) — directly comparable to the existing
PROTEIN_REF_PER_1000KCAL guideline, so gap_detector.py and
nutrition_model.py don't need two different units.

Fiber/sugar/processed stay as the existing universal density guidelines
(WHO/DGE), independent of body size — there's no widely-cited
weight-scaled version of those the way there is for protein.

Calories used to be deliberately excluded here too, for the same reason
as fiber/sugar/processed plus one more: comparing a receipt's estimated
total calories against a personalized daily TDEE needs to know how many
days that receipt covers, which a receipt alone doesn't carry (backlog
EXT-1/NUT-1). That problem is now solved differently — not by this
module, but by the confirmed-consumption pipeline (services/pantry.py,
intake_estimator.py) the absolute-gap nutrients (iron, protein, calcium)
already use, which gets a real per-day estimate from the user's own
consumption confirmations instead of guessing from a receipt. See
absolute_gap_detector.py's detect_calorie_gap for the calorie gap this
enables — personalized_tdee/personalized_calorie_target_kcal below only
compute the *requirement* side, same role as daily_protein_target_g.
"""

from typing import Optional, Union

from backend.app.models.profile import (
    ActivityLevel,
    AgeRange,
    Gender,
    Goal,
    Profile,
    ProfileCreate,
)

ProfileLike = Union[Profile, ProfileCreate]

_ACTIVITY_MULTIPLIER = {
    ActivityLevel.MOSTLY_SITTING: 1.2,
    ActivityLevel.LIGHT_ACTIVITY: 1.375,
    ActivityLevel.MODERATELY_ACTIVE: 1.55,
    ActivityLevel.VERY_ACTIVE: 1.725,
}

# Representative age per bucket — the chat asks for a self-reported
# range (Q5), not a birthday, so BMR uses the bucket's midpoint.
_AGE_RANGE_MIDPOINT = {
    AgeRange.UNDER_25: 22,
    AgeRange.R25_35: 30,
    AgeRange.R36_45: 40,
    AgeRange.R46_55: 50,
    AgeRange.R55_PLUS: 60,
}

# Grams of protein per kg bodyweight per day, by goal. The default
# (no specific goal) matches the DGE's general adult baseline of
# 0.8 g/kg (see nutrient_requirements.py's module docstring for the
# source); goal-specific increases beyond that baseline (preserving
# muscle while losing weight, building muscle) come from broader
# sports-nutrition literature, not the DGE, which doesn't publish
# goal-based figures — not a substitute for individualized dietary advice.
_PROTEIN_G_PER_KG = {
    Goal.BUILD_MUSCLE: 1.8,
    Goal.LOSE_WEIGHT_GRADUALLY: 1.4,
}
_DEFAULT_PROTEIN_G_PER_KG = 0.8

# Rough daily calorie adjustment from TDEE (maintenance), by goal — the
# Miro-diagram's "Goal Multiplier". Broad, commonly-cited ranges (a
# deficit for gradual weight loss, a surplus for muscle building), not
# individualized dietary advice — same disclaimer stance as
# _PROTEIN_G_PER_KG above. `maintain` has no calorie-target rationale of
# its own, so it defaults to 0.0 via .get() below.
_CALORIE_GOAL_ADJUSTMENT = {
    Goal.LOSE_WEIGHT_GRADUALLY: -0.175,  # midpoint of a commonly-cited -15% to -20% deficit
    Goal.BUILD_MUSCLE: 0.10,             # midpoint of a commonly-cited +5% to +15% surplus
}


def _bmr(weight_kg: float, height_cm: float, age: int, gender: Optional[Gender]) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if gender == Gender.MALE:
        return base + 5
    if gender == Gender.FEMALE:
        return base - 161
    return base - 78  # midpoint of the male (+5) / female (-161) offsets


def personalized_tdee(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    Total daily energy expenditure (Mifflin-St Jeor BMR x activity-level
    multiplier) — None when the profile doesn't have enough data
    (weight, height, or age_range missing). Extracted from what used to
    be a private step inside personalized_protein_ref_per_1000kcal so
    personalized_calorie_target_kcal can reuse the exact same calculation
    instead of a second, parallel one.
    """

    if profile is None or not profile.weight_kg or not profile.height_cm or profile.age_range is None:
        return None

    age = _AGE_RANGE_MIDPOINT.get(profile.age_range)
    if age is None:
        return None

    bmr = _bmr(profile.weight_kg, profile.height_cm, age, profile.gender)
    multiplier = _ACTIVITY_MULTIPLIER.get(profile.activity_level, 1.2)
    tdee = bmr * multiplier
    return tdee if tdee > 0 else None


def personalized_calorie_target_kcal(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    Goal-adjusted daily calorie target (kcal/day) — TDEE shifted by the
    goal's rough deficit/surplus (_CALORIE_GOAL_ADJUSTMENT), or plain
    TDEE (maintenance) for goals with no specific adjustment.
    """

    tdee = personalized_tdee(profile)
    if tdee is None:
        return None

    adjustment = _CALORIE_GOAL_ADJUSTMENT.get(profile.goal, 0.0)
    return round(tdee * (1 + adjustment), 1)


# Generic fallback when a profile has no weight/height/age_range yet —
# a commonly-cited "average adult" reference intake (the same figure
# used for %DV on US/EU nutrition labels), used only until personalization
# is possible. Mirrors IRON_REF_DEFAULT_MG_PER_DAY's reasoning in
# nutrient_requirements.py.
CALORIE_TARGET_DEFAULT_KCAL = 2000.0


def daily_protein_target_g(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    Grams of protein/day this profile should aim for (bodyweight x a
    goal-informed g/kg target) — independent of TDEE, so it only needs
    weight_kg (unlike the density reference below, which also needs
    height/age/activity to convert it into a per-1000kcal ratio). Used
    both as the numerator here and directly as an absolute daily
    requirement by nutrient_requirements.py.
    """

    if profile is None or not profile.weight_kg:
        return None

    protein_g_per_kg = _PROTEIN_G_PER_KG.get(profile.goal, _DEFAULT_PROTEIN_G_PER_KG)
    return round(profile.weight_kg * protein_g_per_kg, 1)


def personalized_protein_ref_per_1000kcal(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    None when the profile doesn't have enough data for this (any of
    weight, height, age range missing) — caller should fall back to
    nutrition_model.PROTEIN_REF_PER_1000KCAL in that case.
    """

    daily_protein_g = daily_protein_target_g(profile)
    if daily_protein_g is None:
        return None

    tdee = personalized_tdee(profile)
    if tdee is None:
        return None

    return round(daily_protein_g / tdee * 1000, 1)
