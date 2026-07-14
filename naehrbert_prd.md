# Nährbert — Product Requirements Document

*Structured PRD derived from `naehrbert_v2.md`. Every decision in the source is preserved; content is reorganized and clarified only. No features are added. Requirement IDs (FR/BR/…) are for traceability. Available in German and English.*

---

## 1. Product Vision

Nährbert turns ordinary supermarket receipts into a personalized picture of what a person likely eats, compares it against science-based ideal nutrition targets, and returns grounded, adherence-aware recommendations for the next shop — without any manual food logging.

It is built as a **continuous loop**: each uploaded receipt adds data, sharpening the estimated intake, the detected gaps, and the recommendations over time. The engine combines four layers:

1. **Physiological needs** — what the user should consume (calories, macros, micronutrients), from established formulas and reference values.
2. **Estimated intake** — what the receipts suggest they actually consume.
3. **Functional signals** — symptoms and well-being that re-prioritize which gaps matter most (they change *how* we recommend, not the underlying targets).
4. **Behavioral context** — cooking and shopping habits, preferences, and constraints that determine *how* a recommendation is delivered so the user is likely to adopt it.

Nährbert provides general nutrition information, **not** medical advice or diagnosis.

---

## 2. User Personas

*Derived directly from the scenarios and goals in the source document, not newly invented.*

- **P1 — The goal-driven optimizer.** (Source example: male, 30, 80 kg, 180 cm, muscle gain.) Has a clear body-composition goal, wants precise calorie/macro targets and simple "increase protein by X" guidance. Feels fine; needs numbers.
- **P2 — The motivated home cook (User A).** Enjoys cooking, cooks most days. Best served by ingredient-level suggestions ("add lentils to your chili", "roast vegetables in bulk"). Adherence is high when recommendations fit a cooking lifestyle.
- **P3 — The convenience-oriented user (User B).** Cooks ~once a week and reports functional symptoms (afternoon fatigue, constant hunger, constipation). Needs ready-to-eat, low-effort suggestions ("high-protein yogurt", "frozen vegetables", "pre-cooked chicken/tofu into ready meals") and symptom-aware prioritization (fiber, protein, iron).

The same nutrient targets can apply to all three; the **prioritization and delivery** of recommendations differ by persona (symptoms + behavioral readiness).

---

## 3. Goals

- **G1** Estimate a user's nutritional intake from supermarket receipts, with no manual meal logging.
- **G2** Compute science-based **ideal profiles** (calories, macronutrients, micronutrients) personalized to the individual.
- **G3** Detect gaps between ideal and estimated intake and express them as an overall health score plus per-nutrient detail.
- **G4** Prioritize recommendations using functional (symptom) signals and goals, and deliver them in a way that fits the user's behavioral context (adherence over theoretical perfection).
- **G5** Improve product-matching accuracy over time by learning from user corrections (a floor that rises with use, rather than a fixed ceiling).
- **G6** Motivate healthier shopping shifts and recognize improvement across uploads.
- **G7** Operate fully in German and English.

---

## 4. Non-Goals

- **NG1** Not a medical or diagnostic tool. The engine never diagnoses a cause (e.g. for diarrhea) and always defers persistent symptoms to a healthcare professional.
- **NG2** No manual food/meal logging as the primary input — the product is receipt-driven.
- **NG3** Does not directly capture food eaten away from home / not on receipts (handled as a confidence discount + caveat, not a measured input).
- **NG4** Not validated for children; minimum sign-up age 16.
- **NG5 (Post-MVP, explicitly deferred):**
  - Google Health / Apple Health integration (auto activity/step import).
  - Cross-user comparisons ("top x% of healthiest users"; usage-intensity vs others).
  - Recipe generation and recipe-based shopping lists (MVP keeps item-level Next-Cart recommendations only).
  - Added-sugar-specific health thresholds (MVP uses total sugar as a proxy).

---

## 5. Functional Requirements

### 5.1 Authentication (FR-1)
- **FR-1.1** Login via Supabase Auth, supporting **both** email+password **and** Google OAuth.
- **FR-1.2** Use Supabase's default persisted session (refresh token in secure storage, silent access-token refresh); the user stays logged in across restarts until explicit logout or refresh-token expiry. Do **not** force login on every open; no fixed re-login interval.
- **FR-1.3** Authorized URIs currently cover localhost + the Supabase project only (no production domain yet); the production callback is added at deploy.

