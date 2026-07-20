# Nährbert — Business Rules Register

*Extracted from `naehrbert_prd.md`. One row per rule. IDs mirror the PRD (BR-*) plus a small set of rules embedded in Functional Requirements (R-*). Nothing added beyond what the PRD states.*

**Priority legend:** **P1** = MVP-critical (core loop / correctness); **P2** = MVP quality/refinement; **P3** = Post-MVP / deferred.

---

## General conventions

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-Gen1 | Dates stored ISO-8601; day-boundary logic uses Europe/Berlin | Any date/timestamp | Normalized dates, consistent day boundaries | — | — | P1 | — |
| BR-Gen2 | Compute full precision; round only for display (calories→10 kcal, macros→1 g, score→integer, confidence→band) | Computed numeric value | Display-rounded value | A value to display | — | P1 | — |
| BR-Gen3 | All macro↔kcal conversions use BR-M6 constants | Macro grams / kcal | Converted value | — | — | P1 | BR-M6 |

## Energy (ideal calories)

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-E1 | BMR via Mifflin–St Jeor (sex-specific) | sex-at-birth, weight, height, age | BMR (kcal) | Level-1 profile complete | non-binary / "prefer not to say" → mean of male & female BMR | P1 | R-RECALC, FR-2.3 |
| BR-E2 | TDEE = BMR + NEAT + EAT + TEF | BMR, NEAT, EAT, TEF | TDEE (kcal) | BR-E1/E3/E4/E5 computed | — | P1 | BR-E1, E3, E4, E5 |
| BR-E3 | NEAT = BMR × movement% (0/10/20/35) | BMR, daily-movement selection | NEAT (kcal) | BMR computed, movement captured | — | P1 | BR-E1, FR-2.3 |
| BR-E4 | EAT added kcal/day by exercise-freq enum (none→0, one_two→100, three_four→250, five_six→400, daily_athlete→600) | exercise-frequency enum | EAT (kcal/day) | exercise freq captured | — | P1 | FR-2.3 |
| BR-E5 | TEF = 10% × (BMR + NEAT + EAT) | BMR, NEAT, EAT | TEF (kcal) | BMR/NEAT/EAT computed | — | P1 | BR-E1, E3, E4 |
| BR-E6 | Goal adjustment on TDEE (lose −15%, maintain 0, build +10%, aggressive +15%) → calorie target | TDEE, goal | Daily calorie target | TDEE computed, goal captured | — | P1 | BR-E2, FR-2.3 |

## Macronutrient & micronutrient targets

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-M1 | Protein g/kg = max(activity_value, goal_value) | body weight, exercise freq, goal | Protein target (g) | weight, exercise, goal captured | — | P1 | FR-2.3 |
| BR-M2 | Fat = max(30% of target kcal, 0.8 g/kg) | calorie target, body weight | Fat target (g) | calorie target computed | — | P1 | BR-E6, BR-M6 |
| BR-M3 | Carbs = max(0, target − protein_kcal − fat_kcal) | calorie/protein/fat targets | Carb target (g) or "constrained" flag | BR-E6, M1, M2 done | protein+fat ≥ target → hold protein, drop fat to 0.8 g/kg floor, carbs=0; still infeasible → flag "constrained" | P1 | BR-E6, M1, M2, M6 |
| BR-M4 | Fiber = 14 g per 1000 kcal of target | calorie target | Fiber target (g) | calorie target computed | — | P1 | BR-E6 |
| BR-M5 | Micronutrient targets = age/sex/pregnancy RDA (DGE/EFSA) | age, sex, pregnancy/breastfeeding | Micronutrient targets | Level-1 profile; finalized nutrient list | pregnancy/breastfeeding adjusts iron/calcium/folate; list not final → micro targets deferred | P1 (gated) | FR-2.3, Q1 |
| BR-M6 | Fixed energy densities (protein 4, avail-carb 4, fat 9, alcohol 7, fibre 2, organic acids 3, polyols 2.4 kcal/g) | nutrient grams | kcal | — | — | P1 | — |

