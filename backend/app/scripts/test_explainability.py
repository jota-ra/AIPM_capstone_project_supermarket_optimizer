"""
Manual test for Epic 6 (Explainability & Trust Layer): confidence
tagging, source labeling, and the personalized explanation generator.

Usage (run from the repo root, no network / DB needed):
    python -m backend.app.scripts.test_explainability
"""

import json
from pathlib import Path

from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues
from backend.app.models.profile import ProfileCreate
from backend.app.models.snapshot import Gap
from backend.app.services.confidence import confidence_from_match, confidence_for_product
from backend.app.services.source_labels import source_label
from backend.app.services.explainer import generate_explanation
from backend.app.services.recommender import recommend_next_cart, RECOMMENDATIONS

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def test_confidence_tagging():
    print("\n=== 6.3 Confidence Tagging ===")
    cases = [
        ("exact match (score 0.97)", MatchType.EXACT, 0.97, "high"),
        ("fuzzy, strong (score 0.85)", MatchType.FUZZY, 0.85, "medium"),
        ("fuzzy, generic-term cap (score 0.70)", MatchType.FUZZY, 0.70, "medium"),
        ("fuzzy, weak (score 0.61)", MatchType.FUZZY, 0.61, "low"),
        ("fallback category (score 0.30)", MatchType.FALLBACK, 0.30, "low"),
        ("no match (score 0.0)", MatchType.NONE, 0.0, "low"),
    ]
    ok = True
    for label, match_type, score, expected in cases:
        got = confidence_from_match(match_type, score).value
        status = "OK" if got == expected else "MISMATCH"
        if got != expected:
            ok = False
        print(f"  [{status}] {label} -> {got} (expected {expected})")
    print("ALL PASS" if ok else "SOME MISMATCHES")


def test_source_labels():
    print("\n=== 6.2 Data Source Labeling ===")
    exact = MatchedProduct(
        parsed_item_name="Bananen", matched_name="Bananen", off_id="123",
        match_type=MatchType.EXACT, confidence=0.95, data_source="OpenFoodFacts",
        nutrition=NutritionValues(calories_kcal=89),
    )
    generic = MatchedProduct(
        parsed_item_name="Plattpfirsiche", matched_name="Pfirsich",
        match_type=MatchType.FUZZY, confidence=0.70,
        data_source="OpenFoodFacts (generic: pfirsich)",
        nutrition=NutritionValues(calories_kcal=39),
    )
    fallback = MatchedProduct(
        parsed_item_name="Salatgurke", fallback_category="vegetable",
        match_type=MatchType.FALLBACK, confidence=0.30,
        data_source="fallback_category:vegetable",
        nutrition=NutritionValues(calories_kcal=40),
    )
    for label, product in [("exact OFF match", exact), ("generic-term match", generic), ("fallback", fallback)]:
        print(f"  {label:20} -> {source_label(product)!r}")


def test_explanation_generator():
    print("\n=== 6.1 Explanation Generator ===")
    gap = Gap(
        dimension="fiber", status="low", current_value=11.9, reference_value=14.0,
        message="Your basket is low in fiber (~12 g per 1000 kcal vs a ~14 g guideline).",
        confidence="high",
    )
    oats_candidate = next(
        c for c in RECOMMENDATIONS["fiber:low"] if c["item"] == "Vollkornhaferflocken"
    )
    vegan_profile = ProfileCreate.model_validate(
        json.loads((FIXTURES / "profile.json").read_text(encoding="utf-8"))
    )
    explanation = generate_explanation(gap, oats_candidate, vegan_profile)
    print(f"  vegan + fiber gap + oats:\n  {explanation!r}")
    assert "fiber" in explanation.lower()
    assert "vegan" in explanation.lower()

    omnivore = ProfileCreate(
        goal="gain_muscle", age_range="18-24", activity_level="active", dietary_pattern="omnivore",
    )
    lentils_candidate = next(
        c for c in RECOMMENDATIONS["fiber:low"] if c["item"] == "Rote Linsen"
    )
    explanation2 = generate_explanation(gap, lentils_candidate, omnivore)
    print(f"  omnivore + fiber gap + lentils:\n  {explanation2!r}")
    assert "diet" not in explanation2.lower()  # omnivore has no diet caveat sentence
    print("ALL PASS")


def test_recommendation_carries_explanation_and_disclaimer():
    print("\n=== Integration: NextCartRecommendation now includes explanation + disclaimer ===")
    gap = [Gap(
        dimension="fiber", status="low", current_value=11.9, reference_value=14.0,
        message="Your basket is low in fiber.", confidence="high",
    )]
    profile = ProfileCreate(
        goal="eat_healthier", age_range="25-34", activity_level="moderate", dietary_pattern="vegan",
    )
    rec = recommend_next_cart(gap, profile, "high")
    print(json.dumps(rec.model_dump(), indent=2, ensure_ascii=False))
    assert rec.explanation is not None and len(rec.explanation) > 0
    assert rec.disclaimer.startswith("Estimated from your grocery purchases")
    print("ALL PASS")


if __name__ == "__main__":
    test_confidence_tagging()
    test_source_labels()
    test_explanation_generator()
    test_recommendation_carries_explanation_and_disclaimer()
