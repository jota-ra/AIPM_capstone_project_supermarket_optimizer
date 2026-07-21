"""
One-off: build the OFF-vs-BLS comparison dataset for the matching
investigation (`matching_investigations.ipynb`) and for the LLM judge
panel that scores it (no ground-truth labels exist for "is this match
actually the right product", so an independent panel judges it).

For every *unique* item name currently in `receipt_items` (deduped, since
many receipts repeat the same product), this runs:
  - the real OFF pipeline tiers 1+2 (`matcher.match_product`,
    `base_terms.generic_term` retry) — tier 3 (category fallback) is
    deliberately excluded here: this comparison is about how well each
    *database* names the product, not the shared last-resort guess.
  - the equivalent BLS tiers via `bls_matcher.match_product_bls`.

Output: JSON list written to stdout-adjacent file, one record per unique
item, with only nutrition-bearing matches included (a match search that
found candidates but none with usable nutrition data is treated the same
as no match, per the same rule the production matcher already applies).

Usage (repo root):
    python -m backend.app.scripts.build_bls_off_dataset > /path/to/out.json
"""

import json
import sys

from backend.app.db.supabase import get_all_receipt_items
from backend.app.services import matcher, base_terms, bls_matcher, nutrition_mapping

_GENERIC_CONFIDENCE_CAP = 0.7


def _off_match(name: str) -> dict:
    m = matcher.match_product(name)
    if m is not None:
        return {
            "matched_name": m.matched_name,
            "id": m.off_id,
            "match_type": m.match_type.value,
            "match_tier": 1,
            "confidence": m.confidence,
            "nutrition": m.nutrition.model_dump() if m.nutrition else None,
        }

    generic = base_terms.generic_term(name)
    if generic:
        gm = matcher.match_product(generic, prefer_low_processed=True)
        if gm is not None:
            return {
                "matched_name": gm.matched_name,
                "id": gm.off_id,
                "match_type": "fuzzy",
                "match_tier": 2,
                "generic_term": generic,
                "confidence": round(min(gm.confidence, _GENERIC_CONFIDENCE_CAP), 3),
                "nutrition": gm.nutrition.model_dump() if gm.nutrition else None,
            }
    return {"matched_name": None, "id": None, "match_type": "none", "match_tier": None,
            "confidence": None, "nutrition": None}


def _bls_match(name: str) -> dict:
    m = bls_matcher.match_product_bls(name)
    if m is not None:
        return {
            "matched_name": m["matched_name"],
            "id": m["bls_code"],
            "match_type": m["match_type"],
            "match_tier": 1,
            "confidence": m["confidence"],
            "nutrition": m["nutrition"],
        }

    generic = base_terms.generic_term(name)
    if generic:
        gm = bls_matcher.match_product_bls(generic)
        if gm is not None:
            return {
                "matched_name": gm["matched_name"],
                "id": gm["bls_code"],
                "match_type": "fuzzy",
                "match_tier": 2,
                "generic_term": generic,
                "confidence": round(min(gm["confidence"], _GENERIC_CONFIDENCE_CAP), 3),
                "nutrition": gm["nutrition"],
            }
    return {"matched_name": None, "id": None, "match_type": "none", "match_tier": None,
            "confidence": None, "nutrition": None}


def main():
    items = get_all_receipt_items()
    by_name = {}
    for item in items:
        name = nutrition_mapping._item_name(item)
        if not name:
            continue
        key = name.strip().lower()
        entry = by_name.setdefault(key, {
            "raw_name": item.get("raw_name"),
            "normalized_name": name,
            "category": item.get("category"),
            "occurrences": 0,
        })
        entry["occurrences"] += 1

    records = []
    unique_names = sorted(by_name.keys())
    for i, key in enumerate(unique_names, 1):
        entry = by_name[key]
        name = entry["normalized_name"]
        records.append({
            **entry,
            "off": _off_match(name),
            "bls": _bls_match(name),
        })
        print(f"...{i}/{len(unique_names)} {name!r}", file=sys.stderr)

    json.dump(records, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
