"""
Verified-match store (Epic 5) — Tier-0 learned matching.

Persists user-confirmed corrections so the same raw receipt text resolves
instantly next time, and improves globally as more people confirm the same
mapping. Read side is Tier-0 in the resolver (BR-MT0); write side is the
manual-pick action in review (R-WRITE).

Data model (BR-MT6, reconciled with E5-S5 / E12):
  Each *vote* row carries a user_id — required to enforce one vote per user
  per key and to erase a user's votes on account deletion (E12). The served
  *winner* is the de-identified aggregate: winner = most votes, ties broken
  by most-recent; a key whose top product holds < 50% is "low-agreement"
  and NOT auto-served. The aggregate mapping is what survives erasure.

Two backends (E5 decision): a local JSON dev-store (VERIFIED_STORE_LOCAL=1)
so Tier-0 / voting / conflict resolution can be exercised end-to-end
without a database, and the real Supabase path otherwise (tolerant — inert
until the migration in db/migrations runs). The voting/conflict logic is a
pure function shared by both, so it is unit-tested offline.
"""

import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Optional, List, Dict

# Lower share required for a key's top product to be auto-served (BR-MT6:
# "< 50% → low-agreement, not auto-served"; a 2-way 50/50 tie is served via
# the most-recent tiebreak, so the cutoff is inclusive at 0.5).
_MIN_AGREEMENT = 0.5

# Store-agnostic hits (same raw text, different/أny store) are trusted a bit
# less than an exact (text, store) hit (BR-MT0).
_EXACT_CONF = 1.0
_STORE_AGNOSTIC_CONF = 0.9

_LOCAL = os.environ.get("VERIFIED_STORE_LOCAL", "").strip().lower() in {"1", "true", "yes", "on"}
_VOTES_PATH = Path(__file__).parent / "_verified_matches.json"
_NOMATCH_PATH = Path(__file__).parent / "_no_match_queue.json"

# ── BR-MT0a shared normalization ─────────────────────────────────────────
_STORE_TOKENS = {"rewe", "edeka", "aldi", "netto", "norma", "lidl", "penny", "markt", "gmbh"}
_UNIT_TOKENS = {"g", "gr", "gramm", "kg", "ml", "l", "ltr", "liter", "stk", "stück", "stueck",
                "st", "x", "pack", "packung", "dose", "glas", "flasche", "bund", "cl"}
# a bare quantity or quantity+unit token ("500g", "1,5l", "3,5%", "1,29")
_QTY_RE = re.compile(r"^\d+([.,]\d+)?(g|gr|kg|ml|l|ltr|stk|st|x|%|€)?$")


def normalize_match_key(raw_text: str) -> str:
    """
    Shared normalization for the Tier-0 key (BR-MT0a), used identically on
    the write and read paths so keys can never silently diverge:
    NFC → lowercase → strip quantity/price/unit/store tokens → collapse
    whitespace → trim.
    """

    text = unicodedata.normalize("NFC", raw_text or "").lower()
    text = text.replace("€", " ").replace(",", ".")
    tokens = re.split(r"[\s]+", text)
    kept = []
    for tok in tokens:
        t = tok.strip(".-,;:()")
        if not t:
            continue
        if t in _UNIT_TOKENS or t in _STORE_TOKENS:
            continue
        if _QTY_RE.match(t):
            continue
        kept.append(t)
    return " ".join(kept).strip()


# ── Pure voting / conflict resolution (BR-MT6) ───────────────────────────

def _product_key(vote: dict) -> str:
    return vote.get("off_id") or vote.get("bls_code") or (vote.get("matched_name") or "").lower()


def resolve_winner(votes: List[dict]) -> Optional[dict]:
    """
    Given all votes for one key, return the winning product's representative
    vote plus {votes, total, share, served}, or None if there are no votes.

    - one vote per user (latest kept), then tally by product;
    - winner = most votes, tie → most recent updated_at;
    - served = winner share ≥ 50% (BR-MT6).
    """

    if not votes:
        return None

    # 1 vote per user per key — keep each user's most recent (R-WRITE dedup).
    by_user: Dict[str, dict] = {}
    for v in votes:
        uid = v.get("user_id") or "anon"
        cur = by_user.get(uid)
        if cur is None or (v.get("updated_at") or "") > (cur.get("updated_at") or ""):
            by_user[uid] = v
    effective = list(by_user.values())
    total = len(effective)

    tally: Dict[str, List[dict]] = {}
    for v in effective:
        tally.setdefault(_product_key(v), []).append(v)

    # winner: highest count, tie broken by the most recent vote in the group.
    def group_rank(item):
        pk, group = item
        recent = max((g.get("updated_at") or "") for g in group)
        return (len(group), recent)

    winner_key, winner_group = max(tally.items(), key=group_rank)
    count = len(winner_group)
    representative = max(winner_group, key=lambda g: g.get("updated_at") or "")
    share = count / total if total else 0.0
    return {
        **representative,
        "votes": count,
        "total": total,
        "share": round(share, 3),
        "served": share >= _MIN_AGREEMENT,
    }


