"""
Gap detection & overall health score (Epic 7-S2/S3, BR-HS1..HS4, BR-S2a).

Compares the E2 *ideal* profile against the E6 *status-quo* daily intake,
per sub-profile (calories / macros / micros), and turns it into:

  - per-nutrient bars with a 0–100 "closeness" (BR-HS2: target nutrients
    penalize both directions; calories over-target and the ceiling
    nutrients {sugar, saturated fat, sodium} penalize over-limit only);
  - one 0–100 health score = weighted mean of the scored dimensions'
    closeness, dropping no-data dimensions and renormalizing the weights
    (BR-HS3). The micronutrient group carries weight 0 until the DGE/EFSA
    list is finalized (Q1), so only calories + macros + fibre score.

A dimension with no status-quo data (or confidence 0) is excluded, never
counted as a 100% deficit (BR-S2a). Pure/rule-based.
"""

from typing import Optional, List

# BR-HS3 scored dimensions (macros-first; micro group weight 0 until Q1).
# (label, ideal_field / status_quo_key, weight)
_SCORE_DIMS = [
    ("calories", "calories_kcal", 20),
    ("protein", "protein_g", 15),
    ("fat", "fat_g", 10),
    ("carbs", "carbs_g", 10),
    ("fiber", "fiber_g", 15),
]

# Ceiling nutrients (BR-HS2) — shown as bars, not part of the score weights.
_CEILING = ("sugar_g", "saturated_fat_g", "sodium_mg")

_ON_TARGET_CLOSENESS = 85.0


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def closeness_target(intake: float, target: float) -> float:
    """BR-HS2 target nutrient: penalized in BOTH directions."""
    if target <= 0:
        return 0.0
    return round(100 * (1 - _clamp(abs(intake - target) / target)), 1)


def closeness_ceiling(intake: float, limit: float) -> float:
    """BR-HS2 ceiling nutrient: 100 at/under the limit, declines above it."""
    if limit <= 0:
        return 0.0
    if intake <= limit:
        return 100.0
    return round(100 * (1 - _clamp((intake - limit) / limit)), 1)


def _ideal_get(ideal, field):
    if ideal is None:
        return None
    return getattr(ideal, field, None) if not isinstance(ideal, dict) else ideal.get(field)


def _ideal_micros(ideal) -> dict:
    if ideal is None:
        return {}
    return (getattr(ideal, "micronutrients", None) if not isinstance(ideal, dict)
            else ideal.get("micronutrients")) or {}


def build_analysis(ideal, status_quo_daily: dict, confidence: Optional[dict] = None) -> dict:
    """
    Produce per-nutrient bars + the overall health score from an ideal
    profile (E2) and the status-quo daily intake (E6).
    """

    daily = status_quo_daily or {}
    bars: List[dict] = []
    weighted_sum = 0.0
    weight_total = 0.0

    # ── scored macro dimensions ──────────────────────────────────────────
    for label, field, weight in _SCORE_DIMS:
        target = _ideal_get(ideal, field)
        intake = daily.get(field)
        if target is None or intake is None:
            # BR-S2a: no data → excluded from the score (not a fake deficit).
            bars.append({"nutrient": label, "kind": "target", "intake": intake,
                         "reference": target, "bar_pct": None, "closeness": None,
                         "in_score": False, "weight": weight})
            continue
        closeness = closeness_target(intake, target)
        bar_pct = round(intake / target * 100, 1) if target else None
        weighted_sum += closeness * weight
        weight_total += weight
        bars.append({"nutrient": label, "kind": "target", "intake": round(intake, 1),
                     "reference": round(target, 1), "bar_pct": bar_pct,
                     "closeness": closeness, "in_score": True, "weight": weight})

    # ── ceiling nutrient bars (display only, weight 0) ───────────────────
    cal_target = _ideal_get(ideal, "calories_kcal") or 0
    ceiling_limits = {
        "sugar_g": (0.10 * cal_target / 4) if cal_target else None,       # ~10% energy
        "saturated_fat_g": (0.10 * cal_target / 9) if cal_target else None,
        "sodium_mg": 2300.0,
    }
    for field in _CEILING:
        limit = ceiling_limits.get(field)
        intake = daily.get(field)
        if intake is None or not limit:
            continue
        bars.append({"nutrient": field.replace("_g", "").replace("_mg", ""),
                     "kind": "ceiling", "intake": round(intake, 1), "reference": round(limit, 1),
                     "bar_pct": round(intake / limit * 100, 1),
                     "closeness": closeness_ceiling(intake, limit),
                     "in_score": False, "weight": 0})

    # ── micro bars (target; group weight 0 until Q1) ─────────────────────
    for key, target in _ideal_micros(ideal).items():
        intake = daily.get(key)
        if intake is None or not target:
            continue
        bars.append({"nutrient": key, "kind": "target", "intake": round(intake, 2),
                     "reference": round(target, 2), "bar_pct": round(intake / target * 100, 1),
                     "closeness": closeness_target(intake, target),
                     "in_score": False, "weight": 0})  # micro weight 0 (BR-HS3 / Q1)

    # ── overall score (weighted mean over scored dims, renormalized) ─────
    score = round(weighted_sum / weight_total) if weight_total else None

    scored = [b for b in bars if b["in_score"]]
    on_target = bool(scored) and all(b["closeness"] >= _ON_TARGET_CLOSENESS for b in scored) \
        and all(b["closeness"] >= _ON_TARGET_CLOSENESS for b in bars if b["kind"] == "ceiling")

    return {
        "score": score,                      # 0–100, or None if no data
        "confidence": confidence or {},      # BR-HS4: shown WITH the score, no shrink
        "bars": bars,
        "on_target": on_target,
        "micros_gated": True,                # BR-HS3: micro group weight 0 until Q1
    }
