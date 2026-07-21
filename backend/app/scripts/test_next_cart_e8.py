"""
Tests for Epic 8 — Next-Cart Recommendation Engine.

Covers the "Next-Cart recommendations and scoring" acceptance scenarios
(BR-S1..S6). Offline.

Run from the repo root:
    python -m backend.app.scripts.test_next_cart_e8
"""

from backend.app.models.profile import ProfileCreate, Goal, DietaryPattern
from backend.app.models.next_cart import RecommendationStatus, ActionType
from backend.app.services import next_cart_engine as nce

_PASS = 0
_FAIL = 0


def check(label, got, expected):
    global _PASS, _FAIL
    ok = got == expected if not isinstance(expected, float) else abs(got - expected) < 1e-6
    if ok:
        _PASS += 1
        print(f"  OK   {label}: {got}")
    else:
        _FAIL += 1
        print(f"  FAIL {label}: got {got!r}, expected {expected!r}")


def _profile(**kw):
    base = dict(goal=Goal.BUILD_MUSCLE, activity_level="moderately_active", dietary_pattern="omnivore")
    base.update(kw)
    return ProfileCreate(**base)


def _analysis(bars, conf=0.6, grouping=None):
    return {"confidence": {"value": conf, "band": "medium"}, "bars": bars,
            "grouping": grouping or {}}


# ── BR-S5 goal relevance ─────────────────────────────────────────────────
def test_goal_relevance():
    print("BR-S5: goal relevance multipliers")
    check("build muscle → protein ×1.5", nce.goal_relevance(Goal.BUILD_MUSCLE, "protein"), 1.5)
    check("build muscle → carbs ×1.2", nce.goal_relevance(Goal.BUILD_MUSCLE, "carbs"), 1.2)
    check("lose fat → protein ×1.4", nce.goal_relevance(Goal.LOSE_WEIGHT_GRADUALLY, "protein"), 1.4)
    check("lose fat → fiber ×1.3", nce.goal_relevance(Goal.LOSE_WEIGHT_GRADUALLY, "fiber"), 1.3)
    check("maintain → protein ×1.1", nce.goal_relevance(Goal.MAINTAIN, "protein"), 1.1)
    check("unlisted nutrient → 1.0", nce.goal_relevance(Goal.BUILD_MUSCLE, "fiber"), 1.0)


# ── BR-S1/S2 scoring & ranking ───────────────────────────────────────────
def test_scoring_and_structure():
    print("BR-S1/S2: score = severity × confidence × symptom × goal; structure")
    a = _analysis([
        {"nutrient": "protein", "kind": "target", "intake": 50, "reference": 100},   # sev 0.5
        {"nutrient": "fiber", "kind": "target", "intake": 10, "reference": 30},       # sev 0.667
    ], conf=0.6, grouping={"Unhealthy": [{"name": "Cola"}, {"name": "Chips"}, {"name": "Keks"}]})
    r = nce.build_next_cart(a, _profile(goal=Goal.BUILD_MUSCLE))
    check("status recommended", r.status, RecommendationStatus.RECOMMENDED)
    # protein: 0.5 × 0.6 × 1.5 = 0.45 ; fiber: 0.667 × 0.6 × 1.0 = 0.4 → protein wins
    check("primary score = 0.45 (protein, goal-boosted)", r.primary.score, 0.45)
    check("primary targets protein", r.primary.targets_gap, "protein:low")
    check("≤2 alternatives", len(r.alternatives) <= 2, True)
    check("≤2 reduce", len(r.reduce) <= 2, True)
    check("reduce from red items", r.reduce, ["Cola", "Chips"])


# ── BR-S1 reduce requires over-consumed red items ────────────────────────
def test_reduce_requires_red():
    print("BR-S1: no reduce when no red-tier items")
    a = _analysis([{"nutrient": "protein", "kind": "target", "intake": 50, "reference": 100}],
                  grouping={"Healthy": [{"name": "Apfel"}], "Unhealthy": []})
    r = nce.build_next_cart(a, _profile())
    check("reduce empty without red items", r.reduce, [])


# ── BR-S6 exclusion before scoring + no-suitable state ───────────────────
def test_exclusion_and_no_suitable():
    print("BR-S6: exclusions filter before scoring; no-suitable state")
    # A vegan profile should never be offered the dairy Greek-yogurt candidate.
    a = _analysis([{"nutrient": "protein", "kind": "target", "intake": 50, "reference": 100}])
    r = nce.build_next_cart(a, _profile(dietary_pattern=DietaryPattern.VEGAN))
    items = [r.primary.item] + [x.item for x in r.alternatives] if r.primary else []
    check("no dairy yogurt for vegan", "Griechischer Joghurt" not in items, True)

    # Force every candidate for the gap to be excluded → no-suitable.
    orig = nce._CANDIDATES
    try:
        nce._CANDIDATES = {"protein:low": [{"item": "Erdnussbutter", "action_type": "add",
                                            "tags": ["peanut"], "rationale": "x"}]}
        r2 = nce.build_next_cart(a, _profile(allergies=["peanut"]))
        check("all excluded → no_suitable_candidate", r2.status, RecommendationStatus.NO_SUITABLE_CANDIDATE)
        check("no primary when none suitable", r2.primary, None)
    finally:
        nce._CANDIDATES = orig


# ── no gaps → balanced state ─────────────────────────────────────────────
def test_no_gaps():
    print("BR-S1: balanced basket → no-gaps")
    a = _analysis([{"nutrient": "protein", "kind": "target", "intake": 100, "reference": 100}])
    r = nce.build_next_cart(a, _profile())
    check("no gaps status", r.status, RecommendationStatus.NO_GAPS)


def main():
    for fn in (test_goal_relevance, test_scoring_and_structure, test_reduce_requires_red,
               test_exclusion_and_no_suitable, test_no_gaps):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
