"""
Tests for Epic 4 — Matching & Nutrition Resolution (OFF + BLS hybrid).

Covers the "Feature: Product matching" acceptance scenarios and BR-MT1..MT7.
Offline: the BLS table is local; the OFF tier is faked (monkeypatched) so
no network/quota is needed and the bridge guard can be exercised
deterministically.

Run from the repo root:
    python -m backend.app.scripts.test_matching_e4
"""

from backend.app.models.nutrition import MatchedProduct, MatchType, NutritionValues
from backend.app.services import resolver as R
from backend.app.services import matcher, verified_matches
from backend.app.services.text_similarity import full_ratio, token_similarity
from backend.app.services.nutrition_mapping import map_items

_PASS = 0
_FAIL = 0


def check(label, got, expected):
    global _PASS, _FAIL
    if got == expected:
        _PASS += 1
        print(f"  OK   {label}: {got}")
    else:
        _FAIL += 1
        print(f"  FAIL {label}: got {got!r}, expected {expected!r}")


def _fake_off(name, brand=None, nova=1.0, **nut):
    """Build a MatchedProduct as the OFF tier would (pre-bridge)."""
    return MatchedProduct(
        parsed_item_name=name, matched_name=name, off_id="off-123", brand=brand,
        match_type=MatchType.EXACT, confidence=0.95, identity_conf=0.95, nutrition_conf=1.0,
        data_source="OpenFoodFacts",
        nutrition=NutritionValues(processed_score=nova, sources={}, **nut),
    )


# ── E4-S2: exact label uses the whole-string ratio, not token sim ────────
def test_exact_label_metric():
    print("E4-S2: 'exact' gated on whole-string ratio >= 0.90 (BR-MT1)")
    # token_similarity rewards containment (=0.85+), full_ratio does not:
    check("token sim Gouda/Queso Gouda high", token_similarity("Gouda", "Queso Gouda") >= 0.85, True)
    check("full ratio Gouda/Queso Gouda < 0.90", full_ratio("Gouda", "Queso Gouda") < 0.90, True)
    check("full ratio identical == 1.0", full_ratio("Gouda", "Gouda"), 1.0)


# ── E4-S3: BLS whole-food fallback recovers OFF misses ───────────────────
def test_bls_whole_food():
    print("E4-S3: BLS whole-food fallback (BR-MT2)")
    for q in ["Radieschen", "Himbeeren", "Banane", "Gurke", "Apfel"]:
        m = R._bls_whole_food(q, None)
        ok = m is not None and m.match_type == MatchType.BLS and "roh" in (m.matched_name or "").lower()
        check(f"{q} → BLS roh identity", ok, True)
    # must NOT fabricate a branded/derived identity for non-whole foods
    check("Apfelsaft rejected", R._bls_whole_food("Apfelsaft", "drink"), None)
    check("Erdbeerjoghurt rejected", R._bls_whole_food("Erdbeerjoghurt", None), None)
    # borrowed micros are present
    m = R._bls_whole_food("Banane", None)
    check("whole-food carries micros", len(m.nutrition.micros) >= 8, True)


# ── E4-S4: bridge guard (type agreement) + plain variant + NOVA-from-OFF ─
def test_bridge_guard():
    print("E4-S4: OFF→BLS bridge under type-agreement guard (BR-MT3)")
    check("Gurke ⇄ 'Gurke roh' agrees",
          R._type_agrees("Gurke", R._canonical_category(None, "Gurke"), "Gurke roh"), True)
    check("Gouda ⇄ 'Fleischkäse' rejected",
          R._type_agrees("Gouda", R._canonical_category(None, "Gouda"), "Fleischkäse"), False)

    # plain-variant preference among type-agreeing candidates (BR-MT3)
    from backend.app.services.bls_matcher import prefers_roh, is_plain_variant
    check("'Gurke roh' is roh", prefers_roh("Gurke roh"), True)
    check("'Gurke gedünstet' not plain", is_plain_variant("Gurke gedünstet"), False)
    check("'Vollmilchpulver' not plain (form)", is_plain_variant("Vollmilchpulver"), False)


