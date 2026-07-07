"""
Manual test for the Epic 2 nutrition mapping (no server / DB needed).

Runs the full map_items() pipeline (OFF match -> fallback -> match
quality) against a JSON file of items and prints the result.

Usage (run from the repo root):
    # default: map the parsed_items.json fixture
    python -m backend.app.scripts.test_mapping

    # map a specific items file
    python -m backend.app.scripts.test_mapping path/to/items.json

    # map the fixture AND (over)write fixtures/matched_products.json
    python -m backend.app.scripts.test_mapping --write-fixture

Needs network for the first run (OpenFoodFacts); results are cached in
services/_off_cache.json so re-runs are fast and offline.
"""

import json
import sys
from pathlib import Path

from backend.app.services.nutrition_mapping import map_items

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
PARSED_ITEMS = FIXTURES_DIR / "parsed_items.json"
MATCHED_OUT = FIXTURES_DIR / "matched_products.json"


def main():
    args = sys.argv[1:]
    write_fixture = "--write-fixture" in args
    args = [a for a in args if a != "--write-fixture"]

    items_path = Path(args[0]) if args else PARSED_ITEMS
    items = json.loads(items_path.read_text(encoding="utf-8"))

    result = map_items(items)

    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))

    if write_fixture:
        MATCHED_OUT.write_text(
            json.dumps(
                [p.model_dump() for p in result.matched_products],
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        print(f"\nWrote {len(result.matched_products)} products -> {MATCHED_OUT}")


if __name__ == "__main__":
    main()
