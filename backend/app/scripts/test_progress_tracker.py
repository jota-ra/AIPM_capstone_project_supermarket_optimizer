"""
Manual test for Progress Tracking (integration briefing addendum).

Usage (run from the repo root):
    python -m backend.app.scripts.test_progress_tracker

Pure/offline: exercises compute_nutrition_delta + the trend/message
helpers directly with in-memory NutritionProfile objects, no DB needed.
compute_session_progress() itself needs Supabase (get_receipts_by_session /
get_receipt_items), so it isn't covered here — same DB-vs-offline split
as test_recommender.py's `--db` flag.
"""

from backend.app.analytics.nutrition_delta import compute_nutrition_delta
from backend.app.models.snapshot import NutritionProfile
from backend.app.services.progress_tracker import (
    MESSAGES,
    _addressed_gap_improved,
    _no_history_report,
    _trend_from_deltas,
)

PREVIOUS = NutritionProfile(
    total_calories_kcal=2000, total_grams=3000,
    fiber_per_1000kcal=8.0, protein_per_1000kcal=20.0,
    sugar_pct_energy=25.0, processed_avg=3.0,
    items_total=10, items_with_nutrition=10, items_matched=8, items_fallback=2,
)


def _profile(**overrides):
    data = PREVIOUS.model_dump()
    data.update(overrides)
    return NutritionProfile(**data)


def test_no_history_returns_insufficient_data():
    report = _no_history_report(receipts_compared=1)
    assert report.has_history is False
    assert report.trend == "insufficient_data"
    assert report.deltas == []
    print("test_no_history_returns_insufficient_data: OK")


def test_improvement_detected():
    current = _profile(fiber_per_1000kcal=15.0)
    delta = compute_nutrition_delta(PREVIOUS, current)
    fiber = next(d for d in delta.deltas if d.dimension == "fiber")
    assert fiber.direction == "up"
    assert fiber.is_improvement is True
    assert _addressed_gap_improved(delta.deltas, "fiber") is True
    assert _trend_from_deltas(delta.deltas) == "improving"
    print("test_improvement_detected: OK")


def test_decline_detected():
    current = _profile(sugar_pct_energy=45.0)
    delta = compute_nutrition_delta(PREVIOUS, current)
    sugar = next(d for d in delta.deltas if d.dimension == "sugar")
    assert sugar.direction == "up"
    assert sugar.is_improvement is False
    print("test_decline_detected: OK")


def test_disclaimer_always_present():
    for trend in MESSAGES:
        assert MESSAGES[trend]
    report = _no_history_report()
    assert report.disclaimer
    print("test_disclaimer_always_present: OK")


def main():
    test_no_history_returns_insufficient_data()
    test_improvement_detected()
    test_decline_detected()
    test_disclaimer_always_present()
    print("\nAll progress_tracker checks passed.")


if __name__ == "__main__":
    main()