def test_bridge_overlay_keeps_off_nova(monkeypatch=None):
    print("E4-S4: bridge overlays BLS macros+micros but keeps OFF NOVA")
    R._bridge_cache.clear()
    # Fake an OFF identity for a cucumber with NOVA=1 and sparse nutrition,
    # then let the real bridge borrow BLS "Gurke roh".
    off = _fake_off("Gurke", nova=1.0, calories_kcal=999.0, protein_g=None)
    bridged = R._apply_bridge(off, "Gurke", "Gemüse")
    nut = bridged.nutrition
    check("bls_code attached", bool(bridged.bls_code), True)
    check("calories now from BLS (not 999)", nut.calories_kcal != 999.0, True)
    check("calories source = bls", nut.sources.get("calories_kcal"), "bls")
    check("NOVA kept from OFF (value)", nut.processed_score, 1.0)
    check("NOVA source = off", nut.sources.get("processed_score"), "off")
    check("micros borrowed from BLS", len(nut.micros) >= 8, True)

    # Type DISAGREEMENT → keep OFF's own values (no bls_code)
    R._bridge_cache.clear()
    off2 = _fake_off("Gouda", nova=4.0, calories_kcal=356.0)
    # monkeypatch BLS candidate search to only offer a wrong-type food
    import backend.app.services.bls_matcher as bm
    orig = bm.top_records
    bm.top_records = lambda name, limit=10: [{"code": "X", "name_de": "Fleischkäse", "name_en": "",
                                              "protein_g": 12.0, "fiber_g": 0.0, "sugar_g": 0.0,
                                              "calories_kcal": 250.0, "micros": {"iron_mg": 1.0}}]
    try:
        kept = R._apply_bridge(off2, "Gouda", "Milchprodukte")
    finally:
        bm.top_records = orig
    check("disagreement keeps OFF calories", kept.nutrition.calories_kcal, 356.0)
    check("disagreement → no bls_code", kept.bls_code, None)


# ── E4-S5: category fallback, provenance, dual confidence ────────────────
def test_category_and_provenance():
    print("E4-S5: category fallback + provenance + two confidences")
    c = R._category_fallback("Völlig Unbekanntes XYZ", None)
    check("fallback conf 0.3", c.confidence, 0.30)
    check("identity_conf 0.3", c.identity_conf, 0.30)
    check("nutrition_conf 0.3", c.nutrition_conf, 0.30)
    check("flagged unknown", c.unknown, True)
    check("all values sourced 'category'",
          all(v == "category" for v in c.nutrition.sources.values()), True)


# ── E4-S6: receipt totals ────────────────────────────────────────────────
def test_receipt_totals():
    print("E4-S6: per-receipt nutrition totals")
    items = [
        {"name": "Banane", "quantity": 1, "unit": "kg", "category": "Obst"},
        {"name": "Völlig Unbekannt XYZ", "quantity": 1, "unit": "piece", "category": None},
    ]
    r = map_items(items)
    check("totals include calories", "calories_kcal" in r.nutrition_totals, True)
    check("totals include a micro", "iron_mg" in r.nutrition_totals, True)
    check("coverage 100% (all resolved)", r.match_quality.coverage_rate, 1.0)


# ── Tier-0 inert + never-blocks ──────────────────────────────────────────
def test_tier0_and_never_blocks():
    print("E4: Tier-0 inert until E5; matching never blocks")
    check("verified lookup returns None (no store yet)",
          verified_matches.lookup_verified_match("bananen 1kg", "Rewe"), None)
    # OFF + BLS whole-food both miss → category fallback, no error
    res = R.resolve_item({"name": "Zzxqw Kunstartikel", "category": None})
    check("unresolved degrades to fallback", res.match_type, MatchType.FALLBACK)


def main():
    for fn in (
        test_exact_label_metric,
        test_bls_whole_food,
        test_bridge_guard,
        test_bridge_overlay_keeps_off_nova,
        test_category_and_provenance,
        test_receipt_totals,
        test_tier0_and_never_blocks,
    ):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
