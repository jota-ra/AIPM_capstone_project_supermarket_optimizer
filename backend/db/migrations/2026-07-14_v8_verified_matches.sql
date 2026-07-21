-- =====================================================================
-- E5 — Verified-match store (Tier-0 learned matching) + no-match queue.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Votes carry user_id (BR-MT6 reconciled with E5-S5/E12): needed to enforce
-- one vote per user per key and to erase a user's votes on account deletion.
-- The *served winner* is the de-identified aggregate (computed in
-- services/verified_matches.resolve_winner), which survives that erasure.
-- =====================================================================

create table if not exists verified_matches (
    id           uuid primary key default gen_random_uuid(),
    key          text not null,           -- normalized_raw_text (BR-MT0a)
    store        text not null default '', -- '' = unknown store
    user_id      text not null,           -- who voted (dedup + E12 erasure)
    source       text,                    -- off | bls | manual
    off_id       text,
    bls_code     text,
    matched_name text,
    nova         numeric,
    nutrition    jsonb,
    updated_at   timestamptz not null default now(),
    unique (key, store, user_id)          -- one vote per user per key+store
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

-- Row-level security is added project-wide in E12; the verified-match
-- winner is intentionally global (all users benefit from confirmed
-- mappings), while a user may only insert/delete rows carrying their own
-- user_id. Policies are deferred to the E12 security pass.
