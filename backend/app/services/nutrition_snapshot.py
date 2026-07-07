"""
Nutrition snapshot orchestrator (Epic 4 glue).

Builds a NutritionSnapshot by aggregating *all* saved receipts, not a
single one:

  - build_snapshot_from_db()      -> every row in receipt_items
  - build_snapshot_from_folder()  -> re-scan every image in a folder
  - build_snapshot(items, ...)    -> from an explicit item list
  - assemble_snapshot(items, matched, ...) -> offline core (no OFF/Gemini)

Pipeline per source: items -> Epic 2 mapping -> profile (4.2) -> gaps
(4.3) -> dimensions + confidence + disclaimer.
"""

from pathlib import Path
from typing import List

from backend.app.models.snapshot import NutritionSnapshot
from backend.app.models.nutrition import MatchedProduct
from backend.app.services.nutrition_mapping import map_items
from backend.app.services.nutrition_profile import build_profile
from backend.app.services.gap_detector import detect_gaps
from backend.app import nutrition_model as nm

_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def assemble_snapshot(
    items: List[dict],
    matched: List[MatchedProduct],
    receipts_analyzed: int,
) -> NutritionSnapshot:
    """Offline core: build a snapshot from already-mapped products."""

    profile = build_profile(items, matched)
    confidence = nm.confidence_level(profile)
    gaps = detect_gaps(profile, confidence)
    dimensions = nm.build_dimension_snapshots(profile)

    return NutritionSnapshot(
        receipts_analyzed=receipts_analyzed,
        items_analyzed=len(items),
        profile=profile,
        dimensions=dimensions,
        gaps=gaps,
        confidence=confidence,
        disclaimer=nm.DISCLAIMER,
    )


def build_snapshot(items: List[dict], receipts_analyzed: int) -> NutritionSnapshot:
    """Map `items` via OpenFoodFacts, then assemble the snapshot."""

    matched = map_items(items).matched_products
    return assemble_snapshot(items, matched, receipts_analyzed)


def build_snapshot_from_db() -> NutritionSnapshot:
    """Aggregate every stored receipt item across all receipts."""

    # Imported here so the offline/folder paths don't require DB config.
    from backend.app.db.supabase import get_all_receipt_items

    items = get_all_receipt_items()
    receipts = len({it.get("receipt_id") for it in items if it.get("receipt_id")})
    return build_snapshot(items, receipts)


def build_snapshot_from_folder(folder: str) -> NutritionSnapshot:
    """
    Re-scan every receipt image in `folder`, parse items, and aggregate.

    Imported lazily because the parser initialises the Gemini client at
    import time (needs GEMINI_API_KEY), which the DB/offline paths don't.
    """

    from backend.app.services.receipt_parser import scan_receipt_bytes

    folder_path = Path(folder)
    image_paths = sorted(
        p for p in folder_path.iterdir()
        if p.suffix.lower() in _IMAGE_SUFFIXES
    )

    items: List[dict] = []
    receipts_analyzed = 0
    for path in image_paths:
        parsed = scan_receipt_bytes(
            file_bytes=path.read_bytes(),
            filename=path.name,
        )
        if parsed.get("error"):
            continue
        parsed_items = parsed.get("items", [])
        if not parsed_items:
            continue
        receipts_analyzed += 1
        # Normalise to the receipt_items-ish shape the profile expects.
        for it in parsed_items:
            items.append({
                "normalized_name": it.get("name"),
                "quantity": it.get("quantity"),
                "unit": it.get("unit"),
                "category": it.get("category"),
            })

    return build_snapshot(items, receipts_analyzed)
