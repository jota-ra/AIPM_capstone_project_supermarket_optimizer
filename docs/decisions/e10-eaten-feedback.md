---
name: e10-eaten-feedback
description: Epic 10 (eaten-feedback A/B) feeds the E6 status-quo waste_fraction, not the pantry model
metadata:
  type: project
---

Epic 10 (implemented 2026-07-15) closes the loop by capturing eaten/still-have/thrown-away feedback on a prior receipt.

**Decisions (confirmed with the user):**
- **Target model:** feedback writes a per-item `waste_fraction` on `receipt_items` (new column, migration `v12`), which the E6 `status_quo.build_status_quo` already consumed (the hook was left at 0). It does NOT touch the parallel pantry stock model (consume/remove/Diary) — that stays a separate concern.
- **Semantics:** only "thrown away" → `waste_fraction = 1.0`; "ate it" / "still have" are non-waste (BR-I1, the only waste term in the intake formula).
- **Variant B placement:** a new self-gating card on the Insights dashboard (ResultsStep), distinct from the existing "My Day" diary.

**Shape:**
- `services/ab_assignment.py`: `assign_variant(user_id)` — deterministic SHA-256 %2 → "A"/"B". Sticky by construction, no stored column.
- `api/consumption.py`: `GET /consumption/context` (variant + prior receipt), `POST /consumption/feedback` (writes waste, recomputes + echoes status-quo daily_intake).
- Frontend `steps/EatenFeedbackCard.tsx`: one component, `surface="A"|"B"`, self-gates on `variant === surface && prior_receipt`. Placed in PantryStep (A, above uploader) and ResultsStep (B, above AnalysisCard, `onSubmitted=load`).

Requires migration `backend/db/migrations/2026-07-15_v12_receipt_item_waste.sql` to be run in Supabase. Until then `set_receipt_item_waste` degrades to a logged no-op (tolerant update), so waste stays 0. Two parallel consumption models remain by design — see [[e1-auth-migration]] for the broader architecture.
