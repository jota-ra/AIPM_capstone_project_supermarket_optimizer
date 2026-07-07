"""
Manual test for the Epic 3 dietary exclusion filter (no server / DB
needed).

Runs the roadmap's own example (vegan profile + "add Greek yogurt" ->
blocked, alternate suggested) plus a couple more cases covering
dietary-pattern blocks, free-text exclusion blocks, and an allowed item.
The first case loads `fixtures/profile.json` directly, per the sprint
plan's Task 3.3 requirement to test against that fixture.

Usage (run from the repo root):
    python -m backend.app.scripts.test_exclusion_filter
"""

import json
from pathlib import Path

from backend.app.models.profile import ProfileCreate
from backend.app.services.exclusion_filter import ExclusionCandidate, check_candidate

FIXTURE_PROFILE = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "profile.json").read_text(
        encoding="utf-8"
    )
)

CASES = [
    (
        "fixtures/profile.json (vegan + peanuts/gluten exclusions) blocks dairy",
        ProfileCreate.model_validate(FIXTURE_PROFILE),
        ExclusionCandidate(name="Greek yogurt", tags=["dairy"]),
    ),
    (
        "vegan profile blocks dairy (roadmap's Greek yogurt example)",
        ProfileCreate(
            goal="eat_healthier",
            age_range="25-34",
            activity_level="moderate",
            dietary_pattern="vegan",
        ),
        ExclusionCandidate(name="Greek yogurt", tags=["dairy"]),
    ),
    (
        "vegetarian profile allows dairy",
        ProfileCreate(
            goal="eat_healthier",
            age_range="25-34",
            activity_level="moderate",
            dietary_pattern="vegetarian",
        ),
        ExclusionCandidate(name="Greek yogurt", tags=["dairy"]),
    ),
    (
        "free-text exclusion blocks by name match",
        ProfileCreate(
            goal="eat_healthier",
            age_range="25-34",
            activity_level="moderate",
            dietary_pattern="omnivore",
            exclusions=["peanuts"],
        ),
        ExclusionCandidate(name="Peanut butter", tags=["snack"]),
    ),
    (
        "omnivore profile, no conflicts -> allowed",
        ProfileCreate(
            goal="gain_muscle",
            age_range="18-24",
            activity_level="active",
            dietary_pattern="omnivore",
        ),
        ExclusionCandidate(name="Lentils", tags=["protein", "vegetable"]),
    ),
]


def main():
    for label, profile, candidate in CASES:
        result = check_candidate(profile, candidate)
        print(f"\n{label}")
        print(f"  candidate: {candidate.name} (tags={candidate.tags})")
        print(f"  allowed: {result.allowed}")
        if not result.allowed:
            print(f"  blocked_by: {result.blocked_by}")
            print(f"  reason: {result.reason}")
            print(f"  alternate_suggestion: {result.alternate_suggestion}")


if __name__ == "__main__":
    main()
