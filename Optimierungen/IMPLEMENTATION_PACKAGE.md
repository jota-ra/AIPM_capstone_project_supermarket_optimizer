# Nährbert — Implementation Package

*The single entry point that ties the requirements suite together. New synthesis sections (Architecture, NFRs, Edge cases, API, Data model, consolidated Open Questions) are given in full here; the large sections have authoritative companion files, summarized here with pointers.*

### Document map (authoritative sources)
| Section | Authoritative file |
|---|---|
| Product Overview, Functional Requirements, Business Rules, Open Questions | `naehrbert_prd.md` |
| Business Rules register (71 rules, 8 attributes) | `business_rules.md` |
| User Flows (16) | `user_flows.md` |
| Acceptance Criteria (20 features / 90+ scenarios, Gherkin) | `acceptance_criteria.feature` |
| Epic Breakdown (14) | `epics.md` |
| User Stories (65) | `user_stories.md` |
| Atomic Tasks (207) | `engineering_tasks.md` |
| Source of record (raw decisions) | `naehrbert_v2.md` |
| OFF-vs-BLS matching evidence | `matching_investigations.ipynb`, `bls_off_judgments.json` |

---

## 1. Product Overview

Nährbert turns German supermarket receipts into a personalized picture of what a person likely eats, compares it to science-based ideal targets, and returns grounded, adherence-aware recommendations for the next shop — with **no manual food logging**. Available in German and English.

It runs as a **continuous loop** (upload → match → review → status-quo → gap → next-cart), each cycle adding data. The engine has four layers: **physiological needs** (formulas + reference values), **estimated intake** (from receipts), **functional signals** (symptoms re-prioritize gaps), and **behavioral context** (how to deliver advice for adherence).

**Personas:** P1 goal-driven optimizer, P2 motivated home cook, P3 convenience-oriented user with functional symptoms. **Goals:** G1–G7 (estimate intake; personalized ideal profiles; gap + score; symptom/goal/behavior-aware recommendations; learn matching from corrections; motivate; DE/EN). **Non-medical:** provides nutrition information, never diagnosis. Full detail: `naehrbert_prd.md` §1–§4.

---

## 2. Architecture Assumptions

**Stack (existing, reused):**
- **Backend:** FastAPI (Python), service-oriented (`matcher.py`, `bls_matcher.py`, `nutrition_mapping.py`, `nutrition_snapshot.py`, `gap_detector.py`, `recommender.py`, `confidence.py`, `receipt_parser.py`, `off_api.py`, `exclusion_filter.py`). Blocking OFF/Gemini calls run in a threadpool.
- **Frontend:** responsive web, mobile-first (Vite + React + TypeScript + Tailwind; steps: `UploadStep`, `ReviewStep`, `ResultsStep`, `ProfileStep`); design tokens / first style guide referenced from the Lovable prototype. **Onboarding and the Level-2 questionnaire use a scripted conversational (chat) UI** — warm, expert tone, driven by static localized copy, **not** LLM-generated (B1).
- **Data/auth/storage:** Supabase — Postgres (via postgREST), Auth (email+password + Google), Storage (receipt images), Row-Level Security.
- **AI:** Google Gemini (`google-genai`) for receipt **extraction only** (vision + text → structured items). The LLM never produces nutrition numbers or diagnoses.
- **Nutrition data:** OpenFoodFacts REST (open, identity-strong) + BLS 4.0 (licensed, nutrient-complete incl. micros).

**Architectural principles (load-bearing):**
1. **Nutrition is deterministic** — all nutrition/scoring is rule-based; the LLM is confined to extraction (BR-MT8, C-8).
2. **Identity vs nutrition are separated** — OFF resolves *which food*, BLS supplies *what's in it*, under a type-agreement guard (BR-Matching).
3. **Provenance + dual confidence** travel with every nutrient value (source, identity_conf, nutrition_conf) and drive honesty labels.
4. **Learning loop** — a global, de-identified verified-match store (Tier 0) makes matching accuracy rise with use.
5. **Session → user auth migration** — the current `X-Session-Id` scoping is replaced by authenticated `user_id` scoping with RLS.
6. **Fail-soft** — matching degrades to a category estimate rather than erroring; storage failure is non-fatal; extraction errors are typed.

