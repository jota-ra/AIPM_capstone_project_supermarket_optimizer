from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import ValidationError

from backend.app.services.auth import get_current_user
from backend.app.services.nutrition_snapshot import build_snapshot_from_db
from backend.app.services.absolute_gap_detector import detect_absolute_gaps, has_sufficient_data
from backend.app.services.health_score import compute_health_score
from backend.app.services.conflict_detector import detect_conflicts
from backend.app.db.supabase import get_profile, get_profile_by_user
from backend.app.models.profile import Profile

router = APIRouter()


def _load_profile(profile_id: Optional[str], user_id: str) -> Optional[Profile]:
    """Load a profile by id (or the caller's own), degrading to None on a
    stale-schema row rather than 500-ing the request."""

    row = get_profile(profile_id) if profile_id else get_profile_by_user(user_id)
    if row is None:
        return None
    try:
        return Profile.model_validate(row)
    except ValidationError:
        return None


@router.get("/nutrition/snapshot")
def nutrition_snapshot(profile_id: Optional[str] = None, user_id: str = Depends(get_current_user)):
    """
    Aggregated nutrition snapshot + top gaps across this session's saved
    receipts (Epic 4, scoped per Story 8.3). Density-based, rule-driven,
    with a confidence label and the "estimated, not actual intake"
    disclaimer.

    `profile_id` is optional, same as /next-cart: when given, the
    protein reference/gap is personalized from that profile's
    weight/height/gender/activity (see nutrition_personalization.py);
    without one, the fixed density guideline is used, as before.
    """

    profile = None
    if profile_id is not None:
        row = get_profile(profile_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Profile not found.")
        try:
            profile = Profile.model_validate(row)
        except ValidationError:
            # Bug fix: a profile row written under an older enum set
            # (e.g. "eat_healthier"/"25-34"/"moderate" from before the
            # chat onboarding's option strings were renamed) used to
            # 500 the entire Results page instead of just skipping
            # personalization. profile_id is optional everywhere it's
            # used precisely so this can degrade to the same behavior
            # as "no profile given" rather than hard-failing.
            print(f"[api] profile {profile_id} failed validation (stale schema?) — continuing without personalization")
            profile = None

    snapshot = build_snapshot_from_db(user_id, user_profile=profile)
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )

    # Absolute (Bedarf vs. Ist) gaps, e.g. iron — separate from the
    # density-based `gaps` above since they compare real daily units
    # against confirmed pantry consumption, not a receipt's basket
    # ratios. [] until the user has confirmed any consumption/removal.
    absolute_gaps = detect_absolute_gaps(user_id, profile)
    health_score = compute_health_score(snapshot.dimensions, absolute_gaps)

    # Purchased items that conflict with the profile (e.g. meat bought by
    # a self-described vegan) — [] without a profile to check against.
    # Never changes the profile or the analysis itself; just surfaced so
    # the user can clarify (see conflict_detector.py's docstring).
    conflicts = detect_conflicts(user_id, profile)

    return {
        "user_id": user_id,
        **snapshot.model_dump(),
        "absolute_gaps": [gap.model_dump() for gap in absolute_gaps],
        # Distinguishes "absolute_gaps is [] because nothing's been
        # confirmed yet" from "[] because everything's within range" —
        # otherwise both look identical to the frontend (Epic 11.1).
        "has_sufficient_data": has_sufficient_data(user_id),
        "health_score": health_score.model_dump(),
        "conflicts": [conflict.model_dump() for conflict in conflicts],
    }


@router.get("/nutrition/status-quo")
def nutrition_status_quo(profile_id: Optional[str] = None, user_id: str = Depends(get_current_user)):
    """
    Receipt-derived estimated daily intake per nutrient (Epic 6, BR-I1..I6):
    Σ (item_nutrient × share × (1 − waste)) ÷ item_consumption_days, plus the
    household attribution, eating-occasion coverage and confidence discount.

    Distinct from /nutrition/snapshot (day-agnostic density) — this is the
    absolute daily "status quo" Epic 7 will compare to the ideal profile.
    """

    from backend.app.db.supabase import get_receipt_items_by_user, get_receipts_by_user
    from backend.app.services.nutrition_mapping import map_items
    from backend.app.services.status_quo import build_status_quo
    from datetime import date

    items = get_receipt_items_by_user(user_id)
    if not items:
        raise HTTPException(status_code=409, detail="No receipt items found. Upload a receipt first.")

    profile = _load_profile(profile_id, user_id)

    # BR-T2 repeat-purchase windows: gather each product's purchase dates from
    # this user's receipts (best-effort — falls back to category defaults).
    purchase_dates_by_key: dict = {}
    try:
        receipt_date = {}
        for r in get_receipts_by_user(user_id):
            raw = r.get("purchase_date") or (r.get("raw_text") or {}).get("date") if isinstance(r.get("raw_text"), dict) else r.get("purchase_date")
            if raw:
                try:
                    receipt_date[r.get("id")] = date.fromisoformat(str(raw)[:10])
                except ValueError:
                    pass
        for it in items:
            d = receipt_date.get(it.get("receipt_id"))
            if d:
                key = (it.get("normalized_name") or it.get("raw_name") or "").lower()
                purchase_dates_by_key.setdefault(key, []).append(d)
    except Exception:
        purchase_dates_by_key = {}

    matched = map_items(items).matched_products
    status_quo = build_status_quo(items, matched, profile, purchase_dates_by_key)
    return {"user_id": user_id, **status_quo.model_dump()}
