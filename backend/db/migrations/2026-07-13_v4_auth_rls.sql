-- =====================================================================
-- E1 — Authenticated user scoping + Row-Level Security
-- Run in the Supabase SQL editor.
--
-- Design (decided with the client): scoping is APP-ENFORCED — the backend
-- filters every query by user_id using the service-role key, which
-- BYPASSES RLS. The RLS policies below are DEFENSE-IN-DEPTH: they lock
-- down any non-service-role access (anon key or a user's own JWT hitting
-- PostgREST directly). Existing session-only rows keep user_id = NULL and
-- simply won't surface for authenticated users ("leave old data behind").
--
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1) user_id columns (nullable) -------------------------------------------------
alter table receipts        add column if not exists user_id uuid;
alter table profiles        add column if not exists user_id uuid;
alter table recommendations add column if not exists user_id uuid;
alter table feedback        add column if not exists user_id uuid;
alter table events          add column if not exists user_id uuid;

-- 2) session_id no longer required (kept nullable for backward-compat) ----------
alter table receipts        alter column session_id drop not null;
alter table recommendations alter column session_id drop not null;
alter table feedback        alter column session_id drop not null;
alter table events          alter column session_id drop not null;
-- profiles stored session_id inside its columns too; drop NOT NULL if present:
do $$ begin
  begin
    alter table profiles alter column session_id drop not null;
  exception when undefined_column then null;
  end;
end $$;

-- 3) indexes for the new scoping filter -----------------------------------------
create index if not exists receipts_user_id_idx        on receipts (user_id);
create index if not exists profiles_user_id_idx        on profiles (user_id);
create index if not exists recommendations_user_id_idx on recommendations (user_id);
create index if not exists feedback_user_id_idx        on feedback (user_id);

-- 4) Row-Level Security (defense-in-depth; service_role bypasses it) -------------
alter table receipts        enable row level security;
alter table receipt_items   enable row level security;
alter table profiles        enable row level security;
alter table recommendations enable row level security;
alter table feedback        enable row level security;

-- Own-rows policies for the authenticated role. Drop-then-create for idempotency.
drop policy if exists own_receipts on receipts;
create policy own_receipts on receipts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_profiles on profiles;
create policy own_profiles on profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_recommendations on recommendations;
create policy own_recommendations on recommendations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_feedback on feedback;
create policy own_feedback on feedback
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- receipt_items are owned via their parent receipt (no direct user_id column).
drop policy if exists own_receipt_items on receipt_items;
create policy own_receipt_items on receipt_items
  for all to authenticated
  using (
    exists (select 1 from receipts r
            where r.id = receipt_items.receipt_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from receipts r
            where r.id = receipt_items.receipt_id and r.user_id = auth.uid())
  );

-- Note: `events` is ops/aggregate data written & read only via the
-- service role (/analytics/*); RLS intentionally NOT enabled there.

-- Note: `products` and `verified_matches` (E4/E5) are global, non-personal
-- reference data — no per-user RLS. Add their policies with those epics.
