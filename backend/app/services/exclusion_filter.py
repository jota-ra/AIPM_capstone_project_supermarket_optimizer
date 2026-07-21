"""
Dietary exclusion filter (Task 3.3 / Story 3.2).

Checks a candidate food/product against a user's profile — dietary
pattern (vegan, vegetarian, ...), allergies, and free-text exclusions
(dislikes) — and decides whether it may ever be recommended. Feeds
Epic 5 (Next Cart) so a recommendation is never generated that conflicts
with the user's diet; when a candidate is blocked, an alternate
suggestion of the same purpose is offered where one is known.

`allergies` and `exclusions` (dislikes) are checked separately even
though they block the same way today: allergies are safety-relevant and
must never be softened later (e.g. "recommend anyway, just flag it"),
while dislikes are a softer preference that a future iteration may
choose to override for a strong-enough gap. Keeping them as separate
profile fields (see models/profile.py) means that later change doesn't
require re-deriving "which of these strings was actually an allergy."
"""

from typing import List, Optional

from pydantic import BaseModel, Field

from backend.app.models.profile import DietaryPattern, Profile, ProfileCreate
from backend.app.services import i18n

# Dietary pattern -> tags it excludes.
# NO_SPECIFIC_DIET and the soft styles (HIGH_PROTEIN, LOW_CARB_KETO,
# LOW_FAT) exclude nothing — they're not hard rules, see DietaryPattern's
# docstring in models/profile.py.
DIETARY_PATTERN_EXCLUDED_TAGS = {
    DietaryPattern.VEGAN: {"meat", "fish", "dairy", "eggs", "honey", "animal_product"},
    DietaryPattern.VEGETARIAN: {"meat", "fish"},
    DietaryPattern.PESCATARIAN: {"meat"},
    DietaryPattern.GLUTEN_FREE: {"gluten"},
    # Approximation: candidates only carry a broad "dairy" tag, not a
    # finer lactose-specific one, so lactose-free excludes all dairy
    # even though some lactose-free dairy products exist.
    DietaryPattern.LACTOSE_FREE: {"dairy"},
    DietaryPattern.NO_SPECIFIC_DIET: set(),
    DietaryPattern.HIGH_PROTEIN: set(),
    DietaryPattern.LOW_CARB_KETO: set(),
    DietaryPattern.LOW_FAT: set(),
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
    # "diet" (dietary_pattern) | "allergy" | "dislike" (exclusions) — lets
    # a caller/UI treat an allergy block differently from a dislike block.
    blocked_by_type: Optional[str] = None
    reason: Optional[str] = None
    alternate_suggestion: Optional[str] = None


def _match_free_text_list(
    items: List[str], candidate_tags: set, name_l: str
) -> Optional[str]:
    """Return the first entry of `items` that matches the candidate's
    tags or name, or None. Shared by allergies and exclusions since both
    match the same way — only how the match is treated differs."""

    for item in {i.strip().lower() for i in items if i.strip()}:
        # Naive singular/plural handling ("peanuts" should still catch
        # "peanut butter") without pulling in a stemming dependency.
        stem = item[:-1] if item.endswith("s") and len(item) > 3 else item
        if (
            item in candidate_tags
            or item in name_l
            or stem in name_l
            or any(stem in tag for tag in candidate_tags)
        ):
            return item
    return None


def check_candidate(
    profile: "Profile | ProfileCreate", candidate: ExclusionCandidate, lang: str = "en"
) -> ExclusionResult:
    """
    Decide whether `candidate` may be recommended to this profile.

    Checked in order: dietary pattern's excluded tags, then allergies,
    then free-text exclusions (dislikes) — all against the candidate's
    tags and name. Allergies are checked ahead of dislikes so the reason
    surfaced for a double-match is always the safety-relevant one.
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
            blocked_by_type="diet",
            reason=i18n.t(lang, "excl.diet", name=candidate.name, diet=profile.dietary_pattern.value, tag=tag),
            alternate_suggestion=ALTERNATE_SUGGESTIONS.get(tag),
        )

    allergy_hit = _match_free_text_list(profile.allergies or [], candidate_tags, name_l)
    if allergy_hit is not None:
        return ExclusionResult(
            allowed=False,
            blocked_by=allergy_hit,
            blocked_by_type="allergy",
            reason=i18n.t(lang, "excl.allergy", name=candidate.name, allergen=allergy_hit),
            alternate_suggestion=ALTERNATE_SUGGESTIONS.get(allergy_hit),
        )

    exclusion_hit = _match_free_text_list(profile.exclusions or [], candidate_tags, name_l)
    if exclusion_hit is not None:
        return ExclusionResult(
            allowed=False,
            blocked_by=exclusion_hit,
            blocked_by_type="dislike",
            reason=i18n.t(lang, "excl.dislike", name=candidate.name, item=exclusion_hit),
            alternate_suggestion=ALTERNATE_SUGGESTIONS.get(exclusion_hit),
        )

    return ExclusionResult(allowed=True)


def filter_candidates(
    profile: "Profile | ProfileCreate", candidates: List[ExclusionCandidate]
) -> List[ExclusionCandidate]:
    """Keep only the candidates allowed under the profile's constraints."""

    return [c for c in candidates if check_candidate(profile, c).allowed]
