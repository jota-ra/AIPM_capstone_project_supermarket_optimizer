"""
Tests for Epic 9 — Functional Layer (Level-2 symptoms, consent, prioritization).

Covers the "Level-2 functional questionnaire and consent" + "Not medical
advice" acceptance scenarios (FR-2.4/2.5, BR-P1, BR-S4, R-L2TRIG). Offline.

Run from the repo root:
    python -m backend.app.scripts.test_level2_e9
"""

from backend.app.models.profile import ProfileCreate, Goal
from backend.app.services import symptom_relevance as sr
from backend.app.services.next_cart_engine import build_next_cart
from backend.app.services.confidence_model import snapshot_confidence
from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues

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


# ── Consent gating (BR-P1 / "declining keeps app usable") ────────────────
def test_consent_gating():
    print("BR-P1: without consent every multiplier defaults to 1.0")
    no_consent = {"consent_level2": False, "l2_hunger": "most_of_day", "l2_alcohol": "weekly_plus"}
    check("no consent → protein 1.0", sr.symptom_relevance(no_consent, "protein"), 1.0)
    check("no consent → alcohol discount 1.0", sr.alcohol_discount(no_consent), 1.0)
    check("no consent → empty multiplier map", sr.symptom_multipliers(no_consent), {})
    check("no answers even with consent → 1.0", sr.symptom_relevance({"consent_level2": True}, "protein"), 1.0)


# ── BR-S4 symptom multipliers ────────────────────────────────────────────
def test_symptom_multipliers():
    print("BR-S4: symptom → nutrient multipliers")
    p = {"consent_level2": True, "l2_hunger": "most_of_day", "l2_energy": "afternoon_crash",
         "l2_bowel_frequency": "less_than_3_per_week"}
    check("hunger → protein ×1.5", sr.symptom_relevance(p, "protein"), 1.5)
    check("energy crash → iron ×1.4", sr.symptom_relevance(p, "iron"), 1.4)
    # stacking: hunger fiber 1.3 × bowel fiber 1.6 = 2.08 → capped 2.0
    check("stacked fiber capped at 2.0", sr.symptom_relevance(p, "fiber"), 2.0)
    check("unaffected nutrient → 1.0", sr.symptom_relevance(p, "calcium"), 1.0)


# ── Alcohol → confidence discount (BR-C4/BR-S4) ──────────────────────────
def test_alcohol_discount():
    print("BR-S4: alcohol weekly+ discounts confidence")
    check("weekly+ → 0.85", sr.alcohol_discount({"consent_level2": True, "l2_alcohol": "weekly_plus"}), 0.85)
    check("occasional → 1.0", sr.alcohol_discount({"consent_level2": True, "l2_alcohol": "occasional"}), 1.0)

    # end-to-end: the discount actually lowers snapshot confidence
    items = [{"quantity": 100, "unit": "g", "category": "fruit", "normalized_name": "a"}]
    mp = [MatchedProduct(parsed_item_name="a", match_type=MatchType.EXACT, confidence=1.0,
                         identity_conf=1.0, nutrition_conf=1.0, data_source="off",
                         nutrition=NutritionValues(calories_kcal=100))]
    sober = ProfileCreate(goal=Goal.MAINTAIN, activity_level="moderately_active", dietary_pattern="omnivore")
    drinker = ProfileCreate(goal=Goal.MAINTAIN, activity_level="moderately_active", dietary_pattern="omnivore",
                            consent_level2=True, l2_alcohol="weekly_plus")
    c_sober = snapshot_confidence(items, mp, sober)["value"]
    c_drinker = snapshot_confidence(items, mp, drinker)["value"]
    check("alcohol lowers snapshot confidence", round(c_drinker, 3), round(c_sober * 0.85, 3))


# ── E8 wiring: symptom relevance changes the recommendation score ────────
def test_symptom_feeds_e8():
    print("BR-S1/S4: symptom relevance feeds Next-Cart scoring")
    analysis = {"confidence": {"value": 0.6, "band": "medium"},
                "bars": [{"nutrient": "protein", "kind": "target", "intake": 50, "reference": 100}],
                "grouping": {}}
    base = ProfileCreate(goal=Goal.MAINTAIN, activity_level="moderately_active", dietary_pattern="omnivore")
    l2 = ProfileCreate(goal=Goal.MAINTAIN, activity_level="moderately_active", dietary_pattern="omnivore",
                       consent_level2=True, l2_hunger="most_of_day")
    s_base = build_next_cart(analysis, base).primary.score
    s_l2 = build_next_cart(analysis, l2).primary.score
    # base: 0.5 × 0.6 × 1.1(maintain goal) × 1.0 = 0.33
    # l2:   0.5 × 0.6 × 1.1 × 1.5(hunger→protein) = 0.495
    check("base score 0.33", s_base, 0.33)
    check("symptom-boosted score 0.495", s_l2, 0.495)


def main():
    for fn in (test_consent_gating, test_symptom_multipliers, test_alcohol_discount, test_symptom_feeds_e8):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
