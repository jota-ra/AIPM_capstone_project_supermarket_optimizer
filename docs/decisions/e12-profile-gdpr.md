---
name: e12-profile-gdpr
description: Epic 12 GDPR — export, full account erasure (+auth user), consent revoke, post-processing image deletion; RLS already existed
metadata:
  type: project
---

Epic 12 (Profile Management & GDPR) implemented 2026-07-15. No DB migration needed.

**Status found vs. built:**
- S1 edit + recompute: already done (ProfileSummary + PATCH + `_profile_response` recomputes ideal on read). Left as-is. Minor known gap: raw Level-2 (l2_*) answers aren't editable in the profile screen (only consent revoke) — deemed low value.
- S2 export: built. `GET /profile/me/export` → `services/account.export_user` (profile + receipts+items + recommendations + derived ideal profile as one JSON). Frontend `exportMyData()` + "Download (JSON)" in ProfileSummary's PrivacyCard.
- S3 deletion: built. `DELETE /account` → `services/account.erase_user` cascades receipts+items+storage images, recommendations, feedback, pantry (×2), events, profiles, and the user's verified-match votes, then deletes the Supabase Auth user (`supabase.auth.admin.delete_user`). Best-effort per step (returns summary+errors). De-identified verified-match aggregate retained (only the user's own vote rows deleted — `verified_matches.delete_user_votes`).
- S4 consent revoke: backend already honored `consent_level2` (symptom_relevance `_has_consent` → all multipliers 1.0). Added a "Revoke consent" toggle in PrivacyCard (PATCH consent_level2=false; keeps answers per flow F15).
- S5 RLS/encryption/retention: RLS + own-row policies already existed on all user tables (migrations v4/v6); encryption at rest = Supabase platform default. Built the missing piece: receipt images now deleted from Storage immediately after successful parse (`clear_receipt_storage_path` + `delete_receipt_bytes`), no opt-in (privacy-first). Wrote `docs/data_retention_security.md`.

**Decisions (confirmed with user):** full erasure incl. the Supabase Auth login (not data-only); delete images by default (no "keep images" opt-in).

**Decisions I made (flagged):** did NOT rearchitect the service-role/app-enforced scoping model (RLS stays defense-in-depth — a rewrite would be a regression); export is JSON only (AC allows "JSON or CSV"; data is nested).

**UX reconciliation:** the old footer "Delete or reset my data" (which only deleted the one tracked receipt + profile, no sign-out) was replaced — both the footer and ProfileSummary now call one `handleDeleteAccount` (full erasure + `supabase.auth.signOut()`). See [[e1-auth-migration]] for the auth model, [[e10-eaten-feedback]] for the consent/Level-2 context.
