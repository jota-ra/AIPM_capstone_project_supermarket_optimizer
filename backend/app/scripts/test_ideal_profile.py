"""
Tests for the Ideal Profile Engine (E2, services/ideal_profile.py).

Covers every acceptance scenario under "Feature: Ideal profile calculation"
in acceptance_criteria.feature, plus the E2 business rules (BR-E1..E6,
BR-M1..M6, BR-Gen2) and the E2-S5 recompute-on-change behaviour.

No server / DB needed — the engine is pure. Run from the repo root:
    python -m backend.app.scripts.test_ideal_profile
"""

from datetime import date

from backend.app.models.profile import (
    ProfileCreate,
    Sex,
    Goal,
    ExerciseFrequency,
    DailyMovement,
    PregnancyStatus,
)
from backend.app.services.ideal_profile import (
    compute_ideal_profile,
    _bmr,
    KCAL_PER_G,
    _EAT_KCAL,
    _NEAT_PCT,
)

_PASS = 0
_FAIL = 0


def check(label: str, got, expected) -> None:
    global _PASS, _FAIL
    if got == expected:
        _PASS += 1
        print(f"  OK   {label}: {got}")
    else:
        _FAIL += 1
        print(f"  FAIL {label}: got {got!r}, expected {expected!r}")


def _profile(**overrides) -> ProfileCreate:
    """A completed Level-1 profile with the worked-example defaults, so a
    test only has to override the field it exercises. DOB is chosen so the
    age is exactly 32 relative to the pinned reference date used below."""

    base = dict(
        goal=Goal.MAINTAIN,
        activity_level="moderately_active",
        dietary_pattern="omnivore",
        sex=Sex.MALE,
        date_of_birth="1994-01-01",
        height_cm=182,
        weight_kg=80,
        exercise_frequency=ExerciseFrequency.THREE_FOUR,
        daily_movement=DailyMovement.MIXED,
    )
    base.update(overrides)
    return ProfileCreate(**base)


# ── The worked example (epics.md E2 test oracle) ─────────────────────────
def test_worked_example():
    print("Scenario: worked example male 32 / 80 kg / 182 cm")
    # Pin age to 32 by using a DOB 32 years before a fixed reference; the
    # engine reads age from DOB at compute time, so use an age-32 DOB.
    age32_dob = f"{date.today().year - 32}-01-01"
    ip = compute_ideal_profile(_profile(date_of_birth=age32_dob, goal=Goal.BUILD_MUSCLE))
    check("BMR", ip.bmr_kcal, 1782)
    check("NEAT (mixed, 10%)", ip.neat_kcal, 178)
    check("EAT (3-4x/wk)", ip.eat_kcal, 250)
    check("TEF", ip.tef_kcal, 221)
    check("TDEE additive", ip.tdee_kcal, 2431)
    check("calories (build +10%)", ip.calories_kcal, 2674)


# ── BMR: Mifflin & non-binary mean (BR-E1) ───────────────────────────────
def test_bmr_formulas():
    print("Scenario: BMR via Mifflin & non-binary mean of both")
    check("male BMR", round(_bmr(Sex.MALE, 80, 182, 32)), 1782)
    male = _bmr(Sex.MALE, 80, 182, 32)
    female = _bmr(Sex.FEMALE, 80, 182, 32)
    check("prefer-not-to-say = mean", _bmr(Sex.PREFER_NOT_TO_SAY, 80, 182, 32), (male + female) / 2)


# ── NEAT from daily movement (BR-E3) ─────────────────────────────────────
def test_neat_outline():
    print("Scenario Outline: NEAT from daily movement (BMR 1782)")
    cases = {
        DailyMovement.MOSTLY_SITTING: 0,
        DailyMovement.MIXED: round(1782 * 0.10),
        DailyMovement.MOSTLY_STANDING: round(1782 * 0.20),
        DailyMovement.PHYSICAL_LABOR: round(1782 * 0.35),
    }
    for mv, expected in cases.items():
        ip = compute_ideal_profile(_profile(daily_movement=mv, exercise_frequency=ExerciseFrequency.NONE))
        check(f"NEAT {mv.value}", ip.neat_kcal, expected)


# ── EAT from exercise frequency (BR-E4) ──────────────────────────────────
def test_eat_outline():
    print("Scenario Outline: EAT from exercise frequency")
    for freq, expected in {
        ExerciseFrequency.NONE: 0,
        ExerciseFrequency.ONE_TWO: 100,
        ExerciseFrequency.THREE_FOUR: 250,
        ExerciseFrequency.FIVE_SIX: 400,
        ExerciseFrequency.DAILY_ATHLETE: 600,
    }.items():
        ip = compute_ideal_profile(_profile(exercise_frequency=freq))
        check(f"EAT {freq.value}", ip.eat_kcal, expected)


# ── Goal adjustment → calorie target (BR-E6) ─────────────────────────────
def test_goal_adjustment():
    print("Scenario Outline: goal adjustment on TDEE 2431")
    # maintenance goals leave TDEE unchanged; only lose/build shift it.
    for goal, adj in {
        Goal.LOSE_WEIGHT_GRADUALLY: -0.15,
        Goal.MAINTAIN: 0.0,
        Goal.BUILD_MUSCLE: 0.10,
    }.items():
        age32_dob = f"{date.today().year - 32}-01-01"
        ip = compute_ideal_profile(_profile(date_of_birth=age32_dob, goal=goal))
        check(f"calories {goal.value}", ip.calories_kcal, round(2431 * (1 + adj)))


