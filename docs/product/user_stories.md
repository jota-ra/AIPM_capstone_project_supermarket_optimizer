# Nährbert — User Stories

*Decomposition of every Epic in `epics.md` into ticket-level stories. Each: role/want/so-that · Acceptance Criteria (AC — cross-referenced to `acceptance_criteria.feature` where a scenario exists) · Dependencies · Risks. IDs are `E<epic>-S<n>`.*

---

# E1 — Accounts & Onboarding foundation

### E1-S1 — Email + password sign-up
- **As a** new user, **I want** to sign up with an email and password, **so that** I can create an account and save my data.
- **AC:** valid credentials create a Supabase account + persisted session → onboarding; weak/invalid password shows inline validation; an already-registered email routes to login. *(Feature: Authentication)*
- **Dependencies:** profile schema (E1-S5); Supabase project.
- **Risks:** password policy/UX; email-verification expectations unspecified.

### E1-S2 — Google OAuth sign-up & login
- **As a** new user, **I want** to sign up / log in with Google, **so that** I don't manage another password.
- **AC:** completing OAuth creates account + session; cancel/failure returns to method choice with a message.
- **Dependencies:** Google Cloud console config (per PRD, already set up).
- **Risks:** redirect URIs limited to localhost + Supabase (no prod domain — Q7); OAuth consent-screen review.

### E1-S3 — Age gate (≥16)
- **As a** platform owner, **I want** to block sign-ups under 16, **so that** we meet the GDPR minimum age.
- **AC:** age < 16 → denied with explanation, no account; ≥ 16 proceeds. *(Feature: Authentication — Reject users under 16; BR-P7)*
- **Dependencies:** E1-S1/S2.
- **Risks:** attestation vs. DOB captured later in onboarding — reconcile so they can't conflict.

### E1-S4 — Persisted session & returning login
- **As a** returning user, **I want** to stay logged in, **so that** I'm not forced to re-authenticate every visit.
- **AC:** valid session → dashboard without login; expired refresh token → re-login; logout ends session. *(R-SESSION)*
- **Dependencies:** E1-S1/S2.
- **Risks:** secure token storage; silent-refresh edge cases.

### E1-S5 — Level-1 onboarding walk-through
- **As a** new user, **I want** a guided, friendly walk-through, **so that** I provide the data needed for accurate targets without feeling interrogated.
- **AC:** step-by-step categories (address, sex-at-birth, DOB, height, weight, exercise, movement, meals/snacks, goal, diet, allergies, dislikes, pregnancy-if-applicable); a localized reassuring feedback string per answer; out-of-range inputs blocked; all answers editable later. *(Feature: Onboarding; R-FEEDBACK)*
- **Dependencies:** E1-S1/S2; profile schema; E13 (localized copy).
- **Risks:** localized-content volume; validation ranges undefined per field; pregnancy shown only for female profiles.

### E1-S6 — Profile persistence & resume
- **As a** user who quit mid-onboarding, **I want** my progress saved, **so that** I can resume rather than restart.
- **AC:** partial answers persist; next login resumes at the first unanswered step; completion computes the ideal profile (→E2).
- **Dependencies:** E1-S5.
- **Risks:** partial-state modeling; "complete vs incomplete" flag correctness.

---

# E2 — Ideal Profile Engine

### E2-S1 — BMR + additive TDEE
- **As a** user, **I want** my calorie baseline computed from my body and activity, **so that** targets reflect me.
- **AC:** BMR via Mifflin (worked example male 32/80/182 → 1782); NEAT = BMR×movement%; EAT by exercise enum; TEF = 10%×(BMR+NEAT+EAT); TDEE additive (→2431). *(Feature: Ideal profile calculation)*
- **Dependencies:** E1-S5.
- **Risks:** formula/enum-mapping errors; non-binary mean-of-both handling.

### E2-S2 — Goal adjustment → calorie target
- **As a** user with a goal, **I want** my calories adjusted for it, **so that** the target supports fat loss / maintenance / gain.
- **AC:** lose −15 / maintain 0 / build +10 / aggressive +15% applied to TDEE. *(Scenario Outline: Goal adjustment)*
- **Dependencies:** E2-S1.
- **Risks:** none material.

