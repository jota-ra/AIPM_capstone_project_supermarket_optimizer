-- =====================================================================
-- E3 — Receipt store + purchase date columns.
-- Run in the Supabase SQL editor. Idempotent; both columns nullable.
--
-- OPTIONAL: the full parsed receipt (store, date, items, prices) is already
-- persisted in receipts.raw_text (JSON), so nothing breaks without this
-- migration — update_receipt_with_parse() promotes these two values to
-- dedicated columns only when they exist (tolerant update). Applying this
-- makes store/date directly queryable (e.g. E7 consumption trends).
-- =====================================================================

alter table receipts add column if not exists store         text;   -- Rewe | Edeka | ... | unknown
alter table receipts add column if not exists purchase_date date;   -- ISO date extracted from the receipt

-- receipt_items.price already exists (used since Epic 3 ingestion); the
-- parser now populates it instead of always writing NULL. No schema change
-- needed here — documented for traceability only.
