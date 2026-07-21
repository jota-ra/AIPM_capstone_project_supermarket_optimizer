# NutriWise / Nährbert

Turns German supermarket receipts into a personalized picture of what a
person likely eats, compares it to science-based ideal targets, and returns
grounded, adherence-aware recommendations for the next shop — **without
manual food logging**.

It runs as a continuous loop, each cycle adding data:

```
Upload receipt → OCR + match to nutrition DB → Review → Status-quo intake (E6)
   → Gap analysis + health score (E7) → Next-Cart recommendation (E8)
```

The engine has four layers: physiological needs (Ideal-Profile, formulas +
DGE reference values), estimated intake (from receipts), functional signals
(symptoms re-prioritize gaps), and behavioral context (how advice is delivered).

## Repo structure

```
backend/          FastAPI app (product API) + db/ (schema.sql, migrations)
frontend/         React 19 + Vite app (stepped onboarding → dashboard)
ml/               Reproducible ML/evaluation workspace (notebooks, OCR eval, gold set)
data/             Canonical inputs — BLS nutrition DB + sample receipts
docs/             Documentation: product/ research/ decisions/ planning/ design/
scripts/          Repo maintenance helpers (e.g. check_env_example.py)
Dockerfile · render.yaml · requirements.txt   Deploy (backend on Render)
```

See [docs/file_inventory.md](docs/file_inventory.md) for a per-file map with
purpose and status (live / legacy / dev), and
[backend/db/README.md](backend/db/README.md) for the database.

## Prerequisites

- [pyenv](https://github.com/pyenv/pyenv) with Python 3.11.3 (`pyenv install 3.11.3`)
- Node.js + npm
- A [Supabase](https://supabase.com) project (free tier is fine)

## Setup

Run everything from the **repo root** unless noted.

### 1. Environment variables

```bash
cp .env.example .env
```

Fill in the values (Supabase URL + keys, optional Gemini key). One `.env` at
the repo root serves both backend and frontend — see the comments in
[.env.example](.env.example). The file is gitignored and never committed.

### 2. Database (one-time)

In the Supabase dashboard: **SQL Editor** → paste
[backend/db/schema.sql](backend/db/schema.sql) → **Run**. This creates all
tables, indexes and RLS policies from scratch. (Details: [backend/db/README.md](backend/db/README.md).)

### 3. Backend

```bash
pyenv local 3.11.3
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

Load it as a module from the repo root (running from inside `backend/` fails
with `ModuleNotFoundError`). API docs: http://localhost:8000/docs

### 4. Frontend

In a **second terminal** (keep the backend running):

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (defaults to http://localhost:5173).

> CORS: the backend allows the origins in `ALLOWED_ORIGINS` (see `.env`). If
> port 5173 is taken, Vite moves to 5174+ and API calls fail with CORS errors
> — free up 5173 or add the new origin to `ALLOWED_ORIGINS`.

### 5. ML / evaluation (optional)

```bash
python -m pip install -r ml/requirements-ml.txt
```

Then open the notebooks in `ml/`, or run the OCR regression check:
`python ml/ocr_eval.py`. See [ml/README.md](ml/README.md).

## Deployment

- **Backend** → Render (Docker; see `Dockerfile` + `render.yaml`). Set the
  backend env vars as Render environment variables.
- **Frontend** → Vercel. Set the `VITE_*` vars as Vercel environment
  variables; point `VITE_API_BASE_URL` at the Render backend URL.

## Keeping the project reproducible

As the team adds code, three files must stay in sync — CI
(`.github/workflows/reproducibility.yml`) enforces the first two on every PR:

| When you… | Update… |
|---|---|
| add/change a DB table or column | `backend/db/schema.sql` |
| add an env var | `.env.example` |
| add a setup/run step | this `README.md` |

Check `.env.example` locally: `python scripts/check_env_example.py`.
