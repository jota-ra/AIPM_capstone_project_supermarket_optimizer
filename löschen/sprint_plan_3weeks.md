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


# backlog
- switch to Tesseract or other possibilities for image recognition and text extraction to reduce load times and dependencies on LLM/tokens
- add rate limit / retry details for current gemini usage in extraction step
- add BLS.de databank for food and nutrition lookup, compare which works better for what
- instead of assuming density on nutrients etc, use actual weights and time across which it was consumed e.g. by using the date range in which receipts were uploaded, experiment with other approximations to get more valid nutrition profile
- Confirm that aggregates are only done for each user and not across entire DB
- ranking of all bought groceries regarding healthiness, or grouping of groceries into different health groups
- increase nutrition measurement accuracy by better defining what a "piece" is per product categories ("Anything else (Stk, unknown units, missing quantity) defaults to 100 g per piece ")
- enable app in english and german
- extend from 1 to 3 recommendations per result page, and expand generally recommendation logic, recommend more of the same, but different
- add recommendations on what not to buy anymore
- extract receipt date to properly calculate consumption periods
- add intolerances and allergies as multiple choice dropdown
- add field of products the user doesnt like
- create direct search through the Review step, to search matches in Open Food Facts.
- improve matching quality:
    currently we get this in matching: ""parsed_item_name": "Linsen",
                "matched_name": "DM Bio Linsenwaffeln 100g 1.35\u20ac 1kg 13.50\u20ac",
                "off_id": "4066447562644",
                "fallback_category": null,
                "match_type": "fuzzy",
                "confidence": 0.85,
                "data_source": "OpenFoodFacts",
                "nutrition": {"
- add labels for parsed items review like: quantity and dropdown for units
- Onboarding: Chat Fragebogen
- add overall health score to show current state of nutrient intake vs ideal profile
- Upload pdf ergänzen
- The TEMPORARY fallback shims in db/supabase.py (lines marked with # migration pending?) are no longer needed, so please clean them up (remove them)
- add missing fields in receipts table and understand why we need them, how they are or can be used (store, scan quality, items count, raw metadata)
- add missing fields in receipt items table and understand why we need them, how they are or can be used (price, matched product)
- find out why products table isnt used for matched products from database
- find out why analyses table is empty
- find out what was built in the backend that isnt used in the frontend
- login for users & options to manage profile data, so to only configure profile once, and then only upload, review receipts, see results and get recommendations, add size and weight to calculate ideal profile, add edit profile button on result page to adjust preeference, allergies etc.
- include weekly and monthly view for nutrient intake

# backlog areas
## onboarding
## image to text extraction
## text to product matching
## review step improvement
## nutrient profile calculations and display
## recommendations

# questions
**how is the current "optimal nutrient profile" created?**


prio and effort


# Onboarding
## NOW
add Intolerances and allergies selection area
question: how many intolerances and allergies are there?
--> either do a drop down if its too many or simply give an overview of all and let the user click/tap the ones that apply
use intolerances and allergies to make recommendations valuable / restrict recommendations (exclusion filter)

add a field where users can add food they do not like
save this in profile and use to make recommendations valuable / restrict recommendations (exclusion filter)

add fields for user weight and height and gender --> enable actual nutrient profiles

## LATER
Chat Style Onboarding

# Profile
add login area for users
ensure results, recommendations etc are only calculated with the data from the specific user, not across all data in our database
add  an edit option for profile editing whenever needed

# Image to Text Extraction
## NOW
extract receipt date, number of items, store and save them in receipts table, also extract prices for receipt items (adjust gemini prompt and output format)
--> enables better tracking, allows for more detailed consumption profile and gap detection, later also supermarket share calculations.

add a more detailed info about errors caused by rate limits, e.g. show which limit has been hit and when it can be retried.  --> allows for better understanding of app

add pdf upload and extraction --> allows to extract from netto kassenbons downloaded from their loyalty app.

## LATER
evaluate alternative to gemini extraction

# text to product matching and review
## NOW


give dropdown of measurement units, and allow for "other" to let the user add more measurement units if they are needed and dont exist yet, we can collect the input from other and enhance the measurement units step by step
also increase accuracy of what a "piece" is. e.g. 1 piece of apple is something different than a piece of beer (a bottle of beer 330ml vs an apple 150-180g) How can we better do this?

increase matching accuracy by adding an additional step to the review process:
1. review extracted text, quantity and unit (exists)
2. review matched OFF product name, see how many alternatives were found and get the option to select an alternative that better suits the extracted text. Only showed products that contain nutritional information
(doesnt exist yet)
--> we should log this to see how often we need to get manual improvements
--> there should be an option to say that none of the alternatives nor the first choice is actually a hit
--> current matching algorithm sucks! many fallbacks to tier 3 that actually have matches if we search for the right thing

add matched products to the products table
--> allows for better accuracy calculations and faster loading in the future

add accuracy measurement for receipt item to OFF product mapping


## LATER
try alternative with BLS.de data. right now available as csv. API costs money.

#  Nutrition profile calculation & display
## NOW
calculate actual nutrient and energy needs via age, weight, height, gender and activity level, e.g.  Calculate Basal Metabolic Rate through Mifflin-St Jeor equation to find your baseline daily calorie expenditure, Multiply your BMR by your Total Daily Energy Expenditure (TDEE) factor to get your total needed daily calories and then Based on the USDA Dietary Guidelines, divide your daily calorie intake to cover your nutritional needs:Proteins: 10–35% of total calories. (1 gram = 4 calories)Fats: 20–35% of total calories. (1 gram = 9 calories)Carbohydrates: 45–65% of total calories. (1 gram = 4 calories)For detailed micro-nutrient (vitamins and minerals) goals, health organizations like Health Canada provide specific Dietary Reference Intakes tables based on your demographic
show an overall health score (current profile vs ideal profile achievement 0-100)

## LATER 
calculate healthiness score per purchsed item and give a ranking, either rank each product or assign them to categories like Ideal, good, okay, improvable and bad
show weekly and monthly scores


# other areas
## Later
extend recommendations to more than just 1 recommendation per result
give 1 add recommendation and 1 drop recommendation
give the option to switch between english and german
show everything thats built but not used right now
remove fallbacks from the time Jenny didnt have access to the database

