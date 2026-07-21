-- =====================================================================
-- E9 — Level-2 functional layer: health-data consent + symptom answers.
-- Run in the Supabase SQL editor. Idempotent; all nullable.
--
-- Health data is GDPR Art. 9 special-category: only processed under the
-- explicit consent recorded here (BR-P1). Without consent, all symptom
-- multipliers default to 1.0 and the app stays fully usable.
-- =====================================================================

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
