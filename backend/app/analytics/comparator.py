"""
Receipt Comparison Engine (Task 8.6, v2).

Compares two receipts' item lists to find overlapping products. This is
groundwork for adoption scoring (Task 8.8): "did the item recommended
after receipt N actually turn up in receipt N+1?" — this is v2
scope, so it's built as a data-model
building block rather than a user-facing feature.

Uses the same token-aware fuzzy matcher as Task 2.2's product matching
(services/text_similarity.py) — no extra dependency, no LLM call, so
"overlap" stays a deterministic, explainable fact rather than a guess.

Bug fix: this originally scored matches with a raw whole-string
SequenceMatcher ratio, which badly under-scores a short recommended
item against a longer/differently-worded receipt entry — "Rote Linsen"
recommended, "Linsen" purchased, scored ~0.71 and was reported as NOT
adopted. Switched to the shared token-aware similarity used by the
product matcher, which scores that case ~0.85 and correctly detects it.
"""

from typing import List

from backend.app.models.analytics import ReceiptComparison
from backend.app.services.text_similarity import token_similarity

MATCH_THRESHOLD = 0.8


def _normalize(name: str) -> str:
    return (name or "").strip().lower()


def item_names(items: List[dict]) -> List[str]:
    """Normalized item names from a list of receipt_items rows (or parser items)."""

    names = []
    for item in items:
        name = item.get("normalized_name") or item.get("raw_name") or item.get("name")
        if name:
            names.append(_normalize(name))
    return names


def _best_match_score(name: str, candidates: List[str]) -> float:
    if not candidates:
        return 0.0
    return max(token_similarity(name, c) for c in candidates)


def did_purchase_item(item_name: str, receipt_items: List[dict]) -> bool:
    """Did `item_name` (or a close fuzzy match) appear in this receipt's items?"""

    return _best_match_score(_normalize(item_name), item_names(receipt_items)) >= MATCH_THRESHOLD


def compare_receipts(items_a: List[dict], items_b: List[dict]) -> ReceiptComparison:
    """
    Compare two receipts' items for overlap.

    overlap_score = fuzzy-matched items / size of the union of both
    baskets — 1.0 means every distinct item in either receipt also
    appears in the other, 0.0 means no item recurred at all.
    """

    names_a = item_names(items_a)
    names_b = item_names(items_b)

    matched = [name for name in names_a if _best_match_score(name, names_b) >= MATCH_THRESHOLD]
    union_size = len(set(names_a) | set(names_b))
    overlap_score = round(len(matched) / union_size, 3) if union_size else 0.0

    return ReceiptComparison(
        items_a=len(names_a),
        items_b=len(names_b),
        matched_items=matched,
        overlap_score=overlap_score,
    )
