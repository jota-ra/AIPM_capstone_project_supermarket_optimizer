from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Goal(str, Enum):
    """Primary health goal (chat onboarding Q1). Drives which nutrient
    the app leans on when explaining a recommendation (protein for
    muscle, fiber for gradual weight loss, etc.) — see explainer.py."""

    BUILD_MUSCLE = "build_muscle"
    MORE_ENERGY = "more_energy"
    LOSE_WEIGHT_GRADUALLY = "lose_weight_gradually"
    EAT_BALANCED = "eat_balanced"
    BETTER_FOCUS = "better_focus"
    BETTER_SLEEP = "better_sleep"


class AgeRange(str, Enum):
    """Chat onboarding Q5 (optional) — self-reported bucket, no birthday
    collected. `None` on the profile means "prefer not to say"."""

    UNDER_25 = "under_25"
    R25_35 = "25-35"
    R36_45 = "36-45"
    R46_55 = "46-55"
    R55_PLUS = "55+"


class ActivityLevel(str, Enum):
    """Chat onboarding Q3 — 4 tiers (was 5; "light" and "moderate"
    merged into a single "moderately_active" tier to match the chat's
    simplified copy)."""

    MOSTLY_SITTING = "mostly_sitting"
    LIGHT_ACTIVITY = "light_activity"
    MODERATELY_ACTIVE = "moderately_active"
    VERY_ACTIVE = "very_active"


class DietaryPattern(str, Enum):
    """
    Eating style (chat onboarding Q2). Members split into two groups by
    how the exclusion filter treats them (see exclusion_filter.py):

    - Hard diet types (VEGAN, VEGETARIAN, PESCATARIAN, GLUTEN_FREE,
      LACTOSE_FREE) exclude specific tags outright.
    - Soft styles (HIGH_PROTEIN, LOW_CARB_KETO, LOW_FAT, NO_SPECIFIC_DIET)
      exclude nothing today; they're a hook for the recommender to prefer
      certain candidates later (e.g. low-carb -> a grain-free fiber
      source), not yet wired into recommender.py's selection logic.

    PESCATARIAN is kept for backward compatibility with existing profiles
    but isn't one of Q2's chat options (dropped from the redesigned list).
    """

    HIGH_PROTEIN = "high_protein"
    LOW_CARB_KETO = "low_carb_keto"
    LOW_FAT = "low_fat"
    VEGAN = "vegan"
    VEGETARIAN = "vegetarian"
    PESCATARIAN = "pescatarian"
    NO_SPECIFIC_DIET = "omnivore"
    GLUTEN_FREE = "gluten_free"
    LACTOSE_FREE = "lactose_free"


class Language(str, Enum):
    DE = "de"
    EN = "en"


class Digestion(str, Enum):
    """Chat onboarding Q7 (optional). Maps to gap priority nudges in
    recommender.py — see SYMPTOM_PRIORITY_BOOST — since fiber and
    processed-food share are dimensions this app actually tracks."""

    FINE = "fine"
    BLOATED = "bloated"
    SLOW = "slow"
    SENSITIVE = "sensitive"


class VegFrequency(str, Enum):
    """Chat onboarding Q8 (optional). Collected but not yet used to
    shift any reference baseline — see recommender.py docstring."""

    EVERY_MEAL = "every_meal"
    ONCE_DAILY = "once_daily"
    FEW_TIMES_WEEK = "few_times_week"
    RARELY = "rarely"


class Gender(str, Enum):
    """Optional, used only for the Mifflin-St Jeor BMR term (see
    services/nutrition_personalization.py) — not asked for any other
    reason. `OTHER` uses the midpoint of the male/female BMR offset.

    Retained for backward compatibility. The Level-1 onboarding (E1)
    collects `sex` (sex-at-birth) instead and derives this field from it,
    so existing downstream code (nutrition_personalization) keeps working
    unchanged while the Ideal Profile Engine (E2) reads `sex`."""

    FEMALE = "female"
    MALE = "male"
    OTHER = "other"


# ── Level-1 onboarding enums (E1-S5) ─────────────────────────────────────
# These feed the Ideal Profile Engine (E2, services/ideal_profile.py) per
# the deterministic rules in business_rules.md (BR-E/BR-M).