### E2-S3 — Macro targets (protein / fat / carbs / fiber)
- **As a** user, **I want** macro targets derived deterministically, **so that** I have concrete numbers.
- **AC:** protein = max(activity, goal) g/kg; fat = max(30% kcal, 0.8 g/kg); carbs = remainder floored at 0 with the "constrained" branch; fiber = 14 g/1000 kcal; energy constants per BR-M6. *(Feature: Ideal profile calculation — carbs never negative)*
- **Dependencies:** E2-S2.
- **Risks:** negative-carb edge; correct point-selection from ranges.

### E2-S4 — Micronutrient targets (DGE/EFSA)
- **As a** user, **I want** micronutrient targets for my age/sex, **so that** micro gaps can be detected.
- **AC:** single age/sex/pregnancy RDA per nutrient; **until Q1 finalizes the list, micro targets are deferred and only calories/macros/fibre are produced.** *(Scenario: micronutrient targets deferred; @blocked-Q1)*
- **Dependencies:** E1-S5; **Q1**.
- **Risks:** **blocked on Q1**; sourcing/curating the RDA table.

### E2-S5 — Recompute on change
- **As a** user, **I want** targets to update when I change my profile, **so that** they stay correct as I age or my weight changes.
- **AC:** ideal profile recomputes on any Level-1 change and age increment (age from DOB at compute time). *(R-RECALC; Feature: Profile management)*
- **Dependencies:** E1; E12 (edit surface).
- **Risks:** trigger coverage (missing a field that should recompute).

---

# E3 — Receipt Ingestion

### E3-S1 — Multi-format, multi-file upload
- **As a** user, **I want** to upload photos/PDFs of receipts (several at once), **so that** logging is effortless.
- **AC:** accepts jpg/jpeg/png/pdf/photo; multi-select; each file = one receipt. *(Feature: Receipt upload — Accepted formats, one receipt per file)*
- **Dependencies:** E1.
- **Risks:** large files / mobile capture; multi-image-single-receipt out of scope.

### E3-S2 — Extraction to structured items
- **As a** user, **I want** the app to read my receipt automatically, **so that** I don't type items.
- **AC:** extracts date, store, item count, and per item name/qty/unit/price. *(Feature: Receipt upload — Extract structured fields)*
- **Dependencies:** E3-S1; Gemini.
- **Risks:** OCR accuracy on faded/German receipts; Gemini quota/latency/cost.

### E3-S3 — Unit normalization
- **As a** developer, **I want** units normalized to a canonical enum, **so that** downstream nutrition math is consistent.
- **AC:** units → {g, kg, ml, l, piece}; piece → grams via piece-weight table; liquids per-100-ml, solids per-100-g. *(R-EXTRACT)*
- **Dependencies:** E3-S2.
- **Risks:** ambiguous/abbreviated units; piece-weight coverage gaps.

### E3-S4 — Food vs non-food classification
- **As a** user, **I want** deposits/bags/discounts ignored, **so that** my nutrition isn't polluted by non-food lines.
- **AC:** each line classified; non-food counted separately and excluded from nutrient math. *(Feature: Receipt upload — Non-food lines excluded)*
- **Dependencies:** E3-S2.
- **Risks:** misclassification; store-specific line formats (Pfand, Rabatt).

### E3-S5 — Typed errors & non-fatal storage
- **As a** user, **I want** clear messages when a scan fails, **so that** I know whether to retry.
- **AC:** rate-limited→retry, unavailable→try later, invalid image (no line items/bad MIME); storage-upload failure is non-fatal. *(Feature: Receipt upload — typed errors; FR-4.4)*
- **Dependencies:** E3-S2.
- **Risks:** error-taxonomy completeness.

### E3-S6 — Data-sufficiency disclaimer
- **As a** user, **I want** to know how much data yields what, **so that** I have realistic expectations from one receipt.
- **AC:** disclaimer shown on upload (item-count / days tiers). *(FR-4.2)*
- **Dependencies:** E3-S1.
- **Risks:** minor.

