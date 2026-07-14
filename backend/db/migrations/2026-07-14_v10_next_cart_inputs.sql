-- =====================================================================
-- E8 — Next-Cart inputs on profiles (FR-10.1).
-- Run in the Supabase SQL editor. Idempotent; nullable.
-- =====================================================================

alter table profiles add column if not exists days_to_shop          integer;  -- days until next shop
alter table profiles add column if not exists home_cooked_frequency text;     -- rarely|sometimes|often|daily