# ── Backend I/O (local JSON dev-store or Supabase) ───────────────────────

def _load(path: Path) -> list:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def _save(path: Path, data: list) -> None:
    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def _votes_for_key(key: str, store: Optional[str]) -> List[dict]:
    """All votes for the exact (key, store) pair; store=None matches any store."""

    if _LOCAL:
        rows = _load(_VOTES_PATH)
    else:
        try:
            from backend.app.db.supabase import get_verified_votes
            rows = get_verified_votes(key)
        except Exception:
            return []
    out = []
    for r in rows:
        if r.get("key") != key:
            continue
        if store is not None and (r.get("store") or "") != (store or ""):
            continue
        out.append(r)
    return out


def record_vote(
    raw_text: str,
    store: Optional[str],
    source: str,
    user_id: str,
    off_id: Optional[str] = None,
    bls_code: Optional[str] = None,
    matched_name: Optional[str] = None,
    nova: Optional[float] = None,
    nutrition: Optional[dict] = None,
    now: Optional[str] = None,
) -> dict:
    """Write/replace this user's vote for (normalized key, store) — R-WRITE.
    One vote per user per key: an existing vote by the same user for the
    same key+store is overwritten (not stacked)."""

    from datetime import datetime, timezone

    key = normalize_match_key(raw_text)
    ts = now or datetime.now(timezone.utc).isoformat()
    vote = {
        "key": key, "store": store or "", "user_id": user_id, "source": source,
        "off_id": off_id, "bls_code": bls_code, "matched_name": matched_name,
        "nova": nova, "nutrition": nutrition or {}, "updated_at": ts,
    }

    if _LOCAL:
        rows = _load(_VOTES_PATH)
        rows = [r for r in rows if not (r.get("key") == key and (r.get("store") or "") == (store or "")
                                        and r.get("user_id") == user_id)]
        rows.append(vote)
        _save(_VOTES_PATH, rows)
    else:
        try:
            from backend.app.db.supabase import upsert_verified_vote
            upsert_verified_vote(vote)
        except Exception:
            pass
    return vote


def lookup_verified_match(raw_text: str, store: Optional[str] = None) -> Optional[dict]:
    """
    Tier-0 lookup (BR-MT0). Exact (key, store) winner → confidence 1.0;
    else a store-agnostic winner → lower confidence. Returns None when there
    is no winner or the winner is low-agreement (< 50%), so the resolver
    falls through to OFF/BLS. Never raises.
    """

    key = normalize_match_key(raw_text)
    if not key:
        return None

    # exact store first, then store-agnostic
    for scope_store, conf in ((store, _EXACT_CONF), (None, _STORE_AGNOSTIC_CONF)):
        if scope_store is None and store is None and conf == _EXACT_CONF:
            continue  # avoid running the same query twice when store is None
        winner = resolve_winner(_votes_for_key(key, scope_store))
        if winner and winner["served"]:
            return {
                "matched_name": winner.get("matched_name"),
                "off_id": winner.get("off_id"),
                "bls_code": winner.get("bls_code"),
                "nova": winner.get("nova"),
                "nutrition": winner.get("nutrition"),
                "confidence": conf,
                "votes": winner["votes"],
                "share": winner["share"],
            }
    return None


def delete_user_votes(user_id: str) -> int:
    """
    E12-S3: remove this user's verified-match votes on account erasure.

    The de-identified aggregate (the winning product per key) is RETAINED
    (BR-P3): we only drop rows carrying this user's id, never other users'
    votes — so a key that still has votes from others keeps resolving, and
    only a key that was solely this user's naturally stops (correct: no
    personal data, no phantom mapping). Returns the number of votes removed
    (0 on the Supabase path, which doesn't report a count).
    """

    if _LOCAL:
        rows = _load(_VOTES_PATH)
        kept = [r for r in rows if r.get("user_id") != user_id]
        removed = len(rows) - len(kept)
        _save(_VOTES_PATH, kept)
        return removed

    try:
        from backend.app.db.supabase import delete_verified_votes_by_user
        delete_verified_votes_by_user(user_id)
    except Exception:
        pass
    return 0


def log_no_match(raw_text: str, store: Optional[str] = None) -> dict:
    """No-match queue (E5-S5): record raw text + store with a frequency
    counter so recurring gaps in OFF/BLS coverage are visible."""

    key = normalize_match_key(raw_text)
    entry = {"key": key, "store": store or "", "raw_text": raw_text}
    if _LOCAL:
        rows = _load(_NOMATCH_PATH)
        for r in rows:
            if r.get("key") == key and (r.get("store") or "") == (store or ""):
                r["count"] = r.get("count", 1) + 1
                _save(_NOMATCH_PATH, rows)
                return r
        entry["count"] = 1
        rows.append(entry)
        _save(_NOMATCH_PATH, rows)
    else:
        try:
            from backend.app.db.supabase import log_no_match_row
            log_no_match_row(entry)
        except Exception:
            pass
    return entry
