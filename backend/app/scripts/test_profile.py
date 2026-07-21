"""
Manual test for the Epic 3 profile schema (no server / DB needed).

Validates a few example answer sets against ProfileCreate: a valid
minimal submission, one with exclusions, and one with a bad enum value
to confirm validation actually rejects it.

Usage (run from the repo root):
    python -m backend.app.scripts.test_profile
"""

import json

from pydantic import ValidationError

from backend.app.models.profile import ProfileCreate

EXAMPLES = [
    {
        "goal": "maintain",
        "age_range": "25-35",
        "activity_level": "moderately_active",
        "dietary_pattern": "omnivore",
    },
    {
        "goal": "lose_weight_gradually",
        "age_range": "36-45",
        "activity_level": "light_activity",
        "dietary_pattern": "vegan",
        "exclusions": ["peanuts", "gluten"],
    },
]

INVALID_EXAMPLE = {
    "goal": "maintain",
    "age_range": "25-35",
    "activity_level": "extremely_active",  # not a real ActivityLevel value
    "dietary_pattern": "omnivore",
}


def main():
    for answers in EXAMPLES:
        profile = ProfileCreate.model_validate(answers)
        print("OK:", json.dumps(profile.model_dump(), indent=2))

    try:
        ProfileCreate.model_validate(INVALID_EXAMPLE)
        print("UNEXPECTED: invalid example was accepted")
    except ValidationError as e:
        print("Correctly rejected invalid activity_level:")
        print(e.errors()[0]["msg"])


if __name__ == "__main__":
    main()
