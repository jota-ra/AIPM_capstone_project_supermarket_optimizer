# Data retention & security (E12 / BR-P2–P6)

How Nährbert stores, protects, retains, exports and erases personal data.

## Personal data we hold

| Data | Table / store | Notes |
|---|---|---|
| Account (email, login) | Supabase Auth (`auth.users`) | Managed by Supabase Auth. |
| Level-1 profile + derived | `profiles` | Biometrics, goal, diet, household, Level-2 answers + consent record. Ideal/status-quo profiles are **derived on the fly**, not stored. |
| Receipts | `receipts`, `receipt_items` | Structured line items. Raw parse JSON in `receipts.raw_text`. |
| Raw receipt images | Supabase Storage bucket `receipts` | **Deleted immediately after successful processing** (see Retention). |
| Pantry | `pantry_items`, `pantry_consumption_events` | Running stock + consumption log. |
| Recommendations / feedback | `recommendations`, `feedback` | Next-Cart history + "would you buy this" responses. |
| Analytics events | `events` | Ops metrics, carry `user_id`. |
| Verified-match votes | `verified_matches` | A user's product-match corrections. See "De-identified aggregate" below. |

Global, **non-personal** reference data (no `user_id`, never erased): the
verified-match *aggregate* (winning product per key, computed from all
users' votes), `no_match_queue`, `non_food_terms`.

## Access control (BR-P5)

- **App-enforced scoping (primary):** the backend authenticates every
  request via the Supabase JWT (`services/auth.py` → `get_current_user`)
  and filters every query by the authenticated `user_id`. No endpoint
  returns another user's rows.
- **Row-Level Security (defense-in-depth):** RLS is enabled with own-row
  policies (`user_id = auth.uid()`) on `receipts`, `receipt_items`,
  `profiles`, `recommendations`, `feedback`, `pantry_items`,
  `pantry_consumption_events` (migrations `v4`, `v6`, consolidated). The
  backend uses the service-role key (which bypasses RLS), so RLS is the
  backstop against any non-service-role access (anon key / a user JWT
  hitting PostgREST directly), not the primary guard.

## Encryption (BR-P5)

Encrypted at rest by the Supabase platform (Postgres + Storage on
encrypted volumes) and in transit via TLS. No app-level change required.

## Retention (BR-P4)

- **Raw receipt images:** deleted from Storage immediately after a receipt
  is successfully parsed (`api/receipts.py` → `delete_receipt_bytes` +
  `clear_receipt_storage_path`). The image is never displayed or re-read,
  so nothing depends on it after processing. There is no "keep images"
  opt-in (privacy-first default).
- **Derived rows:** kept while the account is active; recomputed on demand.
- **Everything else:** retained until the user edits or erases it.

## Portability / export (BR-P3, FR-12.4)

`GET /profile/me/export` (`services/account.export_user`) returns one JSON
bundle: profile, every receipt + its line items, recommendations, and the
derived ideal profile. Offered as a download from the profile screen.

## Erasure (BR-P3, FR-12.3)

`DELETE /account` (`services/account.erase_user`) hard cascade-deletes all
personal data — receipts + items + stored images, pantry, recommendations,
feedback, analytics events, profile(s), and the user's verified-match
votes — then deletes the Supabase Auth user. The client signs out.

**De-identified aggregate retained:** only the erasing user's *own* vote
rows are removed. The winning-product-per-key aggregate is recomputed from
the remaining users' votes, so confirmed mappings survive erasure (they
contain no personal data).

## Consent (BR-P1, FR-2.5)

Level-2 health data (Art. 9) is processed only under explicit consent
(`profiles.consent_level2` + timestamp + text version). Revoking consent
(profile screen → "Revoke consent") sets `consent_level2 = false`: all
symptom multipliers revert to 1.0 (`services/symptom_relevance._has_consent`)
and the Level-2 invite hides. Existing answers are kept (removable via
account deletion, retrievable via export).

## Not medical advice (BR-P6)

The symptom-driven recommendation surfaces carry a persistent "not medical
advice / consult a professional" disclaimer; the engine never diagnoses.
