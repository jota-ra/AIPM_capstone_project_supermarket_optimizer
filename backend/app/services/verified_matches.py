"""
Tier-0 verified-match store — read side (BR-MT0/MT6).

Epic 4 wires the *read* hook as the first matching tier; Epic 5 owns the
*write* side (persisting user-confirmed corrections, voting/conflict
resolution) that actually populates the store. Until then this returns
None for every lookup, so the resolver simply falls through to the OFF/BLS
tiers — no behaviour change, but the seam is in place.

The lookup key is the shared normalized raw text (BR-MT0a) plus the store,
so E5 only has to start writing rows for learned matches to light up.
"""

from typing import Optional

from backend.app.services.units import normalize_unit  # noqa: F401  (keeps unit vocab importable)


def normalize_match_key(raw_text: str) -> str:
    """Shared normalization for the Tier-0 key (BR-MT0a): NFC → lowercase →
    collapse whitespace → trim. Kept deliberately simple and identical on
    the read and (future E5) write paths so keys can't silently diverge."""

    import unicodedata

    text = unicodedata.normalize("NFC", raw_text or "")
    return " ".join(text.lower().split()).strip()


def lookup_verified_match(raw_text: str, store: Optional[str] = None) -> Optional[dict]:
    """
    Tier-0 lookup on (normalized_raw_text, store).

    Returns a verified match dict at confidence 1.0 when the store has a
    winning entry for this key, else None. Inert until Epic 5 populates the
    `verified_matches` store — any read error (table missing on an
    unmigrated DB) is swallowed and treated as "no learned match", so the
    resolver degrades gracefully (BR-MT: matching never blocks).
    """

    key = normalize_match_key(raw_text)
    if not key:
        return None

    try:
        from backend.app.db.supabase import get_verified_match  # E5 write side
    except ImportError:
        return None

    try:
        return get_verified_match(key, store)
    except Exception:
        return None
