-- =====================================================================
-- Schema introspection queries — run these in the Supabase SQL editor to
-- regenerate backend/db/schema.sql from the LIVE database.
--
-- These read information_schema/pg_catalog only — METADATA, no user data
-- (GDPR-safe). Run each block, copy the JSON/grid result, and hand the
-- outputs to whoever rebuilds schema.sql (or to Claude Code).
--
-- CAVEAT: the SQL editor caps results at ~100 rows. `profiles` alone has
-- ~49 columns, so Query 1 can truncate — if the last tables are missing,
-- re-run Query 1 filtered to the missing table names (see Query 1b).
-- =====================================================================


-- Query 1 — all columns of all public tables
select table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- Query 1b — columns for specific tables (use if Query 1 truncated)
-- select table_name, ordinal_position, column_name, data_type,
--        udt_name, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('receipts','recommendations','verified_matches')
-- order by table_name, ordinal_position;


-- Query 2 — primary-key and unique constraints
select tc.table_name, tc.constraint_type, kcu.column_name, kcu.ordinal_position
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
order by tc.table_name, kcu.ordinal_position;


-- Query 3 — RLS policies (compare against the policies in schema.sql)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- Query 4 — indexes (indexdef is a ready-to-paste CREATE INDEX statement)
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- Query 5 — foreign keys (schema.sql currently declares none; run this to
-- confirm whether prod enforces any at the DB level)
select tc.table_name, kcu.column_name,
       ccu.table_name  as references_table,
       ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name;
