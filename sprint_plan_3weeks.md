# NutriWise — 3-Week Sprint Plan (2 people, remaining work)

Based on the gap analysis of `backend/` against [roadmap_consolidated.md](roadmap_consolidated.md). Scope decisions carried over from that review:

- **Epic 7 (Results UI & User Flow) is back in scope**, but built as minimal, functional screens from scratch — **not** as a refactor of `lovable_prototypes/`. That folder stays untouched; wiring these flows into (or replacing) the existing prototype is a separate future phase.
- **Epic 10 (Agent System)** stays cut — both source docs already flagged it as conflicting-priority stretch work; with only 2 people and a full pipeline plus UI still to build, it isn't scheduled.
- **The Gemini "parse + normalize + categorize in one call" design stays as-is** — no refactor into a separate OCR/normalize split this sprint.

## The trick for zero same-day dependencies: contracts before code, and each person owns their own UI

The pipeline is inherently sequential (intake → match → nutrition → gaps → recommendation → explanation → feedback), so if either of you builds against the *other's actual running code*, someone waits every day. Two techniques remove that:

1. **Contracts before code.** On Day 1 you jointly lock the JSON shape of every hand-off point in the pipeline and save each as a fixture file in `backend/app/fixtures/`. After that, each of you builds and tests against fixtures, not against each other's real code — no dependency at all except two deliberate integration days.
2. **Each person builds the UI for their own backend output.** Rather than a separate "frontend person," whoever owns a pipeline stage also builds the screen that displays its output — they already know the exact shape of their own data, so there's no waiting on someone else's API contract to stabilize. This is also why Epic 7's screens are split up below rather than kept together.

Contracts to define on Day 1:

| Contract | Produced by (later) | Consumed by (later) | Fixture file |
|---|---|---|---|
| `ParsedReceiptItem[]` | existing Gemini parser | Person B's item-review UI + Person A's matcher | `fixtures/parsed_items.json` (copy from an existing `receipt_items` row) |
| `MatchedProduct[]` (name, off_id or fallback_category, nutrition, match_type, confidence) | Person A (Epic 2) | Person A (Epic 4) | `fixtures/matched_products.json` |
| `NutritionProfile` (aggregated totals per dimension) | Person A (Epic 4) | Person A (Epic 4 gap detector + Results Dashboard UI) | `fixtures/nutrition_profile.json` |
| `Gap[]` (dimension, status, message, confidence) | Person A (Epic 4) | Person B (Epic 5, Epic 6, Next Cart UI) | `fixtures/gaps.json` |
| `Profile` (goal, age_range, activity_level, dietary_pattern, exclusions[]) | Person B (Epic 3) | Person B (Epic 5 exclusion filter) | `fixtures/profile.json` |
| `Recommendation` (action, item, addresses_gap, confidence, explanation) | Person B (Epic 5 + 6) | Person B (Next Cart UI, Epic 8 feedback) | `fixtures/recommendation.json` |

Once these 6 files exist, every task below — backend or UI — can be built and tested in isolation, regardless of what the other person has actually finished.

## Track ownership

- **Person A — Nutrition Intelligence Track:** Epic 2 (product matching) → Epic 4 (nutrition + gaps) → the data-provenance half of Epic 6 → the Results Dashboard UI that displays this track's own output → related analytics.
- **Person B — Intake, Recommendation & Validation Track:** rest of Epic 1 → Epic 3 (profile) → Epic 5 (Next Cart) → the explanation half of Epic 6 → Epic 8 (feedback/session) → Epic 9 (analytics/error-handling/demo) → every UI screen along this track (upload, consent, item review, profile form, Next Cart, feedback), each built the same day as its backend counterpart since it's the same person and the JSON shape was already fixed on Day 1.

Task IDs reference [roadmap_consolidated.md](roadmap_consolidated.md); "(new)" = a task not in that doc, added because it's needed but had no atomic-task breakdown.

---

## Week 1 — Core intake pipeline + its screens, built against fixtures

| Day | Person A (Nutrition Intelligence) | Person B (Intake, Recommendation & Validation) |
|---|---|---|
| **1** | **Joint (AM): define the 6 contracts above.** PM: start Task 2.1 — OpenFoodFacts API wrapper (`services/off_api.py`) | **Joint (AM): same session.** PM: Task 1.2b (new) — text/paste fallback: extend `POST /receipts` to accept a raw-text body alongside file upload |
| **2** | Task 2.2 — Fuzzy matching engine (`services/matcher.py`), tested against `fixtures/parsed_items.json` | Task 1.4 — Formalize `models/receipt.py` as a validated Pydantic schema + Task 7.5 — Consent & Disclaimer Component (`frontend/ConsentBanner.tsx`): static GDPR consent gate + "not medical advice" copy, no backend dependency |
| **3** | Task 2.3 — Fallback category mapper (`services/fallback_categories.py`) | Task 1.5 — Build 2+ sample receipts (clean + messy, image + text) in `fixtures/receipts/`; fix broken `test_receipt_parser.py` + Task 7.1 — Upload Screen (`frontend/Upload.tsx`) wired to today's/yesterday's own upload endpoint |
| **4** | Task 2.4 — Nutrition schema (`models/nutrition.py`, Pydantic) | Task 1.3-support (new) — `PATCH /receipts/{id}/items` endpoint for post-parse item correction + Task 7.2 — Item Review Screen (`frontend/ItemReview.tsx`) against that same endpoint |
| **5** | Task 2.5 — Match quality logger (`analytics/match_quality.py`); sanity-check the matching pipeline against Person B's Day-3 sample receipts | Task 3.2 — Profile schema (`models/profile.py`) + `POST /profile` endpoint + Task 3.1 — Profile Questionnaire UI (`frontend/Profile.tsx`), same-day pairing |

