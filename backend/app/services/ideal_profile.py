"""
Ideal Profile Engine (E2).

Turns a Level-1 profile into personalized daily targets — calories,
macros, fibre, and (starter) micronutrients — using the deterministic
rules in business_rules.md (BR-Gen/BR-E/BR-M) and the reference tables in
reference_data.md. Pure and rule-based: no LLM, no randomness.

Returns None when the required biometrics (sex, DOB, height, weight) are
missing, so the caller can fall back to density-only analysis until the
user completes onboarding.
"""

from datetime import date
from typing import Optional

from backend.app.models.profile import (
    ProfileCreate,
    Goal,
    Sex,
    ExerciseFrequency,
    DailyMovement,
    PregnancyStatus,
    IdealProfile,
)

# ── BR-M6 energy densities (kcal/g) ──────────────────────────────────────
KCAL_PER_G = {"protein": 4.0, "carb": 4.0, "fat": 9.0}

# ── BR-E3 NEAT: BMR × movement% ──────────────────────────────────────────
_NEAT_PCT = {
    DailyMovement.MOSTLY_SITTING: 0.00,
    DailyMovement.MIXED: 0.10,
    DailyMovement.MOSTLY_STANDING: 0.20,
    DailyMovement.PHYSICAL_LABOR: 0.35,
}
# ── BR-E4 EAT: added kcal/day ────────────────────────────────────────────
_EAT_KCAL = {
    ExerciseFrequency.NONE: 0,
    ExerciseFrequency.ONE_TWO: 100,
    ExerciseFrequency.THREE_FOUR: 250,
    ExerciseFrequency.FIVE_SIX: 400,
    ExerciseFrequency.DAILY_ATHLETE: 600,
}
# ── BR-E6 goal → calorie adjustment ──────────────────────────────────────
# BR-E6 defines four tiers (lose −15%, maintain 0, build +10%, aggressive
# +15%); the onboarding chat offers only 3 of them (Goal, models/profile.py):
#   LOSE_WEIGHT_GRADUALLY → −15%  (BR-E6 "lose fat")
#   BUILD_MUSCLE          → +10%  (BR-E6 "build muscle")
#   MAINTAIN              → 0%    (BR-E6 "maintain"), also the .get default
# BR-E6's "aggressive" (+15%) tier is deliberately not offered.
_GOAL_ADJ = {
    Goal.LOSE_WEIGHT_GRADUALLY: -0.15,
    Goal.BUILD_MUSCLE: 0.10,
    # MAINTAIN → 0.0 (maintenance) via .get default
}
# ── BR-M1 protein g/kg ───────────────────────────────────────────────────
_PROTEIN_BY_EXERCISE = {
    ExerciseFrequency.NONE: 1.0,
    ExerciseFrequency.ONE_TWO: 1.4,
    ExerciseFrequency.THREE_FOUR: 1.6,
    ExerciseFrequency.FIVE_SIX: 1.8,
    ExerciseFrequency.DAILY_ATHLETE: 1.8,
}
_PROTEIN_BY_GOAL = {
    Goal.LOSE_WEIGHT_GRADUALLY: 2.0,   # protein spared in a deficit
    Goal.BUILD_MUSCLE: 2.0,
    # everything else → 1.2 g/kg via the .get default below
}

# ── BR-M5 / reference_data.md §D1 — DGE micronutrient starter (adults) ────
# VERIFY against the current DGE Referenzwerte before go-live (A4/Q1a).
def _micros(sex: Sex, age: int, pregnancy: Optional[PregnancyStatus]) -> dict:
    female = sex == Sex.FEMALE
    older = age >= 51
    m = {
        "iron_mg": (10.0 if older else 15.0) if female else 10.0,
        "calcium_mg": 1000.0,
        "magnesium_mg": 300.0 if female else 350.0,
        "zinc_mg": 8.0 if female else 11.0,
        "vitamin_c_mg": 95.0 if female else 110.0,
        "vitamin_d_ug": 20.0,
        "vitamin_b12_ug": 4.0,
        "folate_ug": 300.0,
        "potassium_mg": 4000.0,
        "iodine_ug": (180.0 if older else 200.0),
    }
    if female and pregnancy == PregnancyStatus.PREGNANT:
        m["iron_mg"] = 30.0
        m["folate_ug"] = 550.0
        m["vitamin_c_mg"] = 105.0
        m["iodine_ug"] = 230.0
    return m


