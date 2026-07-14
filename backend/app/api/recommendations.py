from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends
from pydantic import ValidationError

from backend.app.services.auth import get_current_user
from backend.app.analytics.events import log_event
from backend.app.db.supabase import get_profile, create_recommendation_row
from backend.app.models.profile import Profile
from backend.app.services.nutrition_snapshot import build_snapshot_from_db
from backend.app.services.progress_tracker import compute_session_progress
from backend.app.services.recommender import recommend_next_cart, default_profile, gap_from_absolute, find_pantry_match
from backend.app.services.absolute_gap_detector import detect_absolute_gaps
from backend.app.services.pantry import get_pantry
from backend.app.services.recipe_suggester import suggest_recipes_from_pantry
from backend.app.services.easy_swaps import suggest_easy_swaps
from backend.app.services.health_score import compute_health_score
from backend.app.services.nutri_coach import generate_coach_message

router = APIRouter()


@router.get("/recommendations")
def structured_recommendations(profile_id: Optional[str] = None, user_id: str = Depends(get_current_user)):
    """
    Epic 8 Next-Cart engine: candidates scored against the E7 analysis
    (severity × confidence × symptom × goal, BR-S1), filtered by
    diet/allergies/dislikes before scoring (BR-S6), returned as 1 primary +
    ≤2 alternatives + ≤2 reduce (BR-S1). Additive to the legacy /next-cart.
    """

    from backend.app.db.supabase import get_receipt_items_by_user, get_profile_by_user
    from backend.app.services.nutrition_mapping import map_items
    from backend.app.services.status_quo import build_status_quo
    from backend.app.services.confidence_model import snapshot_confidence
    from backend.app.services.gap_engine import build_analysis
    from backend.app.services.grouping import group_products
    from backend.app.services.ideal_profile import compute_ideal_profile
    from backend.app.services.next_cart_engine import build_next_cart

    items = get_receipt_items_by_user(user_id)
    if not items:
        raise HTTPException(status_code=409, detail="No receipt items found. Upload a receipt first.")

    row = get_profile(profile_id) if profile_id else get_profile_by_user(user_id)
    profile = None
    if row is not None:
        try:
            profile = Profile.model_validate(row)
        except ValidationError:
            profile = None
    profile = profile or default_profile()

    matched = map_items(items).matched_products
    status_quo = build_status_quo(items, matched, profile)
    confidence = snapshot_confidence(items, matched, profile)
    analysis = build_analysis(compute_ideal_profile(profile), status_quo.daily_intake, confidence)
    analysis["grouping"] = group_products(matched)

    result = build_next_cart(analysis, profile)
    return {"user_id": user_id, **result.model_dump()}


