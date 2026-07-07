from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Goal(str, Enum):
    """Primary goal driving recommendations (Story 3.1)."""

    LOSE_WEIGHT = "lose_weight"
    GAIN_MUSCLE = "gain_muscle"
    EAT_HEALTHIER = "eat_healthier"
    MORE_ENERGY = "more_energy"
    MAINTAIN_WEIGHT = "maintain_weight"


class AgeRange(str, Enum):
    R18_24 = "18-24"
    R25_34 = "25-34"
    R35_44 = "35-44"
    R45_54 = "45-54"
    R55_64 = "55-64"
    R65_PLUS = "65+"


class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"


class DietaryPattern(str, Enum):
    """
    Dietary pattern (Story 3.2). Allergies/dislikes are NOT modeled here —
    those go in `exclusions`, so "vegan" stays a clean diet type rather
    than a bucket for unrelated restrictions.
    """

    OMNIVORE = "omnivore"
    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    PESCATARIAN = "pescatarian"


class ProfileCreate(BaseModel):
    """
    Input for Story 3.1 (Quick Profile Setup).

    Exactly the 4 fields the roadmap calls out as required (goal, age
    range, activity level, dietary pattern) plus one optional field
    (exclusions) — <=5 questions total, completable in under 90 seconds.
    No biometrics or other nonessential fields (Story 3.3: skip optional
    details) — they're simply not part of the schema.
    """

    goal: Goal
    age_range: AgeRange
    activity_level: ActivityLevel
    dietary_pattern: DietaryPattern
    exclusions: List[str] = Field(default_factory=list)


class Profile(ProfileCreate):
    """Stored profile (Task 3.2), as returned by the API / DB."""

    id: str
    created_at: Optional[str] = None
