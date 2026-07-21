-- =====================================================================
-- E10 — Eaten-feedback waste (BR-I3 / BR-T3).
-- Run in the Supabase SQL editor. Idempotent.
--
-- The E6 status-quo engine (services/status_quo.py) already reads a
-- per-item `waste_fraction` in its daily-intake rollup
--   Σ (item_nutrient × share × (1 − waste)) ÷ consumption_days
-- but nothing wrote it until now (it defaulted to 0). Epic 10's
-- eaten-feedback (variant A at next upload, variant B on the dashboard)
-- writes the "thrown away" share here, per receipt item, which then flows
-- straight into gap detection & the health score on the next analysis.
--
-- 0.0 = nothing wasted (default, = today's behaviour); 1.0 = the whole
-- item was thrown away.
-- =====================================================================

alter table receipt_items
  add column if not exists waste_fraction numeric not null default 0;