## Product matching (identity vs nutrition; ordered tiers)

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-MT0a | Shared normalization for the match key (NFC → lowercase → strip qty/price/unit/store tokens → collapse ws → trim) | raw receipt text | normalized_raw_text | raw text extracted | — | P1 | R-EXTRACT |
| BR-MT0 | Tier 0 — learned lookup on (normalized_raw_text, store) first | normalized text, store, verified-match store | matched product @ conf 1.0, or fall-through | normalization done | no hit → BR-MT1; store-agnostic hit → lower confidence | P1 | BR-MT0a, BR-MT6 |
| BR-MT1 | Tier 1 — OFF identity search; confident = token-sim ≥ 0.60 (+usable nutrition); "exact" ≥ 0.90 | normalized name, OFF API | identity (name, brand, NOVA) + score, or fall-through | Tier 0 miss | no confident+usable hit → BR-MT2 | P1 | BR-MT0, C-5 (OFF) |
| BR-MT2 | Tier 1b — BLS generic head-noun match, whole/raw foods only | head-noun/base term, BLS data | identity for whole foods, or fall-through | Tier 1 miss | only whole/raw + head-noun agreement; else → BR-MT4 | P1 | BR-MT1, C-3 (BLS) |
| BR-MT3 | Tier 2 — OFF→BLS nutrient bridge; type-agreement guard; plain-variant pick; NOVA always from OFF | identity (category, head noun), BLS candidates | nutrient values (macros+micros, source-tagged) | identity known (MT1/MT2) | type disagreement → keep OFF's values; several plain candidates → shortest name | P1 | BR-MT1/MT2, MT5, C-3 |
| BR-MT4 | Tier 3 — category estimate, low confidence, "unknown" | canonical category | approximate nutrition @ conf 0.3, "unknown" flag | all higher tiers missed | — | P1 | BR-MT2, R-CATTAX |
| BR-MT5 | Provenance: source tag + identity_conf (match sim; verified 1.0, fallback 0.3) + nutrition_conf (OFF/BLS 1.0, category 0.3, absent 0) | match result, scores | per-value source, identity_conf, nutrition_conf | a match produced | — | P1 | BR-MT0–MT4 |
| BR-MT6 | Verified-match store: persist confirmed match; global de-identified, no user FK; 1 vote/user/key; winner = most votes, tie → most-recent; <50% → low-agreement (flagged, not auto-served) | confirmed match (raw text, store, source, product, nutrition, NOVA, user id) | verified record, vote counts, winning product per key | user confirmation/correction | <50% agreement → not auto-served | P1 | R-WRITE, BR-MT0a/MT0 |
| BR-MT7 | Compute OFF→BLS bridge once per distinct product (cached) | distinct product id | cached nutrient profile | BR-MT3 ran | — | P2 | BR-MT3, products registry |
| BR-MT8 | LLM never produces nutrition numbers (nutrition always grounded) | — (policy) | implementation constraint | — | — | P1 | C-8 |

## Intake attribution

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-I1 | intake = grocery_total × user_share × (1 − waste_fraction) | per-nutrient grocery total, user_share, waste_fraction | attributed intake per nutrient | matched nutrition + share/waste answers | — | P1 | BR-I2, I3, FR-5 |
| BR-I2 | user_share: not shared 100%; shared → 1/N (N incl. user), adjustable | shared? answer, N, optional manual share | user_share | status-quo question answered | — | P1 | FR-7.1 |
| BR-I3 | waste_fraction from next-upload question; applies to prior receipt; named items reduced individually else uniform | waste answer, prior receipt items | adjusted quantities / waste_fraction | prior receipt exists; next upload | no named items → uniform | P2 | FR-7.1, R-EATEN |
| BR-I4 | "Meals outside" & "receipts=all shopping" feed confidence, NOT intake (no double-count) | — (policy) | routing to BR-C4 | — | — | P1 | BR-C4 |
| BR-I5 | Daily rollup: daily intake/nutrient = Σ (item_nutrient × share × (1−waste)) ÷ item_consumption_days | per-item nutrient, share, waste, consumption_days | daily intake per nutrient | BR-I1 inputs + timeframe windows | — | P1 | BR-I1, BR-T1/T2/T3 |
| BR-I6 | Eating-occasion coverage: total = meals+snacks; untracked_share midpoints (5/20/40/65%); tracked_occasions — for coverage line, plausibility check, distribution tips | full_meals, snacks, meals-outside answer | coverage %, plausibility flag, tips | meals/snacks captured, meals-outside answered | does NOT scale intake; occasion-share ≠ nutrient-share | P2 | FR-2.3 |

## Consumption timeframe

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-T1 | Default window from category lookup (produce 3–7 d … staples 60–90 d); taxonomy = canonical categories | item canonical category | default consumption_days | item categorized | — | P1 | R-CATTAX |
| BR-T2 | Refine: repeat purchase → mean of last 3 inter-purchase intervals; key = matched_product_id (or raw_text+store) | purchase history per product | refined consumption_days | ≥2 purchases of same product | <2 purchases → BR-T1 default | P2 | BR-T1, BR-MT (product id) |
| BR-T3 | Correct: eaten/left/thrown feedback adjusts remaining qty; only signal for one-offs | consumption feedback | adjusted remaining quantity | feedback provided | — | P2 | R-EATEN, FR-11.7 |