---

# E4 — Matching & Nutrition Resolution (OFF + BLS)

### E4-S1 — BLS ingestion & cache
- **As a** developer, **I want** BLS 4.0 loaded and cached, **so that** it can supply complete macros + micros.
- **AC:** BLS parsed to per-100g nutrition incl. micronutrients; cached for fast lookup.
- **Dependencies:** **Q2 (license — €2,000/yr, resolved)**.
- **Risks:** license terms for bundling; large-file parse; micro-column mapping accuracy.

### E4-S2 — OFF identity tier
- **As a** user, **I want** my items matched to the real product, **so that** nutrition reflects what I bought.
- **AC:** OFF candidate ≥ 0.60 token-sim + usable nutrition → identity; "exact" at ≥ 0.90; keep name/brand/NOVA. *(Feature: Product matching — OFF confident match)*
- **Dependencies:** none (OFF matcher exists).
- **Risks:** OFF ~30% unmatched, macro gaps, rate limits (C-5).

### E4-S3 — BLS whole-food fallback
- **As a** user, **I want** whole foods OFF misses to still resolve, **so that** produce/staples aren't lost.
- **AC:** whole/raw foods with head-noun agreement → BLS generic identity. *(Feature: Product matching — BLS whole-food fallback)*
- **Dependencies:** E4-S1.
- **Risks:** false accepts on branded/compound names — must stay whole-food-only.

### E4-S4 — OFF→BLS nutrition bridge (guard + plain variant)
- **As a** user, **I want** complete nutrition (incl. micros) on correctly-identified items, **so that** gaps are trustworthy.
- **AC:** borrow BLS macros+micros only when same canonical category AND head-noun stem; else keep OFF values; prefer plain "roh" variant, then shortest name; NOVA always from OFF. *(Feature: Product matching — type agreement, plain variant, NOVA from OFF)*
- **Dependencies:** E4-S1, E4-S2.
- **Risks:** **highest in the project** — a loose guard reintroduces BLS's 33% wrong-food problem; this is the correctness tentpole.

### E4-S5 — Category fallback + provenance + confidences
- **As a** developer, **I want** every item resolved with tracked provenance, **so that** confidence and honesty labels work.
- **AC:** all-tiers-miss → category estimate at conf 0.3, "unknown"; each value source-tagged; identity_conf + nutrition_conf recorded. *(Feature: Product matching — category fallback, provenance)*
- **Dependencies:** E4-S2..S4.
- **Risks:** inconsistent confidence assignment across tiers.

### E4-S6 — Bridge caching & receipt totals
- **As a** developer, **I want** the OFF→BLS bridge computed once per product and totals aggregated, **so that** performance and correctness hold.
- **AC:** bridge cached per distinct product; per-receipt nutrition totals computed. *(BR-MT7, FR-5.3)*
- **Dependencies:** E4-S4.
- **Risks:** cache invalidation when a product's mapping changes.

---

# E5 — Review & Learned Matching

### E5-S1 — Editable review list
- **As a** user, **I want** to see and fix what was matched, **so that** wrong matches don't skew my results.
- **AC:** each item shows extracted text/product/qty/unit, all editable. *(Feature: Review — editable list)*
- **Dependencies:** E4, E3.
- **Risks:** UX for long baskets.

### E5-S2 — Dual-DB manual search
- **As a** user, **I want** to search OFF and BLS myself, **so that** I can pick the right product.
- **AC:** search both; show only nutrition-bearing results. *(Feature: Review — nutrition-only results)*
- **Dependencies:** E4.
- **Risks:** live-search latency; API failure handling.

### E5-S3 — Verified-match store & write triggers
- **As a** developer, **I want** confirmed matches persisted, **so that** matching learns.
- **AC:** write on explicit selection / manual pick / non-Tier-0 confirm; passive Tier-0 pass-through does not vote. *(Feature: Review — manual pick writes; passive Tier-0 no vote; R-WRITE)*
- **Dependencies:** E5-S1/S2.
- **Risks:** over-/under-writing votes; schema for de-identified global store.

