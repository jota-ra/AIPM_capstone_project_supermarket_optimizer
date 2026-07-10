"""
Personalizes the protein reference baseline using weight, height,
gender and activity level, when a profile has enough of them.

Approach: Mifflin-St Jeor BMR x an activity-level TDEE multiplier gives
a personalized daily energy estimate; a goal-informed protein target
(g per kg bodyweight) divided by that TDEE gives a personalized protein
density (g per 1000 kcal) — directly comparable to the existing
PROTEIN_REF_PER_1000KCAL guideline, so gap_detector.py and
nutrition_model.py don't need two different units.

Deliberately limited to protein. Fiber/sugar/processed stay as the
existing universal density guidelines (WHO/DGE), independent of body
size — there's no widely-cited weight-scaled version of those the way
there is for protein. And this deliberately does NOT touch calories:
comparing a receipt's estimated total calories against a personalized
daily TDEE would need to know how many days that receipt covers, which
nothing in this app extracts yet (backlog EXT-1/NUT-1). Mixing that in
here would produce a plausible-looking but unfounded number — exactly
what this codebase's anti-hallucination stance forbids elsewhere
(recommender.py, explainer.py).
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

# Grams of protein per kg bodyweight per day, by goal — broad,
# commonly-cited ranges (sedentary ~0.8, general fitness ~1.0,
# preserving muscle while losing weight ~1.2-1.6, building muscle
# ~1.6-2.2). Not a substitute for individualized dietary advice.
_PROTEIN_G_PER_KG = {
    Goal.BUILD_MUSCLE: 1.8,
    Goal.LOSE_WEIGHT_GRADUALLY: 1.4,
}
_DEFAULT_PROTEIN_G_PER_KG = 1.0


def _bmr(weight_kg: float, height_cm: float, age: int, gender: Optional[Gender]) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if gender == Gender.MALE:
        return base + 5
    if gender == Gender.FEMALE:
        return base - 161
    return base - 78  # midpoint of the male (+5) / female (-161) offsets


def personalized_protein_ref_per_1000kcal(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    None when the profile doesn't have enough data for this (any of
    weight, height, age range missing) — caller should fall back to
    nutrition_model.PROTEIN_REF_PER_1000KCAL in that case.
    """

    if profile is None:
        return None
    if not profile.weight_kg or not profile.height_cm or profile.age_range is None:
        return None

    age = _AGE_RANGE_MIDPOINT.get(profile.age_range)
    if age is None:
        return None

    bmr = _bmr(profile.weight_kg, profile.height_cm, age, profile.gender)
    multiplier = _ACTIVITY_MULTIPLIER.get(profile.activity_level, 1.2)
    tdee = bmr * multiplier
    if tdee <= 0:
        return None

    protein_g_per_kg = _PROTEIN_G_PER_KG.get(profile.goal, _DEFAULT_PROTEIN_G_PER_KG)
    daily_protein_g = profile.weight_kg * protein_g_per_kg

    return round(daily_protein_g / tdee * 1000, 1)
