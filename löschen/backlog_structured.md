# NutriWise — Structured Backlog (v2 planning)

All findings collected from testing the current build, sorted into focus areas,
each tagged with the components it touches, an effort estimate, and a priority.
The last section groups them into **candidate next Epics** with a recommended
sequence.

## How to read this

**Effort**
- **S** — ≤ 1–2 days, localized change or a spike (investigation, no shipping code)
- **M** — ~3–5 days, spans a couple of layers
- **L** — > 1 week and/or needs design decisions first

**Priority** (my recommendation — adjust to taste)
- **P1** — do next; directly serves the core hypothesis (trustworthy, personalized nutrition insight from receipts) or unblocks other P1 work
- **P2** — should do; clear value, not blocking
- **P3** — later / nice-to-have

**Areas** — your six product-flow areas, plus four cross-cutting areas I had to add
because several findings don't belong to any single flow step (flagged *(added)*).

---

## Area: Onboarding

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| ONB-1 | Intolerances & allergies as multi-select dropdown | Profile model, exclusion filter, matching | M | P2 | Extends the existing free-text `exclusions`; makes them structured & reliable. Overlaps ACC-1. |
| ONB-2 | "Products I don't like" field | Profile model, exclusion filter, recommender | S | P2 | Cheap — reuses the exclusion-filter infra already built in Epic 3. Feeds REC-1/REC-2. |
| ONB-3 | Chat-style questionnaire onboarding | Onboarding UI, (optional LLM) | L | P3 | UX polish, not core value. Adds token cost if LLM-driven. |