### E5-S4 — Tier-0 learned lookup wired first
- **As a** user, **I want** previously-corrected items auto-resolved, **so that** I don't fix the same thing twice.
- **AC:** exact (normalized_raw_text, store) hit → conf 1.0, skip fuzzy; store-agnostic → lower confidence; shared normalization for write + read. *(BR-MT0/MT0a)*
- **Dependencies:** E5-S3, E4, normalization (C1).
- **Risks:** normalization divergence between write and read paths → silent misses.

### E5-S5 — Conflict resolution & no-match queue
- **As a** platform owner, **I want** contested mappings handled and misses tracked, **so that** the shared store stays trustworthy.
- **AC:** one vote/user/key; winner = majority, tie → most-recent; <50% → flagged, not auto-served; no-match items logged with frequency. *(Feature: Review — conflict resolution, one vote per user)*
- **Dependencies:** E5-S3.
- **Risks:** vote gaming; cold-start (no votes yet).

---

# E6 — Status-Quo Profile & Consumption

### E6-S1 — Intake attribution questions
- **As a** user, **I want** to say how much of the groceries are mine, **so that** intake isn't overstated for a shared household.
- **AC:** not shared → 100%; shared → "people including you" (N) → default 1/N, adjustable. *(Feature: Status-quo — not shared / shared incl. user)*
- **Dependencies:** E4.
- **Risks:** "including you" comprehension.

### E6-S2 — External-intake questions feed confidence (not intake)
- **As a** developer, **I want** meals-outside and receipt-completeness to lower confidence only, **so that** intake isn't double-counted.
- **AC:** neither multiplies intake; both feed the confidence discount + a caveat. *(Feature: Status-quo — Meals-outside does not scale intake; BR-I4)*
- **Dependencies:** E7 (confidence model).
- **Risks:** double-count regression.

### E6-S3 — Consumption-timeframe engine
- **As a** user, **I want** stockpiled goods spread over time, **so that** one big shop isn't read as one day's eating.
- **AC:** category default → repeat-purchase refine (mean of last 3 intervals, keyed by product) → leftover-feedback correct; per-product timeframe table. *(Feature: Consumption timeframe)*
- **Dependencies:** E4 (product id), R-CATTAX, E10 (feedback).
- **Risks:** product-identity stability across receipts; one-off items.

### E6-S4 — Daily-intake rollup
- **As a** user, **I want** an estimated daily intake, **so that** it's comparable to daily targets.
- **AC:** daily/nutrient = Σ (item_nutrient × share × (1−waste)) ÷ consumption_days. *(Feature: Status-quo — daily rollup; BR-I5)*
- **Dependencies:** E6-S1/S3.
- **Risks:** rollup correctness; needs ≥ enough dated data.

### E6-S5 — Eating-occasion coverage
- **As a** user, **I want** to see what share of my meals is tracked, **so that** I trust the picture honestly.
- **AC:** total = meals+snacks; tracked-occasions line via eating-out midpoints; does not scale intake. *(Feature: Status-quo — coverage line; BR-I6)*
- **Dependencies:** E1 (meals/snacks input).
- **Risks:** misread as an intake multiplier.

---

# E7 — Gap Detection, Health Score, Grouping & Confidence

### E7-S1 — Confidence model
- **As a** user, **I want** an honest confidence label, **so that** I know how much to trust the numbers.
- **AC:** per-item = identity×nutrition (fallback 0.3); snapshot = product of 5 factors; coverage tiers; discount tables; bands <0.34/0.34–0.66/>0.66. *(Feature: Confidence model)*
- **Dependencies:** E4 (per-item), E6 (coverage/discounts).
- **Risks:** multiplicative product trends low → tune band thresholds.

### E7-S2 — Gap detection & per-nutrient bars
- **As a** user, **I want** to see where I'm under/over per nutrient, **so that** I know what to change.
- **AC:** per-sub-profile compare; target vs ceiling closeness; missing-data nutrients excluded. *(Feature: Gap detection — closeness, missing-data not a fake gap)*
- **Dependencies:** E2, E6.
- **Risks:** ceiling-nutrient math; excluding vs zeroing unmeasured nutrients.