### 5.2 Onboarding & Profile (FR-2)
- **FR-2.1 Onboarding flow** walks the user step-by-step through each category with **static, localized (DE/EN) copy** (not LLM-generated): a warm-but-expert introduction, a short explanation per category of how it affects well-being and the calorie/macro/micro calculation, then the question. After each answer it gives brief reassuring feedback (complimenting healthy habits or normalizing common issues). Each answer option maps 1:1 to a fixed localized feedback string (DE/EN) — a content deliverable, not generated at runtime. All answers are editable later in the profile.
- **FR-2.2** First, ask how the user wants to be addressed (name/pronoun) — used for tone only, never for calculations.
- **FR-2.3 Level-1 (physiological) inputs**, captured during onboarding — see §7.
- **FR-2.4 Level-2 (functional) inputs**: on first render of the results screen (the first time the health score & recommendations are shown), present a **non-blocking** invitation to answer them; store a `level2_prompted` flag and re-invite at most once per later session until completed or dismissed twice. All optional; Level-2 is never a prerequisite for any Level-1 feature. See §7.
- **FR-2.5 Health-data consent (GDPR):** explicit, separate opt-in is captured at the start of the Level-2 questionnaire (not bundled into general terms). The app is fully usable — login, profile, Level-1 targets, macro gap analysis — without consenting to Level-2. Stored as a single Level-2 consent record per user (boolean + timestamp + consent-text version); revocation disables Level-2 processing and hides those inputs.

### 5.3 Ideal Profile Generation (FR-3)
- **FR-3.1** Compute **BMR** via Mifflin–St Jeor.
- **FR-3.2** Estimate **TDEE additively** from four components: BMR + NEAT (daily movement) + EAT (exercise) + TEF (thermic effect of food), rather than a single coarse multiplier.
- **FR-3.3** Apply the **goal adjustment** to TDEE to produce the daily calorie target.
- **FR-3.4** Derive **macro targets** (protein, fat, carbohydrates) per the business rules in §6.
- **FR-3.5** Derive **micronutrient targets** from age/sex/pregnancy-specific reference values (DGE/EFSA).
- **FR-3.6** Output **three ideal sub-profiles**: calories, macronutrients, micronutrients.
- **FR-3.7 Recalculation triggers:** the ideal profile recomputes whenever any Level-1 input changes (weight, height, activity, goal, sex, pregnancy) and whenever age (derived from DOB at compute time) increments; the status-quo profile recomputes on every receipt upload and every consumption-feedback update.

### 5.4 Receipt Upload (FR-4) — *loop step*
- **FR-4.1** Accept JPG, JPEG, PNG, PDF, and direct photo capture; support multi-file selection in one upload. Each selected file is one receipt unless explicitly grouped in the upload UI; a single receipt photographed across multiple images is out of scope for MVP (one image per receipt).
- **FR-4.2** Show a data-sufficiency disclaimer explaining how much data supports what (see §8 / §11).
- **FR-4.3** Extract per receipt: date of trip, store name (if available), number of food items, and per item: name (for matching), quantity, unit, price. Units normalize to a canonical enum {g, kg, ml, l, piece}; piece-based items convert to grams via the piece-weight table; liquids use per-100-ml nutrition, solids per-100-g.
- **FR-4.4** Surface typed extraction errors to the user (rate-limited → retry; unavailable → try later; invalid image — no parseable line items or unsupported MIME type); storage failure is non-fatal (parsing still succeeds).
- **FR-4.5** Extraction classifies each line as food or non-food; only food lines enter matching and nutrition math. Non-food lines (deposits/Pfand, bags, discounts, non-food goods) are counted separately and excluded from all nutrient calculations.

### 5.5 Product Matching (FR-5) — *loop step*
- **FR-5.1** Resolve each item to a nutrition profile through an ordered tier system (see §6 BR-Matching), separating **identity** (which food — OFF wins) from **nutrition** (BLS supplies complete macros + the full micronutrient spectrum).
- **FR-5.2 Tier 0 — learned lookup (M12):** before any fuzzy search, check the verified-match store keyed on `(normalized_raw_text, store)`; a confirmed hit is used directly.
- **FR-5.3** Compute total calories, macro and micronutrients from matched items, their quantities and units.
- **FR-5.4** Track a **micro-coverage** metric (share of items with real, non-category micronutrient data).

