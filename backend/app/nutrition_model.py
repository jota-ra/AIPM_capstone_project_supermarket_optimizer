"""
Nutrition dimension definitions & scoring (Task 4.1).

The MVP judges a basket by day-agnostic density ratios rather than
absolute daily totals (receipts carry no "how many days" information):

  - fiber   : grams per 1000 kcal        (DGE reference: >=30 g/day,
              confirmed in its 2022 review, converted to a density —
              see FIBER_REF_PER_1000KCAL below for the exact figure and
              source)
  - protein : grams per 1000 kcal        (~25 g/1000 kcal as a low-bar;
              deliberately below DGE's ~28-34 g/1000kcal implied by its
              0.8 g/kg reference at typical energy intakes — this fixed
              value is a floor for the non-personalized path only, see
              nutrition_personalization.py for the real DGE-based
              individualized reference used whenever weight/height/age
              are available)
  - sugar   : % of energy from sugar      (see SUGAR_MAX_PCT_ENERGY below
              — a heuristic working around a real data limitation, not a
              directly-cited guideline value)
  - processed: average NOVA score 1..4    (see PROCESSED_MAX_AVG below —
              NOT a DGE metric; NOVA is a separate, Brazilian-origin food
              classification framework with no official "basket average"
              threshold in the literature)

Everything here is rule-based on purpose — no ML — so the logic stays
transparent and trustworthy for the MVP.
"""

from typing import List, Optional

from backend.app.models.snapshot import (
    NutritionProfile,
    DimensionSnapshot,
    ConfidenceLevel,
)
from backend.app.services import i18n

# ─────────────────────────────────────────────────────────────
# References / thresholds
# ─────────────────────────────────────────────────────────────

# DGE reference: >=30 g fiber/day, confirmed (not just carried over) in
# its 2022 referenz-values review; DGE itself states this corresponds to
# >=14.6 g/1000 kcal (3.5 g/MJ). This file previously used 14.0 — close,
# but not the actual cited figure. Source:
# https://www.dge.de/presse/meldungen/2022/ueberarbeitete-referenzwerte/
FIBER_REF_PER_1000KCAL = 14.6     # below -> low fiber

PROTEIN_REF_PER_1000KCAL = 25.0   # below -> low protein (see module docstring)

# WHO's 2015 guidance (endorsed by a joint DGE/DAG/DDG 2018 consensus
# paper) is <10% of energy from FREE sugar, ~50g/day at 2000 kcal —
# https://www.dge.de/wissenschaft/stellungnahmen-und-positionspapiere/stellungnahmen/quantitative-empfehlung-zur-zuckerzufuhr-in-deutschland/
# This app only has OFF's TOTAL sugars (includes naturally-occurring
# sugar in whole fruit/dairy, which the free-sugar definition excludes),
# so applying the 10% figure directly would over-flag whole-food baskets.
# 20% is a pragmatic doubling to compensate — NOT an independently cited
# threshold, just this app's own workaround for the data gap. If a food
# database exposes free/added sugar directly in the future (BLS may),
# switch back to the real 10% figure against that field instead.
SUGAR_MAX_PCT_ENERGY = 20.0       # above -> high sugar (total-sugar heuristic)

# NOVA (Monteiro et al.) classifies individual foods 1 (unprocessed) to
# 4 (ultra-processed); it does NOT define how to average that across a
# whole basket, and no dietary guideline (DGE or otherwise) publishes a
# numeric "average NOVA score" cutoff. 2.5 (the scale's midpoint) is this
# app's own simplification, not a cited value — flagged here so it isn't
# mistaken for the same rigor as the fiber/sugar figures above.
PROCESSED_MAX_AVG = 2.5           # above -> highly processed

DISCLAIMER = (
    "Estimated from your grocery purchases, not your actual intake. "
    "Receipts can't capture meals eaten out, shared food, or what you "
    "actually ate. This is not medical advice."
)


def disclaimer(lang: str = "en") -> str:
    """Localized data-sufficiency/not-medical-advice disclaimer (E13)."""
    return i18n.t(lang, "disclaimer")

# Neutral, non-diagnostic one-liners for the snapshot (Story 4.1).
WHAT_THIS_MEANS = {
    "fiber": "Fiber comes from whole grains, legumes, fruit and vegetables; "
             "a higher share generally points to a more balanced basket.",
    "protein": "Reflects how protein-dense your purchases are, relative to "
               "their calories.",
    "sugar": "The estimated share of your basket's calories that comes from "
             "sugar (based on total sugars).",
    "calories": "A rough estimate of the total food energy in the groceries "
                "analysed.",
    "processed": "How processed your basket leans, on a 1 (whole foods) to 4 "
                 "(ultra-processed) scale.",
}


