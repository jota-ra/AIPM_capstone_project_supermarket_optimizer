"""
Unified confidence model (Epic 7, BR-C1..C5).

Turns the per-item match confidences (identity_conf × nutrition_conf, from
the E4 resolver) into one honest snapshot confidence for the whole basket:

    snapshot = data_conf × coverage_conf × completeness
               × external_intake_discount × alcohol_discount        (BR-C2)

where data_conf is the contribution-weighted mean of per-item confidences
(weighted by each item's grams), coverage_conf steps up with item count
(BR-C3), completeness is the real-match share, and the discounts come from
the status-quo answers (BR-C4). Banded Low/Med/High (BR-C5). Pure/rule-based.
"""

from typing import List, Optional

from backend.app.models.nutrition import MatchedProduct, MatchType
from backend.app.models.snapshot import ConfidenceLevel
from backend.app.services.nutrition_profile import grams_for
from backend.app.services.status_quo import external_intake_discount


def per_item_confidence(mp: MatchedProduct) -> float:
    """BR-C1: identity_conf × nutrition_conf; category fallback → 0.3;
    unknown/none → 0."""

    if mp.match_type == MatchType.NONE:
        return 0.0
    if mp.unknown or mp.match_type == MatchType.FALLBACK:
        return 0.3
    idc = mp.identity_conf if mp.identity_conf is not None else mp.confidence
    ntc = mp.nutrition_conf if mp.nutrition_conf is not None else 1.0
    return round(max(0.0, min(1.0, idc * ntc)), 3)


def coverage_conf(item_count: int) -> float:
    """BR-C3: coverage confidence by matched item count."""

    if item_count >= 200:
        return 1.0
    if item_count >= 100:
        return 0.8
    if item_count >= 50:
        return 0.6
    if item_count >= 20:
        return 0.4
    return 0.2


def band(conf: float) -> ConfidenceLevel:
    """BR-C5 bands: <0.34 Low, 0.34–0.66 Medium, >0.66 High."""

    if conf > 0.66:
        return ConfidenceLevel.HIGH
    if conf >= 0.34:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def snapshot_confidence(items: List[dict], matched: List[MatchedProduct], profile=None) -> dict:
    """BR-C2: the multiplicative snapshot confidence + its band."""

    if not matched:
        return {"value": 0.0, "band": ConfidenceLevel.LOW.value,
                "data_conf": 0.0, "coverage_conf": 0.2, "completeness": 0.0,
                "external_intake_discount": 1.0}

    # data_conf = grams-contribution-weighted mean of per-item confidence.
    total_g = 0.0
    weighted = 0.0
    real = 0
    for item, mp in zip(items, matched):
        grams = grams_for(item.get("quantity"), item.get("unit"), item.get("category"),
                          item.get("normalized_name") or item.get("name"))
        total_g += grams
        weighted += grams * per_item_confidence(mp)
        if not (mp.unknown or mp.match_type in (MatchType.FALLBACK, MatchType.NONE)):
            real += 1
    data_conf = (weighted / total_g) if total_g else 0.0

    cov = coverage_conf(len(matched))
    completeness = real / len(matched)
    ext = external_intake_discount(profile) if profile is not None else 1.0
    alcohol = 1.0  # BR-C4: 0.85 if weekly+ — needs Level-2 (Epic 9); 1.0 for now

    value = round(data_conf * cov * completeness * ext * alcohol, 3)
    return {
        "value": value,
        "band": band(value).value,
        "data_conf": round(data_conf, 3),
        "coverage_conf": cov,
        "completeness": round(completeness, 3),
        "external_intake_discount": ext,
    }
