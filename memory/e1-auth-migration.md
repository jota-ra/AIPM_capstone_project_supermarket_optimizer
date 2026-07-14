---
name: e1-auth-migration
description: Epic 1 replaced the anonymous session model with Supabase auth (full replacement) + extended onboarding
metadata:
  type: project
---

The app (codename NutriWise, rebranding to Nährbert) originally scoped all data by an anonymous `X-Session-Id` header + a demo "account picker". Epic 1 (implemented 2026-07-14) did a **full replacement** to Supabase Auth:

- Backend: every router now depends on `get_current_user` (services/auth.py, verifies the Supabase JWT via JWKS); the DB layer scopes by `user_id` instead of `session_id` (the `*_by_user` helpers). `services/session.py` was deleted. Migrations v4 (auth+RLS) / v5 (Level-1 biometrics) / v6 (pantry user_id + `profile_complete` + form_of_address/meals/snacks/dislikes/address) must all be run in Supabase.
- Frontend: `App.tsx` gates on a Supabase session; `lib/api.ts` sends `Authorization: Bearer`; demo `LandingStep`/`AccountPickerStep` were deleted; onboarding (`ChatOnboardingStep`) was extended with the Level-1 inputs + per-answer feedback + resume + incremental save; `/profile/me` drives resume-vs-dashboard.

**Decisions (from the user):** full replacement (not layered), and extend the existing onboarding additively (not a new walk-through). The existing `Goal` enum was kept app-wide; `ideal_profile.py` (E2) was reconciled to it via mapping (only `lose_weight_gradually`→−15% and `build_muscle`→+10% shift TDEE). New Level-1 fields derive the legacy `gender`/`age_range`/`activity_level` in `toProfileCreate` so downstream code is untouched.

**Known gaps:** age gate (≥16) is client-side only in AuthScreen (Supabase signUp is client-direct — no backend hook); DOB is stored in user_metadata and prefilled into onboarding, which is authoritative. `bls_matcher.py` + `product_registry.py` are untracked E4/E5 dark drafts that don't import (reference not-yet-existing symbols) — unrelated to E1, not wired into the app.