## Area: Image-to-text extraction

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| EXT-1 | Extract the **receipt date** during parsing | Parser schema, receipts table, profile calc | M | **P1** | **Enabler** for NUT-1 and NUT-5 (any time-based nutrition math needs this). Low-risk add to the Gemini schema. |
| EXT-2 | Rate-limit / retry handling for Gemini extraction | Parser, error handling, upload UX | S | **P1** | Directly caused the "Maximum retries exceeded" upload breakage. Honor the API's `retryDelay`, return a clear typed error, move the blocking call off the event loop. |
| EXT-3 | Add PDF upload | Upload endpoint, parser | M | P2 | Real receipts are often PDFs (there's already a Netto PDF in `receipts/`). |
| EXT-4 | Evaluate Tesseract / non-LLM OCR to cut load time & token cost | Parser pipeline, cost, latency | L | P2 | Optimization, not correctness — current LLM path works. Do as a comparison spike first (accuracy vs. Gemini) before committing. |

## Area: Text-to-product matching

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| MATCH-1 | Improve match quality (e.g. "Linsen" → "DM Bio Linsenwaffeln") | Matcher | M | **P1** | Visible trust problem: a fuzzy 0.85 match to the wrong product pollutes the whole nutrition profile. Penalize length mismatch / prefer base-product hits. |
| MATCH-2 | Add **BLS.de** as a nutrition source; compare vs. OpenFoodFacts | Matching, nutrition data | L | P2 | German-authoritative data, better for fresh/produce where OFF is sparse. Check licensing/access first (spike). Pairs with MATCH-1. |
| MATCH-3 | **Decision made:** commit to DB-backed matching — upsert matched products into the `products` table (dedupe by `off_id`), write `receipt_items.matched_product_id` | `nutrition_mapping.py`/`receipt_items_repo.py`, `products` table, DB writes | M | **P1** | Resolves `SPIKE-2` (table was designed for this, then left unused when Epic 2 shipped stateless/file-cached matching instead). Gives a persistent match registry: caches OFF nutrition data in the DB (fewer repeat OFF calls), dedupes products across receipts, and creates the stable FK that `MATCH-4` needs. |
| MATCH-4 | Matching accuracy tracking: persist match outcomes over time and compute an accuracy metric | `analytics/match_quality.py`, `products`/`receipt_items`, `REV-2` | M | **P1** | **Depends on MATCH-3** (needs `matched_product_id` persisted to measure anything). Extends the existing *per-run* `match_quality` (Epic 2) into a *persisted, over-time* metric: exact/fuzzy/fallback rate trend, confidence distribution. Best ground-truth signal is user corrections from `REV-2` — every manual fix of a match is a labeled "this was wrong" data point, so pair the two. |

## Area: Review step improvement

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| REV-1 | Structured labels in review: quantity field + unit dropdown | Review UI, `ReceiptItemUpdate` schema | S | P2 | Improves data quality *upstream* of the nutrition calc (better units → better grams → better profile). |
| REV-2 | Direct OpenFoodFacts search from the review step | New OFF search endpoint, review UI | M | P2 | Lets a user fix a bad auto-match by hand — the human-in-the-loop backstop for MATCH-1. |

## Area: Nutrition profile calculation & display

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| NUT-1 | Use **actual weights + consumption time window** (receipt date range) instead of assumed density | Profile builder, gap detector | L | **P1** | The credibility core of the product. **Depends on EXT-1.** Design-heavy — try several approximations. |
| NUT-2 | Per-category "piece" weight definitions (replace the flat 100 g/piece default) | `nutrition_profile.grams_for` | M | P2 | A concrete, shippable slice of NUT-1's accuracy goal; doable independently. |
| NUT-3 | Healthiness ranking / grouping of bought groceries | Nutrition display, scoring | M | P2 | New insight surface. Shares scoring logic with NUT-4. |
| NUT-4 | Overall **health score** (current intake vs. ideal profile) | Nutrition model, display | M | **P1** | One compelling headline metric; strong demo value. Needs an "ideal profile" — richer once ACC-1 adds size/weight. |
| NUT-5 | Weekly / monthly intake views | Time-series aggregation, display | L | P2 | **Depends on EXT-1.** Natural follow-on to NUT-1. |

## Area: Recommendations

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| REC-1 | Extend 1 → 3 recommendations; expand logic ("more of the same, but different") | Recommender, `NextCartRecommendation` model, results UI | M | **P1** | Core output value. Already flagged in earlier review that Next Cart returns exactly one. |
| REC-2 | "What to stop buying" recommendations | Recommender (high/reduce gaps, processed items) | M | P2 | Complements REC-1; the reduce-side of the mapping table already exists for sugar/processed. |

## Area: Accounts & profile management *(added)*

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| ACC-1 | User login + persistent profile (configure once, then just upload/review/results); add size & weight for an ideal profile; edit-profile button on results | Auth, profile model, frontend flow, DB, `user_id` scoping | L | **P1** | Big UX unlock and the honest basis for per-user aggregation (SPIKE-1). Size/weight feeds NUT-4's "ideal profile". **Recommend splitting** into: (a) auth, (b) profile persistence/edit, (c) biometric fields. |

## Area: Internationalization *(added)*

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| I18N-1 | Enable app in English **and** German | All frontend copy, backend messages, parser prompt | L | P2 | Cross-cutting; cheaper if done before more UI is built, more expensive the longer it waits. |

## Area: Data model & persistence *(added)*

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| DATA-1 | Populate/justify missing `receipts` fields (store, scan_quality, items_count, raw metadata) | Receipts schema, parser persistence | S–M | P2 | The parser already produces store/scan_quality/items_count — just not persisted to columns. Decide which are worth storing. |
| DATA-2 | Populate/justify missing `receipt_items.price` | receipt_items schema | S | P2 | `price` unlocks spend insights. `matched_product_id` (the other missing field originally scoped here) is now covered by `MATCH-3` — decision made to wire it up rather than justify leaving it null. |

## Area: Tech debt & discovery spikes *(added)*

| ID | Item | Also affects | Effort | Priority | Notes / dependencies |
|---|---|---|---|---|---|
| SPIKE-1 | Confirm aggregation is **per user/session**, never across the whole DB | Snapshot, next-cart, session/user scoping | S | **P1** | Correctness + privacy. Session scoping exists (Epic 8); verify it, and tighten to `user_id` now that receipts carry it. |
| SPIKE-2 | ~~Why is the `products` table unused for matched products?~~ **RESOLVED** | Matching persistence, products table | S | — | **Answer:** `products` (id, off_id, name, brand, nutrition) and `receipt_items.matched_product_id` were designed for a DB-backed match registry, but Epic 2 shipped stateless matching with a local JSON file cache instead — the table was never wired up (confirmed: 0 rows in `products`, all 166 real `receipt_items` rows have `matched_product_id = null`). **Decision:** commit to the DB-backed design after all — actioned as `MATCH-3`/`MATCH-4` above. |
| SPIKE-3 | Why is the `analyses` table empty? | Analytics | S | P3 | Decide: wire it up or drop it. |
| SPIKE-4 | Audit backend built but **not surfaced in frontend** | Whole stack | S | P2 | Epic 8/9 shipped feedback/session/analytics/recipes — not all are exposed in the UI. Directly informs which Epics to prioritize. |
| DEBT-1 | Remove the "migration pending?" fallback shims in `db/supabase.py` | DB layer | S | P2 | Only after confirming every environment has run the migrations. (Already partly commented out.) |

---

## Candidate next Epics

Derived by clustering the items above. Ordering is a recommendation based on
*value to the core hypothesis* and *dependencies*.

**Epic 0 — Hardening & Discovery** *(do first; almost all S / spikes)*
`SPIKE-1, SPIKE-2, SPIKE-3, SPIKE-4, DEBT-1` — cheap, de-risking, and SPIKE-4
tells you how much already-built backend you can surface for near-free. Front-load it.

**Epic 11 — Extraction Reliability & Inputs**
`EXT-2` (rate limits), `EXT-1` (receipt date — unblocks the nutrition epic), `EXT-3` (PDF); `EXT-4` (Tesseract) as a stretch spike.

**Epic 12 — Matching & Nutrition Data Quality**
`MATCH-3` (persist matches via `products` table — do this first, it's the foundation), `MATCH-1` (fix bad fuzzy matches), `REV-2` (manual OFF search fallback), `MATCH-4` (accuracy tracking — needs `MATCH-3` + benefits from `REV-2`'s correction signal), `DATA-2` (price field); `MATCH-2` (BLS.de) as a scoped experiment.

**Epic 13 — Trustworthy Nutrition Profile** *(the credibility epic)*
`NUT-1` (real weights + time), `NUT-2` (piece weights), `NUT-4` (health score), `SPIKE-1` (per-user aggregation), `NUT-3` (healthiness grouping); `NUT-5` (weekly/monthly) after.

**Epic 14 — Richer Recommendations**
`REC-1` (3 recs + expanded logic), `REC-2` (what to stop buying), `ONB-2` (dislikes feed recs).

**Epic 15 — Accounts & Personalization**
`ACC-1` split into auth → profile persistence/edit → biometric (size/weight) fields; `ONB-1` (allergies dropdown) rides along.

**Epic 16 — Review & Onboarding UX**
`REV-1` (unit dropdowns), `ONB-3` (chat onboarding).

**Epic 17 — Internationalization**
`I18N-1` — schedule *before* the UI grows much more; cost scales with surface area.

### Suggested sequence & why
1. **Epic 0** — spikes are nearly free and change what you'd prioritize next (especially SPIKE-4).
2. **Epic 11 → Epic 13** — EXT-1 (receipt date) unblocks NUT-1; do them back-to-back. This chain is where the core "estimated, not exact" weakness becomes "credibly estimated."
3. **Epic 12** in parallel where possible — matching quality is independent of the profile math and both feed trust.
4. **Epic 14** — highest-visibility output improvement once the inputs (12/13) are trustworthy.
5. **Epic 15** — large; sequence after the core loop is solid, since it's UX/scale rather than core-hypothesis.
6. **Epic 16 / 17** — polish and reach; slot opportunistically.

### Cross-cutting dependencies to watch
- `EXT-1` (receipt date) → blocks `NUT-1`, `NUT-5`.
- `ACC-1` (size/weight) → strengthens `NUT-4`'s "ideal profile".
- `MATCH-1` ↔ `REV-2` — automated fix and manual fix of the same problem; design together.
- `SPIKE-1` should land before/with `ACC-1` (they're both about correct per-user scoping).
- `MATCH-3` → blocks `MATCH-4` (no persisted `matched_product_id`, nothing to measure) and unblocks `DATA-2`'s remaining scope (just `price` now).
- `MATCH-4` ↔ `REV-2` — a review-step correction is the strongest accuracy signal available; sequence `REV-2` alongside `MATCH-4`, not after it.

### Quick wins (S + P1/P2 — good momentum / low risk)
`EXT-2`, `SPIKE-1`, `ONB-2`, `REV-1`, `SPIKE-4`, `DEBT-1`.

# User Feedback to prioritization:
## Onboarding
### NOW
add Intolerances and allergies selection area
question: how many intolerances and allergies are there?
--> either do a drop down if its too many or simply give an overview of all and let the user click/tap the ones that apply
use intolerances and allergies to make recommendations valuable / restrict recommendations (exclusion filter)

add a field where users can add food they do not like
save this in profile and use to make recommendations valuable / restrict recommendations (exclusion filter)

add fields for user weight and height and gender --> enable actual nutrient profiles

### LATER
Chat Style Onboarding

## Profile
### NOW
add login area for users
ensure results, recommendations etc are only calculated with the data from the specific user, not across all data in our database
add  an edit option for profile editing whenever needed

## Image to Text Extraction
### NOW
extract receipt date, number of items, store and save them in receipts table, also extract prices for receipt items (adjust gemini prompt and output format)
--> enables better tracking, allows for more detailed consumption profile and gap detection, later also supermarket share calculations.

add a more detailed info about errors caused by rate limits, e.g. show which limit has been hit and when it can be retried.  --> allows for better understanding of app

add pdf upload and extraction --> allows to extract from netto kassenbons downloaded from their loyalty app.

### LATER
evaluate alternative to gemini extraction

## text to product matching and review
### NOW


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


### LATER
try alternative with BLS.de data. right now available as csv. API costs money.

##  Nutrition profile calculation & display
### NOW
calculate actual nutrient and energy needs via age, weight, height, gender and activity level, e.g.  Calculate Basal Metabolic Rate through Mifflin-St Jeor equation to find your baseline daily calorie expenditure, Multiply your BMR by your Total Daily Energy Expenditure (TDEE) factor to get your total needed daily calories and then Based on the USDA Dietary Guidelines, divide your daily calorie intake to cover your nutritional needs:Proteins: 10–35% of total calories. (1 gram = 4 calories)Fats: 20–35% of total calories. (1 gram = 9 calories)Carbohydrates: 45–65% of total calories. (1 gram = 4 calories)For detailed micro-nutrient (vitamins and minerals) goals, health organizations like Health Canada provide specific Dietary Reference Intakes tables based on your demographic
show an overall health score (current profile vs ideal profile achievement 0-100)

### LATER 
calculate healthiness score per purchsed item and give a ranking, either rank each product or assign them to categories like Ideal, good, okay, improvable and bad
show weekly and monthly scores


## other areas
### Later
extend recommendations to more than just 1 recommendation per result
give 1 add recommendation and 1 drop recommendation
give the option to switch between english and german
show everything thats built but not used right now
remove fallbacks from the time Jenny didnt have access to the database