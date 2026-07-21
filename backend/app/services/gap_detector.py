"""
Gap detection engine (Task 4.3 / Story 4.2).

Rule-based only (no ML). Compares the density-based NutritionProfile to
standard references and returns at most the top 3 gaps, ranked by how far
each one deviates from its reference, in plain non-medical language.
"""

from typing import List, Optional

from backend.app.models.snapshot import (
    NutritionProfile,
    Gap,
    GapStatus,
    ConfidenceLevel,
)
from backend.app import nutrition_model as nm
from backend.app.services import i18n

MAX_GAPS = 3


def detect_gaps(
    profile: NutritionProfile,
    confidence: ConfidenceLevel,
    protein_ref: Optional[float] = None,
    lang: str = "en",
) -> List[Gap]:
    """
    Return up to MAX_GAPS gaps, worst deviation first.

    `protein_ref` overrides PROTEIN_REF_PER_1000KCAL when the caller has
    a personalized value from weight/height/gender/activity (see
    services/nutrition_personalization.py) — omit it (or pass None) to
    use the fixed density guideline, unchanged from before.
    """

    effective_protein_ref = protein_ref or nm.PROTEIN_REF_PER_1000KCAL
    candidates = []  # (severity, Gap)

    fiber = profile.fiber_per_1000kcal
    if fiber is not None and fiber < nm.FIBER_REF_PER_1000KCAL:
        severity = (nm.FIBER_REF_PER_1000KCAL - fiber) / nm.FIBER_REF_PER_1000KCAL
        candidates.append((severity, Gap(
            dimension="fiber",
            status=GapStatus.LOW,
            current_value=fiber,
            reference_value=nm.FIBER_REF_PER_1000KCAL,
            message=i18n.t(lang, "gap.fiber", value=fiber, ref=nm.FIBER_REF_PER_1000KCAL),
            confidence=confidence,
        )))

    protein = profile.protein_per_1000kcal
    if protein is not None and protein < effective_protein_ref:
        severity = (effective_protein_ref - protein) / effective_protein_ref
        candidates.append((severity, Gap(
            dimension="protein",
            status=GapStatus.LOW,
            current_value=protein,
            reference_value=effective_protein_ref,
            message=i18n.t(lang, "gap.protein", value=protein, ref=effective_protein_ref),
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
            message=i18n.t(lang, "gap.sugar", value=sugar, ref=nm.SUGAR_MAX_PCT_ENERGY),
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
            message=i18n.t(lang, "gap.processed", value=processed, ref=nm.PROCESSED_MAX_AVG),
            confidence=confidence,
        )))

    candidates.sort(key=lambda pair: pair[0], reverse=True)
    return [gap for _, gap in candidates[:MAX_GAPS]]
