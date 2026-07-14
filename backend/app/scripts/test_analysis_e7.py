"""
Tests for Epic 7 — Gap Detection, Health Score, Grouping & Confidence.

Covers the "Gap detection and health score", "Item health grouping" and
"Confidence model" acceptance scenarios (BR-HS1..HS4, BR-S2a, BR-G1..G6,
BR-C1..C5). Fully offline.

Run from the repo root:
    python -m backend.app.scripts.test_analysis_e7
"""

from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues
from backend.app.services.grouping import group_item, TIER_HEALTHY, TIER_OK, TIER_UNHEALTHY, TIER_GREY
from backend.app.services.gap_engine import closeness_target, closeness_ceiling, build_analysis
from backend.app.services import confidence_model as cm
from backend.app.models.snapshot import ConfidenceLevel

_PASS = 0
_FAIL = 0


def check(label, got, expected):
    global _PASS, _FAIL
    if got == expected:
        _PASS += 1
        print(f"  OK   {label}: {got}")
    else:
        _FAIL += 1
        print(f"  FAIL {label}: got {got!r}, expected {expected!r}")


class _Ideal:
    calories_kcal = 2000
    protein_g = 100
    fat_g = 70
    carbs_g = 250
    fiber_g = 30
    micronutrients = {"iron_mg": 10.0}


# ── BR-G grouping ────────────────────────────────────────────────────────
def test_grouping():
    print("BR-G: three-tier grouping by NOVA + sugar")
    check("NOVA4/sugar5 → Unhealthy", group_item(4, 5), TIER_UNHEALTHY)
    check("NOVA1/sugar25 → Unhealthy", group_item(1, 25), TIER_UNHEALTHY)
    check("NOVA1/sugar5 → Healthy", group_item(1, 5), TIER_HEALTHY)
    check("NOVA3/sugar12 → OK", group_item(3, 12), TIER_OK)
    check("no nutrition → grey", group_item(None, None), TIER_GREY)
    check("missing NOVA, sugar25 → Unhealthy (sugar alone)", group_item(None, 25), TIER_UNHEALTHY)
    check("missing NOVA, sugar5 → Healthy", group_item(None, 5), TIER_HEALTHY)


# ── BR-HS2 closeness ─────────────────────────────────────────────────────
def test_closeness():
    print("BR-HS2: per-dimension closeness")
    check("target equal → 100", closeness_target(100, 100), 100.0)
    check("target 50% → 50 (under penalized)", closeness_target(50, 100), 50.0)
    check("target 150% → 50 (over penalized)", closeness_target(150, 100), 50.0)
    check("ceiling below limit → 100", closeness_ceiling(80, 100), 100.0)
    check("ceiling above limit → penalized", closeness_ceiling(150, 100), 50.0)


# ── BR-HS3 score + renormalization + S2a + micro gate ────────────────────
def test_score():
    print("BR-HS3: weighted score, renormalize, S2a, micro gate")
    sq_on = {"calories_kcal": 2000, "protein_g": 100, "fat_g": 70, "carbs_g": 250, "fiber_g": 30, "iron_mg": 5.0}
    a = build_analysis(_Ideal(), sq_on, {"value": 0.5, "band": "medium"})
    check("all-on-target score = 100", a["score"], 100)
    check("on_target flag", a["on_target"], True)
    check("micros gated", a["micros_gated"], True)
    scored = [b["nutrient"] for b in a["bars"] if b["in_score"]]
    check("5 macro dims scored", scored, ["calories", "protein", "fat", "carbs", "fiber"])
    iron = [b for b in a["bars"] if b["nutrient"] == "iron_mg"][0]
    check("micro bar weight 0, not in score", (iron["weight"], iron["in_score"]), (0, False))

    # BR-S2a: a macro with no intake data is excluded (not a 100% deficit),
    # and the score renormalizes over the remaining dimensions.
    sq_missing_fat = {"calories_kcal": 2000, "protein_g": 100, "carbs_g": 250, "fiber_g": 30}
    a2 = build_analysis(_Ideal(), sq_missing_fat, {})
    fat_bar = [b for b in a2["bars"] if b["nutrient"] == "fat"][0]
    check("missing fat excluded from score", fat_bar["in_score"], False)
    check("still perfect score over measured dims", a2["score"], 100)

    # a genuine deficit lowers the score
    sq_low = {"calories_kcal": 2000, "protein_g": 50, "fat_g": 70, "carbs_g": 250, "fiber_g": 30}
    a3 = build_analysis(_Ideal(), sq_low, {})
    check("protein at 50% lowers score below 100", a3["score"] < 100, True)


# ── BR-C confidence model ────────────────────────────────────────────────
def _mp(match_type, idc=1.0, ntc=1.0, unknown=False):
    return MatchedProduct(parsed_item_name="x", match_type=match_type, confidence=idc,
                          identity_conf=idc, nutrition_conf=ntc, unknown=unknown,
                          data_source="x", nutrition=NutritionValues(calories_kcal=100))


def test_confidence():
    print("BR-C: unified confidence model")
    check("per-item identity×nutrition", cm.per_item_confidence(_mp(MatchType.EXACT, 0.9, 1.0)), 0.9)
    check("category fallback → 0.3", cm.per_item_confidence(_mp(MatchType.FALLBACK, unknown=True)), 0.3)
    check("none → 0", cm.per_item_confidence(_mp(MatchType.NONE)), 0.0)
    check("coverage <20 → 0.2", cm.coverage_conf(10), 0.2)
    check("coverage 20–50 → 0.4", cm.coverage_conf(30), 0.4)
    check("coverage 200+ → 1.0", cm.coverage_conf(250), 1.0)
    check("band low", cm.band(0.2), ConfidenceLevel.LOW)
    check("band medium", cm.band(0.5), ConfidenceLevel.MEDIUM)
    check("band high", cm.band(0.8), ConfidenceLevel.HIGH)

    # snapshot = data × coverage × completeness × external × alcohol
    items = [{"quantity": 100, "unit": "g", "category": "fruit", "normalized_name": "a"}]
    snap = cm.snapshot_confidence(items, [_mp(MatchType.EXACT, 1.0, 1.0)], profile=None)
    # data 1.0 × coverage 0.2 (1 item) × completeness 1.0 × ext 1.0 × alcohol 1.0
    check("snapshot multiplicative (1 item → 0.2)", snap["value"], 0.2)
    check("snapshot band Low", snap["band"], "low")


def main():
    for fn in (test_grouping, test_closeness, test_score, test_confidence):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
