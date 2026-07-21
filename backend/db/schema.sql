-- =====================================================================
-- NutriWise / Nährbert — consolidated database schema (Supabase / Postgres)
--
-- Purpose: recreate the ENTIRE database on a fresh Supabase project in one
-- run. Until now the base tables existed only in the production instance
-- (they were created by hand); the migrations under backend/db/migrations/
-- only ALTER them. This file is the single source of truth for a from-
-- scratch bootstrap — see README "Database setup".
--
-- Provenance: reconstructed from a live schema export (information_schema,
-- 2026-07-20) for exact columns/types/defaults, plus the RLS policies and
-- indexes defined in backend/db/migrations/ (v4–v14). It reflects the REAL
-- production schema, including a few legacy/orphaned columns and one
-- orphaned table (flagged inline as cleanup candidates).
--
-- Idempotent: every statement uses IF NOT EXISTS / DROP POLICY IF EXISTS,
-- so it is safe to run repeatedly. It creates structure only — no data.
--
-- Access model: scoping is APP-ENFORCED (the backend uses the service-role
-- key, which bypasses RLS, and filters by user_id in code). The RLS
-- policies below are defense-in-depth for the authenticated role.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- profiles — user onboarding profile (the most-extended table).
-- NOTE: goal / activity_level / dietary_pattern / exclusions are LEGACY
-- density-system fields (NOT NULL, kept for back-compat); the current
-- Ideal-Profile engine (E2) uses sex/date_of_birth/height_cm/weight_kg/…
-- weight & height (smallint) are legacy; weight_kg & height_cm (float8)
-- are the live ones.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists profiles (
    id                    uuid primary key,
    goal                  text not null,
    age_range             text,
    activity_level        text not null,
    dietary_pattern       text not null,
    exclusions            jsonb not null default '[]'::jsonb,
    created_at            timestamptz not null default now(),
    session_id            uuid,
    weight                smallint,
    height                smallint,
    gender                text,
    dislikes              jsonb not null default '[]'::jsonb,
    name                  text,
    allergies             jsonb default '[]'::jsonb,
    symptoms              jsonb default '[]'::jsonb,
    digestion             text,
    veg_frequency         text,
    language              text default 'en'::text,
    weight_kg             double precision,
    height_cm             double precision,
    user_id               uuid,
    -- Level-1 (E2, migration v5)
    sex                   text,
    date_of_birth         date,
    exercise_frequency    text,
    daily_movement        text,
    pregnancy_status      text,
    form_of_address       text,
    meals_per_day         integer,
    snacks_per_day        integer,
    address               text,
    profile_complete      boolean default false,
    -- Status-quo attribution (E6, migration v9)
    groceries_shared      boolean,
    household_size        integer,
    user_share            numeric,
    meals_outside         text,
    receipts_complete     text,
    -- Next-Cart inputs (E8, migration v10)
    days_to_shop          integer,
    home_cooked_frequency text,
    -- Level-2 functional layer: consent + symptom answers (E9, migration v11)
    consent_level2        boolean,
    consent_at            timestamptz,
    consent_text_version  text,
    l2_bowel_frequency    text,
    l2_bloating           text,
    l2_hunger             text,
    l2_energy             text,
    l2_sleep              text,
    l2_hydration          text,
    l2_alcohol            text,
    l2_muscle_soreness    text
);


-- ─────────────────────────────────────────────────────────────────────
-- receipts — uploaded receipt metadata + full parsed JSON in raw_text.
-- LEGACY/unused columns (not written by current code): upload_time,
-- parser_version, scan_quality, items_count, raw_metadata, receipt_date.
-- store/purchase_date (v7) are the live promoted fields.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists receipts (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid,
    upload_time    timestamptz default now(),
    file_name      text,
    file_type      text,
    storage_path   text,
    raw_text       text,
    parser_version text,
    status         text default 'uploaded'::text,
    created_at     timestamptz default now(),
    store          text,
    scan_quality   text,
    items_count    smallint,
    raw_metadata   jsonb,
    session_id     uuid,
    receipt_date   timestamptz,
    purchase_date  date
);


-- ─────────────────────────────────────────────────────────────────────
-- receipt_items — line items per receipt. receipt_id logically references
-- receipts.id (integrity is enforced in app code, not by a DB FK).
-- waste_fraction (v12, E10): thrown-away share, feeds status-quo intake.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists receipt_items (
    id                  uuid primary key default gen_random_uuid(),
    receipt_id          uuid,
    raw_name            text,
    normalized_name     text,
    quantity            text,
    price               numeric,
    confidence          double precision,
    unit                text,
    category            text,
    matched_product_id  text,
    waste_fraction      numeric not null default 0
);


-- ─────────────────────────────────────────────────────────────────────
-- recommendations — persisted Next-Cart output (payload = full dict).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists recommendations (
    id          uuid primary key,
    session_id  uuid,
    payload     jsonb not null,
    created_at  timestamptz not null default now(),
    user_id     uuid
);