# ─────────────────────────────────────────────────────────────
# Per-dimension classification
# ─────────────────────────────────────────────────────────────

def classify_fiber(value: Optional[float]) -> str:
    if value is None:
        return "info"
    return "low" if value < FIBER_REF_PER_1000KCAL else "ok"


def classify_protein(value: Optional[float], protein_ref: Optional[float] = None) -> str:
    if value is None:
        return "info"
    return "low" if value < (protein_ref or PROTEIN_REF_PER_1000KCAL) else "ok"


def classify_sugar(value: Optional[float]) -> str:
    if value is None:
        return "info"
    return "high" if value > SUGAR_MAX_PCT_ENERGY else "ok"


def classify_processed(value: Optional[float]) -> str:
    if value is None:
        return "info"
    return "high" if value > PROCESSED_MAX_AVG else "ok"


def _ratio(value: Optional[float], reference: float) -> Optional[float]:
    if value is None or reference == 0:
        return None
    return round(value / reference, 2)


def build_dimension_snapshots(
    profile: NutritionProfile, protein_ref: Optional[float] = None, lang: str = "en"
) -> List[DimensionSnapshot]:
    """
    Assemble the display rows for the snapshot (Story 4.1).

    `protein_ref` overrides PROTEIN_REF_PER_1000KCAL when the caller has
    a personalized value (see services/nutrition_personalization.py) —
    the displayed reference then matches whatever gap_detector.py
    actually used, instead of silently showing the generic guideline.

    `lang` (E13) localizes the unit labels and the "what this means" copy.
    """

    effective_protein_ref = protein_ref or PROTEIN_REF_PER_1000KCAL

    return [
        DimensionSnapshot(
            dimension="fiber",
            value=profile.fiber_per_1000kcal,
            unit=i18n.t(lang, "unit.g_per_1000kcal"),
            reference=FIBER_REF_PER_1000KCAL,
            ratio=_ratio(profile.fiber_per_1000kcal, FIBER_REF_PER_1000KCAL),
            status=classify_fiber(profile.fiber_per_1000kcal),
            what_this_means=i18n.t(lang, "wtm.fiber"),
        ),
        DimensionSnapshot(
            dimension="protein",
            value=profile.protein_per_1000kcal,
            unit=i18n.t(lang, "unit.g_per_1000kcal"),
            reference=effective_protein_ref,
            ratio=_ratio(profile.protein_per_1000kcal, effective_protein_ref),
            status=classify_protein(profile.protein_per_1000kcal, effective_protein_ref),
            what_this_means=i18n.t(lang, "wtm.protein"),
        ),
        DimensionSnapshot(
            dimension="sugar",
            value=profile.sugar_pct_energy,
            unit=i18n.t(lang, "unit.pct_energy"),
            reference=SUGAR_MAX_PCT_ENERGY,
            ratio=_ratio(profile.sugar_pct_energy, SUGAR_MAX_PCT_ENERGY),
            status=classify_sugar(profile.sugar_pct_energy),
            what_this_means=i18n.t(lang, "wtm.sugar"),
        ),
        DimensionSnapshot(
            dimension="processed",
            value=profile.processed_avg,
            unit=i18n.t(lang, "unit.nova"),
            reference=PROCESSED_MAX_AVG,
            ratio=_ratio(profile.processed_avg, PROCESSED_MAX_AVG),
            status=classify_processed(profile.processed_avg),
            what_this_means=i18n.t(lang, "wtm.processed"),
        ),
        DimensionSnapshot(
            dimension="calories",
            value=profile.total_calories_kcal,
            unit=i18n.t(lang, "unit.kcal_basket"),
            reference=None,
            ratio=None,
            status="info",
            what_this_means=i18n.t(lang, "wtm.calories"),
        ),
    ]


# ─────────────────────────────────────────────────────────────
# Confidence (Story 4.3)
# ─────────────────────────────────────────────────────────────

def confidence_level(profile: NutritionProfile) -> ConfidenceLevel:
    """
    Overall trust in the snapshot, driven by how many items were analysed
    and how many resolved to real OpenFoodFacts data (vs category fallback).
    """

    n = profile.items_total
    matched_ratio = (profile.items_matched / n) if n else 0.0

    if n >= 5 and matched_ratio >= 0.6:
        return ConfidenceLevel.HIGH
    if n >= 3 and matched_ratio >= 0.3:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW
