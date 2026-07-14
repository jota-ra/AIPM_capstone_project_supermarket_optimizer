-- =====================================================================
-- CONSOLIDATED MIGRATION — Epics 1–9 (v4 → v11), in order.
-- Paste this whole file into the Supabase SQL editor and run once.
--
-- Every statement is idempotent (`if not exists` / `drop policy if exists`),
-- so it is safe to run even if some individual migrations were applied
-- before. This does NOT backfill legacy rows: session-only rows keep
-- user_id = NULL and won't surface for authenticated users (by design).
--
-- Scoping is APP-ENFORCED (backend filters by user_id via the service-role
-- key, which bypasses RLS); the RLS policies are defense-in-depth.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- v4 — Auth user scoping + RLS on receipts/profiles/recommendations/feedback
-- ─────────────────────────────────────────────────────────────────────
alter table receipts        add column if not exists user_id uuid;
alter table profiles        add column if not exists user_id uuid;
alter table recommendations add column if not exists user_id uuid;
alter table feedback        add column if not exists user_id uuid;
alter table events          add column if not exists user_id uuid;

do $$ begin
  begin alter table receipts        alter column session_id drop not null; exception when undefined_column then null; end;
  begin alter table recommendations alter column session_id drop not null; exception when undefined_column then null; end;
  begin alter table feedback        alter column session_id drop not null; exception when undefined_column then null; end;
  begin alter table events          alter column session_id drop not null; exception when undefined_column then null; end;
  begin alter table profiles        alter column session_id drop not null; exception when undefined_column then null; end;
end $$;

create index if not exists receipts_user_id_idx        on receipts (user_id);
create index if not exists profiles_user_id_idx        on profiles (user_id);
create index if not exists recommendations_user_id_idx on recommendations (user_id);
create index if not exists feedback_user_id_idx        on feedback (user_id);

alter table receipts        enable row level security;
alter table receipt_items   enable row level security;
alter table profiles        enable row level security;
alter table recommendations enable row level security;
alter table feedback        enable row level security;

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

drop policy if exists own_receipt_items on receipt_items;
create policy own_receipt_items on receipt_items
  for all to authenticated
  using (exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.user_id = auth.uid()))
  with check (exists (select 1 from receipts r where r.id = receipt_items.receipt_id and r.user_id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────
-- v5 — Level-1 profile fields (Ideal Profile Engine, E2)
-- ─────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists sex                text;
alter table profiles add column if not exists date_of_birth      date;
alter table profiles add column if not exists height_cm          numeric;
alter table profiles add column if not exists weight_kg          numeric;
alter table profiles add column if not exists exercise_frequency text;
alter table profiles add column if not exists daily_movement     text;
alter table profiles add column if not exists pregnancy_status   text;


-- ─────────────────────────────────────────────────────────────────────
-- v6 — Pantry user scoping + RLS; remaining Level-1 columns (E1)
-- ─────────────────────────────────────────────────────────────────────
alter table pantry_items              add column if not exists user_id uuid;
alter table pantry_consumption_events add column if not exists user_id uuid;

do $$ begin
  begin alter table pantry_items              alter column session_id drop not null; exception when undefined_column then null; end;
  begin alter table pantry_consumption_events alter column session_id drop not null; exception when undefined_column then null; end;
end $$;

create index if not exists pantry_items_user_id_idx              on pantry_items (user_id);
create index if not exists pantry_consumption_events_user_id_idx on pantry_consumption_events (user_id);

alter table pantry_items              enable row level security;
alter table pantry_consumption_events enable row level security;

drop policy if exists own_pantry_items on pantry_items;
create policy own_pantry_items on pantry_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_pantry_consumption_events on pantry_consumption_events;
create policy own_pantry_consumption_events on pantry_consumption_events
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table profiles add column if not exists form_of_address  text;
alter table profiles add column if not exists meals_per_day    integer;
alter table profiles add column if not exists snacks_per_day   integer;
alter table profiles add column if not exists dislikes         jsonb default '[]'::jsonb;
alter table profiles add column if not exists address          text;
alter table profiles add column if not exists profile_complete boolean default false;


-- ─────────────────────────────────────────────────────────────────────
-- v7 — Receipt store + purchase date (E3)
-- ─────────────────────────────────────────────────────────────────────
alter table receipts add column if not exists store         text;
alter table receipts add column if not exists purchase_date date;


-- ─────────────────────────────────────────────────────────────────────
-- v8 — Verified-match store (Tier-0) + no-match queue (E5)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists verified_matches (
    id           uuid primary key default gen_random_uuid(),
    key          text not null,
    store        text not null default '',
    user_id      text not null,
    source       text,
    off_id       text,
    bls_code     text,
    matched_name text,
    nova         numeric,
    nutrition    jsonb,
    updated_at   timestamptz not null default now(),
    unique (key, store, user_id)
);
create index if not exists verified_matches_key_idx on verified_matches (key);

create table if not exists no_match_queue (
    id         uuid primary key default gen_random_uuid(),
    key        text not null,
    store      text not null default '',
    raw_text   text,
    count      integer not null default 1,
    updated_at timestamptz not null default now(),
    unique (key, store)
);


-- ─────────────────────────────────────────────────────────────────────
-- v9 — Status-quo attribution inputs (E6)
-- ─────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists groceries_shared  boolean;
alter table profiles add column if not exists household_size     integer;
alter table profiles add column if not exists user_share         numeric;
alter table profiles add column if not exists meals_outside      text;
alter table profiles add column if not exists receipts_complete  text;


-- ─────────────────────────────────────────────────────────────────────
-- v10 — Next-Cart inputs (E8)
-- ─────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists days_to_shop          integer;
alter table profiles add column if not exists home_cooked_frequency text;


-- ─────────────────────────────────────────────────────────────────────
-- v11 — Level-2 functional layer: consent + symptom answers (E9)
-- ─────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists consent_level2        boolean;
alter table profiles add column if not exists consent_at            timestamptz;
alter table profiles add column if not exists consent_text_version  text;
alter table profiles add column if not exists l2_bowel_frequency    text;
alter table profiles add column if not exists l2_bloating           text;
alter table profiles add column if not exists l2_hunger             text;
alter table profiles add column if not exists l2_energy             text;
alter table profiles add column if not exists l2_sleep              text;
alter table profiles add column if not exists l2_hydration          text;
alter table profiles add column if not exists l2_alcohol            text;
alter table profiles add column if not exists l2_muscle_soreness    text;

-- =====================================================================
-- Done. Reload the app; new receipts you upload as the logged-in user
-- will now populate the per-user pantry (Vorrat) and full persistence.
-- Legacy ai_agent rows (user_id = NULL) intentionally stay hidden.
-- =====================================================================
