"""
Next-Cart recommendation engine (Epic 8, BR-S1..S6).

Scores grounded candidate foods against the E7 analysis (ideal-vs-status-quo
gaps + confidence + item grouping) and produces the E8 output structure:

    Score = GapSeverity × Confidence × SymptomRelevance × GoalRelevance   (BR-S1)

- GapSeverity ∈ [0,1]: deficit clamp((target−intake)/target); excess
  clamp((intake−limit)/limit) (BR-S2). Confidence 0 → excluded (BR-S2a/S3).
- SymptomRelevance defaults to 1.0 until Level-2 (Epic 9) supplies it (BR-S4).
- GoalRelevance ≥ 1 from the goal lookup (BR-S5).
- Candidates are filtered by diet/allergies/dislikes BEFORE scoring (BR-S6),
  reusing services/exclusion_filter.py and the curated table in
  data/recommendations.json.

Output (BR-S1): 1 primary + ≤2 alternatives + ≤2 reduce (red-tier items in
the basket, only when over-consumed red items exist); a "no suitable
candidate" state when everything is excluded. Pure/rule-based, no LLM.
"""

import json
from pathlib import Path
from typing import List, Optional

from backend.app.models.profile import Goal
from backend.app.models.snapshot import ConfidenceLevel
from backend.app.models.next_cart import (
    ScoredRecommendation, StructuredNextCart, EvaluatedCandidate,
    ActionType, RecommendationStatus,
)
from backend.app.services.exclusion_filter import check_candidate, ExclusionCandidate

_RECS_PATH = Path(__file__).resolve().parents[1] / "data" / "recommendations.json"
with open(_RECS_PATH, encoding="utf-8") as _fh:
    _CANDIDATES = json.load(_fh)

# BR-S5 goal relevance (≥1), keyed on the app Goal enum. Per-nutrient
# multipliers; 1.0 for anything unlisted.
_GOAL_RELEVANCE = {
    Goal.BUILD_MUSCLE: {"protein": 1.5, "carbs": 1.2},
    Goal.LOSE_WEIGHT_GRADUALLY: {"protein": 1.4, "fiber": 1.3},
    # maintenance-ish goals: a gentle protein lean (BR-S5 "maintain ×1.1")
    Goal.EAT_BALANCED: {"protein": 1.1},
    Goal.MORE_ENERGY: {"protein": 1.1},
    Goal.BETTER_FOCUS: {"protein": 1.1},
    Goal.BETTER_SLEEP: {"protein": 1.1},
}

# E7 bar nutrient → (candidate key, gap direction). Only nutrients that have
# a curated candidate list can produce an "add" recommendation.
_DEFICIT_KEYS = {"protein": "protein:low", "fiber": "fiber:low",
                 "iron_mg": "iron:low", "calcium_mg": "calcium:low"}
_EXCESS_KEYS = {"sugar": "sugar:high"}

# nutrient base name used for the goal-relevance lookup
_NUTRIENT_BASE = {"protein": "protein", "fiber": "fiber", "carbs": "carbs",
                  "iron_mg": "iron", "calcium_mg": "calcium", "sugar": "sugar"}

_TIER_UNHEALTHY = "Unhealthy"


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def goal_relevance(goal, nutrient: str) -> float:
    base = _NUTRIENT_BASE.get(nutrient, nutrient)
    return _GOAL_RELEVANCE.get(goal, {}).get(base, 1.0)


def _severity_from_bar(bar: dict) -> float:
    """BR-S2 severity from an E7 bar (intake vs reference)."""
    intake, ref = bar.get("intake"), bar.get("reference")
    if intake is None or not ref:
        return 0.0
    if bar.get("kind") == "ceiling":
        return round(_clamp((intake - ref) / ref), 3)   # excess over limit
    return round(_clamp((ref - intake) / ref), 3)         # deficit under target


def derive_gaps(analysis: dict) -> List[dict]:
    """Turn E7 bars into scoreable gaps {nutrient, key, severity}."""
    gaps = []
    for bar in analysis.get("bars", []):
        nutrient = bar.get("nutrient")
        key = None
        if bar.get("kind") == "ceiling" and nutrient in _EXCESS_KEYS:
            key = _EXCESS_KEYS[nutrient]
        elif nutrient in _DEFICIT_KEYS:
            key = _DEFICIT_KEYS[nutrient]
        if not key:
            continue
        sev = _severity_from_bar(bar)
        if sev > 0:
            gaps.append({"nutrient": nutrient, "key": key, "severity": sev})
    return gaps


def build_next_cart(analysis: dict, profile) -> StructuredNextCart:
    """E8 structured recommendation from the E7 analysis + profile."""

    confidence_value = (analysis.get("confidence") or {}).get("value", 0.0)
    band = (analysis.get("confidence") or {}).get("band", "low")
    conf_level = ConfidenceLevel(band) if band in {"low", "medium", "high"} else ConfidenceLevel.LOW
    goal = getattr(profile, "goal", None)

    gaps = derive_gaps(analysis)
    scored: List[ScoredRecommendation] = []
    evaluated: List[EvaluatedCandidate] = []
    seen_items = set()

    for gap in sorted(gaps, key=lambda g: -g["severity"]):
        gr = goal_relevance(goal, gap["nutrient"])
        for cand in _CANDIDATES.get(gap["key"], []):
            name = cand["item"]
            # BR-S6: exclusion filter BEFORE scoring
            if profile is not None:
                res = check_candidate(profile, ExclusionCandidate(name=name, tags=cand.get("tags", [])))
                if not res.allowed:
                    evaluated.append(EvaluatedCandidate(item=name, targets_gap=gap["key"],
                                                        allowed=False, reason=res.reason))
                    continue
            if name in seen_items:
                continue
            seen_items.add(name)
            # BR-S1: severity × confidence × symptom(1.0) × goal
            score = round(gap["severity"] * confidence_value * 1.0 * gr, 4)
            scored.append(ScoredRecommendation(
                item=name,
                action_type=ActionType(cand.get("action_type", "add")),
                targets_gap=gap["key"],
                score=score, severity=gap["severity"], goal_relevance=gr,
                rationale=cand.get("rationale"),
            ))
            evaluated.append(EvaluatedCandidate(item=name, targets_gap=gap["key"], allowed=True))

    scored.sort(key=lambda r: -r.score)

    # BR-S1 reduce: red-tier (Unhealthy) items already in the basket, only
    # when such over-consumed items exist.
    grouping = analysis.get("grouping") or {}
    reduce = [it["name"] for it in grouping.get(_TIER_UNHEALTHY, [])][:2]

    if not scored:
        status = (RecommendationStatus.NO_SUITABLE_CANDIDATE if gaps
                  else RecommendationStatus.NO_GAPS)
        msg = ("No suitable recommendation — every candidate conflicts with your profile."
               if gaps else "Your basket looks balanced — no notable gaps to fill.")
        return StructuredNextCart(status=status, primary=None, alternatives=[], reduce=reduce,
                                  message=msg, confidence=conf_level, evaluated_candidates=evaluated)

    return StructuredNextCart(
        status=RecommendationStatus.RECOMMENDED,
        primary=scored[0],
        alternatives=scored[1:3],   # ≤2
        reduce=reduce,
        message=f"Top pick to close your biggest gap: {scored[0].item}.",
        confidence=conf_level,
        evaluated_candidates=evaluated,
    )
