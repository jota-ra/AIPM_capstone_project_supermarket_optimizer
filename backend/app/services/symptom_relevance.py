"""
Symptom-relevance multipliers (Epic 9-S3, BR-S4).

Turns the Level-2 questionnaire answers into per-nutrient priority
multipliers that feed the Next-Cart scoring (E8) and the alcohol
confidence discount (E7). Gated on explicit health-data consent (BR-P1):
without consent — or without answers — every multiplier defaults to 1.0,
so the app behaves exactly as Level-1-only (BR-S4).

Multiple matching answers stack multiplicatively, capped at 2.0 (BR-S4).
Nothing here diagnoses a cause; it only re-prioritizes nutrients the app
already tracks (BR-P6 / NG1).
"""

from typing import Dict

_CAP = 2.0

# Level-2 answer → {nutrient: factor} (BR-S4). Nutrient names match the
# gap/candidate vocabulary used by the recommender (protein, fiber, iron,
# carbs, magnesium, potassium).
_RULES = {
    ("l2_bowel_frequency", "less_than_3_per_week"): {"fiber": 1.6},
    ("l2_bloating", "often_daily"): {"fiber": 0.7},          # already-high-fiber case
    ("l2_hunger", "most_of_day"): {"protein": 1.5, "fiber": 1.3},
    ("l2_energy", "afternoon_crash"): {"iron": 1.4, "carbs": 1.2},
    ("l2_sleep", "poor"): {"magnesium": 1.2},
    ("l2_hydration", "low"): {"fiber": 0.7},
    ("l2_muscle_soreness", "active_sore"): {"protein": 1.3, "magnesium": 1.3, "potassium": 1.2},
}


def _has_consent(profile) -> bool:
    return bool(getattr(profile, "consent_level2", None)) if not isinstance(profile, dict) \
        else bool(profile.get("consent_level2"))


def _get(profile, field):
    return getattr(profile, field, None) if not isinstance(profile, dict) else profile.get(field)


def symptom_multipliers(profile) -> Dict[str, float]:
    """Per-nutrient multiplier map from the Level-2 answers (stacked ×,
    capped 2.0). Empty/1.0 everywhere without consent."""

    if profile is None or not _has_consent(profile):
        return {}
    out: Dict[str, float] = {}
    for (field, value), factors in _RULES.items():
        if _get(profile, field) == value:
            for nutrient, factor in factors.items():
                out[nutrient] = out.get(nutrient, 1.0) * factor
    # cap only the boosts (>1); reductions (e.g. fiber ×0.7) stay as-is
    return {n: (min(v, _CAP) if v > 1 else v) for n, v in out.items()}


def symptom_relevance(profile, nutrient: str) -> float:
    """SymptomRelevance for one nutrient (BR-S4). Defaults to 1.0."""

    return symptom_multipliers(profile).get(nutrient, 1.0)


def alcohol_discount(profile) -> float:
    """BR-C4 / BR-S4: global confidence ×0.85 when the user drinks weekly+
    (needs consent). 1.0 otherwise."""

    if profile is None or not _has_consent(profile):
        return 1.0
    return 0.85 if _get(profile, "l2_alcohol") == "weekly_plus" else 1.0
