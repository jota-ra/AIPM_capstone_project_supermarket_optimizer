# Database (`backend/db/`)

Everything needed to stand up and evolve the Supabase/Postgres database.

| File | Purpose |
|---|---|
| `schema.sql` | **Single source of truth** for a from-scratch DB. Run once on a fresh Supabase project to create all tables, constraints, indexes and RLS policies. |
| `migrations/` | Historical record of how production reached the current schema (v4–v14). Do **not** run these on a fresh DB — `schema.sql` already includes them. |
| `introspect_queries.sql` | Queries to regenerate `schema.sql` from the live DB (metadata only, GDPR-safe). |

## Bootstrap a fresh database

1. Create a Supabase project.
2. Open **SQL Editor** → paste the contents of `schema.sql` → **Run**.
3. Copy `.env.example` (repo root) to `.env` and fill in the Supabase URL + keys.

That's it — the backend can now read/write every table.

## Keeping reproducibility artifacts in sync ⚠️

As the app evolves, three files can drift. CI (`.github/workflows/reproducibility.yml`)
enforces the first two on every PR into `main`:

| When you… | Also update… | Enforced by |
|---|---|---|
| add/change a table or column (new file in `migrations/`) | `schema.sql` | CI: `schema-in-sync` job fails otherwise |
| add an env var (a `Settings` field in `core/config.py`, an `os.environ` read, or a `VITE_*` var) | root `.env.example` | CI: `env-example` job (`scripts/check_env_example.py`) |
| add a setup/run step | root `README.md` | convention (please) |

### Regenerating `schema.sql`

`schema.sql` was reconstructed from a live schema export (there is no
original `CREATE TABLE` history — the base tables were made by hand). To
refresh it against the current production DB:

1. Run the blocks in `introspect_queries.sql` in the Supabase SQL editor.
2. Copy each result.
3. Rebuild `schema.sql` from the outputs (Query 1/2 = tables & constraints,
   Query 3/4 = policies & indexes, Query 5 = confirm FKs). Handing the
   outputs to Claude Code regenerates it in one step.

Run the env check locally any time:

```bash
python scripts/check_env_example.py
```

### Known cleanup candidates (documented in `schema.sql`)

- `user_day_flags` — table exists in prod but is **not referenced by any
  backend code**; drop candidate.
- `receipts`: `upload_time`, `parser_version`, `scan_quality`,
  `items_count`, `raw_metadata`, `receipt_date` — legacy columns no longer
  written by the code.
- `profiles`: `goal`, `activity_level`, `dietary_pattern`, `exclusions`,
  `weight`/`height` (smallint) — legacy density-system fields, superseded
  by the Ideal-Profile engine's `sex`/`date_of_birth`/`weight_kg`/`height_cm`.
