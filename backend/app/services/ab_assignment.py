"""
Eaten-feedback A/B assignment (E10-S1 / R-EATEN).

Each account is placed in variant **A** (asked at the next upload) or **B**
(daily on the dashboard) by a deterministic 50/50 hash of the user id.

Deterministic-by-construction gives us everything R-EATEN asks for without a
stored column:
  - sticky for the account's lifetime (same user id → same variant, always);
  - never both (the function returns exactly one);
  - no migration / no write path that could drift out of sync.

Pure and unit-testable.
"""

import hashlib

Variant = str  # "A" | "B"

VARIANT_A: Variant = "A"
VARIANT_B: Variant = "B"


def assign_variant(user_id: str) -> Variant:
    """Deterministic 50/50 split by SHA-256 of the user id (even → A, odd → B)."""

    if not user_id:
        # Defensive: an empty id shouldn't happen behind auth, but never crash.
        return VARIANT_A
    digest = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
    return VARIANT_A if int(digest, 16) % 2 == 0 else VARIANT_B