## Recommendation scoring

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-S1 | Score = GapSeverity × Confidence × SymptomRelevance × GoalRelevance; rank; output 1 primary + ≤2 alternatives + ≤2 reduce | per-nutrient severity, confidence, relevances, candidate table | ranked recommendations (structured) | gaps computed, candidates filtered | no eligible candidate → "none" | P1 | BR-S2–S6, BR-Grouping, recommendation table |
| BR-S2 | GapSeverity ∈ [0,1]: deficit clamp((target−intake)/target); excess clamp((intake−target)/target) | target, intake | severity | target + intake estimate | see BR-S2a | P1 | BR-M*, BR-I5 |
| BR-S2a | Nutrient with snapshot confidence 0 excluded from gaps/scoring/health-score (never a 100% deficit) | snapshot confidence/nutrient | include/exclude decision | confidence computed | — | P1 | BR-C, BR-S2, BR-HS3 |
| BR-S3 | Confidence term = snapshot/nutrient confidence | BR-Conf output | confidence factor | BR-C computed | — | P1 | BR-Conf |
| BR-S4 | SymptomRelevance ≥1 from lookup (stack ×, cap 2.0) — e.g. constipation→fiber×1.6, hunger→protein×1.5 | Level-2 symptom answers | per-nutrient symptom multiplier | Level-2 answered | no Level-2 → all 1.0 | P2 | FR-2.4, Level-2 inputs |
| BR-S5 | GoalRelevance ≥1 from lookup (build→protein×1.5; fat loss→protein×1.4,fiber×1.3; maintain×1.1) | goal | per-nutrient goal multiplier | goal captured | — | P1 | FR-2.3 |
| BR-S6 | Dietary style / allergies / dislikes filter candidates before scoring | dietary style, allergies, dislikes, candidates | filtered candidate set | profile captured | — | P1 | FR-2.3, BR-S1 |

## Item health grouping

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-G1–G4 | Tier by NOVA+sugar: red = NOVA≥4 OR sugar≥20; green = NOVA≤2 AND sugar<10; else OK; no nutrition → grey "not enough data" | item NOVA, sugar g/100g | tier label | item nutrition (or lack) | missing NOVA → BR-G6; no nutrition → grey | P1 | BR-MT (nutrition), BR-G6 |
| BR-G5 | MVP uses total sugar as proxy for added sugar | total sugar | grouping input | — | added-sugar thresholds post-MVP | P1 (interim) | Q4 |
| BR-G6 | Missing NOVA (e.g. BLS-only) → group on sugar alone (green <10, red ≥20, else OK); both absent → grey | sugar g/100g | tier label | NOVA absent | both NOVA & sugar absent → grey | P1 | BR-G1–G4 |

## Overall health score

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-HS1 | Ideal & status-quo each = 3 sub-profiles (calories/macros/micros); gaps compared per sub-profile | ideal profile, status-quo profile | per-sub-profile gap comparison | both profiles computed | — | P1 | FR-3, FR-7 |
| BR-HS2 | Closeness 0–100: target nutrients penalize both directions; ceiling nutrients {sugar, sat fat, sodium} penalize over-limit only | intake, target/limit per nutrient | bar value, closeness | intake + target/limit | ceiling = over-only; calories over-target penalized like ceiling | P1 | BR-M*, BR-I5 |
| BR-HS3 | Overall = weighted mean of closeness (cal 20/prot 15/fat 10/carb 10/fiber 15/micros 30%); drop no-data dims + renormalize; micros gated on Q1 (weight 0 until list final) | per-dimension closeness, weights, confidence | health score 0–100 | closeness computed | no-data dims dropped; micros weight 0 until Q1 | P1 | BR-HS2, BR-S2a, BR-C, Q1 |
| BR-HS4 | Always display score WITH confidence badge; MVP applies no shrink | score, confidence | display | score + confidence computed | — | P1 | BR-HS3, BR-C5 |

## Confidence model

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-C1 | Per-item confidence = identity_conf × nutrition_conf; category fallback 0.3; unknown 0 | identity_conf, nutrition_conf | per-item confidence | match produced | — | P1 | BR-MT5 |
| BR-C2 | Snapshot/nutrient conf = data_conf × coverage_conf × completeness × external_intake_discount × alcohol_discount (multiplicative); data_conf = contribution-weighted mean of per-item conf | per-item conf, coverage, completeness, discounts | snapshot/per-nutrient confidence | BR-C1, C3, C4 | — | P1 | BR-C1, C3, C4 |
| BR-C3 | coverage_conf by item count (<20→0.2, 20–50→0.4, 50–100→0.6, 100–200→0.8, 200+→1.0) | matched item count | coverage_conf | item count known | — | P1 | — |
| BR-C4 | completeness = real-match share; external_intake_discount = meals-outside {1.0/0.85/0.70/0.60} × receipts-complete {1.0/0.85/0.70/0.50}; alcohol_discount 0.85 if weekly+ | match completeness, meals-outside, receipts-completeness, alcohol | completeness + discounts | status-quo answers; alcohol optional | no Level-2 alcohol → 1.0 | P1/P2 | FR-7.1, Level-2 |
| BR-C5 | Bands: <0.34 Low, 0.34–0.66 Medium, >0.66 High; surfaced everywhere | snapshot_conf | Low/Med/High label | BR-C2 computed | — | P1 | BR-C2 |