**Deployment:** **frontend on Vercel**, **backend on Render**, **Supabase** for DB/auth/storage — all pinned to **EU regions** (e.g. Render Frankfurt, Supabase EU) for GDPR data residency (A6/G1). Frontend builds as a static/SSR bundle; backend runs as a Render web service; secrets via platform env vars (not a committed `.env`). Production domain + the Google OAuth production callback are configured on the Vercel domain at deploy (Q7). Required keys (Supabase, Gemini) provisioned per environment.

**Integration constraints:** OFF ~30% unmatched + inconsistent macros + rate-limited (C-5); BLS licensed **€2,000/yr** for production (C-3), no NOVA field (C-6); Gemini has quota/latency/cost. Assumptions A1–A6 (household item volume, stockpile windows, formula validity, experiment representativeness) per `naehrbert_prd.md` §10.

---

## 3. User Flows

16 flows, each with Trigger · Steps · Decisions · Edge cases · Error handling · Exit conditions. Full detail: **`user_flows.md`**.

| ID | Flow | ID | Flow |
|---|---|---|---|
| F0 | The Loop (overarching) | F8 | Level-2 questionnaire (+consent) |
| F1 | Sign-up | F9 | Next-Cart recommendations |
| F2 | Login / returning session | F10 | Consumption / eaten feedback (A/B) |
| F3 | Onboarding — Level-1 profile | F11 | Dashboard (hub) |
| F4 | Receipt upload & extraction | F12 | Profile management & edit |
| F5 | Matching & review/correction | F13 | Data export (GDPR) |
| F6 | Status-quo attribution | F14 | Account deletion (GDPR) |
| F7 | Gap detection & results | F15 | Consent revocation |

---

## 4. Business Rules

71 rules across 12 families, each with Inputs/Outputs/Preconditions/Exceptions/Priority/Dependencies. Full register: **`business_rules.md`**. Families:

- **BR-Gen** conventions (dates/timezone, rounding, energy constants)
- **BR-E** energy (BMR → NEAT/EAT/TEF → TDEE → goal)
- **BR-M** macro/micro targets (protein/fat/carb/fiber/micros; energy densities)
- **BR-MT** matching tiers (Tier 0 learned → OFF → BLS → bridge → category; provenance; verified store)
- **BR-I** intake attribution (share/waste; daily rollup; occasion coverage)
- **BR-T** consumption timeframe (default → refine → correct)
- **BR-S** recommendation scoring (severity × confidence × symptom × goal; lookups; exclusions)
- **BR-G** item health grouping (3-tier + grey + missing-NOVA)
- **BR-HS** overall health score (closeness; weighted; renormalize; micro-gate)
- **BR-C** confidence model (per-item → snapshot; bands)
- **BR-P** privacy/GDPR (consent, minimization, erasure, retention, RLS, disclaimer, age)

Critical compute chain: `BR-E1→E3/E5→E2→E6→M1/M2→M3` and `BR-MT0a→MT0→MT1→MT2→MT3→MT5→C1→C2→HS3`.

---

## 5. Functional Requirements

Grouped FR-1…FR-12 (auth, onboarding, ideal-profile generation, receipt upload, matching, review, status-quo, eaten-feedback, gap detection, next-cart, dashboard, profile management) plus FR-embedded rules R-*. Full detail: **`naehrbert_prd.md` §5** (+ R-* in `business_rules.md`). Each FR maps to an Epic in §11 and a Gherkin Feature in §7.

---

## 6. Non-Functional Requirements

