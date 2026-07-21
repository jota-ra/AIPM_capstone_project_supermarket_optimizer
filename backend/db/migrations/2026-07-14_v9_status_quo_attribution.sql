-- =====================================================================
-- E6 — Status-quo attribution inputs on profiles.
-- Run in the Supabase SQL editor. Idempotent; all columns nullable so
-- existing profiles keep working (values default to sensible fallbacks in
-- services/status_quo.py when absent).
-- =====================================================================

alter table profiles add column if not exists groceries_shared  boolean;
alter table profiles add column if not exists household_size     integer;  -- N incl. the user
alter table profiles add column if not exists user_share         numeric;  -- optional manual override 0..1
alter table profiles add column if not exists meals_outside      text;     -- never|rarely|sometimes|often|daily
alter table profiles add column if not exists receipts_complete  text;     -- all|most|some|few
