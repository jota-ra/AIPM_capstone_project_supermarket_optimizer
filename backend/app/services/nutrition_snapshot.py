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

import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

from backend.app.models.profile import Profile, ProfileCreate
from backend.app.models.snapshot import NutritionSnapshot
from backend.app.models.nutrition import MatchedProduct
from backend.app.services.nutrition_mapping import map_items
from backend.app.services.nutrition_profile import build_profile
from backend.app.services.nutrition_personalization import personalized_protein_ref_per_1000kcal
from backend.app.services.gap_detector import detect_gaps
from backend.app import nutrition_model as nm

_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}

UserProfileLike = Union[Profile, ProfileCreate]

# Bug fix: /nutrition/snapshot and /next-cart each independently called
# build_snapshot_from_db for the same session, redoing the same 2 DB
# round-trips + OFF-mapping pipeline every time — the frontend's
# ResultsStep.tsx fires both in parallel on every page load. A short-TTL
# cache collapses that pair (and rapid Refresh clicks) into one
# computation without risking meaningfully stale data — nothing in this
# app updates a session's receipts fast enough for 5 seconds to matter.
# Keyed by (user_id, profile_id) since the personalized protein
# reference (weight/height/gender) depends on which profile was passed.
_SNAPSHOT_CACHE_TTL_SECONDS = 5.0
_snapshot_cache: Dict[Tuple[str, Optional[str]], Tuple[float, NutritionSnapshot]] = {}


def invalidate_snapshot_cache(user_id: str) -> None:
    """Call after any write that changes a session's receipts (new
    upload, item correction) so the next snapshot reflects it immediately
    instead of waiting out the cache TTL."""

    for key in [k for k in _snapshot_cache if k[0] == user_id]:
        _snapshot_cache.pop(key, None)


def assemble_snapshot(
    items: List[dict],
    matched: List[MatchedProduct],
    receipts_analyzed: int,
    user_profile: Optional[UserProfileLike] = None,
    lang: str = "en",
) -> NutritionSnapshot:
    """
    Offline core: build a snapshot from already-mapped products.

    `user_profile` is optional and only used to personalize the protein
    reference (weight/height/gender/activity — see
    services/nutrition_personalization.py); omit it for the existing
    profile-agnostic behavior. `lang` (E13) localizes gap messages,
    dimension labels and the disclaimer.
    """

    profile = build_profile(items, matched)
    confidence = nm.confidence_level(profile)
    protein_ref = personalized_protein_ref_per_1000kcal(user_profile)
    gaps = detect_gaps(profile, confidence, protein_ref=protein_ref, lang=lang)
    dimensions = nm.build_dimension_snapshots(profile, protein_ref=protein_ref, lang=lang)

    return NutritionSnapshot(
        receipts_analyzed=receipts_analyzed,
        items_analyzed=len(items),
        profile=profile,
        dimensions=dimensions,
        gaps=gaps,
        confidence=confidence,
        disclaimer=nm.disclaimer(lang),
    )


def build_snapshot(
    items: List[dict],
    receipts_analyzed: int,
    user_profile: Optional[UserProfileLike] = None,
    lang: str = "en",
) -> NutritionSnapshot:
    """Map `items` via OpenFoodFacts, then assemble the snapshot."""

    matched = map_items(items).matched_products
    return assemble_snapshot(items, matched, receipts_analyzed, user_profile, lang)


def build_snapshot_from_db(
    user_id: str,
    user_profile: Optional[UserProfileLike] = None,
    lang: str = "en",
) -> NutritionSnapshot:
    """
    Aggregate every receipt item from THIS session's receipts only
    (Story 8.3). Previously this aggregated every receipt in the whole
    database regardless of who uploaded it — fine with a single tester,
    silently wrong the moment a second person uses the app at the same
    time, since their baskets would blend into one shared snapshot.

    `user_profile`, if given, personalizes the protein reference — pass
    the same profile object the caller already loaded (e.g. for
    /next-cart's exclusion filtering) rather than fetching it again here.
    """

    cache_key = (user_id, getattr(user_profile, "id", None), lang)
    cached = _snapshot_cache.get(cache_key)
    if cached is not None and (time.time() - cached[0]) < _SNAPSHOT_CACHE_TTL_SECONDS:
        return cached[1]

    # Imported here so the offline/folder paths don't require DB config.
    from backend.app.db.supabase import get_receipt_items_by_user
    from backend.app.analytics.events import log_event

    items = get_receipt_items_by_user(user_id)
    receipts = len({it.get("receipt_id") for it in items if it.get("receipt_id")})

    # Bug fix (Story 9.1): match_rate was only ever logged by
    # /receipts/{id}/mapping, an endpoint the frontend never calls — so
    # in real usage this "critical metric" (per Epic 2's own risk
    # analysis) never fired. This is the actual pipeline every user goes
    # through (both /nutrition/snapshot and /next-cart route through
    # here), so log it here instead of via build_snapshot(), which is
    # also used by dev-only/offline paths that have no session to log
    # against. map_items() runs once; matched_products feeds the
    # snapshot and match_quality feeds the event, no redundant OFF calls.
    mapping = map_items(items)
    log_event("match_rate", mapping.match_quality.model_dump(), user_id)
    snapshot = assemble_snapshot(items, mapping.matched_products, receipts, user_profile, lang)

    _snapshot_cache[cache_key] = (time.time(), snapshot)
    return snapshot


def build_snapshot_from_all_receipts() -> NutritionSnapshot:
    """
    Dev/debug only: aggregate every receipt in the database regardless of
    session. NOT used by the API — real requests always go through
    `build_snapshot_from_db(user_id)` so one session's data doesn't
    bleed into another's. Kept for manual scripts that want to sanity
    check against everything that's been uploaded so far.
    """

    from backend.app.db.supabase import get_all_receipt_items

    items = get_all_receipt_items()
    receipts = len({it.get("receipt_id") for it in items if it.get("receipt_id")})
    return build_snapshot(items, receipts)


def build_snapshot_from_folder(folder: str) -> NutritionSnapshot:
    """
    Re-scan every receipt image in `folder`, parse items, and aggregate.

    Extraction is fully local (Tesseract/PyMuPDF, no API). Imported lazily to
    keep the OCR/PDF dependencies off the DB/offline import paths that never
    scan files.
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