### 5.6 Review & Correction (FR-6) — *loop step*
- **FR-6.1** Show extracted + matched products alongside the original extracted text, detected quantity, and unit; all correctable by the user.
- **FR-6.2** Let the user search **both** OpenFoodFacts and BLS directly from the review, showing **only results that carry nutritional data** ("has nutritional data" = at least one of {kcal, protein, fat, carbs} present and numeric — identical to the matcher's usability check).
- **FR-6.3** Provide a "no match found" action for direct feedback.
- **FR-6.4** Persist matches to the verified-match store (§6 BR-Matching / M12) on explicit user selection, manual search pick, or confirmation of a *non-Tier-0* match; passive pass-through of an existing Tier-0 verified hit does not create a new vote. Collect "no match" items for later analysis and manual addition.

### 5.7 Status-Quo Profile (FR-7) — *loop step*
- **FR-7.1** Ask the intake-attribution questions (shared? → count → share → waste) and compute the user's actual intake from receipts (see §6 BR-Intake).
- **FR-7.2** Infer the consumption timeframe for purchased goods across three layers (category default → repeat-purchase interval → leftover feedback; see §6 BR-Timeframe), and maintain a per-product consumption-timeframe table.
- **FR-7.3** Output three status-quo sub-profiles (calories, macros, micros) mirroring the ideal profile.

### 5.8 Eaten-Feedback (FR-8) — *A/B, loop step*
- **FR-8.1** Implement **both** feedback variants and decide by user testing: **A** — at the time of the next upload (while extraction/matching runs, ask what of the last receipt was eaten / left over / thrown away); **B** — daily update via the dashboard. Assignment: each user is placed in A or B at account creation via a deterministic 50/50 hash of the user id; sticky for the account's lifetime; never both.

### 5.9 Gap Detection (FR-9) — *loop step*
- **FR-9.1** Compare ideal vs status-quo sub-profiles and produce an **overall health score (0–100)** plus a per-nutrient detail view.
- **FR-9.2** Render each macro/micronutrient as a horizontal bar (0 → 100 = ideal → over 100 = over-consumption); greener near ideal, redder as it deviates (under or over). Bar/closeness formula per BR-HS2 — ceiling nutrients scale against their limit, not an ideal.
- **FR-9.3** **What to add** = the top-scored recommendations from BR-Scoring (1 primary + up to 2 alternatives; action add or replace). **What to drop** = up to 2 of the user's own red-tier items driving the most over-consumed dimension. Both respect dietary style, allergies/intolerances, and dislikes.
- **FR-9.4** Provide a full grouping of purchased items into **three tiers** (Healthy / OK / Unhealthy) plus a separate "not enough data" group (see §6 BR-Grouping).
- **FR-9.5** Motivate the user to shift toward healthier items and congratulate improvement across uploads.
- **FR-9.6** Show weekly and monthly trends once uploaded data permits.

### 5.10 Next-Cart Recommendations (FR-10) — *loop step*
- **FR-10.1** Entered on demand (user taps the Next-Cart area); then ask: for how many days do you plan to shop, and how often do you want to eat home-cooked meals.
- **FR-10.2** Combine this with detected gaps, dietary style, allergies/intolerances, and dislikes to produce recommendations, scored and ranked (see §6 BR-Scoring), surfacing the top items (add/replace/reduce).
- **FR-10.3 (Post-MVP)** Propose recipes, let the user select an amount, and generate a shopping list.

### 5.11 Dashboard (FR-11)
- **FR-11.1** Overall Health Score (cross-user comparison is post-MVP).
- **FR-11.2** Detailed macro/micronutrient overview.
- **FR-11.3** Upload a new receipt.
- **FR-11.4** Counter of uploaded receipts & items (cross-user comparison is post-MVP).
- **FR-11.5** Selected recipes (post-MVP).
- **FR-11.6** Item health ranking.
- **FR-11.7** Update consumption (what was eaten / thrown away / still exists).
- **FR-11.8** Edit profile.

### 5.12 Profile Management (FR-12)
- **FR-12.1** Edit Profile shows all captured data for viewing and adjustment.
- **FR-12.2** Switch language between German and English. Initial language defaults to the browser/device locale if German or English, otherwise English; the user's explicit choice overrides and persists on the profile.
- **FR-12.3** Delete the profile (hard cascade delete of all **personal** data — see §6 BR-Privacy; the de-identified aggregate verified-match mapping is retained, as it holds no personal data).
- **FR-12.4** Export the full profile + receipts + derived profiles (JSON/CSV).

---

## 6. Business Rules

### BR-Gen (cross-cutting conventions)
- **BR-Gen1 Dates / timezone:** all dates are stored ISO-8601; day-boundary logic uses Europe/Berlin.
- **BR-Gen2 Rounding:** compute in full precision; round only for display — calories to the nearest 10 kcal, macros to the nearest 1 g, health score to an integer, confidence to one of Low/Medium/High.
- **BR-Gen3 Energy conversions:** all macro↔kcal conversions use the constants in BR-M6.

### BR-Energy (ideal calories)
- **BR-E1** `BMR` via Mifflin–St Jeor (sex-specific). For non-binary / "prefer not to say", compute the male and female BMR independently and take the arithmetic mean of the two BMR values.
- **BR-E2** `Calories = BMR + NEAT + EAT + TEF`.
- **BR-E3** NEAT = `BMR × movement%`: mostly sitting +0%, mixed sitting/walking +10%, mostly standing/walking +20%, physical labor +35%.
- **BR-E4** EAT (added kcal/day), keyed by the exercise-frequency enum: `none→0, one_two→100, three_four→250, five_six→400, daily_athlete→600`. The same enum keys are used in onboarding and this rule.
- **BR-E5** TEF = `10% × (BMR + NEAT + EAT)`.
- **BR-E6** Goal adjustment applied to TDEE: lose fat −15%, maintain 0%, build muscle +10%, aggressive gain +15%.

### BR-Macros (M3 — every range resolves to one deterministic value; ranges are the safe envelope, never shown to the user)
- **BR-M1 Protein (g/kg)** = `max(activity_value, goal_value)`. Activity: none 1.0 / 1–2wk 1.4 / 3–4wk 1.6 / 5–6wk 1.8 / athlete 1.8. Goal: fat-loss 2.0, build 2.0, aggressive 2.0, maintain 1.2.
- **BR-M2 Fat** = `max(30% of target kcal, 0.8 g/kg)`.
- **BR-M3 Carbohydrates** = `max(0, target_kcal − protein_kcal − fat_kcal)`, converted to grams via BR-M6. If protein + fat already meet or exceed the target, protein is held fixed, fat is reduced toward its 0.8 g/kg floor to make room, and carbohydrates are floored at 0; if still infeasible, flag the target as "constrained" and surface the conflict rather than showing negative carbs.
- **BR-M4 Fiber** = `14 g per 1000 kcal` of the calorie target.
- **BR-M5 Micronutrients** = single age/sex/pregnancy-specific RDA (DGE/EFSA). Independent of calories; pregnancy/breastfeeding materially change iron/calcium/folate (C4).
- **BR-M6 Energy densities (fixed conversion constants):** protein 4 kcal/g (17 kJ/g), available carbohydrate 4 kcal/g (17 kJ/g), fat 9 kcal/g (37 kJ/g), alcohol 7 kcal/g (29 kJ/g), dietary fibre 2 kcal/g (8 kJ/g), organic acids 3 kcal/g (13 kJ/g), sugar alcohols/polyols 2.4 kcal/g (10 kJ/g). All macro↔kcal conversions use these constants; carbohydrate energy uses *available* carbohydrate, with fibre counted separately at 2 kcal/g.

### BR-Matching (identity vs nutrition; ordered tiers)
- **BR-MT0 Tier 0 — learned lookup (M12):** check the verified-match store on `(normalized_raw_text, store)`; exact hit → use at confidence 1.0 and skip fuzzy search; store-agnostic hit → use at slightly lower confidence; else fall through.
- **BR-MT0a Normalization (shared by write and read):** Unicode NFC → lowercase → strip quantity/price/unit tokens and store artifacts → collapse internal whitespace → trim. Implemented in one shared function used identically by the verified-match write path and the Tier-0 lookup, so keys never diverge.
- **BR-MT1 Tier 1 — identity via OFF:** OFF search with current scoring + form-word/NOVA guards. Confident hit → identity (keep name, brand, NOVA). Confident = token-similarity ≥ 0.60 with a usable-nutrition candidate; labelled "exact" at whole-string ratio ≥ 0.90 (thresholds in one config).
- **BR-MT2 Tier 1b — identity via BLS generic:** only for whole/raw foods with head-noun agreement (recovers items OFF misses).
- **BR-MT3 Tier 2 — nutrition enrichment (OFF→BLS bridge):** prefer BLS for macros + micros, mapped from the identity's head noun + category, picking the "roh"/plain variant. **Guard (type agreement):** borrow BLS values only when the OFF-identified item and the BLS candidate resolve to the **same canonical food category** AND share the **same head-noun stem** (per the base-term deriver); otherwise keep OFF's own values. Never let BLS free-match branded/prepared items. NOVA/processing always from OFF (BLS has none). **Plain variant:** among type-agreeing BLS candidates, prefer names with no preparation qualifier (gedünstet, gebraten, frittiert, gekocht, …); if several remain, choose the shortest (most generic) name.
- **BR-MT4 Tier 3 — category estimate:** last resort, flagged low-confidence / "unknown".
- **BR-MT5 Provenance:** every nutrient value carries its source (off / bls / category) and two confidences. `identity_conf` = the match's token-similarity (Tier-0 verified = 1.0; category fallback = 0.3). `nutrition_conf` = 1.0 when values come from a confirmed OFF/BLS product, 0.3 from the category table, 0 when absent.
- **BR-MT6 Verified-match store (M12):** on each confirmed/corrected match, persist `raw_text` (normalized), `store`, `chosen_source` (off/bls/manual), `product_id`, `matched_name`, nutrition snapshot, NOVA (if OFF), `verified=true`, `confidence=1.0`, user-vote count (one vote per distinct user per key), last-updated. Stored as **global, de-identified reference data in a separate table with no user FK**. One vote **per distinct user** per `(normalized_raw_text, store)` key (repeat purchases by the same user do not increase the count). The winning product has the most user-votes; ties break by most-recent confirmation. A key is "low-agreement" — flagged for manual review and **not** auto-served — when no product holds > 50% of votes.
- **BR-MT7** Compute the OFF→BLS bridge once per distinct product (cached in the products registry), not per receipt line.
- **BR-MT8** Never invent nutrition facts (LLM never produces nutrition numbers).

### BR-Intake (M5 — receipts → actual intake)
- **BR-I1** `intake_from_receipts = grocery_total × user_share × (1 − waste_fraction)`.
- **BR-I2** `user_share`: not shared → 100%; shared → ask "How many people eat from these groceries, **including you**?" (N) → default `user_share = 1/N`, user-adjustable.
- **BR-I3** `waste_fraction` from the "how much did you throw away?" question at the next upload. It applies to the immediately preceding receipt; named items are reduced individually, otherwise the fraction is applied uniformly across that receipt's food items.
- **BR-I4** "Meals eaten outside" and "receipts represent all shopping" do **not** multiply intake (would double-count); they feed the confidence discount (BR-Conf) and a caveat.
- **BR-I5 Daily rollup:** daily intake per nutrient = Σ over items of `(item_nutrient_amount × user_share × (1 − waste)) ÷ item_consumption_days`, where `item_consumption_days` comes from BR-Timeframe. This per-item rollup is the single source of daily intake — it replaces any basket-wide window.
- **BR-I6 Eating-occasion coverage (meals/snacks + eating-out):** `total_occasions = full_meals + snacks` (integer inputs). `untracked_share` = the meals-outside answer's midpoint (rarely 5%, sometimes 20%, often 40%, most 65%); `tracked_occasions = round(total_occasions × (1 − untracked_share))`. Used only for (a) a user-facing coverage line, (b) a plausibility check (receipt-implied calories vs occasions × typical size), and (c) meal-distribution tips. It does **not** scale intake — there is no data on food eaten out, and occasion-share ≠ nutrient-share.

### BR-Timeframe (M6 — consumption window)
- **BR-T1 Default (from receipt #1):** category window lookup — fresh produce 3–7 d, dairy 7–10 d, bread 3–5 d, fresh meat/fish 2–4 d (frozen 30–60 d), pantry staples (rice/oil/flour/pasta) 60–90 d, supplements ~90 d. Windows key off the app's canonical food categories (same taxonomy as the category-fallback nutrition); the category→days table is a single config.
- **BR-T2 Refine:** a repeat is the same `matched_product_id` (or, if unmatched, the same `normalized_raw_text` + store). The window = the mean of the **last 3** inter-purchase intervals for that product; with fewer than 2 purchases, use the BR-T1 category default.
- **BR-T3 Correct:** the eaten/left/thrown-away feedback adjusts remaining quantity and is the only correction signal for one-off/stockpiled items.

### BR-Scoring (M4 — recommendation prioritization)
- **BR-S1** `Score = GapSeverity × Confidence × SymptomRelevance × GoalRelevance`; rank descending. Output = 1 primary recommendation + up to 2 alternatives (action add or replace) + up to 2 reduce suggestions; "top 3" = the primary + alternatives set. Deterministic, rule-based.
- **BR-S2 GapSeverity ∈ [0,1]** — deficit `clamp((target−intake)/target,0,1)`; excess (sugar/sat-fat/calories) `clamp((intake−target)/target,0,1)`.
- **BR-S2a Missing data:** a nutrient with snapshot confidence = 0 (no real intake estimate) is excluded from gap detection, scoring, and the health-score weighting — never scored as a 100% deficit.
- **BR-S3 Confidence ∈ [0,1]** — the snapshot/nutrient confidence (BR-Conf).
- **BR-S4 SymptomRelevance ≥ 1** (default 1.0; multiple hits stack multiplicatively, cap 2.0), per lookup: bowel <3/wk or hard stool → fiber ×1.6 + water reminder; bloating often/daily + already high-fiber → fiber ×0.7 + "adjust meal composition"; hunger most-of-day/constantly → protein ×1.5, fiber ×1.3; energy crash/tired → iron ×1.4, complex-carbs ×1.2 + sleep flag; muscle soreness (active) → protein ×1.3, magnesium ×1.3, potassium ×1.2; poor sleep → magnesium ×1.2 + caffeine-timing tip; hydration <1 L + high fiber → fiber ×0.7 + hydration first; alcohol weekly+ → global confidence ×0.85 + whole-food nudge.
- **BR-S5 GoalRelevance ≥ 1** — build/aggressive → protein ×1.5, carbs ×1.2; fat loss → protein ×1.4, fiber ×1.3; maintain → protein ×1.1.
- **BR-S6** All exclusions (dietary style, allergies/intolerances, dislikes) filter candidates before scoring.

### BR-Grouping (M8 — 3-tier item health)
- **BR-G1 Unhealthy (red):** NOVA ≥ 4 **OR** sugar ≥ 20 g/100 g.
- **BR-G2 Healthy (green):** NOVA ≤ 2 **AND** sugar < 10 g/100 g.
- **BR-G3 OK (yellow):** everything in between.
- **BR-G4 Not enough data (grey):** no confirmed nutrition — shown separately, never guessed.
- **BR-G5** MVP uses **total** sugar as a proxy for added sugar (added-sugar thresholds post-MVP).
- **BR-G6 Missing NOVA:** if NOVA is absent (e.g. a BLS-only match), group on sugar alone (green < 10, red ≥ 20, else OK); if both NOVA and sugar are absent, the item is "not enough data".

### BR-Score (M11 — overall health score)
- **BR-HS1** Ideal and status-quo profiles each have three sub-profiles (calories, macros, micros); gaps compared per sub-profile.
- **BR-HS2** **Target nutrients** (protein, carbohydrate, fibre, most micros): bar = `intake ÷ target × 100`; closeness = `100 × (1 − clamp(|intake−target|/target, 0, 1))` — penalizes both under and over. **Ceiling nutrients** = {added/total sugar, saturated fat, sodium}: bar = `intake ÷ limit × 100`; closeness = 100 for intake ≤ limit, then declines as `100 × (1 − clamp((intake−limit)/limit, 0, 1))`. Calories are a target nutrient, but over-consumption past the target is penalized like a ceiling.
- **BR-HS3** Overall score = weighted mean of closeness scores (e.g. calories 20%, protein 15%, fat 10%, carbs 10%, fiber 15%, micros-as-group 30%; weights tunable). Dimensions with no data (confidence 0) are dropped and the remaining weights renormalized to sum to 1, so the score reflects only measured dimensions. Micronutrient scoring is gated on the finalized DGE/EFSA nutrient list (Q1); until then the micro-group weight is 0 and only calories + macros + fibre score.
- **BR-HS4** Always display the score **with** the confidence badge. For MVP, do **not** apply any probabilistic shrink — the score and the badge are shown side by side.

### BR-Conf (M10 — confidence, one definition used everywhere)
- **BR-C1 Per item** = `identity_conf × nutrition_conf`; category-fallback fixed at 0.3; unknown 0.
- **BR-C2 Snapshot/per nutrient** = `data_conf × coverage_conf × completeness × external_intake_discount × alcohol_discount` (multiplicative — any single weak factor lowers trust). `data_conf` = each contributing item's per-item confidence (BR-C1) weighted by its share of that nutrient's total contributed amount.
- **BR-C3 coverage_conf** from item-count tiers: <20 → 0.2, 20–50 → 0.4, 50–100 → 0.6, 100–200 → 0.8, 200+ → 1.0.
- **BR-C4** completeness = share of basket with a real (non-category) match; external_intake_discount = meals-outside {rarely 1.0, sometimes 0.85, often 0.70, most 0.60} × receipts-completeness {all 1.0, most 0.85, half 0.70, <half 0.50}; alcohol_discount 0.85 if weekly+.
- **BR-C5** Bands: < 0.34 Low, 0.34–0.66 Medium, > 0.66 High. Surfaced accordingly; feeds the scoring engine, the health-score badge, and every "estimated, not measured" label.

### BR-Privacy (C3 — GDPR)
- **BR-P1** Health data (symptoms, digestion, sleep, mood, alcohol, supplements) is Art. 9 special-category; lawful basis = explicit consent (Art. 9(2)(a)), stored with timestamp + consent-text version.
- **BR-P2** Data minimization + purpose limitation: used only to personalize this user's recommendations; never sold; never used for cross-user ranking.
- **BR-P3** Right to access/portability (export) and erasure. Erasure hard-cascade-deletes all **personal** data — profile, receipts, images, derived profiles, and the user's votes in the verified-match store. The de-identified aggregate mapping (winning product per key) is **retained**, as it contains no personal data.
- **BR-P4** Retention: delete raw receipt images after successful processing unless the user opts to keep them; derived rows kept while the account is active.
- **BR-P5** Encrypted at rest + row-level security (user reads only their own rows).
- **BR-P6** Persistent "not medical advice / never diagnose" disclaimer wherever symptoms → recommendations appear.
- **BR-P7** Minimum age 16.

---

## 7. User Inputs

### Account
- Email+password or Google credentials; language choice (DE/EN); health-data consent (opt-in, for Level-2).

### Onboarding — Level 1 (physiological, required)
- Preferred form of address (name/pronoun).
- Sex assigned at birth (female/male) — for BMR only; non-binary/"prefer not to say" → mean of the male and female BMR values (M7).
- Date of birth (age); height (cm); weight (kg).
- Exercise frequency (none / 1–2 / 3–4 / 5–6 / daily-athlete).
- Daily movement (mostly sitting / mixed / mostly standing-walking / physical labor).
- Food intake: number of full meals per day (integer 1–8) and number of snacks per day (integer 0–8). Used for meal-distribution tips and eating-occasion coverage (BR-I6) — not for calorie targets.
- Goal (lose fat / maintain / build muscle / aggressive bulk).
- Dietary style (omnivore / pescatarian / vegetarian / vegan).
- Allergies & intolerances (lactose, gluten, milk, eggs, peanuts, tree nuts, wheat, soy, fish, crustacean shellfish, sesame, other).
- Dislikes (open text).
- Pregnancy/breastfeeding status (female profiles, optional) (C4).

### Onboarding — Level 2 (functional, optional; asked after first gap analysis)
- Bowel regularity; stool consistency; bloating; stomach discomfort (none/pain/heartburn/gas/nausea); energy; hunger; satiety; sleep; concentration; mood; hydration (daily); alcohol; supplements (none/multivitamin/protein/vitamin D/magnesium/omega-3/iron/other).

### Receipts & Review
- Uploaded files (JPG/JPEG/PNG/PDF/photo, multi-select).
- Corrections to matched product, quantity, unit; manual OFF/BLS search selections; "no match found".

### Status-Quo & Consumption
- Shared groceries? → number of people eating from them (including the user) → user's consumed share %.
- Waste: how much of the last shop was thrown away.
- Meals eaten outside (rarely/sometimes/often/most).
- Do receipts represent all grocery shopping (all/most/half/<half).
- Consumption update: what was eaten / still have / thrown away (variant A at next upload, variant B daily).

### Next-Cart
- Days planned to shop; desired home-cooked-meal frequency; recipe selection (post-MVP).

---

## 8. Outputs

- **Ideal profile** — three sub-profiles (calories, macros, micronutrients).
- **Status-quo profile** — three sub-profiles mirroring the ideal, adjusted for share/waste and consumption timeframe.
- **Eating-occasion coverage** — a transparency line, e.g. "we're capturing ~4 of your ~5 daily eating occasions; meals eaten out aren't included" (BR-I6).
- **Gap detection** — overall health score (0–100) with confidence badge; per-nutrient bars (0 → ideal → over); "what to drop" and "what to add" lists (respecting dietary style, allergies, dislikes).
- **Item health grouping** — Healthy / OK / Unhealthy + "not enough data".
- **Trends** — weekly and monthly, once data permits.
- **Next-Cart** — ranked add/replace/reduce recommendations (top items); shopping list from selected recipes (post-MVP).
- **Consumption-timeframe table** — per-product windows and purchase frequency.
- **Dashboard** — health score, macro/micro detail, receipt/item counter, item health ranking, consumption update, selected recipes (post-MVP), profile access.
- **Confidence labels & disclaimers** — "estimated, not measured"; "not medical advice"; data-sufficiency guidance.

---

## 9. Success Metrics

- **SM1 Matching quality** — product-identity correctness and coverage (baseline from the OFF vs BLS experiment: OFF ~71% correct / ~70% coverage; BLS ~33% / ~87%); target the hybrid + learned-lookup path to raise correct-match coverage.
- **SM2 Learned-match growth** — share of items resolved by Tier-0 verified matches over time (should rise with usage); count and frequency of unmatched "no match found" strings (should fall).
- **SM3 Micro-coverage** — share of basket items with real (non-category) micronutrient data (gates the reliability of micro-based features).
- **SM4 Data sufficiency** — proportion of users reaching meaningful confidence tiers (100+ matched items ≈ good confidence; a German household generates ~120–250 line items/month).
- **SM5 Eaten-feedback engagement (A/B)** — feedback-completion rate and retention; used to choose variant A vs B.
- **SM6 Health-score improvement** — improvement in overall health score across successive uploads (basis for congratulating users).
- **SM7 Recommendation adherence** — whether recommended items appear in subsequent receipts (adherence over theoretical perfection).

*Targets above are confirmed (Q9) and drawn from figures stated in the source.*

---

## 10. Assumptions

- **A1** A typical German supermarket household generates ~120–250 line items/month, so 100+ matched items is a realistic confidence target.
- **A2** Stockpiled/bulk goods (rice, oats, oil, frozen, supplements) are consumed over ~30–90 days ("best used by" style windows) until refined by repeat-purchase data.
- **A3** Receipts represent most of a user's grocery shopping (adjusted by the status-quo questions).
- **A4** Mifflin–St Jeor, the NEAT/EAT/TEF components, goal adjustments, and DGE/EFSA reference values are valid, established bases for the calculations.
- **A5** OpenFoodFacts is open data; BLS 4.0 is a licensed dataset.
- **A6** The matching experiment on current DB items is representative enough to guide the OFF/BLS strategy.
- **A7** Required API keys/config exist in the deployment environment.

---

## 11. Constraints

- **C-1** Must operate fully in German and English.
- **C-2** GDPR special-category health data with **no lawyer/DPO engaged** → deliberately conservative handling (explicit consent, minimization, deletion, disclaimer).
- **C-3** BLS 4.0 is licensable for production; the server license costs **€2,000/year**, which must be budgeted as an operating cost (resolved — see Q2).
- **C-4** No production domain yet (localhost + Supabase URIs only).
- **C-5** OpenFoodFacts coverage is inconsistent (~30% of items unmatched; macro data ~85% complete) and rate-limited.
- **C-6** BLS has **no NOVA/processing field**; processing signal comes only from OFF or the category table.
- **C-7** Added-sugar data is largely unavailable; total sugar is used as a proxy.
- **C-8** Nutrition must be grounded — the LLM never invents nutrition facts; the engine never diagnoses.
- **C-9** Receipts capture groceries only, not food eaten away from home.
- **C-10** Minimum user age 16.

---

## 12. Open Questions & Decisions Log

**Resolved (2026-07-13):**
- **Q1 Micronutrient reference source — RESOLVED:** use **DGE/EFSA** reference values (see FR-3.5, BR-M5). Exact micronutrient list to track still to be finalized.
- **Q2 BLS licensing — RESOLVED:** licensable for production; a **server license costs €2,000/year**, to be budgeted as an operating cost (see C-3). No blocker to using BLS.
- **Q3 Verified-match store scope — RESOLVED:** **global / shared**, de-identified (see BR-MT6).
- **Q9 Success-metric targets — CONFIRMED:** the targets in §9 are accepted.

**Still open (tbd):**
- **Q4 Added sugar** — source of added-sugar data to replace the total-sugar proxy in grouping (BR-G5).
- **Q5 Recipe data source** — curated set vs recipe API (post-MVP) for FR-10.3.
- **Q6 A/B feasibility** — is a formal A/B split viable at capstone user scale (SM5)?
- **Q7 Production deployment** — production domain and OAuth callback (FR-1.3).
- **Q8 Legal review** — medical-advice / medical-device boundary given health-data collection with no DPO (BR-Privacy).
