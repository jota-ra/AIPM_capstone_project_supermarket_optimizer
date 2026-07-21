-- =====================================================================
-- E3-S4 follow-up — learned non-food terms.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Gemini used to classify food vs. non-food semantically; the local
-- OCR/text parser (services/receipt_text_parser.py) only catches a fixed
-- German keyword list (Pfand/Rabatt/Tüte/...). This table lets users teach
-- the system the rest: every time someone marks a receipt line "Not food"
-- in Review, its normalized text is learned here, so future receipts with
-- the same line are stripped out at parse time automatically — same
-- normalization as the Tier-0 verified-match key (BR-MT0a), so the two
-- learned stores can never diverge on how they key a raw line.
--
-- Global, non-personal reference data (like verified_matches/no_match_
-- queue) — no per-user RLS.
-- =====================================================================

create table if not exists non_food_terms (
    id             uuid primary key default gen_random_uuid(),
    key            text not null unique,  -- normalize_match_key(raw_text)
    raw_text       text,                  -- most recent raw text that produced this key (audit/debug)
    times_reported integer not null default 1,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists non_food_terms_key_idx on non_food_terms (key);
