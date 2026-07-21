# Memory index

- [E1 auth migration](e1-auth-migration.md) — Epic 1 swapped the anonymous session model for Supabase auth (full replacement) + extended Level-1 onboarding; decisions, migrations, known gaps.
- [Receipt extraction is local](receipt-extraction-local.md) — Gemini removed from the receipt path; now Tesseract + PyMuPDF (no rate limits, no data to third-party LLM); Render switched to Docker runtime.
- [E10 eaten-feedback](e10-eaten-feedback.md) — Epic 10 A/B eaten-feedback feeds the E6 status-quo waste_fraction (not the pantry model); deterministic A/B, /consumption endpoints, self-gating card; needs migration v12.
- [Review fixes 2026-07-15](review-fixes-2026-07-15.md) — fixed a silent NameError breaking manual product matching, added non-food marking + learned keyword list, retired the dead products table; needs migrations v13/v14.
- [E11 dashboard](e11-dashboard.md) — Epic 11 was ~90% already built as the merged Insights/Overview; only closed FR-11.3 (upload action) + FR-11.4 (counter), no separate page/endpoint.
- [E12 profile & GDPR](e12-profile-gdpr.md) — Epic 12: added export, full account erasure (+Supabase auth user), consent revoke, post-processing image deletion; RLS already existed; no migration; `docs/data_retention_security.md`.
- [E13 i18n](e13-i18n.md) — Epic 13: device-locale default + AuthScreen localized + FULL backend prose localization via `services/i18n.py` and a `lang` query param; recommendations/recipes JSON got DE fields; frontend nutrientLabel + language-triggered refetch.