@router.get("/next-cart")
def next_cart(profile_id: Optional[str] = None, user_id: str = Depends(get_current_user)):
    """
    The single Next Cart recommendation (Epic 5), grounded in the
    aggregated gaps from Epic 4 across this session's saved receipts
    (scoped per Story 8.3), and constrained by the given profile's
    dietary pattern + exclusions (Epic 3).

    profile_id is optional: without one, a neutral no-exclusions profile
    is used so the endpoint still works before onboarding is complete.

    The computed recommendation is persisted (Task 8.5) so feedback
    (Task 8.2) has a stable `recommendation_id` to reference — otherwise
    "would you buy this?" would have nothing to point back to, since
    Next Cart is computed fresh on every call rather than stored ahead
    of time.
    """

    profile = None
    if profile_id is not None:
        row = get_profile(profile_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Profile not found.")
        try:
            profile = Profile.model_validate(row)
        except ValidationError:
            # Bug fix: see the identical fallback in api/nutrition.py —
            # a profile row saved under an older enum set (renamed
            # chat-onboarding option strings) used to 500 all of Next
            # Cart instead of just falling back to the same
            # no-exclusions default already used pre-onboarding.
            print(f"[api] profile {profile_id} failed validation (stale schema?) — using default profile")
            profile = default_profile()
    else:
        profile = default_profile()

    # Profile loaded first (not after, as before) so its gaps and the
    # recommendation below use the same personalized protein reference —
    # see nutrition_personalization.py — instead of two different ones.
    snapshot = build_snapshot_from_db(user_id, user_profile=profile)
    if snapshot.items_analyzed == 0:
        raise HTTPException(
            status_code=409,
            detail="No receipt items found to analyse. Upload a receipt first.",
        )

    # Absolute (Bedarf vs. Ist) gaps, e.g. iron, appended after the
    # density gaps: Epic 4's severity ranking and the pantry-confirmation
    # based confidence here aren't on comparable scales, so density gaps
    # keep priority unless a Q6 symptom boosts iron specifically (see
    # _SYMPTOM_PRIORITY_BOOST in recommender.py).
    absolute_gaps = detect_absolute_gaps(user_id, profile)
    gaps = list(snapshot.gaps) + [gap_from_absolute(g) for g in absolute_gaps]

    recommendation = recommend_next_cart(
        gaps=gaps,
        profile=profile,
        confidence=snapshot.confidence,
        user_id=user_id,
    )
    # NutriWise Agent - modified: added for Progress Tracking (addendum).
    # has_history=False (not an error) when this session only has one
    # receipt so far, so Next Cart still works before any history exists.
    recommendation.progress = compute_session_progress(user_id)

    recommendation_id = str(uuid4())
    payload = recommendation.model_dump(mode="json")
    create_recommendation_row(recommendation_id, user_id, payload)
    log_event(
        "recommendation_viewed",
        {"recommendation_id": recommendation_id, "status": payload["status"], "action_type": payload["action_type"]},
        user_id,
    )

    pantry_items = get_pantry(user_id)

    # "Cook with what you have": recipes buildable from the pantry that
    # also target the same gap the shopping recommendation above
    # addresses (e.g. egg already in stock + open iron gap -> egg +
    # spinach salad), on top of (not instead of) the shopping suggestion.
    pantry_recipes = []
    if absolute_gaps:
        pantry_item_names = [item["normalized_name"] for item in pantry_items]
        pantry_recipes = [
            recipe.model_dump()
            for recipe in suggest_recipes_from_pantry(pantry_item_names, absolute_gaps[0])
        ]

    # "Use what you already have" — shown alongside (never instead of)
    # the purchase recommendation above, so the user can choose either
    # (docs/architektur_entscheidungen.md, ToDo 2).
    pantry_match = find_pantry_match(gaps, pantry_items, profile, user_id=user_id)

    # Easy, low-effort/cheap/in-season swaps across every flagged gap —
    # a broader supplementary list alongside the one deliberate Next
    # Cart pick above (see services/easy_swaps.py).
    easy_swaps = [
        swap.model_dump()
        for swap in suggest_easy_swaps(gaps, profile, datetime.now(timezone.utc).month)
    ]

    # Nutri-Coach: a warm, conversational phrasing of everything already
    # computed above — the LLM only rephrases these facts, it never adds
    # new ones (see services/nutri_coach.py). Falls back to a rule-based
    # template on any Gemini failure, so this can never break Next Cart.
    health_score = compute_health_score(snapshot.dimensions, absolute_gaps)
    coach_context = {
        "health_score": health_score.model_dump(),
        "top_gaps": [
            {"dimension": g.dimension, "status": g.status.value, "message": g.message}
            for g in gaps[:3]
        ],
        "recommendation": {
            "status": payload.get("status"),
            "item": payload.get("item"),
            "action_type": payload.get("action_type"),
            "message": payload.get("message"),
        },
        "easy_swaps": [
            {"item": s["item"], "targets_gap": s["targets_gap"], "cost": s["cost"]}
            for s in easy_swaps[:3]
        ],
        "progress_trend": recommendation.progress.trend if recommendation.progress else None,
    }
    language = profile.language.value if getattr(profile, "language", None) else "en"
    coach_message = generate_coach_message(coach_context, language=language)

    return {
        "recommendation_id": recommendation_id,
        "user_id": user_id,
        **payload,
        "pantry_recipes": pantry_recipes,
        "easy_swaps": easy_swaps,
        "coach_message": coach_message,
        "pantry_match": pantry_match.model_dump() if pantry_match else None,
    }