def _age_from_dob(dob: str, today: Optional[date] = None) -> Optional[int]:
    try:
        y, mth, d = (int(x) for x in dob.split("-")[:3])
        birth = date(y, mth, d)
    except (ValueError, AttributeError):
        return None
    ref = today or date.today()
    return ref.year - birth.year - ((ref.month, ref.day) < (birth.month, birth.day))


def _bmr(sex: Sex, weight: float, height: float, age: int) -> float:
    """Mifflin–St Jeor. prefer_not_to_say → mean of male & female (BR-E1)."""
    base = 10 * weight + 6.25 * height - 5 * age
    male = base + 5
    female = base - 161
    if sex == Sex.MALE:
        return male
    if sex == Sex.FEMALE:
        return female
    return (male + female) / 2  # prefer_not_to_say / non-binary


def compute_ideal_profile(profile: ProfileCreate) -> Optional[IdealProfile]:
    """Personalized daily targets, or None if biometrics are incomplete."""

    if not (profile.sex and profile.date_of_birth and profile.height_cm and profile.weight_kg):
        return None
    age = _age_from_dob(profile.date_of_birth)
    if age is None:
        return None

    weight = float(profile.weight_kg)
    notes: list[str] = []

    # Energy (BR-E1..E6). BR-Gen2 says round only for display, but the
    # additive TDEE chain is defined on whole-kcal component values: the
    # "TDEE is additive" acceptance scenario sums BMR 1782 + NEAT 178 +
    # EAT 250 + TEF 221 = 2431. Rounding each component to whole kcal
    # before summing reproduces that worked example exactly (2431), whereas
    # carrying full float precision through the sum yields 2431.8 → 2432.
    bmr = round(_bmr(profile.sex, weight, float(profile.height_cm), age))
    movement = profile.daily_movement or DailyMovement.MOSTLY_SITTING
    exercise = profile.exercise_frequency or ExerciseFrequency.NONE
    neat = round(bmr * _NEAT_PCT[movement])
    eat = _EAT_KCAL[exercise]
    tef = round(0.10 * (bmr + neat + eat))
    tdee = bmr + neat + eat + tef
    calories = round(tdee * (1 + _GOAL_ADJ.get(profile.goal, 0.0)))

    # Macros (BR-M1..M4, M6)
    protein_g = max(_PROTEIN_BY_EXERCISE[exercise], _PROTEIN_BY_GOAL.get(profile.goal, 1.2)) * weight
    protein_kcal = protein_g * KCAL_PER_G["protein"]

    # BR-M2 fat = max(30% kcal, 0.8 g/kg). BR-M3: if protein + this fat
    # already meet/exceed the target, hold protein fixed and drop fat toward
    # its 0.8 g/kg floor to make room, floor carbs at 0; only if protein +
    # floor-fat *still* exceed the target flag the profile "constrained"
    # rather than emit negative carbs.
    fat_floor_g = 0.8 * weight
    fat_g = max(0.30 * calories / KCAL_PER_G["fat"], fat_floor_g)
    remaining = calories - protein_kcal - fat_g * KCAL_PER_G["fat"]
    constrained = False
    if remaining < 0:
        fat_g = fat_floor_g
        remaining = calories - protein_kcal - fat_g * KCAL_PER_G["fat"]
        if remaining < 0:
            constrained = True
            remaining = 0.0
    carbs_g = remaining / KCAL_PER_G["carb"]
    fiber_g = 14.0 * calories / 1000.0

    if constrained:
        notes.append(
            "Targets are constrained: your protein target alone meets or exceeds "
            "your calorie goal, so fat is held at its 0.8 g/kg minimum and carbs are 0."
        )

    micros = _micros(profile.sex, age, profile.pregnancy_status)
    notes.append("Micronutrient targets are DGE starter values pending dietitian verification.")

    return IdealProfile(
        calories_kcal=round(calories),
        protein_g=round(protein_g),
        fat_g=round(fat_g),
        carbs_g=round(carbs_g),
        fiber_g=round(fiber_g),
        micronutrients=micros,
        bmr_kcal=bmr,
        neat_kcal=neat,
        eat_kcal=eat,
        tef_kcal=tef,
        tdee_kcal=tdee,
        constrained=constrained,
        notes=notes,
    )