### E7-S3 — Overall health score
- **As a** user, **I want** one 0–100 score, **so that** I get an at-a-glance sense of my basket.
- **AC:** weighted mean of closeness; drop no-data dims + renormalize; **micro weight 0 until Q1**; shown with confidence badge, no shrink. *(Feature: Gap detection — @blocked-Q1, score with badge)*
- **Dependencies:** E7-S1/S2; **Q1**.
- **Risks:** **Q1 gate**; weight tuning.

### E7-S4 — 3-tier item grouping
- **As a** user, **I want** items grouped Healthy/OK/Unhealthy, **so that** I can see what to shift.
- **AC:** NOVA+sugar thresholds; no-data → grey; missing NOVA → sugar-only. *(Feature: Item health grouping)*
- **Dependencies:** E4.
- **Risks:** BLS-only items lack NOVA.

### E7-S5 — Drop/add, on-target, trends
- **As a** user, **I want** clear "drop this / add that" plus trends, **so that** I know my next move and my direction.
- **AC:** add = top recs (from E8), drop = red items in the worst over-consumed dimension; on-target state; weekly/monthly trends when data permits; congratulate improvement. *(FR-9.3/9.5/9.6)*
- **Dependencies:** E8 (add side), E7-S4 (drop side).
- **Risks:** ordering dependency with E8.

---

# E8 — Next-Cart Recommendation Engine

### E8-S1 — Scoring engine
- **As a** user, **I want** recommendations prioritized by what matters most, **so that** advice is relevant, not generic.
- **AC:** Score = severity×confidence×symptom×goal; severity clamps; missing-data excluded; rank descending. *(Feature: Next-Cart — scored and ranked)*
- **Dependencies:** E7.
- **Risks:** severity definition for excess/ceiling; symptom term defaults to 1.0 pre-E9.

### E8-S2 — Goal relevance & exclusion filter
- **As a** user, **I want** recommendations that fit my goal and never violate my diet/allergies/dislikes, **so that** I can actually buy them.
- **AC:** goal multipliers applied; dietary style/allergies/dislikes filter candidates before scoring. *(Feature: Next-Cart — exclusions filter, goal relevance)*
- **Dependencies:** E2, E1.
- **Risks:** allergen/synonym coverage in the exclusion filter.

### E8-S3 — Output structure & no-suitable state
- **As a** user, **I want** a clear primary plus a few alternatives (and what to cut back), **so that** I'm not overwhelmed.
- **AC:** 1 primary + ≤2 alternatives (add/replace) + ≤2 reduce; "no suitable recommendation" when all excluded; reduce only when over-consumed red items exist. *(Feature: Next-Cart — output structure, no suitable candidate)*
- **Dependencies:** E8-S1/S2.
- **Risks:** reduce-suggestion sourcing from own basket.

### E8-S4 — Next-Cart inputs
- **As a** user, **I want** to say how long I'm shopping for and how much I cook, **so that** suggestions fit my plan.
- **AC:** days-to-shop + home-cooked frequency captured and used. *(FR-10.1)*
- **Dependencies:** none.
- **Risks:** minor; home-cooked scale undefined.

---

# E9 — Functional Layer (Level-2)

### E9-S1 — Health-data consent
- **As a** user, **I want** explicit control over sharing symptom data, **so that** my health data is only used with my permission.
- **AC:** explicit opt-in before Level-2 questions; consent record (bool + timestamp + text version); app fully usable without it. *(Feature: Level-2 — consent required, decline keeps app usable)*
- **Dependencies:** E7.
- **Risks:** **GDPR correctness with no DPO (Q8)**; consent-text versioning.

### E9-S2 — Level-2 questionnaire
- **As a** user, **I want** to optionally share how I feel, **so that** recommendations get smarter.
- **AC:** non-blocking prompt on first results; re-invite ≤ once/session, stop after two dismissals; each question skippable. *(Feature: Level-2 — non-blocking prompt, re-invite capped; R-L2TRIG)*
- **Dependencies:** E7, E9-S1.
- **Risks:** prompt fatigue; partial-answer handling.

