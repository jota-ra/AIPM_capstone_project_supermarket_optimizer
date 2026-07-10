"""
Nutrition dimension definitions & scoring (Task 4.1).

The MVP judges a basket by day-agnostic density ratios rather than
absolute daily totals (receipts carry no "how many days" information):

  - fiber   : grams per 1000 kcal        (IOM/DGE reference ~14 g/1000 kcal)
  - protein : grams per 1000 kcal        (~25 g/1000 kcal as a low-bar)
  - sugar   : % of energy from sugar      (WHO free-sugar guidance <10%;
              we only have TOTAL sugars, so a looser 20% heuristic is used)
  - processed: average NOVA score 1..4    (>2.5 leans processed)

Everything here is rule-based on purpose — no ML — so the logic stays
transparent and trustworthy for the MVP.
"""

from typing import List, Optional

from backend.app.models.snapshot import (
    NutritionProfile,
    DimensionSnapshot,
    ConfidenceLevel,
)

# ─────────────────────────────────────────────────────────────
# References / thresholds
# ─────────────────────────────────────────────────────────────

FIBER_REF_PER_1000KCAL = 14.0     # below -> low fiber
PROTEIN_REF_PER_1000KCAL = 25.0   # below -> low protein
SUGAR_MAX_PCT_ENERGY = 20.0       # above -> high sugar (total-sugar heuristic)
PROCESSED_MAX_AVG = 2.5           # above -> highly processed

DISCLAIMER = (
    "Estimated from your grocery purchases, not your actual intake. "
    "Receipts can't capture meals eaten out, shared food, or what you "
    "actually ate. This is not medical advice."
)

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
    profile: NutritionProfile, protein_ref: Optional[float] = None
) -> List[DimensionSnapshot]:
    """
    Assemble the display rows for the snapshot (Story 4.1).

    `protein_ref` overrides PROTEIN_REF_PER_1000KCAL when the caller has
    a personalized value (see services/nutrition_personalization.py) —
    the displayed reference then matches whatever gap_detector.py
    actually used, instead of silently showing the generic guideline.
    """

    effective_protein_ref = protein_ref or PROTEIN_REF_PER_1000KCAL

    return [
        DimensionSnapshot(
            dimension="fiber",
            value=profile.fiber_per_1000kcal,
            unit="g per 1000 kcal",
            reference=FIBER_REF_PER_1000KCAL,
            ratio=_ratio(profile.fiber_per_1000kcal, FIBER_REF_PER_1000KCAL),
            status=classify_fiber(profile.fiber_per_1000kcal),
            what_this_means=WHAT_THIS_MEANS["fiber"],
        ),
        DimensionSnapshot(
            dimension="protein",
            value=profile.protein_per_1000kcal,
            unit="g per 1000 kcal",
            reference=effective_protein_ref,
            ratio=_ratio(profile.protein_per_1000kcal, effective_protein_ref),
            status=classify_protein(profile.protein_per_1000kcal, effective_protein_ref),
            what_this_means=WHAT_THIS_MEANS["protein"],
        ),
        DimensionSnapshot(
            dimension="sugar",
            value=profile.sugar_pct_energy,
            unit="% of energy",
            reference=SUGAR_MAX_PCT_ENERGY,
            ratio=_ratio(profile.sugar_pct_energy, SUGAR_MAX_PCT_ENERGY),
            status=classify_sugar(profile.sugar_pct_energy),
            what_this_means=WHAT_THIS_MEANS["sugar"],
        ),
        DimensionSnapshot(
            dimension="processed",
            value=profile.processed_avg,
            unit="avg NOVA (1-4)",
            reference=PROCESSED_MAX_AVG,
            ratio=_ratio(profile.processed_avg, PROCESSED_MAX_AVG),
            status=classify_processed(profile.processed_avg),
            what_this_means=WHAT_THIS_MEANS["processed"],
        ),
        DimensionSnapshot(
            dimension="calories",
            value=profile.total_calories_kcal,
            unit="kcal (basket total, estimated)",
            reference=None,
            ratio=None,
            status="info",
            what_this_means=WHAT_THIS_MEANS["calories"],
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
