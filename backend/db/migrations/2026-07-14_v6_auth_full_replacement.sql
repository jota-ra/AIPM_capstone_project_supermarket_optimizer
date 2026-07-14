-- =====================================================================
-- E1 — Full replacement of the anonymous session model with Supabase Auth.
-- Run in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- v4 added user_id + RLS to receipts/profiles/recommendations/feedback/
-- events. This migration finishes the switch:
--   1) user_id + RLS on the pantry tables (missed by v4);
--   2) the remaining Level-1 onboarding columns (v5 added the biometrics);
--   3) a profile_complete flag so onboarding can be resumed (E1-S6).
--
-- Scoping stays APP-ENFORCED (the backend filters every query by the
-- authenticated user_id using the service-role key, which bypasses RLS);
-- the RLS policies are defense-in-depth for any non-service-role access.
-- Legacy session_id-tagged rows keep user_id = NULL and simply won't
-- surface for authenticated users ("leave old data behind").
-- =====================================================================

-- 1) Pantry tables: user_id scoping ---------------------------------------------
alter table pantry_items              add column if not exists user_id uuid;
alter table pantry_consumption_events add column if not exists user_id uuid;

-- session_id no longer required on the pantry tables (kept nullable for
-- backward-compat with rows written before the switch).
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

-- 2) Remaining Level-1 onboarding columns (v5 added sex/dob/height/weight/
--    exercise_frequency/daily_movement/pregnancy_status). All nullable so
--    partial onboarding persists (E1-S6). -----------------------------------
alter table profiles add column if not exists form_of_address text;   -- neutral | informal_du | formal_sie (how to address the user)
alter table profiles add column if not exists meals_per_day   integer; -- eating-occasion coverage input (E6)
alter table profiles add column if not exists snacks_per_day  integer;
alter table profiles add column if not exists dislikes        jsonb default '[]'::jsonb;  -- soft "foods I'd rather avoid"
alter table profiles add column if not exists address         text;    -- collected in onboarding, not used in calculations
alter table profiles add column if not exists profile_complete boolean default false;
