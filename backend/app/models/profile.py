from enum import Enum
from typing import List, Optional

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
    reason. `OTHER` uses the midpoint of the male/female BMR offset."""

    FEMALE = "female"
    MALE = "male"
    OTHER = "other"


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


class Profile(ProfileCreate):
    """Stored profile (Task 3.2), as returned by the API / DB."""

    id: str
    created_at: Optional[str] = None
