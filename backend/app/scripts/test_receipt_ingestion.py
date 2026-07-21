"""
Tests for Epic 3 — Receipt Ingestion (upload + extraction).

Pure/offline: exercises unit normalization (E3-S3), the piece-weight table,
the mock parser path (E3 offline mode), food/non-food separation (E3-S4),
date/price extraction fields (E3-S2), and the typed extraction errors
(E3-S5) for the LOCAL extractor — no network, no DB, no quota.

Run from the repo root:
    python -m backend.app.scripts.test_receipt_ingestion
"""

import json

from backend.app.services import receipt_parser as rp
from backend.app.services.units import (
    normalize_unit,
    normalize_quantity,
    piece_weight_grams,
    CANONICAL_UNITS,
)
from backend.app.services.nutrition_profile import grams_for
from backend.app.models.receipt import ParsedReceipt

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


# ── E3-S3: canonical unit normalization ──────────────────────────────────
def test_unit_normalization():
    print("E3-S3: unit normalization to {g,kg,ml,l,piece}")
    for raw, expected in {
        "g": "g", "Gramm": "g", "GR": "g",
        "kg": "kg", "Kilo": "kg",
        "ml": "ml", "Milliliter": "ml",
        "L": "l", "Liter": "l",
        "Stk": "piece", "Stück": "piece", "x": "piece", "Packung": "piece",
        None: "piece", "": "piece", "grams": "g",
    }.items():
        check(f"normalize {raw!r}", normalize_unit(raw), expected)
    for u in CANONICAL_UNITS:
        check(f"canonical {u} is idempotent", normalize_unit(u), u)
    # cl is 10 ml → unit ml, quantity scaled
    check("cl → ml unit", normalize_unit("cl"), "ml")
    check("cl 50 → 500 ml", normalize_quantity(50, "cl"), 500.0)
    check("g quantity unchanged", normalize_quantity(500, "g"), 500)


# ── E3-S3: piece-weight table ────────────────────────────────────────────
def test_piece_weights():
    print("E3-S3: piece → grams via table")
    check("eggs 60 g/piece", piece_weight_grams("Eier"), 60.0)
    check("bread 250 g/piece", piece_weight_grams("Backwaren"), 250.0)
    check("fruit 120 g/piece", piece_weight_grams("Obst"), 120.0)
    check("default 100 g", piece_weight_grams("Sonstiges"), 100.0)
    # grams_for uses the table for pieces, direct factors for mass/volume
    check("10 eggs → 600 g", grams_for(10, "piece", "Eier"), 600.0)
    check("1 kg → 1000 g", grams_for(1, "kg"), 1000.0)
    check("1 l → 1000 g", grams_for(1, "l"), 1000.0)
    check("500 g → 500 g", grams_for(500, "g"), 500.0)


# ── E3 offline mock parser + E3-S2/S4 shape ──────────────────────────────
def test_mock_parser():
    print("E3: mock parser output (date/price/units/non-food)")
    parsed = rp._load_mock()
    check("store present", bool(parsed.get("store")), True)
    check("date extracted (E3-S2)", parsed.get("date"), "2026-07-13")
    check("food items only", len(parsed["items"]), 4)
    check("non-food kept separate (E3-S4)", len(parsed["non_food_items_ignored"]), 2)
    # units all canonical after normalization
    units_ok = all(it["unit"] in CANONICAL_UNITS for it in parsed["items"])
    check("all units canonical (E3-S3)", units_ok, True)
    # every food item carries a price (E3-S2)
    prices_ok = all(isinstance(it.get("price"), (int, float)) for it in parsed["items"])
    check("every item has a price (E3-S2)", prices_ok, True)
    # non-food strings never leak into food items
    food_names = {it["name"] for it in parsed["items"]}
    check("Pfand not a food item", "Pfand" not in food_names, True)
    # validates against the contract model
    validated = ParsedReceipt.model_validate(parsed)
    check("validates as ParsedReceipt", validated.items_count, 4)


# ── E3-S5: typed extraction errors (local extractor, no Gemini) ──────────
def _scan(file_bytes, filename):
    """Run scan_receipt_bytes with mock mode forced off."""
    prev_mock = rp.MOCK_MODE
    rp.MOCK_MODE = False
    try:
        return rp.scan_receipt_bytes(file_bytes=file_bytes, filename=filename)
    finally:
        rp.MOCK_MODE = prev_mock


