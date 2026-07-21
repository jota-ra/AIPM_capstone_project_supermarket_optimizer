"""
Absolute daily nutrient requirements (RDA-style): iron, protein and calcium.

Companion to nutrition_personalization.py, but deliberately separate:
that module turns body data into a *density* reference (g per 1000 kcal)
to stay compatible with the existing day-agnostic gap model. A "Bedarf"
(requirement) is inherently a per-day absolute (e.g. "15 mg/day" iron,
"144 g/day" protein), not a density ratio — comparing it needs the
pantry-derived daily intake estimate from intake_estimator.py, not a
receipt's basket ratios.

Values are broad, commonly-cited reference intakes — not individualized
dietary advice, same disclaimer stance as nutrition_personalization.py
and nutrition_model.py.

Sourced from the DGE (Deutsche Gesellschaft für Ernährung) reference
values, checked against https://www.dge.de/wissenschaft/referenzwerte/
(2024 revision) rather than left as an unverified guess:
  - Iron: 11 mg/day (men), 16 mg/day (menstruating women), 14 mg/day
    (postmenopausal women) — the DGE's 2024 revision raised these from
    its previous 10/15/10 mg figures, which is what this file originally
    (incorrectly) shipped with.
  - Protein: 0.8 g/kg bodyweight/day general baseline for adults 19-65,
    corresponding to ~57-67 g/day at DGE's reference bodyweight.
  - Calcium: 1000 mg/day, flat across adult age (post-adolescence) and
    gender — DGE doesn't split this one by age/gender the way it does
    iron, so there's nothing to personalize.
"""

from typing import Optional, Union

from backend.app.models.profile import AgeRange, Gender, Profile, ProfileCreate
from backend.app.services.nutrition_personalization import daily_protein_target_g

ProfileLike = Union[Profile, ProfileCreate]

# Generic fallback when a profile has no age_range/gender yet — midpoint
# of the male (11mg) and menstruating-women (16mg) DGE reference, used
# only until personalization is possible (mirrors default_profile() in
# recommender.py: recommendations still work before onboarding).
IRON_REF_DEFAULT_MG_PER_DAY = 13.5

# Women in the pre-menopausal age buckets lose iron through
# menstruation and need more than a man's reference intake; from the
# 55+ bucket onward menopause is assumed, so the DGE reference drops
# (14mg) but stays above the male value (11mg) — unlike this file's
# original figures, DGE's postmenopausal reference does NOT converge
# all the way down to the male value.
_IRON_MG_PER_DAY = {
    (AgeRange.UNDER_25, Gender.FEMALE): 16.0,
    (AgeRange.R25_35, Gender.FEMALE): 16.0,
    (AgeRange.R36_45, Gender.FEMALE): 16.0,
    (AgeRange.R46_55, Gender.FEMALE): 16.0,
    (AgeRange.R55_PLUS, Gender.FEMALE): 14.0,
    (AgeRange.UNDER_25, Gender.MALE): 11.0,
    (AgeRange.R25_35, Gender.MALE): 11.0,
    (AgeRange.R36_45, Gender.MALE): 11.0,
    (AgeRange.R46_55, Gender.MALE): 11.0,
    (AgeRange.R55_PLUS, Gender.MALE): 11.0,
}


def personalized_iron_ref_mg_per_day(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    None when the profile doesn't have enough data (age_range or gender
    missing, or gender is OTHER — no single-sided reference applies) —
    caller should fall back to IRON_REF_DEFAULT_MG_PER_DAY in that case,
    same pattern as personalized_protein_ref_per_1000kcal.
    """

    if profile is None:
        return None
    if profile.age_range is None or profile.gender is None:
        return None

    return _IRON_MG_PER_DAY.get((profile.age_range, profile.gender))


# Generic fallback used only when a profile has no weight_kg yet — DGE's
# 0.8 g/kg baseline at its reference bodyweight (~57-67g/day), not the
# US FDA label's 50g %DV figure this file previously (incorrectly) used
# for a DACH-focused app. Not an individualized target — mirrors
# IRON_REF_DEFAULT_MG_PER_DAY's "recommendations still work before
# onboarding" reasoning.
PROTEIN_REF_DEFAULT_G_PER_DAY = 57.0


def personalized_protein_grams_per_day(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    Absolute daily protein target (g/day) — thin re-export of
    nutrition_personalization.daily_protein_target_g, kept here so every
    absolute nutrient requirement (iron, protein, calcium) has one
    obvious home for callers like absolute_gap_detector.py.
    """

    return daily_protein_target_g(profile)


# DGE's calcium reference for adults, flat across age (post-adolescence)
# and gender — source: https://www.dge.de/wissenschaft/referenzwerte/calcium/
CALCIUM_REF_MG_PER_DAY = 1000.0


def personalized_calcium_ref_mg_per_day(profile: Optional[ProfileLike]) -> Optional[float]:
    """
    Always returns the flat DGE reference — there's no profile data to
    personalize calcium by (unlike iron's age/gender split or protein's
    bodyweight scaling). Kept as a function anyway, not just the bare
    constant, so absolute_gap_detector.py's nutrient table stays uniform
    in shape across iron/protein/calcium.
    """

    return CALCIUM_REF_MG_PER_DAY