- **NFR-Performance:** extraction runs off the event loop (threadpool); OFF/BLS lookups cached (on-disk + per-product bridge cache, BR-MT7); OFF calls retry/back-off on 429/503; results screens render partial data rather than block.
- **NFR-Reliability:** matching never blocks the pipeline — degrades to category estimate (BR-MT4); storage-upload failure is non-fatal (FR-4.4); all extraction failures are typed (rate_limited / unavailable / invalid); recommendation-table load failure degrades to "no recommendation".
- **NFR-Security & Privacy:** Art. 9 health data under explicit consent (BR-P1); row-level security so users read only their own rows (BR-P5); encryption at rest (Supabase default); hard cascade erasure retaining only de-identified aggregates (BR-P3); image retention minimized (BR-P4); min age 16 (BR-P7); **EU data residency** across Vercel / Render / Supabase for Art. 9 data (A6/G1). No DPO engaged → conservative posture (C-2, Q8).
- **NFR-Scalability:** per-product bridge caching; global verified-match store aggregated by vote (one/user/key) with low-agreement flagging; reference data (BLS, RDA) loaded once/cached.
- **NFR-Usability & Accessibility:** warm-but-expert tone; DE/EN throughout; mobile photo capture + multi-file; clear empty/error/on-target states; non-blocking Level-2 prompt.
- **NFR-Maintainability:** deterministic rules with tunable constants in one config; provenance + confidence for auditability; the full traceability suite (PRD → rules → flows → AC → epics → stories → tasks) kept in sync by ID.
- **NFR-Observability:** analytics `events` (uploads, corrections `match_corrected`, adoption); match coverage / naive-accuracy metric (`/analytics/matching`); micro-coverage metric; confidence surfaced to users.
- **NFR-Cost:** BLS license €2,000/yr (production); Gemini + OFF usage bounded by caching.
- **NFR-Compliance:** persistent "not medical advice / never diagnose" wherever symptoms drive recommendations (BR-P6, NG1).
- **NFR-i18n:** locale-default + persisted switch; all UI/onboarding/Level-2/feedback copy localized DE/EN (C-1).

*(Baselines/targets: extraction & matching quality tracked via Success Metrics SM1–SM7, `naehrbert_prd.md` §9.)*

---

## 7. Acceptance Criteria

Executable Gherkin — **20 Features, 90 Scenarios + 15 Scenario Outlines** — importable into Cucumber/Behave/pytest-bdd. Full file: **`acceptance_criteria.feature`**. Tags: `@mvp` `@post-mvp` `@gdpr` `@blocked-Q1` `@blocked-Q4`. Each Feature notes its FR/BR/R IDs; enumerated rules (multipliers, thresholds, bands, discounts) are Scenario Outlines with Examples tables; worked calculation values (BMR 1782 → TDEE 2431) are pinned as assertions.

---

## 8. Edge Cases (consolidated)

**Profile/calculation:** non-binary/"prefer not to say" → mean of both BMR formulas; protein+fat exceed target → "constrained" (never negative carbs); age auto-updates from DOB; micronutrient targets deferred until DGE/EFSA list finalized (Q1).

**Extraction:** non-food-only receipt (all lines excluded); single receipt (snapshot mode, no daily intake); multi-image single receipt (out of scope, MVP); missing date/store (nullable); ambiguous units.

**Matching:** ~30% OFF unmatched; BLS-only item has no NOVA → grouped on sugar alone; type-disagreement → keep OFF values (guard); cold-start empty verified store; contested verified key (<50% agreement → not auto-served); one user's repeat purchases = one vote; normalization must match write↔read or Tier-0 silently misses.

**Intake/timeframe:** first-ever purchase (no repeat → category default); one-off/stockpiled item (only feedback corrects); shared household (÷N incl. user); waste applies to prior receipt; meals-outside/receipt-completeness must not double-count (confidence only).

**Gap/score:** unmeasured nutrient (confidence 0) excluded, never a fake 100% deficit; low-confidence basket → score shown with badge, not inflated; no-data dimensions dropped + weights renormalized; balanced basket → "on target"; trends hidden until enough data.

