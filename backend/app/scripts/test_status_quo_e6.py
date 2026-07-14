"""
Tests for Epic 6 — Status-Quo Profile & Consumption Model.

Covers the "Status-quo attribution and daily intake" and "Consumption
timeframe" acceptance scenarios (BR-I1..I6, BR-T1..T3). Fully offline:
the daily rollup runs on hand-built MatchedProducts so it doesn't depend
on OFF/BLS.

Run from the repo root:
    python -m backend.app.scripts.test_status_quo_e6
"""

from datetime import date

from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues
from backend.app.services import status_quo as sq
from backend.app.services import consumption_timeframe as ctf

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


# ── BR-I2 share ──────────────────────────────────────────────────────────
def test_share():
    print("BR-I2: user share")
    check("not shared → 100%", sq.user_share({"groceries_shared": False}), 1.0)
    check("shared among 4 → 1/4", sq.user_share({"groceries_shared": True, "household_size": 4}), 0.25)
    check("manual override wins", sq.user_share({"groceries_shared": True, "household_size": 4, "user_share": 0.4}), 0.4)
    check("unanswered defaults 100%", sq.user_share({}), 1.0)


# ── BR-I4/BR-C4: meals-outside discounts confidence, not intake ──────────
def test_meals_outside_no_intake_scaling():
    print("BR-I4: meals-outside discounts confidence, never intake")
    items = [{"name": "X", "quantity": 100, "unit": "g", "category": "fruit"}]
    matched = [MatchedProduct(parsed_item_name="X", match_type=MatchType.BLS, confidence=0.7,
                              data_source="bls", nutrition=NutritionValues(protein_g=10.0))]
    never = sq.build_status_quo(items, matched, {"meals_outside": "never"})
    often = sq.build_status_quo(items, matched, {"meals_outside": "often"})
    check("intake identical regardless of meals-outside", never.daily_intake, often.daily_intake)
    check("but discount differs (never=1.0)", never.external_intake_discount, 1.0)
    check("often discount < 1.0", often.external_intake_discount < 1.0, True)


# ── BR-I6 coverage ───────────────────────────────────────────────────────
def test_coverage():
    print("BR-I6: eating-occasion coverage (does not scale intake)")
    cov = sq.occasion_coverage({"meals_per_day": 3, "snacks_per_day": 2, "meals_outside": "often"})
    check("total occasions 5", cov["total_occasions"], 5)
    check("tracked ≈ 3 of 5 (often)", cov["tracked_occasions"], 3.0)


# ── BR-T1/T2 consumption windows ─────────────────────────────────────────
def test_windows():
    print("BR-T1/T2: consumption windows")
    check("fresh produce default", ctf.default_window("Obst"), 5)
    check("dairy default", ctf.default_window("Milchprodukte"), 8)
    check("pantry staple default", ctf.default_window("Backwaren"), 75)
    # BR-T2: mean of last 3 inter-purchase intervals (weekly buys → 7)
    weekly = [date(2026, 7, 1), date(2026, 7, 8), date(2026, 7, 15), date(2026, 7, 22)]
    check("repeat purchases → mean interval", ctf.refined_window(weekly, "Obst"), 7)
    # BR-T2: too few purchases → category default
    check("single purchase → default", ctf.window_for("Obst", None, [date(2026, 7, 1)]), 5)


# ── BR-I5 daily rollup (deterministic) ───────────────────────────────────
def test_daily_rollup():
    print("BR-I5: daily rollup Σ(nutrient × share × (1−waste)) ÷ days")
    # 100 g of a fruit (window 5 d), protein 10 g/100g + iron 2 mg/100g,
    # shared among 2 → share 0.5, waste 0.
    #   daily protein = 10 × (100/100) × 0.5 × 1 / 5 = 1.0
    #   daily iron    =  2 × ...                        = 0.2
    items = [{"name": "Apfel", "quantity": 100, "unit": "g", "category": "fruit"}]
    matched = [MatchedProduct(parsed_item_name="Apfel", match_type=MatchType.BLS, confidence=0.7,
                              data_source="bls",
                              nutrition=NutritionValues(protein_g=10.0, micros={"iron_mg": 2.0}))]
    r = sq.build_status_quo(items, matched, {"groceries_shared": True, "household_size": 2})
    check("share 0.5", r.user_share, 0.5)
    check("daily protein = 1.0", r.daily_intake.get("protein_g"), 1.0)
    check("daily iron = 0.2", r.daily_intake.get("iron_mg"), 0.2)
    check("items considered", r.items_considered, 1)

    # BR-I3 waste hook: per-item waste_fraction reduces the contribution.
    items_w = [{**items[0], "waste_fraction": 0.5}]
    rw = sq.build_status_quo(items_w, matched, {"groceries_shared": True, "household_size": 2})
    check("waste 0.5 halves intake", rw.daily_intake.get("protein_g"), 0.5)


def main():
    for fn in (test_share, test_meals_outside_no_intake_scaling, test_coverage,
               test_windows, test_daily_rollup):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
