"""
Tests for Epic 5 — Review & Learned Matching (verified-match store, Tier-0).

Covers the "Review, correction and the verified-match store" acceptance
scenarios and BR-MT0/MT0a/MT6/R-WRITE. Fully offline: forces the local
JSON dev-store into a temp file, so voting / conflict resolution / Tier-0
run without a database.

Run from the repo root:
    python -m backend.app.scripts.test_verified_matches_e5
"""

import tempfile
from pathlib import Path

import backend.app.services.verified_matches as vm
from backend.app.services import resolver as R

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


def _reset_store():
    tmp = Path(tempfile.mkdtemp())
    vm._LOCAL = True
    vm._VOTES_PATH = tmp / "_votes.json"
    vm._NOMATCH_PATH = tmp / "_nomatch.json"


def _mk(product, user, ts):
    return {"off_id": product, "user_id": user, "updated_at": ts, "matched_name": product}


# ── BR-MT0a normalization ────────────────────────────────────────────────
def test_normalization():
    print("BR-MT0a: shared key normalization strips qty/price/unit/store")
    check("Rewe Vollmilch 3,5% 1L 1,29 €", vm.normalize_match_key("REWE  Vollmilch 3,5% 1L   1,29 €"), "vollmilch")
    check("Bananen 1 kg", vm.normalize_match_key("Bananen 1 kg"), "bananen")
    check("write==read parity", vm.normalize_match_key("Bio Eier 10 Stk"), vm.normalize_match_key("bio  eier  10 stk"))


# ── BR-MT6 conflict resolution (the acceptance outline) ──────────────────
def test_conflict_resolution():
    print("BR-MT6: verified-store conflict resolution")
    w1 = vm.resolve_winner([_mk("A", f"u{i}", "t1") for i in range(5)] + [_mk("B", f"v{i}", "t1") for i in range(2)])
    check("A:5,B:2 → serve A (majority)", (vm._product_key(w1), w1["served"]), ("A", True))

    w2 = vm.resolve_winner([_mk("A", f"u{i}", "t2") for i in range(3)] + [_mk("B", f"v{i}", "t1") for i in range(3)])
    check("A:3,B:3 (A recent) → serve A (recency)", (vm._product_key(w2), w2["served"]), ("A", True))

    w3 = vm.resolve_winner([_mk("A", "u1", "t"), _mk("A", "u2", "t"), _mk("B", "u3", "t"), _mk("B", "u4", "t"), _mk("C", "u5", "t")])
    check("A:2,B:2,C:1 (no >50%) → low-agreement, not served", w3["served"], False)


# ── One vote per user per key ────────────────────────────────────────────
def test_one_vote_per_user():
    print("BR-MT6: one vote per distinct user per key")
    _reset_store()
    for _ in range(12):  # same user, twelve receipts
        vm.record_vote("Bananen 1kg", "Rewe", "off", "user-1", off_id="BAN", matched_name="Banane",
                        nutrition={"calories_kcal": 89})
    hit = vm.lookup_verified_match("Bananen 1kg", "Rewe")
    check("12 same-user votes count as 1", hit["votes"], 1)


# ── Tier-0 read: exact vs store-agnostic; resolver uses it ───────────────
def test_tier0_lookup_and_resolver():
    print("BR-MT0: Tier-0 short-circuits; exact 1.0, store-agnostic 0.9")
    _reset_store()
    vm.record_vote("Haferflocken 500g", "Edeka", "bls", "u1", bls_code="H1", matched_name="Hafer Flocken",
                   nutrition={"calories_kcal": 348})
    exact = vm.lookup_verified_match("Haferflocken 500g", "Edeka")
    check("exact (text,store) confidence 1.0", exact["confidence"], 1.0)
    agnostic = vm.lookup_verified_match("Haferflocken 500g", "Rewe")
    check("store-agnostic confidence 0.9", agnostic["confidence"], 0.9)

    res = R.resolve_item({"raw_name": "Haferflocken 500g", "name": "Haferflocken", "store": "Edeka"})
    check("resolver returns LEARNED", res.match_type.value, "learned")
    check("resolver confidence 1.0", res.confidence, 1.0)


# ── Passive Tier-0 acceptance casts no vote (R-WRITE) ────────────────────
def test_passive_tier0_no_vote():
    print("R-WRITE: passively resolving via Tier-0 does not add a vote")
    _reset_store()
    vm.record_vote("Milch 1L", "Rewe", "off", "u1", off_id="M1", matched_name="Milch", nutrition={})
    before = len(vm._load(vm._VOTES_PATH))
    R.resolve_item({"raw_name": "Milch 1L", "name": "Milch", "store": "Rewe"})  # passive resolve
    after = len(vm._load(vm._VOTES_PATH))
    check("vote count unchanged by resolve", (before, after), (1, 1))


# ── No-match queue ───────────────────────────────────────────────────────
def test_no_match_queue():
    print("E5-S5: no-match items logged with frequency")
    _reset_store()
    vm.log_no_match("Exotisches Etwas", "Rewe")
    e = vm.log_no_match("Exotisches Etwas", "Rewe")
    check("frequency increments", e["count"], 2)


def main():
    for fn in (
        test_normalization,
        test_conflict_resolution,
        test_one_vote_per_user,
        test_tier0_lookup_and_resolver,
        test_passive_tier0_no_vote,
        test_no_match_queue,
    ):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
