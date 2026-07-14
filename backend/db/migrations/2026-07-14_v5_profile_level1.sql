-- =====================================================================
-- E2 — Level-1 profile fields for the Ideal Profile Engine.
-- Run in the Supabase SQL editor. Idempotent; all columns nullable so
-- existing profiles keep working (legacy age_range/activity_level stay).
-- =====================================================================

alter table profiles add column if not exists sex                text;   -- female | male | prefer_not_to_say
alter table profiles add column if not exists date_of_birth      date;
alter table profiles add column if not exists height_cm          numeric;
alter table profiles add column if not exists weight_kg          numeric;
alter table profiles add column if not exists exercise_frequency text;   -- none | one_two | three_four | five_six | daily_athlete
alter table profiles add column if not exists daily_movement     text;   -- mostly_sitting | mixed | mostly_standing | physical_labor
alter table profiles add column if not exists pregnancy_status   text;   -- none | pregnant | breastfeeding