# ── Protein = max(activity, goal) g/kg (BR-M1) ───────────────────────────
def test_protein():
    print("Scenario: protein max(activity, goal)")
    # building muscle + 1-2x/week: activity 1.4 vs goal 2.0 → 2.0 g/kg
    ip = compute_ideal_profile(
        _profile(goal=Goal.BUILD_MUSCLE, exercise_frequency=ExerciseFrequency.ONE_TWO, weight_kg=80)
    )
    check("protein g/kg (2.0 * 80)", ip.protein_g, 160)
    # sedentary maintenance: activity 1.0 vs goal 1.2 → 1.2 g/kg
    ip2 = compute_ideal_profile(
        _profile(goal=Goal.MAINTAIN, exercise_frequency=ExerciseFrequency.NONE, weight_kg=80)
    )
    check("protein g/kg (1.2 * 80)", ip2.protein_g, 96)


# ── Fat hormone floor (BR-M2) ────────────────────────────────────────────
def test_fat_floor():
    print("Scenario: fat = max(30% kcal, 0.8 g/kg)")
    ip = compute_ideal_profile(_profile(goal=Goal.MAINTAIN))
    thirty_pct = 0.30 * ip.calories_kcal / KCAL_PER_G["fat"]
    floor = 0.8 * 80
    check("fat = greater of 30%/floor", ip.fat_g, round(max(thirty_pct, floor)))


# ── Carbs never negative / constrained (BR-M3) ───────────────────────────
def test_constrained():
    print("Scenario: carbohydrates never go negative → constrained flag")
    # High protein (fat-loss 2.0 g/kg) on a heavy, low-energy profile forces
    # protein + floor-fat past the calorie target.
    ip = compute_ideal_profile(
        _profile(
            goal=Goal.LOSE_WEIGHT_GRADUALLY,
            sex=Sex.FEMALE,
            height_cm=150,
            weight_kg=120,
            exercise_frequency=ExerciseFrequency.NONE,
            daily_movement=DailyMovement.MOSTLY_SITTING,
        )
    )
    check("carbs floored at 0", ip.carbs_g, 0)
    check("constrained flag set", ip.constrained, True)
    check("fat dropped to 0.8 g/kg floor", ip.fat_g, round(0.8 * 120))
    # A normal profile is never flagged constrained and has positive carbs.
    ok = compute_ideal_profile(_profile(goal=Goal.MAINTAIN))
    check("normal profile not constrained", ok.constrained, False)
    check("normal profile positive carbs", ok.carbs_g > 0, True)


# ── Energy density constants (BR-M6) ─────────────────────────────────────
def test_energy_densities():
    print("Scenario Outline: energy density constants")
    check("protein 4 kcal/g", KCAL_PER_G["protein"], 4.0)
    check("carb 4 kcal/g", KCAL_PER_G["carb"], 4.0)
    check("fat 9 kcal/g", KCAL_PER_G["fat"], 9.0)


# ── Fibre 14 g / 1000 kcal (BR-M4) ───────────────────────────────────────
def test_fiber():
    print("Scenario: fibre = 14 g per 1000 kcal")
    ip = compute_ideal_profile(_profile(goal=Goal.MAINTAIN))
    check("fiber", ip.fiber_g, round(14.0 * ip.calories_kcal / 1000.0))


# ── Micros: starter list is produced (reference_data.md §D1) ─────────────
def test_micros_present():
    print("Scenario: micronutrient starter list produced (Q1 resolved for MVP per §D1)")
    ip = compute_ideal_profile(_profile())
    check("iron present", "iron_mg" in ip.micronutrients, True)
    check("10 micronutrients", len(ip.micronutrients), 10)
    check(
        "pending-verification note",
        any("pending dietitian verification" in n for n in ip.notes),
        True,
    )
    # pregnancy raises iron/folate (BR-M5)
    preg = compute_ideal_profile(
        _profile(sex=Sex.FEMALE, pregnancy_status=PregnancyStatus.PREGNANT)
    )
    check("pregnancy raises iron to 30 mg", preg.micronutrients["iron_mg"], 30.0)
    check("pregnancy raises folate to 550 µg", preg.micronutrients["folate_ug"], 550.0)


# ── Incomplete biometrics → None (engine guard) ──────────────────────────
def test_incomplete_returns_none():
    print("Scenario: incomplete biometrics yield no ideal profile")
    incomplete = ProfileCreate(goal=Goal.MAINTAIN, activity_level="moderately_active", dietary_pattern="omnivore")
    check("None when biometrics missing", compute_ideal_profile(incomplete), None)


# ── E2-S5: recompute reflects a changed weight & age from DOB ────────────
def test_recompute_on_change():
    print("Scenario: recompute reflects profile changes (E2-S5 / R-RECALC)")
    light = compute_ideal_profile(_profile(weight_kg=60))
    heavy = compute_ideal_profile(_profile(weight_kg=100))
    check("heavier weight → more calories", heavy.calories_kcal > light.calories_kcal, True)
    # age is derived from DOB at compute time, not stored
    young = compute_ideal_profile(_profile(date_of_birth=f"{date.today().year - 25}-01-01"))
    old = compute_ideal_profile(_profile(date_of_birth=f"{date.today().year - 60}-01-01"))
    check("younger age → higher BMR", young.bmr_kcal > old.bmr_kcal, True)


def main():
    for fn in (
        test_worked_example,
        test_bmr_formulas,
        test_neat_outline,
        test_eat_outline,
        test_goal_adjustment,
        test_protein,
        test_fat_floor,
        test_constrained,
        test_energy_densities,
        test_fiber,
        test_micros_present,
        test_incomplete_returns_none,
        test_recompute_on_change,
    ):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