### E9-S3 — Symptom-relevance prioritization
- **As a** user with symptoms, **I want** relevant nutrients prioritized, **so that** advice targets how I feel.
- **AC:** symptom→nutrient multipliers (stack ×, cap 2.0) feed E8; default 1.0 without Level-2. *(Feature: Next-Cart — symptom relevance; BR-S4)*
- **Dependencies:** E8, E9-S2.
- **Risks:** multiplier tuning; interaction with goal multipliers.

### E9-S4 — Not-medical-advice safeguards
- **As a** platform owner, **I want** clear non-diagnostic framing, **so that** we stay on the right side of the medical-advice line.
- **AC:** disclaimer wherever symptoms→recs; never diagnoses (e.g. diarrhea → defer to professional). *(Feature: Not medical advice)*
- **Dependencies:** E8, E9.
- **Risks:** compliance (Q8).

---

# E10 — Eaten-Feedback & the Loop (A/B)

### E10-S1 — Sticky A/B assignment
- **As a** product owner, **I want** users deterministically assigned to A or B, **so that** we can compare feedback UX.
- **AC:** 50/50 by user-id hash; sticky; never both. *(R-EATEN)*
- **Dependencies:** E1.
- **Risks:** sample size at capstone scale (Q6); assignment determinism.

### E10-S2 — Variant A (at next upload)
- **As a** user (variant A), **I want** to report leftovers when I next shop, **so that** intake reflects what I actually ate.
- **AC:** with a prior receipt, prompt eaten/left/thrown while extraction runs; no prior → no prompt. *(Feature: Eaten feedback — variant A, no prior receipt)*
- **Dependencies:** E3, E10-S1.
- **Risks:** timing/UX during extraction.

### E10-S3 — Variant B (daily dashboard)
- **As a** user (variant B), **I want** to update daily on the dashboard, **so that** tracking stays current.
- **AC:** dashboard consumption update available daily. *(FR-11.7)*
- **Dependencies:** E11, E10-S1.
- **Risks:** daily engagement.

### E10-S4 — Feedback → recompute
- **As a** user, **I want** my feedback to update my picture, **so that** results stay accurate.
- **AC:** eaten/left/thrown adjusts remaining quantity + waste_fraction → status-quo recompute. *(BR-T3, BR-I3)*
- **Dependencies:** E6.
- **Risks:** waste attribution correctness.

---

# E11 — Dashboard & Presentation

### E11-S1 — Dashboard hub & navigation
- **As a** user, **I want** a home screen tying everything together, **so that** I can act on my data.
- **AC:** cards + entry points into upload, consumption, edit, next-cart. *(FR-11)*
- **Dependencies:** E7, E8.
- **Risks:** layout/IA; reuse Lovable prototype.

### E11-S2 — Empty / new-user state
- **As a** brand-new user, **I want** a clear first step, **so that** I know to upload a receipt.
- **AC:** no-receipts state shows an upload CTA.
- **Dependencies:** E1.
- **Risks:** minor.

### E11-S3 — Score / detail / counter / ranking cards
- **As a** user, **I want** my score, nutrient detail, counts and item ranking, **so that** I see progress at a glance.
- **AC:** cards render from real data; partial data renders only available cards. *(FR-11.1–11.6)*
- **Dependencies:** E7.
- **Risks:** partial-data rendering.

### E11-S4 — Consumption entry & hidden comparisons
- **As a** user, **I want** to update consumption from the dashboard, **so that** I stay current; cross-user comparisons stay hidden in MVP.
- **AC:** variant-B consumption update present; "top x%"/usage comparisons hidden. *(Feature: Dashboard — cross-user hidden @post-mvp)*
- **Dependencies:** E10.
- **Risks:** minor.

---

# E12 — Profile Management & GDPR

### E12-S1 — Edit profile & recompute
- **As a** user, **I want** to view and change all my data, **so that** my profile stays accurate.
- **AC:** all Level-1/Level-2 data viewable/editable; changes recompute the ideal profile; age from DOB. *(Feature: Profile management)*
- **Dependencies:** E1, E2.
- **Risks:** recompute coverage.