**Recommendations:** all candidates excluded by profile → "no suitable recommendation"; reduce suggestions only when over-consumed red items exist; no Level-2 → symptom multipliers default to 1.0.

**GDPR/consent:** decline Level-2 → app fully usable; prompt dismissed twice → stop inviting; revoke consent → disable Level-2 + hide inputs; deletion retains de-identified aggregate; expired session → re-login.

---

## 9. API Requirements

Authenticated via Supabase session (Bearer JWT) — replaces the legacy `X-Session-Id` header; every resource is scoped to the authenticated `user_id` and enforced by RLS.

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /auth/*` (Supabase client) | sign-up / login (email+pw, Google) | age gate ≥16 server-checked |
| `GET /profile` · `POST /profile` · `PATCH /profile` | read / create / edit Level-1 profile | PATCH triggers recompute |
| `POST /profile/level2` | persist Level-2 responses | requires consent |
| `POST /consent` · `DELETE /consent` | grant / revoke health-data consent | records timestamp + text version |
| `GET /profile/export` | GDPR export (JSON/CSV) | profile + receipts + derived |
| `DELETE /profile` | GDPR erasure | hard cascade; retains aggregate |
| `POST /receipts` | upload (multi-file) + extract | typed errors; storage non-fatal |
| `GET /receipts` | list user receipts | |
| `PATCH /receipts/{rid}/items/{iid}` | edit item / correct match | may write verified-match vote |
| `POST /receipts/{rid}/items/{iid}/match` | pin a manual match | writes verified-match vote |
| `GET /off/search` · `GET /bls/search` | manual product search | nutrition-bearing results only |
| `POST /consumption` | eaten/left/thrown update (variant B) | recomputes status-quo |
| `GET /nutrition/snapshot` | status-quo profile + gaps + score + grouping + confidence | core results payload |
| `GET /recommendations` · `POST /recommendations` | Next-Cart (with days/home-cooked inputs) | scored, exclusions applied |
| `POST /feedback` | recommendation feedback | |
| `GET /dashboard` | aggregate dashboard payload | composes snapshot + recs + counters |
| `GET /analytics/matching` | coverage / naive-accuracy / micro-coverage | ops metric |

External: OpenFoodFacts search (rate-limited, cached), BLS local dataset (cached), Gemini extraction (threadpool).

---

## 10. Data Model

Postgres (Supabase). **Per-user tables** enforce RLS (own rows only); the **verified-match store is global & de-identified** (no user FK) so learning is shared safely.

**profiles** (per-user) — `user_id` (FK auth) · form_of_address · sex_at_birth · dob · height_cm · weight_kg · exercise_frequency · daily_movement · full_meals · snacks · goal · dietary_style · allergies[] · dislikes[] · pregnancy_status · language · ab_variant · onboarding_state · consent_* .
**ideal_profiles** (derived, per-user) — calories/macros/micros targets + version (recomputed on change).
**receipts** (per-user) — id · user_id · date · store · items_count · scan_quality · storage_path (nullable).
**receipt_items** (per-user) — id · receipt_id (FK) · raw_name · normalized_name · quantity · unit · price · is_food · matched_product_id (FK) · source(off/bls/category) · identity_conf · nutrition_conf.
**products** (registry) — id · off_id / bls_code · name · brand · nutrition(json incl. micros) · nova · source.
**verified_matches** (GLOBAL, de-identified) — key(normalized_raw_text, store) · chosen_source · product_id · matched_name · nutrition · nova · user_vote refs (for one-vote-per-user + deletion) · winning_product · updated_at.
**consumption_timeframes** (per-user) — product_key · window_days · purchase_history[] .
**level2_responses** (per-user) — user_id · symptom/lifestyle fields · supplements[].
**consent** (per-user) — user_id · granted(bool) · timestamp · text_version.
**recommendations** (per-user) — id · user_id · items · scores · created_at.
**feedback** (per-user) — recommendation_id (FK) · response · comment.
**events** (analytics) — name · payload · user_id (for adoption/corrections).
**no_match_queue** — normalized_raw_text · store · frequency (ops backlog).
**micronutrient_rda** (reference, **Q1**) — age/sex/pregnancy → per-nutrient RDA.
**bls_products** (reference) — code · name · per-100g macros + micros.

Key relationships: `receipts 1—N receipt_items`; `receipt_items N—1 products`; `products ←→ verified_matches` (via product_id); `profiles 1—1 ideal_profiles / consent / level2_responses`. Deletion cascades all per-user rows + the user's verified-match votes; the aggregate winning-product mapping persists.

---

## 11. Epic Breakdown

13 MVP epics + 1 post-MVP, each with Goal · Scope · Dependencies · Deliverables · Complexity. Full detail: **`epics.md`**.

| Epic | Complexity | Epic | Complexity |
|---|---|---|---|
| E1 Accounts & Onboarding | M | E8 Next-Cart engine | M |
| E2 Ideal Profile Engine | M | E9 Functional Layer (Level-2) | M |
| E3 Receipt Ingestion | L | E10 Eaten-Feedback & Loop | M |
| **E4 Matching & Nutrition** | **XL** | E11 Dashboard | M |
| E5 Review & Learned Matching | L | E12 Profile Mgmt & GDPR | L |
| E6 Status-Quo & Consumption | L | E13 i18n (DE/EN) | M |
| E7 Gap/Score/Grouping/Confidence | L | E14 Post-MVP | XL |

**Critical path:** E1 → E2 → E3 → **E4** → E5/E6 → E7 → E8. Milestones: M1 personalized targets (E2), M2 receipt→nutrition (E4), **M3 first end-to-end** (E7), M4 recommendations (E8), M5 MVP complete (E13).

---

## 12. User Stories

65 stories (role/want/so-that + AC + Dependencies + Risks). Full detail: **`user_stories.md`**. Distribution: E1(6) E2(5) E3(6) E4(6) E5(5) E6(5) E7(5) E8(4) E9(4) E10(4) E11(4) E12(5) E13(2) E14(4). Each story's AC maps to a Gherkin scenario; Q-gated stories tagged.

---

## 13. Atomic Tasks

**207 tasks**, each 1–4 h, tagged FE/BE/DB/API/AI/TEST/DOC. Full detail: **`engineering_tasks.md`**. By discipline: BE 63 · TEST 60 · FE 43 · API 14 · DB 13 · DOC 12 · AI 2. Bottom-up estimate **≈ 435 h ≈ 7–8 weeks for a 2-dev team** (excludes Q1 RDA-table and Q5 recipe work, which cannot be sized yet).

---

## 14. Open Questions

**Resolved:** Q1 micronutrient source → **DGE/EFSA** (list still to finalize — gates BR-M5 & micro scoring); Q2 BLS license → **licensable, €2,000/yr** (budgeted, C-3); Q3 verified-match scope → **global/shared, de-identified**; Q9 success-metric targets → **confirmed**.

**Still open (tbd):**
- **Q1a** finalize the exact DGE/EFSA micronutrient list to track *(blocks micro targets/bars/score — E2-S4, E7-S3)*.
- **Q4** source of added-sugar data to replace the total-sugar proxy in grouping *(BR-G5)*.
- **Q5** recipe data source — curated vs API *(post-MVP, E14-S1)*.
- **Q6** A/B feasibility at capstone user scale + confirmed thresholds *(E10)*.
- **Q7** production domain + OAuth callback *(FR-1.3, deploy)*.
- **Q8** legal review of the medical-advice / medical-device boundary given health-data collection with no DPO *(BR-Privacy)*.

---

*This package plus its seven companion files form a complete, ID-traceable requirements set — every atomic task traces up to a story → epic → business rule / functional requirement → product goal, and the open-question gates are flagged consistently at every level.*
