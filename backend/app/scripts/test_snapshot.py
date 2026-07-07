"""
Manual test for the Epic 4 nutrition snapshot.

Aggregates across MULTIPLE receipts and prints the snapshot + gaps.

Usage (run from the repo root):
    # OFFLINE: aggregate the fixtures (parsed_items + matched_products),
    # no network / no API keys needed
    python -m backend.app.scripts.test_snapshot

    # Re-scan every receipt image in a folder (needs GEMINI_API_KEY)
    python -m backend.app.scripts.test_snapshot --folder receipts

    # Aggregate ALL receipts stored in the DB (needs Supabase config)
    python -m backend.app.scripts.test_snapshot --db
"""

import json
import sys
from pathlib import Path

from backend.app.models.nutrition import MatchedProduct
from backend.app.services.nutrition_snapshot import (
    assemble_snapshot,
    build_snapshot_from_folder,
    build_snapshot_from_db,
)

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def _offline_snapshot():
    """Aggregate the two fixtures (aligned by index) with no network."""
    items = json.loads((FIXTURES / "parsed_items.json").read_text(encoding="utf-8"))
    matched_raw = json.loads((FIXTURES / "matched_products.json").read_text(encoding="utf-8"))
    matched = [MatchedProduct.model_validate(m) for m in matched_raw]
    # Treat the single fixture as one receipt.
    return assemble_snapshot(items, matched, receipts_analyzed=1)


def main():
    args = sys.argv[1:]
    if "--folder" in args:
        folder = args[args.index("--folder") + 1]
        snap = build_snapshot_from_folder(folder)
    elif "--db" in args:
        snap = build_snapshot_from_db()
    else:
        snap = _offline_snapshot()

    print(json.dumps(snap.model_dump(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