### E12-S2 — Data export
- **As a** user, **I want** to export my data, **so that** I exercise GDPR portability.
- **AC:** profile + receipts + derived profiles as JSON/CSV. *(Feature: Data export)*
- **Dependencies:** E1.
- **Risks:** large datasets; ensuring export completeness.

### E12-S3 — Account deletion
- **As a** user, **I want** to delete my account and data, **so that** I exercise my right to erasure.
- **AC:** hard cascade delete of personal data incl. the user's verified-match votes; de-identified aggregate mapping retained; sign out. *(Feature: Account deletion)*
- **Dependencies:** E5 (verified-store nuance).
- **Risks:** **cascade completeness; accidentally deleting the shared aggregate**.

### E12-S4 — Consent revocation
- **As a** user, **I want** to withdraw health-data consent, **so that** I can stop symptom processing.
- **AC:** revoke disables Level-2 processing, hides inputs, reverts multipliers to 1.0; app stays usable. *(Feature: Consent revocation)*
- **Dependencies:** E9.
- **Risks:** partial-state; whether existing Level-2 data is retained vs deleted.

### E12-S5 — Retention, RLS & encryption
- **As a** platform owner, **I want** minimized retention and strict access control, **so that** we meet GDPR security expectations.
- **AC:** raw receipt images deleted post-processing unless opted-in; row-level security (own rows only); encryption at rest. *(BR-P4/P5)*
- **Dependencies:** E1.
- **Risks:** **RLS policy gaps; security correctness**; retention job reliability.

---

# E13 — Internationalization (DE / EN)

### E13-S1 — i18n framework, default & switch
- **As a** user, **I want** the app in my language, **so that** I understand it.
- **AC:** default to device locale if DE/EN else EN; explicit switch persists. *(Feature: Profile management — language default/switch; R-LANG)*
- **Dependencies:** E1.
- **Risks:** framework choice; RTL not needed but pluralization/format.

### E13-S2 — DE/EN content catalogs
- **As a** user, **I want** all copy localized, **so that** nothing appears in the wrong language.
- **AC:** UI + onboarding + Level-2 + per-answer feedback strings localized in DE/EN. *(C-1, R-FEEDBACK)*
- **Dependencies:** E1, E9, E11.
- **Risks:** **content volume; tone consistency ("warm but expert") across both languages**.

---

# E14 — Post-MVP enhancements

### E14-S1 — Recipe engine & shopping list
- **As a** user, **I want** recipes and a shopping list from my gaps, **so that** I know exactly what to buy and cook.
- **AC:** retrieval-based recipes filtered by profile/gaps; recipe nutrition grounded via the resolver; ingredients → buyable products → list; LLM never invents nutrition. *(FR-10.3)*
- **Dependencies:** E8; **Q5 (recipe source)**.
- **Risks:** recipe data source; grounding accuracy; ingredient→product mapping.

### E14-S2 — Cross-user comparisons
- **As a** user, **I want** to see how I compare, **so that** I'm motivated.
- **AC:** aggregated/anonymised "top x%" + usage comparisons, opt-in.
- **Dependencies:** E7, E11.
- **Risks:** privacy; demotivation; percentile with small N.

### E14-S3 — Health-app integration
- **As a** user, **I want** activity auto-imported, **so that** I skip manual entry.
- **AC:** Google/Apple Health steps/activity feed NEAT/EAT.
- **Dependencies:** E2.
- **Risks:** platform APIs/permissions.

### E14-S4 — Added-sugar thresholds
- **As a** user, **I want** grouping to use added sugar, **so that** naturally-sweet whole foods aren't penalized.
- **AC:** added-sugar thresholds replace the total-sugar proxy in grouping. *(BR-G5)*
- **Dependencies:** E7; **Q4 (added-sugar source)**.
- **Risks:** added-sugar data availability.

---

*Traceability: each story's AC maps to a Feature/Scenario in `acceptance_criteria.feature`; scope IDs trace to `epics.md` → `business_rules.md`/`naehrbert_prd.md`. Stories tagged with a Q-number are gated on that open question.*