*End of Week 1:* Epic 2 done; Epic 1 fully closed out (text fallback, schema, item-edit endpoint + UI, fixtures); Epic 3 (schema, endpoint, UI) done. Consent + Upload + Item Review + Profile screens all exist and work against real or fixture data.

## Week 2 — Nutrition logic, recommendation logic, and their screens

| Day | Person A (Nutrition Intelligence) | Person B (Intake, Recommendation & Validation) |
|---|---|---|
| **6** | Task 4.1 — Nutrition dimension definitions (`nutrition_model.py`): protein/fiber/sugar/processed-score/calories scoring | Task 3.3 — Dietary exclusion filter (`services/exclusion_filter.py`), tested against `fixtures/profile.json` |
| **7** | Task 4.2 — Nutrition profile builder (`services/nutrition_profile.py`), consumes `fixtures/matched_products.json` | Task 5.1 — Recommendation mapping table (`data/recommendations.json`), built against `fixtures/gaps.json` — **not** waiting on Person A's real gap detector |
| **8** | Task 4.3 — Gap detection engine (`services/gap_detector.py`) vs. WHO baseline thresholds | Task 5.2 — Recommendation engine (`services/recommender.py`), still against fixtures |
| **9** | Task 6.2 — Data source labeling (`services/source_labels.py`) + Task 6.3 — Confidence tagging (`services/confidence.py`), against fixtures | Task 5.3 — Output formatter (`models/next_cart.py`) + Task 6.1 — Explanation generator (`services/explainer.py`), against fixtures |
| **10** | **Integration day (shared, not blocking):** replace Person A's own fixtures with real Epic 2 output end-to-end; export a real `gaps.json` from the actual gap detector and hand it to Person B for tomorrow | **Integration day:** wire `GET /receipts/{id}/next-cart` end-to-end using fixtures so far + Task 7.4 — Next Cart UI (`frontend/NextCart.tsx`); swap in Person A's real gap-detector output starting Day 11, not mid-day today |

*End of Week 2:* full pipeline logic (match → nutrition → gaps → recommendation → explanation) exists, has been integrated once end to end with real data, and has a working Next Cart screen.

## Week 3 — Feedback/session tracking, Results Dashboard, hardening, demo prep

| Day | Person A (Nutrition Intelligence) | Person B (Intake, Recommendation & Validation) |
|---|---|---|
| **11** | Task 9.1 — Analytics event logger (`analytics/events.py`): upload_started/completed, parsing_success, match_rate | Task 8.3 — Session management (`services/session.py`, persistent `session_id`) |
| **12** | Task 7.3 + 4.4 — Results Dashboard (`frontend/Results.tsx`): nutrition snapshot + gap cards with progress bars, against Person A's own real nutrition-profile and gap-detector output from Week 2 (own data, no cross-person wait) | Task 8.4 — Receipt history storage (query by `session_id`) + Task 8.5 — Recommendation storage (linked record) |
| **13** | Finish Results Dashboard (styling, "estimated from your shopping habits" trust copy, confidence display); if done early, harden matcher/gap-detector edge cases with real receipts from Task 1.5 | Task 8.2 — Feedback storage + `POST /feedback` endpoint + Task 8.1 — Feedback Capture UI (`frontend/Feedback.tsx`), same-day pairing |
| **14** | **Integration & QA day (shared):** run the full flow end-to-end for real — upload → consent → item review → profile → match → nutrition → gaps → recommendation → explanation → Next Cart screen → feedback — against both a clean and a messy sample receipt; log/fix bugs found | same as Person A — pair on this, it's the first true full-pipeline **and** full-UI run |
| **15** | Task 9.3 — Error state handling (`services/error_handler.py`): OCR/parse failure, no-match failure, API failure all return useful structured errors instead of 500s, and each has a visible fallback state in the screens built this sprint | Task 9.4 — Demo script (`docs/demo_script.md`) covering the core loop + hypothesis + limitations; buffer for whatever Day 14 QA turned up |

---

## Sync rhythm

- **Daily standup (~15 min):** what you finished yesterday, what you're doing today, any fixture/contract you need updated.
- **Optional midday check-in:** only needed on Days 1, 10, and 14 (contract-setting and the two integration days) — every other day is designed to need zero contact beyond the standup.
- If a fixture needs to change after Day 1 (e.g., you discover the `Gap` shape needs one more field), the owner updates the fixture file and flags it at the next standup — the other person picks it up starting their *next* task, never mid-task.

## What's deliberately not in this 3 weeks

- Any refactor of, or integration into, `lovable_prototypes/` — the screens built this sprint are minimal/functional, meant to prove the pipeline works end-to-end; reconciling them with the existing prototype is a later phase.
- Epic 10 (Agent System) — cut, per both source docs' priority conflict.
- v2 adoption-scoring pieces (Tasks 8.6–8.8: receipt comparison, nutrition delta, adoption score) — no longer scheduled at all now that Epic 7 has taken their place in Week 3; they move to the post-3-week backlog alongside real supermarket integrations and barcode scanning.
- Recipe suggestions (should-have in the original roadmap) — not scheduled; add as a follow-up once the core loop is validated.