-- ─────────────────────────────────────────────────────────────────────
-- feedback — one response per recommendation. recommendation_id logically
-- references recommendations.id (app-enforced).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists feedback (
    id                 uuid primary key,
    recommendation_id  uuid not null,
    session_id         uuid,
    response           text not null,
    comment            text,
    created_at         timestamptz not null default now(),
    user_id            uuid
);


-- ─────────────────────────────────────────────────────────────────────
-- events — analytics events (A/B assignment, adoption tracking).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists events (
    id          uuid primary key,
    name        text not null,
    payload     jsonb not null default '{}'::jsonb,
    session_id  uuid,
    created_at  timestamptz not null default now(),
    user_id     uuid
);


-- ─────────────────────────────────────────────────────────────────────
-- pantry_items — running per-user stock (E12/E13 pantry model).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists pantry_items (
    id                  uuid primary key default gen_random_uuid(),
    session_id          uuid,
    normalized_name     text not null,
    quantity_available  numeric not null default 0,
    unit                text,
    category            text,
    last_replenished_at timestamptz,
    created_at          timestamptz not null default now(),
    user_id             uuid
);


-- ─────────────────────────────────────────────────────────────────────
-- pantry_consumption_events — per-user consumption log (Tages-Log).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists pantry_consumption_events (
    id                 uuid primary key default gen_random_uuid(),
    session_id         uuid,
    normalized_name    text not null,
    quantity_consumed  numeric not null,
    consumed_at        timestamptz not null default now(),
    user_id            uuid
);


-- ─────────────────────────────────────────────────────────────────────
-- verified_matches — Tier-0 learned product matches (E5, migration v8).
-- Global reference data (no RLS). One vote per (key, store, user_id).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists verified_matches (
    id            uuid primary key default gen_random_uuid(),
    key           text not null,
    store         text not null default ''::text,
    user_id       text not null,
    source        text,
    off_id        text,
    bls_code      text,
    matched_name  text,
    nova          numeric,
    nutrition     jsonb,
    updated_at    timestamptz not null default now(),
    unique (key, store, user_id)
);
create index if not exists verified_matches_key_idx on verified_matches (key);


-- ─────────────────────────────────────────────────────────────────────
-- no_match_queue — frequency of unmatched receipt lines (E5, migration v8).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists no_match_queue (
    id          uuid primary key default gen_random_uuid(),
    key         text not null,
    store       text not null default ''::text,
    raw_text    text,
    count       integer not null default 1,
    updated_at  timestamptz not null default now(),
    unique (key, store)
);


-- ─────────────────────────────────────────────────────────────────────
-- non_food_terms — user-taught non-food keys (E3-S4, migration v13).
-- Global reference data (no RLS).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists non_food_terms (
    id             uuid primary key default gen_random_uuid(),
    key            text not null unique,
    raw_text       text,
    times_reported integer not null default 1,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists non_food_terms_key_idx on non_food_terms (key);


-- ─────────────────────────────────────────────────────────────────────
-- user_day_flags — ORPHANED: present in the production DB but NOT
-- referenced anywhere in the backend code (likely a never-wired "away/
-- skip day" feature). Kept here so the schema matches production; it is a
-- DROP candidate. Remove this block (and the table in prod) if unwanted.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists user_day_flags (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null,
    date        date not null,
    flag        text not null default 'away'::text,
    created_at  timestamptz not null default now(),
    unique (user_id, date, flag)
);


-- =====================================================================
-- Indexes on user-scoped tables (migrations v4/v6)
-- =====================================================================
create index if not exists receipts_user_id_idx                 on receipts (user_id);
create index if not exists profiles_user_id_idx                 on profiles (user_id);
create index if not exists recommendations_user_id_idx          on recommendations (user_id);
create index if not exists feedback_user_id_idx                 on feedback (user_id);
create index if not exists pantry_items_user_id_idx             on pantry_items (user_id);
create index if not exists pantry_consumption_events_user_id_idx on pantry_consumption_events (user_id);


-- =====================================================================
-- Row-Level Security (migrations v4/v6). Defense-in-depth: the backend's
-- service-role key bypasses these; they guard the `authenticated` role so
-- a client using the anon key can only ever see its own rows.
-- Global reference tables (events, verified_matches, no_match_queue,
-- non_food_terms, user_day_flags) intentionally have no per-user RLS.
-- =====================================================================
alter table receipts                  enable row level security;
alter table receipt_items             enable row level security;
alter table profiles                  enable row level security;
alter table recommendations           enable row level security;
alter table feedback                  enable row level security;
alter table pantry_items              enable row level security;
alter table pantry_consumption_events enable row level security;

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

drop policy if exists own_pantry_items on pantry_items;
create policy own_pantry_items on pantry_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_pantry_consumption_events on pantry_consumption_events;
create policy own_pantry_consumption_events on pantry_consumption_events
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- Done. On a fresh project: run this file once in the Supabase SQL editor.
-- The migrations under backend/db/migrations/ are the historical record of
-- how production reached this state and do not need to be run after this.
-- =====================================================================