class Sex(str, Enum):
    """Sex at birth — the Mifflin-St Jeor BMR term (BR-E1).
    `PREFER_NOT_TO_SAY` uses the mean of the male & female offset."""

    FEMALE = "female"
    MALE = "male"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class ExerciseFrequency(str, Enum):
    """Structured exercise per week → EAT added kcal/day (BR-E4)."""

    NONE = "none"
    ONE_TWO = "one_two"
    THREE_FOUR = "three_four"
    FIVE_SIX = "five_six"
    DAILY_ATHLETE = "daily_athlete"


class DailyMovement(str, Enum):
    """Non-exercise daily movement → NEAT as a % of BMR (BR-E3)."""

    MOSTLY_SITTING = "mostly_sitting"
    MIXED = "mixed"
    MOSTLY_STANDING = "mostly_standing"
    PHYSICAL_LABOR = "physical_labor"


class PregnancyStatus(str, Enum):
    """Shown only for female profiles (BR); adjusts micronutrient RDAs."""

    NONE = "none"
    PREGNANT = "pregnant"
    BREASTFEEDING = "breastfeeding"


class FormOfAddress(str, Enum):
    """How the app addresses the user (FR-2.2). Presentation-only."""

    NEUTRAL = "neutral"
    INFORMAL_DU = "informal_du"
    FORMAL_SIE = "formal_sie"


class MealsOutside(str, Enum):
    """How often the user eats outside the tracked groceries (E6). Feeds the
    confidence discount (BR-C4) and the eating-occasion coverage midpoints
    (BR-I6) — it NEVER scales intake (BR-I4)."""

    NEVER = "never"
    RARELY = "rarely"
    SOMETIMES = "sometimes"
    OFTEN = "often"
    DAILY = "daily"


class ReceiptsComplete(str, Enum):
    """How much of the user's shopping the uploaded receipts cover (E6).
    Confidence discount only (BR-C4)."""

    ALL = "all"
    MOST = "most"
    SOME = "some"
    FEW = "few"


class ProfileCreate(BaseModel):
    """
    Input for the chat onboarding flow: language + name up front, then
    goal/eating-style/activity/avoid-foods (required), then age, gender,
    weight, height, symptoms, digestion and veg/fruit frequency (all
    optional).

    Weight/height/gender were dropped from an earlier redesign and then
    reinstated (optional) once there was a concrete, real use for them:
    services/nutrition_personalization.py turns them into a personalized
    protein reference (BMR + activity-level TDEE), replacing the fixed
    density guideline when available. Birthday/household size/country/
    preferred supermarket stay dropped — nothing consumes those.

    `exclusions` (soft dislikes) stays in the schema for backward
    compatibility, but the chat no longer asks for it either; only
    `allergies` (hard, Q4) is collected.

    `symptoms` (Q6) is free-form like `allergies`, not an enum: the
    chat only offers a fixed set of values today, but nothing else
    validates against it — see recommender.py for what it's actually
    used for (priority nudges on already-tracked dimensions only, never
    a fabricated iron/B12/magnesium/omega-3/vitamin-D/biotin gap, since
    this app doesn't measure those).
    """

    goal: Goal
    age_range: Optional[AgeRange] = None
    activity_level: ActivityLevel
    dietary_pattern: DietaryPattern
    exclusions: List[str] = Field(default_factory=list)

    name: Optional[str] = None

    gender: Optional[Gender] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None

    # Hard, safety-relevant — checked separately from `exclusions` by
    # the exclusion filter and never overridden (chat onboarding Q4).
    allergies: List[str] = Field(default_factory=list)

    symptoms: List[str] = Field(default_factory=list)
    digestion: Optional[Digestion] = None
    veg_frequency: Optional[VegFrequency] = None

    language: Language = Language.EN

    # ── Level-1 onboarding fields (E1-S5) ────────────────────────────────
    # All optional so partial onboarding can be persisted and resumed
    # (E1-S6). The frontend also derives the legacy `gender`/`age_range`/
    # `activity_level` fields from these so existing downstream code keeps
    # working unchanged (see ChatOnboardingStep.toProfileCreate).
    form_of_address: Optional[FormOfAddress] = None
    sex: Optional[Sex] = None
    date_of_birth: Optional[str] = None  # ISO "YYYY-MM-DD"
    exercise_frequency: Optional[ExerciseFrequency] = None
    daily_movement: Optional[DailyMovement] = None
    pregnancy_status: Optional[PregnancyStatus] = None
    meals_per_day: Optional[int] = Field(default=None, ge=0, le=12)
    snacks_per_day: Optional[int] = Field(default=None, ge=0, le=12)
    dislikes: List[str] = Field(default_factory=list)
    address: Optional[str] = None

    # ── Status-quo attribution inputs (E6) ───────────────────────────────
    # BR-I2 share: not shared → 100%; shared → 1/household_size (incl. user),
    # optionally overridden by user_share. meals_outside / receipts_complete
    # feed the confidence discount only (BR-C4/BR-I4), never intake.
    groceries_shared: Optional[bool] = None
    household_size: Optional[int] = Field(default=None, ge=1, le=20)
    user_share: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    meals_outside: Optional[MealsOutside] = None
    receipts_complete: Optional[ReceiptsComplete] = None

    # E1-S6: false while the user is mid-walk-through, true once every
    # required step is answered (drives "resume vs. dashboard" on login).
    profile_complete: bool = False


