"""
Gap detection engine (Task 4.3 / Story 4.2).

Rule-based only (no ML). Compares the density-based NutritionProfile to
standard references and returns at most the top 3 gaps, ranked by how far
each one deviates from its reference, in plain non-medical language.
"""

from typing import List

from backend.app.models.snapshot import (
    NutritionProfile,
    Gap,
    GapStatus,
    ConfidenceLevel,
)
from backend.app import nutrition_model as nm

MAX_GAPS = 3


def detect_gaps(
    profile: NutritionProfile,
    confidence: ConfidenceLevel,
) -> List[Gap]:
    """Return up to MAX_GAPS gaps, worst deviation first."""

    candidates = []  # (severity, Gap)

    fiber = profile.fiber_per_1000kcal
    if fiber is not None and fiber < nm.FIBER_REF_PER_1000KCAL:
        severity = (nm.FIBER_REF_PER_1000KCAL - fiber) / nm.FIBER_REF_PER_1000KCAL
        candidates.append((severity, Gap(
            dimension="fiber",
            status=GapStatus.LOW,
            current_value=fiber,
            reference_value=nm.FIBER_REF_PER_1000KCAL,
            message=(
                f"Your basket is low in fiber (~{fiber:.0f} g per 1000 kcal "
                f"vs a ~{nm.FIBER_REF_PER_1000KCAL:.0f} g guideline). More whole "
                "grains, legumes, fruit or vegetables would help."
            ),
            confidence=confidence,
        )))

    protein = profile.protein_per_1000kcal
    if protein is not None and protein < nm.PROTEIN_REF_PER_1000KCAL:
        severity = (nm.PROTEIN_REF_PER_1000KCAL - protein) / nm.PROTEIN_REF_PER_1000KCAL
        candidates.append((severity, Gap(
            dimension="protein",
            status=GapStatus.LOW,
            current_value=protein,
            reference_value=nm.PROTEIN_REF_PER_1000KCAL,
            message=(
                f"Protein is on the low side (~{protein:.0f} g per 1000 kcal). "
                "Beans, dairy, eggs, fish or lean meat would round it out."
            ),
            confidence=confidence,
        )))

    sugar = profile.sugar_pct_energy
    if sugar is not None and sugar > nm.SUGAR_MAX_PCT_ENERGY:
        severity = (sugar - nm.SUGAR_MAX_PCT_ENERGY) / nm.SUGAR_MAX_PCT_ENERGY
        candidates.append((severity, Gap(
            dimension="sugar",
            status=GapStatus.HIGH,
            current_value=sugar,
            reference_value=nm.SUGAR_MAX_PCT_ENERGY,
            message=(
                f"Sugar makes up a high share of your basket's calories "
                f"(~{sugar:.0f}% of energy). Cutting back on sweetened drinks "
                "and snacks would lower it."
            ),
            confidence=confidence,
        )))

    processed = profile.processed_avg
    if processed is not None and processed > nm.PROCESSED_MAX_AVG:
        severity = (processed - nm.PROCESSED_MAX_AVG) / nm.PROCESSED_MAX_AVG
        candidates.append((severity, Gap(
            dimension="processed",
            status=GapStatus.HIGH,
            current_value=processed,
            reference_value=nm.PROCESSED_MAX_AVG,
            message=(
                f"Your basket leans heavily processed (avg {processed:.1f} on a "
                "1-4 scale). Swapping some ready-made items for whole foods "
                "would help."
            ),
            confidence=confidence,
        )))

    candidates.sort(key=lambda pair: pair[0], reverse=True)
    return [gap for _, gap in candidates[:MAX_GAPS]]
