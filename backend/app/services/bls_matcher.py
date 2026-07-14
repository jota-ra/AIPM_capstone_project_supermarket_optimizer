"""
BLS (Bundeslebensmittelschlüssel) local matcher — investigation only.

Not wired into the live app / production matching pipeline yet. Built to
answer a concrete question: how does matching against the German federal
food-composition database (BLS 4.0, `BLS_data/BLS_4_0_Daten_2025_DE.xlsx`,
~7,140 generic food entries) compare to matching against OpenFoodFacts
(`off_api.py` / `matcher.py`)?

To make that comparison fair, this reuses the *exact same* scoring
function and thresholds as the OFF matcher (`text_similarity.token_similarity`,
`matcher.FUZZY_THRESHOLD`, `matcher.EXACT_THRESHOLD`) — the only variable
being compared is the underlying dataset, not the algorithm.

Key structural difference from OFF, which matters for the comparison:
BLS is a *generic food composition table* (e.g. "Tomate, roh"), not a
*branded/packaged product catalogue* (e.g. "EDEKA Cocktailrispentomaten
500g"). It therefore has near-complete macro data for almost every row,
but: (a) no brand-specific entries, and (b) no NOVA/processing
classification at all — `processed_score` is always None.
"""

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional, List, TypedDict

import openpyxl

from backend.app.services.matcher import EXACT_THRESHOLD, FUZZY_THRESHOLD
from backend.app.services.text_similarity import token_similarity, full_ratio

_XLSX_PATH = Path(__file__).resolve().parents[3] / "BLS_data" / "BLS_4_0_Daten_2025_DE.xlsx"
_CACHE_PATH = Path(__file__).parent / "_bls_cache.json"
_SHEET_NAME = "BLS_4_0_Daten_2025_DE"

# 0-indexed column positions in the BLS 4.0 export (verified against the
# header row directly; see BLS_4_0_Components_DE_EN.xlsx for the full
# code dictionary).
_COL_CODE = 0
_COL_NAME_DE = 1
_COL_NAME_EN = 2
_COL_KCAL = 6      # ENERCC Energie (Kilokalorien) [kcal/100g]
_COL_PROTEIN = 12  # PROT625 Protein (Nx6,25) [g/100g]
_COL_FIBER = 21    # FIBT Ballaststoffe, gesamt [g/100g]
_COL_SUGAR = 219   # SUGAR Zucker (Mono- und Disaccharide), gesamt [g/100g]


class BlsRecord(TypedDict):
    code: str
    name_de: str
    name_en: str
    protein_g: Optional[float]
    fiber_g: Optional[float]
    sugar_g: Optional[float]
    calories_kcal: Optional[float]


def _num(v) -> Optional[float]:
    if v is None or v == "" or isinstance(v, str) and not v.strip():
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _build_cache() -> List[BlsRecord]:
    """Parse the ~7,140-row / 418-column xlsx once and keep only the 7
    columns this matcher needs, cached as compact JSON next to this file
    (mirrors off_api.py's on-disk cache) so every later import is instant
    instead of paying the ~6s full-sheet openpyxl read again."""

    wb = openpyxl.load_workbook(_XLSX_PATH, read_only=True, data_only=True)
    ws = wb[_SHEET_NAME]
    records: List[BlsRecord] = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        code = row[_COL_CODE]
        name_de = row[_COL_NAME_DE]
        if not code or not name_de:
            continue
        records.append({
            "code": str(code),
            "name_de": str(name_de).strip(),
            "name_en": str(row[_COL_NAME_EN] or "").strip(),
            "protein_g": _num(row[_COL_PROTEIN]),
            "fiber_g": _num(row[_COL_FIBER]),
            "sugar_g": _num(row[_COL_SUGAR]),
            "calories_kcal": _num(row[_COL_KCAL]),
        })
    wb.close()

    _CACHE_PATH.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    return records


def _load_records() -> List[BlsRecord]:
    if _CACHE_PATH.exists():
        try:
            return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return _build_cache()


# Loaded once at import time — a static reference table, not a live
# resource (same rationale as recommender.py's RECOMMENDATIONS).
BLS_RECORDS: List[BlsRecord] = _load_records()


def _has_usable_nutrition(rec: BlsRecord) -> bool:
    return any(rec.get(k) is not None for k in ("protein_g", "fiber_g", "sugar_g", "calories_kcal"))


def search_bls(name: str, page_size: int = 5) -> List[dict]:
    """
    Return the top `page_size` BLS candidates for `name`, scored by the
    identical `token_similarity` used for OFF — best of the German name
    and the English name (receipts are German, but a handful of BLS
    entries have a much cleaner English gloss).
    """

    q = (name or "").strip()
    if not q:
        return []

    scored = []
    for rec in BLS_RECORDS:
        score_de = token_similarity(q, rec["name_de"])
        score_en = token_similarity(q, rec["name_en"]) if rec["name_en"] else 0.0
        score = max(score_de, score_en)
        if score <= 0:
            continue
        scored.append((score, rec))

    scored.sort(key=lambda t: -t[0])
    return [{"score": round(s, 3), **rec} for s, rec in scored[:page_size]]


def match_product_bls(name: str, prefer_low_processed: bool = False) -> Optional[dict]:
    """
    Resolve one product name to a BLS entry, mirroring
    `matcher.match_product` tier-for-tier and threshold-for-threshold.

    `prefer_low_processed` is accepted for call-site symmetry with the
    OFF matcher (used when retrying a generalised produce term) but is a
    no-op here: BLS carries no NOVA/processing signal to prefer on.

    Returns None when no candidate clears FUZZY_THRESHOLD with usable
    nutrition — same contract as `matcher.match_product`.
    """

    q = (name or "").strip()
    if not q:
        return None

    candidates = search_bls(q, page_size=10)
    if not candidates:
        return None

    scored = []
    for cand in candidates:
        score = max(
            token_similarity(q, cand["name_de"]),
            token_similarity(q, cand["name_en"]) if cand["name_en"] else 0.0,
        )
        if score < FUZZY_THRESHOLD:
            continue
        if not _has_usable_nutrition(cand):
            continue
        scored.append((score, cand))

    if not scored:
        return None

    scored.sort(key=lambda t: -t[0])
    best_score, best = scored[0]

    is_exact = full_ratio(q, best["name_de"]) >= EXACT_THRESHOLD or full_ratio(q, best["name_en"]) >= EXACT_THRESHOLD

    return {
        "parsed_item_name": q,
        "matched_name": best["name_de"],
        "bls_code": best["code"],
        "match_type": "exact" if is_exact else "fuzzy",
        "confidence": round(best_score, 3),
        "data_source": "BLS",
        "nutrition": {
            "protein_g": best["protein_g"],
            "fiber_g": best["fiber_g"],
            "sugar_g": best["sugar_g"],
            "calories_kcal": best["calories_kcal"],
            "processed_score": None,  # BLS has no NOVA/processing classification
        },
    }