def test_typed_errors():
    print("E3-S5: typed extraction errors (local, no rate limits)")
    # Corrupt bytes with an image extension → unreadable → invalid (422).
    check("corrupt image → invalid",
          _scan(b"this is not an image", "receipt.png").get("error_code"),
          rp.ERROR_INVALID)
    # Corrupt bytes with a pdf extension → unreadable → invalid.
    check("corrupt pdf → invalid",
          _scan(b"%PDF-not-really", "receipt.pdf").get("error_code"),
          rp.ERROR_INVALID)
    # Unsupported file type → invalid.
    check("unsupported type → invalid",
          _scan(b"whatever", "receipt.xyz").get("error_code"),
          rp.ERROR_INVALID)


# ── E3-S5: API maps error codes to HTTP statuses ─────────────────────────
def test_error_status_map():
    print("E3-S5: error code → HTTP status map")
    from backend.app.api.receipts import _PARSE_ERROR_STATUS
    check("rate_limited → 429", _PARSE_ERROR_STATUS[rp.ERROR_RATE_LIMITED], 429)
    check("unavailable → 503", _PARSE_ERROR_STATUS[rp.ERROR_UNAVAILABLE], 503)
    check("invalid → 422", _PARSE_ERROR_STATUS[rp.ERROR_INVALID], 422)
    check("unknown code → 502 fallback", _PARSE_ERROR_STATUS.get("weird", 502), 502)


def test_offline_text_parser():
    print("E3 text fallback: offline regex parser (no Gemini)")
    from backend.app.services.receipt_text_parser import parse_receipt_text_offline
    txt = ("REWE Markt GmbH\n"
           "Datum: 13.07.2026\n"
           "Vollmilch 3,5% 1L    1,29\n"
           "Bananen 1,0 kg       1,49\n"
           "Bio Eier 10 Stk      2,99\n"
           "Pfand                0,25\n"
           "SUMME                5,77")
    r = parse_receipt_text_offline(txt)
    check("store detected", r["store"], "Rewe")
    check("date parsed to ISO", r["date"], "2026-07-13")
    check("3 food items (header/summe excluded)", r["items_count"], 3)
    check("Pfand → non-food", any("Pfand" in n for n in r["non_food_items_ignored"]), True)
    names = [i["name"] for i in r["items"]]
    check("store header not an item", "REWE Markt GmbH" not in names, True)
    milk = next(i for i in r["items"] if i["name"] == "Vollmilch")
    check("price extracted", milk["price"], 1.29)
    check("unit parsed (1L → l)", milk["unit"], "l")
    eier = next(i for i in r["items"] if "Eier" in i["name"])
    check("count unit (10 Stk → piece)", eier["unit"], "piece")


def test_block_layout_parser():
    print("E3: block-layout parser (eBon PDF — price on the next line)")
    from backend.app.services.receipt_text_parser import parse_receipt_text_offline
    txt = (
        "NETTO\n"
        "Filiale 7761\n"
        "EUR\n"
        "Beste Ernte Kichererbsen 265g\n0,59\nB\n"
        "Irische Butter Kerrygold 250g\n1,49\nB\n"
        "1,266 kg x\n1,29 EUR/kg\nBananen Lose MT\n1,63\nB\n"
        "Pfand\n0,25\nB\n"
        "SUMME [3]\n3,71\n"
    )
    r = parse_receipt_text_offline(txt)
    check("block store detected", r["store"], "Netto")
    check("3 food items (summe/pfand excluded)", r["items_count"], 3)
    check("Pfand → non-food", any("Pfand" in n for n in r["non_food_items_ignored"]), True)
    banane = next(i for i in r["items"] if "Banane" in i["name"])
    check("weighed item unit kg", banane["unit"], "kg")
    check("weighed item qty 1.266", banane["quantity"], 1.266)
    kicher = next(i for i in r["items"] if "Kichererbsen" in i["name"])
    check("block price parsed", kicher["price"], 0.59)


def main():
    for fn in (
        test_unit_normalization,
        test_piece_weights,
        test_mock_parser,
        test_typed_errors,
        test_error_status_map,
        test_offline_text_parser,
        test_block_layout_parser,
    ):
        fn()
    print(f"\n{_PASS} passed, {_FAIL} failed")
    if _FAIL:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
