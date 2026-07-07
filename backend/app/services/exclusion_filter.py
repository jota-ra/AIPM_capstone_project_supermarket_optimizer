"""
Dietary exclusion filter (Task 3.3 / Story 3.2).

Checks a candidate food/product against a user's profile — dietary
pattern (vegan, vegetarian, ...) plus free-text exclusions (allergens,
dislikes) — and decides whether it may ever be recommended. Feeds
Epic 5 (Next Cart) so a recommendation is never generated that conflicts
with the user's diet; when a candidate is blocked, an alternate
suggestion of the same purpose is offered where one is known.
"""

from typing import List, Optional

from pydantic import BaseModel, Field

from backend.app.models.profile import DietaryPattern, Profile, ProfileCreate

# Dietary pattern -> tags it excludes. OMNIVORE excludes nothing.
DIETARY_PATTERN_EXCLUDED_TAGS = {
    DietaryPattern.VEGAN: {"meat", "fish", "dairy", "eggs", "honey", "animal_product"},
    DietaryPattern.VEGETARIAN: {"meat", "fish"},
    DietaryPattern.PESCATARIAN: {"meat"},
    DietaryPattern.OMNIVORE: set(),
}

# Blocked tag/keyword -> a same-purpose alternative to suggest instead.
ALTERNATE_SUGGESTIONS = {
    "dairy": "a plant-based yogurt or milk (oat, soy, or almond)",
    "meat": "a plant-based or legume-based protein (tofu, lentils, chickpeas)",
    "fish": "a plant-based omega-3 source (walnuts, flaxseed, chia seeds)",
    "eggs": "a plant-based egg substitute (tofu scramble, chickpea flour)",
    "animal_product": "a plant-based alternative",
    "honey": "maple syrup or agave syrup",
    "gluten": "a gluten-free grain (rice, gluten-free oats, quinoa)",
    "nuts": "a seed-based alternative (sunflower or pumpkin seeds)",
    "peanuts": "a seed-based alternative (sunflower seed butter)",
    "shellfish": "a non-shellfish seafood or plant-based omega-3 source",
    "lactose": "a lactose-free dairy or plant-based alternative",
}


class ExclusionCandidate(BaseModel):
    """A candidate food/product being checked against a profile."""

    name: str
    tags: List[str] = Field(default_factory=list)


class ExclusionResult(BaseModel):
    allowed: bool
    blocked_by: Optional[str] = None
    reason: Optional[str] = None
    alternate_suggestion: Optional[str] = None


def check_candidate(
    profile: "Profile | ProfileCreate", candidate: ExclusionCandidate
) -> ExclusionResult:
    """
    Decide whether `candidate` may be recommended to this profile.

    Checks the dietary pattern's excluded tags first, then the profile's
    free-text exclusions (matched against tags and the candidate name).
    """

    excluded_tags = DIETARY_PATTERN_EXCLUDED_TAGS.get(profile.dietary_pattern, set())
    candidate_tags = {t.strip().lower() for t in candidate.tags}
    name_l = candidate.name.lower()

    pattern_hit = candidate_tags & excluded_tags
    if pattern_hit:
        tag = sorted(pattern_hit)[0]
        return ExclusionResult(
            allowed=False,
            blocked_by=tag,
            reason=f"'{candidate.name}' conflicts with a {profile.dietary_pattern.value} diet ({tag}).",
            alternate_suggestion=ALTERNATE_SUGGESTIONS.get(tag),
        )

    user_exclusions = {e.strip().lower() for e in (profile.exclusions or []) if e.strip()}
    for exclusion in user_exclusions:
        # Naive singular/plural handling ("peanuts" should still catch
        # "peanut butter") without pulling in a stemming dependency.
        stem = exclusion[:-1] if exclusion.endswith("s") and len(exclusion) > 3 else exclusion
        if (
            exclusion in candidate_tags
            or exclusion in name_l
            or stem in name_l
            or any(stem in tag for tag in candidate_tags)
        ):
            return ExclusionResult(
                allowed=False,
                blocked_by=exclusion,
                reason=f"'{candidate.name}' matches your excluded item '{exclusion}'.",
                alternate_suggestion=ALTERNATE_SUGGESTIONS.get(exclusion),
            )

    return ExclusionResult(allowed=True)


def filter_candidates(
    profile: "Profile | ProfileCreate", candidates: List[ExclusionCandidate]
) -> List[ExclusionCandidate]:
    """Keep only the candidates allowed under the profile's constraints."""

    return [c for c in candidates if check_candidate(profile, c).allowed]
