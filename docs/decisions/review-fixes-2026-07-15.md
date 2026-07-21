---
name: review-fixes-2026-07-15
description: Fixed a NameError that silently broke manual product matching, added non-food marking, retired the dead products table
metadata:
  type: project
---

Three fixes implemented 2026-07-15, from a user testing session against Review + the DB:

**Critical bug found and fixed:** `pick_item_match`/`flag_no_match` in `backend/app/api/receipts.py` called `_assert_owner(...)`, a function that only existed in `api/profile.py` — never defined or imported in `receipts.py`. Every call crashed with `NameError` → 500. The frontend's `pick()` had no `catch` block, so this was completely silent — clicking "Use this" in Review appeared to do nothing. This is *why* `verified_matches` and `no_match_queue` were both empty (0 rows): every write attempt crashed before reaching the vote-recording code. Fixed by defining `_assert_owner` locally in `receipts.py` (mirroring profile.py's version).

**Non-food marking (E3-S4 follow-up):** Gemini used to semantically classify non-food items; the local OCR parser only catches a fixed German keyword list (Pfand/Rabatt/Tüte/...). Added a manual "Not food" button in Review (`POST /receipts/{id}/items/{id}/non-food`) that: (1) sets the item's `category` to the sentinel `"non_food"`, which `services/resolver.py` now recognizes and excludes from all nutrition matching (no OFF/BLS lookup, `nutrition=None` — the same "skip" signal every downstream consumer already honors); (2) removes its quantity from the pantry via `mark_unavailable`; (3) learns the raw text into a new `non_food_terms` table (reusing `verified_matches.normalize_match_key` for consistent keying), so future receipts strip it automatically at upload time via `services/non_food_terms.filter_learned_non_food`. See [[e1-auth-migration]] for the receipt pipeline this hooks into.

**Search-and-select feedback fix:** `MatchFixer` (in ReviewStep.tsx) shared one `busy` flag across search/pick/no-match, so clicking "Use this" made the *Search* button flash "Searching…" — the reported "nothing happens" symptom. Split into `searching`/`working` state; pick now also updates `receipt_items.confidence` to 1.0 server-side (previously never touched after a manual fix, so the confidence badge stayed stale) and auto-collapses the panel after a brief confirmation.

**Retired:** `product_registry.py` (broken — imported DB helpers that no longer existed in `supabase.py`, threw `ImportError`, imported by nothing live) and its only caller `scripts/backfill_matches.py`, both deleted. The `products` table (52 orphaned rows, nothing read/wrote it) is dropped via migration v14 — the user must run this migration themselves in the Supabase SQL editor. `verified_matches` already fulfills Epic 5's "remember corrections" role and actually works.

**Migrations added (user must run in order):** v13 (`non_food_terms` table), v14 (`drop table products`).