## Privacy & compliance (GDPR)

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| BR-P1 | Health data = Art. 9 special category; lawful basis = explicit consent, stored w/ timestamp + consent-text version | Level-2 consent action | consent record | user reaches Level-2 | — | P1 | R-L2TRIG, FR-2.5 |
| BR-P2 | Data minimization + purpose limitation; never sold; never used for cross-user ranking | — (policy) | processing constraint | — | — | P1 | — |
| BR-P3 | Access/portability + erasure: hard cascade delete of personal data incl. user's votes; de-identified aggregate mapping retained | delete/export request | data export / hard delete | authenticated user | aggregate mapping NOT deleted (no personal data) | P1 | BR-MT6, FR-12.3/12.4 |
| BR-P4 | Retention: delete raw receipt images after processing unless user opts to keep; derived rows kept while active | processed receipt | retention action | receipt processed | user opt-in to keep image | P2 | — |
| BR-P5 | Encrypted at rest + row-level security (user reads only own rows) | — (policy) | storage constraint | — | — | P1 | — |
| BR-P6 | Persistent "not medical advice / never diagnose" disclaimer wherever symptoms → recommendations | symptom-driven output | disclaimer shown | Level-2 recs displayed | — | P1 | NG1, BR-S4 |
| BR-P7 | Minimum age 16 at sign-up | DOB / age attestation | allow/deny sign-up | during registration | under 16 → deny | P1 | FR-1 |

## Rules embedded in Functional Requirements

| Rule ID | Description | Inputs | Outputs | Preconditions | Exceptions | Priority | Dependencies |
|---|---|---|---|---|---|---|---|
| R-EXTRACT | Extract per receipt: date, store, item count, and per item name/qty/unit/price; units → canonical enum {g, kg, ml, l, piece} | uploaded file(s) | structured receipt + items | valid upload | invalid image (no line items / bad MIME) → typed error | P1 | FR-4.3 |
| R-NONFOOD | Classify each line food vs non-food; only food enters matching/nutrition; non-food counted separately | receipt lines | food vs non-food split | extraction done | — | P1 | FR-4.5, R-EXTRACT |
| R-FILE | Each uploaded file = one receipt unless grouped in UI (one image per receipt for MVP) | uploaded files | receipt grouping | upload | multi-image single receipt out of scope (MVP) | P2 | FR-4.1 |
| R-RECALC | Ideal profile recomputes on any Level-1 change or age increment; status-quo recomputes on each upload + consumption update | profile edits, uploads, age | recomputed profiles | profiles exist | — | P1 | FR-3.7, FR-3, FR-7 |
| R-L2TRIG | Level-2 asked via non-blocking prompt on first results render; flag + re-invite ≤ once/session until done or dismissed twice; never a prerequisite | first results render, prompt state | Level-2 invitation | first gap analysis shown | dismissed twice → stop inviting | P2 | FR-2.4 |
| R-FEEDBACK | Per-answer onboarding feedback = fixed localized string per option (content, not generated) | answer option | localized feedback string | onboarding answer given | — | P2 | FR-2.1 |
| R-WRITE | Write to verified-match store on explicit selection / manual pick / confirm of non-Tier-0 match; passive Tier-0 pass-through does not vote | review action | verified-match write / vote | review step | Tier-0 pass-through → no vote | P1 | FR-6.4, BR-MT6 |
| R-EATEN | Eaten-feedback A/B: A at next upload, B daily dashboard; assign by deterministic 50/50 user-id hash, sticky | user id, feedback | variant assignment + consumption feedback | account created | never both variants | P2 | FR-8.1, BR-T3, BR-I3 |
| R-CATTAX | Canonical food-category taxonomy (shared by category fallback, timeframe windows, exclusion logic) | item | canonical category | item present | — | P1 | BR-MT4, BR-T1 |
| R-SESSION | Persisted Supabase session (silent refresh); no forced re-login; logout/expiry ends session | auth tokens | session state | authenticated | — | P2 | FR-1.2 |
| R-LANG | Default language = device locale if DE/EN else EN; explicit choice overrides + persists | device locale, user choice | active language | app start | — | P2 | FR-12.2 |

---

*Open dependencies that gate rules: **Q1** (DGE/EFSA micronutrient list → BR-M5, BR-HS3 micro scoring), **Q4** (added-sugar source → BR-G5). Post-MVP rules are out of this MVP register (recipes/shopping-list, cross-user comparison).*
