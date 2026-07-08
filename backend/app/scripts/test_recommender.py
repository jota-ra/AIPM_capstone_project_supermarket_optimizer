"""
Manual test for the Epic 5 Next Cart recommender.

Usage (run from the repo root):
    # OFFLINE: recommend against the gaps.json + profile.json fixtures,
    # no network / no DB needed. Also runs a vegan-vs-omnivore comparison
    # to show the exclusion fallback in action.
    python -m backend.app.scripts.test_recommender

    # Same, but also (over)write fixtures/recommendation.json
    python -m backend.app.scripts.test_recommender --write-fixture

    # LIVE: aggregate all receipts from the DB + a stored profile, then
    # recommend (needs Supabase config; profile_id optional)
    python -m backend.app.scripts.test_recommender --db [profile_id]
"""

import json
import sys
from pathlib import Path

from backend.app.models.profile import ProfileCreate
from backend.app.models.snapshot import Gap, ConfidenceLevel
from backend.app.services.recommender import recommend_next_cart

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def _load_gaps():
    raw = json.loads((FIXTURES / "gaps.json").read_text(encoding="utf-8"))
    return [Gap.model_validate(g) for g in raw]


def _print(label, rec):
    print(f"\n=== {label} ===")
    print(json.dumps(rec.model_dump(), indent=2, ensure_ascii=False))


def _offline():
    gaps = _load_gaps()
    profile = ProfileCreate.model_validate(
        json.loads((FIXTURES / "profile.json").read_text(encoding="utf-8"))
    )

    rec = recommend_next_cart(gaps, profile, ConfidenceLevel.HIGH)
    _print(f"fixture profile ({profile.dietary_pattern.value})", rec)

    if "--write-fixture" in sys.argv:
        out = FIXTURES / "recommendation.json"
        out.write_text(
            json.dumps(rec.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"\nWrote recommendation -> {out}")

    # Comparison: same gaps, omnivore profile with no exclusions.
    omnivore = ProfileCreate(
        goal="eat_healthier",
        age_range="25-34",
        activity_level="moderate",
        dietary_pattern="omnivore",
    )
    rec_omni = recommend_next_cart(gaps, omnivore, ConfidenceLevel.HIGH)
    _print("comparison profile (omnivore, no exclusions)", rec_omni)

    # Determinism check: same input -> same output.
    rec_again = recommend_next_cart(gaps, profile, ConfidenceLevel.HIGH)
    assert rec.model_dump() == rec_again.model_dump(), "non-deterministic output!"
    print("\nDeterminism check passed: same input -> same output.")

    # Exclusion FALLBACK demo: protein:low's first candidate (Greek yogurt)
    # is dairy, so a vegan profile must skip it and land on the next
    # allowed candidate (tofu) -- the real test of Story 5.2.
    protein_gap = [Gap(
        dimension="protein", status="low", current_value=18.0,
        reference_value=25.0, message="Protein is on the low side.",
        confidence="high",
    )]
    rec_vegan_protein = recommend_next_cart(protein_gap, profile, ConfidenceLevel.HIGH)
    _print("vegan profile, protein gap (expect fallback past dairy)", rec_vegan_protein)


def _live_db():
    from backend.app.db.supabase import get_profile
    from backend.app.models.profile import Profile
    from backend.app.services.nutrition_snapshot import build_snapshot_from_db
    from backend.app.services.recommender import default_profile

    profile_id = sys.argv[2] if len(sys.argv) > 2 else None
    snapshot = build_snapshot_from_db()

    profile = Profile.model_validate(get_profile(profile_id)) if profile_id else default_profile()
    rec = recommend_next_cart(snapshot.gaps, profile, snapshot.confidence)
    _print(f"DB-aggregated ({snapshot.items_analyzed} items, profile={profile.dietary_pattern.value})", rec)


def main():
    if "--db" in sys.argv:
        _live_db()
    else:
        _offline()


if __name__ == "__main__":
    main()