# Sane biometric bounds (E1-S5 "out-of-range inputs blocked"). Applied via
# field validators below rather than Field(ge/le) so a legacy row that
# predates onboarding validation still deserializes on read.
_HEIGHT_CM_RANGE = (100.0, 250.0)
_WEIGHT_KG_RANGE = (30.0, 300.0)


class ProfileUpdate(BaseModel):
    """
    Partial edit of a stored profile (profile summary/edit screen).

    Every field optional so a PATCH only has to send what changed;
    `exclude_unset` in the route distinguishes "not provided" from an
    explicit reset to empty/null (e.g. clearing all allergies).
    """

    goal: Optional[Goal] = None
    age_range: Optional[AgeRange] = None
    activity_level: Optional[ActivityLevel] = None
    dietary_pattern: Optional[DietaryPattern] = None
    exclusions: Optional[List[str]] = None
    name: Optional[str] = None
    gender: Optional[Gender] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    allergies: Optional[List[str]] = None
    symptoms: Optional[List[str]] = None
    digestion: Optional[Digestion] = None
    veg_frequency: Optional[VegFrequency] = None
    language: Optional[Language] = None

    # Level-1 fields (E1)
    form_of_address: Optional[FormOfAddress] = None
    sex: Optional[Sex] = None
    date_of_birth: Optional[str] = None
    exercise_frequency: Optional[ExerciseFrequency] = None
    daily_movement: Optional[DailyMovement] = None
    pregnancy_status: Optional[PregnancyStatus] = None
    meals_per_day: Optional[int] = None
    snacks_per_day: Optional[int] = None
    dislikes: Optional[List[str]] = None
    address: Optional[str] = None
    # E6 status-quo attribution
    groceries_shared: Optional[bool] = None
    household_size: Optional[int] = None
    user_share: Optional[float] = None
    meals_outside: Optional[MealsOutside] = None
    receipts_complete: Optional[ReceiptsComplete] = None
    profile_complete: Optional[bool] = None


class Profile(ProfileCreate):
    """Stored profile (Task 3.2), as returned by the API / DB."""

    id: str
    created_at: Optional[str] = None


class IdealProfile(BaseModel):
    """Personalized daily targets produced by the Ideal Profile Engine
    (E2, services/ideal_profile.py) from a completed Level-1 profile.

    Micronutrients ship as DGE starter values pending dietitian
    verification (Q1) — see the `notes` field."""

    calories_kcal: int
    protein_g: int
    fat_g: int
    carbs_g: int
    fiber_g: int
    micronutrients: Dict[str, float] = Field(default_factory=dict)

    # Energy breakdown (BR-E1..E6), surfaced for transparency/debugging.
    bmr_kcal: int
    neat_kcal: int
    eat_kcal: int
    tef_kcal: int
    tdee_kcal: int

    # BR-M3: True when protein alone (with fat already dropped to its
    # 0.8 g/kg floor and carbs at 0) still meets/exceeds the calorie goal,
    # so the macro split can't be satisfied and the conflict is surfaced
    # rather than showing negative carbs.
    constrained: bool = False

    notes: List[str] = Field(default_factory=list)
