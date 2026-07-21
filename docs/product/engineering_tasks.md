# Nährbert — Engineering Tasks

*Decomposition of every story in `user_stories.md` into implementation tasks of **1–4 h** each. Tag legend: **[FE]** frontend (Vite/React) · **[BE]** backend (FastAPI services) · **[DB]** Supabase schema/migration · **[API]** endpoint/external-API · **[AI]** Gemini/LLM · **[TEST]** · **[DOC]**. Estimates in hours. Existing modules referenced where reused.*

---

# E1 — Accounts & Onboarding foundation

### E1-S1 — Email + password sign-up
- [DB] Migration: add `auth`-linked `user_id` FK to `profiles`; add `weight/height/dob/sex/pregnancy` columns — 2h
- [BE] Wire Supabase email/password sign-up in an `auth` service; map to profile row — 3h
- [API] `POST /auth/signup` (or client-side Supabase) + session bootstrap endpoint — 2h
- [FE] Sign-up form + validation (email, password strength) — 3h
- [FE] Route existing-email → login — 1h
- [TEST] Scenarios: sign-up happy path, weak password, existing email — 2h
- [DOC] README: auth setup + env vars — 1h

### E1-S2 — Google OAuth
- [BE] Configure Supabase Google provider; callback handling — 2h
- [FE] "Continue with Google" button + OAuth redirect flow — 2h
- [FE] Handle cancel/failure → back to method choice — 1h
- [TEST] OAuth success + cancel scenarios (mocked) — 2h
- [DOC] Note prod callback URI as deploy TODO (Q7) — 0.5h

### E1-S3 — Age gate (≥16)
- [FE] Age/DOB confirmation step with denial message — 2h
- [BE] Server-side age validation (reject <16) — 1h
- [TEST] <16 denied, ≥16 proceeds — 1h

### E1-S4 — Persisted session & returning login
- [BE] Session verification middleware / dependency (replace `X-Session-Id`) — 3h
- [FE] Persist Supabase session; silent refresh; expired → login — 3h
- [FE] Login form (email/pw) — 2h
- [TEST] valid session skip, expired re-login, wrong creds — 2h

### E1-S5 — Level-1 onboarding walk-through
- [FE] Conversational (chat) onboarding shell — message list, typed turns, progress, back/edit (reuse AppShell tokens) — 4h
- [FE] In-chat input widgets per question type (pills, numeric, multi-select, free-text) rendered as chat turns — 4h
- [FE] Per-answer feedback as a chat reply bubble, bound to the localized copy map — 2h
- [BE] `ProfileCreate` model extension for all Level-1 fields — 2h
- [API] `POST /profile` persist full Level-1 profile — 2h
- [BE] Field validation (ranges for height/weight/age) — 2h
- [TEST] onboarding completion, validation, address-not-in-calc — 3h
- [DOC] Onboarding field spec + feedback-copy table structure — 1h

### E1-S6 — Profile persistence & resume
- [DB] `onboarding_state` / `profile_complete` flag column — 1h
- [BE] Save partial answers; compute complete/incomplete — 2h
- [FE] Resume at first unanswered step on login — 2h
- [TEST] resume mid-onboarding — 1h

---

# E2 — Ideal Profile Engine

### E2-S1 — BMR + additive TDEE
- [BE] `ideal_profile` service: Mifflin BMR (incl. non-binary mean) — 2h
- [BE] NEAT/EAT/TEF components + enum→value maps (BR-E3/E4) — 3h
- [BE] BR-Gen energy constants + rounding helpers — 1h
- [TEST] worked example (1782→2431) + NEAT/EAT/goal outlines — 3h

### E2-S2 — Goal adjustment → calorie target
- [BE] Apply goal % to TDEE — 1h
- [TEST] goal-adjustment outline — 1h

### E2-S3 — Macro targets
- [BE] Protein `max(activity, goal)`; fat `max(30%, 0.8g/kg)`; carbs remainder + constrained branch; fiber 14g/1000kcal — 4h
- [TEST] macro cases incl. negative-carb "constrained" — 2h
- [DOC] Macro-rule reference in code docstring — 0.5h

### E2-S4 — Micronutrient targets (DGE/EFSA) — @blocked-Q1
- [DB] `micronutrient_rda` reference table (age/sex/pregnancy) — 2h *(needs Q1 list)*
- [BE] Micro-target lookup + pregnancy adjustment; deferred flag until list present — 3h
- [TEST] RDA lookup + deferral behavior — 2h
- [DOC] Record Q1 dependency + interim (macros-only) — 0.5h

### E2-S5 — Recompute on change
- [BE] Recompute hooks on profile update + age-from-DOB at compute time — 2h
- [TEST] weight change recomputes; age rollover — 1h

---

# E3 — Receipt Ingestion

### E3-S1 — Multi-format, multi-file upload
- [FE] Upload component: file picker + camera capture, multi-select (extend UploadStep) — 3h
- [FE] Per-file "one receipt" handling + progress list — 2h
- [API] `POST /receipts` accept multipart, multiple files — 2h
- [TEST] format acceptance matrix (jpg/png/pdf/photo) — 1h

### E3-S2 — Extraction to structured items
- [AI] Extend Gemini prompt/schema in `receipt_parser.py` for date/store/count/items — 3h
- [BE] Parse response → structured items; run in threadpool — 2h
- [TEST] extraction on sample receipts (receipts/ dir) — 2h
- [DOC] Prompt + schema documentation — 1h

### E3-S3 — Unit normalization
- [BE] Canonical unit enum + normalizer {g,kg,ml,l,piece}; piece→grams via piece-weight table (reuse `nutrition_profile`) — 3h
- [TEST] unit normalization + piece conversion — 2h

### E3-S4 — Food vs non-food classification
- [AI] Prompt/schema field to flag non-food (Pfand/bag/discount) — 2h
- [BE] Filter non-food from nutrition; keep separate count — 2h
- [TEST] non-food exclusion (deposit, bag) — 2h

### E3-S5 — Typed errors & non-fatal storage
- [BE] Map parser errors → typed codes (rate_limited/unavailable/invalid); storage try/except non-fatal (reuse existing) — 2h
- [API] Error→HTTP status map (429/503/502) — 1h
- [FE] Error state UI per code — 2h
- [TEST] each error state + storage-fail-non-fatal — 2h

### E3-S6 — Data-sufficiency disclaimer
- [FE] Disclaimer panel with item-count/days tiers — 1h
- [DOC] Disclaimer copy (DE/EN) — 0.5h

---

# E4 — Matching & Nutrition Resolution (OFF + BLS)

### E4-S1 — BLS ingestion & cache
- [DB] `bls_products` table (code, name, per-100g macros+micros) OR keep cached json — 2h
- [BE] BLS loader → normalized records incl. micronutrient columns (extend `bls_matcher.py`) — 4h
- [BE] Cache build + fast in-memory index — 2h
- [TEST] BLS load + spot-check nutrient columns — 2h
- [DOC] BLS license note (€2k/yr) + data provenance — 1h

### E4-S2 — OFF identity tier
- [BE] Confirm thresholds (0.60/0.90) + usable-nutrition filter in `matcher.py` — 2h
- [API] OFF search hardening (retry/cache) in `off_api.py` — 2h
- [TEST] OFF confident/exact/no-match scenarios — 2h

### E4-S3 — BLS whole-food fallback
- [BE] Head-noun agreement + whole/raw gate (reuse `base_terms.py`) → BLS identity — 3h
- [TEST] produce recovery (Radieschen/Himbeeren) + false-accept guard — 2h

### E4-S4 — OFF→BLS nutrition bridge (guard + plain variant) ⚠ highest risk
- [BE] Type-agreement guard (same canonical category + head-noun stem) — 3h
- [BE] Plain-variant selection (no prep qualifier, shortest name) — 2h
- [BE] Borrow BLS macros+micros; keep NOVA from OFF; keep-OFF on disagreement — 3h
- [TEST] guard matrix incl. wrong-food rejections (Gouda≠Fleischkäse) — 3h
- [DOC] Guard rationale + failure modes — 1h

### E4-S5 — Category fallback + provenance + confidences
- [BE] Category estimate tier (reuse `fallback_categories.py`), conf 0.3, "unknown" — 2h
- [BE] Provenance tags + identity_conf/nutrition_conf on every value (extend `MatchedProduct`) — 3h
- [TEST] provenance + confidence assignment across tiers — 2h

### E4-S6 — Bridge caching & receipt totals
- [DB] `products` registry reuse; store bridged nutrition per product — 1h
- [BE] Compute bridge once/product; aggregate receipt totals (extend `nutrition_mapping.py`) — 3h
- [TEST] caching + totals correctness — 2h

---

# E5 — Review & Learned Matching

### E5-S1 — Editable review list
- [FE] Review rows: extracted text/product/qty/unit editable (extend ReviewStep) — 4h
- [API] `PATCH /receipts/{rid}/items/{iid}` update fields (exists — extend) — 2h
- [TEST] edit item fields — 1h

### E5-S2 — Dual-DB manual search
- [API] `GET /off/search` (exists) + `GET /bls/search`; nutrition-only filter — 3h
- [FE] Search UI (query → results from both, "use this") — 3h
- [TEST] nutrition-only filtering — 1h

### E5-S3 — Verified-match store & write triggers
- [DB] `verified_matches` table (raw_text, store, source, product_id, nutrition, nova, votes, user_id, updated) — 2h
- [BE] Write on explicit pick/correction/non-Tier-0 confirm; skip Tier-0 pass-through — 3h
- [TEST] write-trigger matrix — 2h

### E5-S4 — Tier-0 learned lookup
- [BE] Shared normalization fn (NFC→lower→strip→trim) used by write+read (BR-MT0a) — 2h
- [BE] Tier-0 lookup as first matching tier; exact vs store-agnostic confidence — 3h
- [TEST] Tier-0 hit skips fuzzy; normalization parity write/read — 2h

### E5-S5 — Conflict resolution & no-match queue
- [DB] Vote aggregation view; `no_match_queue` table — 2h
- [BE] One-vote/user, majority + most-recent tiebreak, <50% flagged — 3h
- [BE] Log no-match items with frequency — 1h
- [TEST] conflict cases (majority/tie/low-agreement); one-vote-per-user — 2h

---

# E6 — Status-Quo Profile & Consumption

### E6-S1 — Intake attribution questions
- [FE] Shared? → N (incl. you) → share % inputs — 2h
- [BE] `user_share` computation (BR-I2) — 1h
- [TEST] not-shared / shared-incl-user — 1h

### E6-S2 — External-intake → confidence (not intake)
- [BE] Route meals-outside + receipts-completeness to confidence discount only — 2h
- [TEST] no-double-count regression — 1h

### E6-S3 — Consumption-timeframe engine
- [DB] `consumption_timeframes` table (product_id/raw_text, window_days, history) — 2h
- [BE] Category default lookup (BR-T1) — 2h
- [BE] Repeat-purchase refine (mean of last 3 intervals, keyed) — 3h
- [BE] Feedback correction hook (BR-T3) — 2h
- [TEST] default→refine→correct paths; one-off items — 3h

### E6-S4 — Daily-intake rollup
- [BE] Per-item rollup Σ(nutrient×share×(1−waste))÷days (extend `nutrition_snapshot.py`) — 3h
- [TEST] rollup vs known fixture — 2h

### E6-S5 — Eating-occasion coverage
- [BE] total/tracked occasions from meals+snacks + eating-out midpoints (BR-I6) — 2h
- [FE] Coverage line on results — 1h
- [TEST] coverage calc + no-intake-scaling — 1h

---

# E7 — Gap Detection, Health Score, Grouping & Confidence

### E7-S1 — Confidence model
- [BE] Per-item + snapshot confidence (multiplicative), coverage tiers, discount tables, bands (extend `confidence.py`) — 4h
- [TEST] coverage tiers, band cutoffs, discount values — 2h

### E7-S2 — Gap detection & per-nutrient bars
- [BE] Per-sub-profile compare; target vs ceiling closeness; exclude conf-0 (extend `gap_detector.py`) — 4h
- [FE] Per-nutrient bars (green↔red, over-100) — 3h
- [TEST] target/ceiling closeness; missing-data excluded — 2h

### E7-S3 — Overall health score — @blocked-Q1 (micros)
- [BE] Weighted mean + renormalize dropped dims; micro weight 0 until Q1 (extend `nutrition_model.py`) — 3h
- [FE] Score card + confidence badge (no shrink) — 2h
- [TEST] renormalization; micro-gate; score+badge — 2h

### E7-S4 — 3-tier grouping
- [BE] NOVA+sugar tiers; grey no-data; missing-NOVA sugar-only (extend grouping) — 2h
- [FE] Grouping columns incl. "not enough data" (exists — extend) — 2h
- [TEST] grouping threshold outline; missing-NOVA — 2h

### E7-S5 — Drop/add, on-target, trends
- [BE] Drop = red items in worst over-dimension; add = top recs; on-target state — 3h
- [FE] Drop/add lists + on-target + trends charts — 3h
- [DB] Trend query over dated receipts — 1h
- [TEST] drop/add sources; on-target; trend gating — 2h

---

# E8 — Next-Cart Recommendation Engine

### E8-S1 — Scoring engine
- [BE] Score = severity×conf×symptom×goal; severity clamps; exclude conf-0 (extend `recommender.py`) — 4h
- [TEST] scoring + ranking + severity clamps — 2h

### E8-S2 — Goal relevance & exclusion filter
- [BE] Goal-relevance lookup; exclusion filter (reuse `exclusion_filter.py`) applied pre-scoring — 3h
- [TEST] goal multipliers; allergy/dislike/diet exclusion — 2h

### E8-S3 — Output structure & no-suitable state
- [BE] 1 primary + ≤2 alt + ≤2 reduce; reduce from red items; no-candidate state — 3h
- [FE] Next-Cart card (primary/alternatives/reduce) (exists — extend) — 2h
- [TEST] output structure; no-suitable; reduce-gating — 2h

### E8-S4 — Next-Cart inputs
- [FE] Days-to-shop + home-cooked frequency inputs — 2h
- [API] pass inputs to `/recommendations` — 1h

---

# E9 — Functional Layer (Level-2)

### E9-S1 — Health-data consent
- [DB] `consent` table (bool, timestamp, text_version) — 1h
- [BE] Consent capture + gate Level-2 processing — 2h
- [FE] Consent screen (explicit opt-in) — 2h
- [TEST] consent required; decline keeps app usable — 2h
- [DOC] Consent text (DE/EN) + versioning note — 1h

### E9-S2 — Level-2 questionnaire
- [DB] `level2_responses` table — 1h
- [FE] Non-blocking prompt + chat-style questionnaire (reuse the onboarding chat shell); re-invite cap flag — 4h
- [API] `POST /profile/level2` persist responses — 2h
- [TEST] non-blocking trigger; re-invite cap; skippable — 2h

### E9-S3 — Symptom-relevance prioritization
- [BE] Symptom→nutrient multiplier lookup (BR-S4); stack×cap 2.0; default 1.0 (wire into `recommender.py`) — 3h
- [TEST] symptom multipliers; default without Level-2 — 2h

### E9-S4 — Not-medical-advice safeguards
- [FE] Disclaimer wherever symptoms→recs — 1h
- [BE] Ensure no diagnosis path (diarrhea → defer copy) — 1h
- [TEST] disclaimer presence; never-diagnose — 1h

---

# E10 — Eaten-Feedback & the Loop (A/B)

### E10-S1 — Sticky A/B assignment
- [BE] Deterministic 50/50 user-id hash; store variant — 2h
- [TEST] determinism; sticky; never-both — 1h

### E10-S2 — Variant A (at next upload)
- [FE] Eaten/left/thrown prompt during extraction (variant A) — 3h
- [BE] Attach feedback to prior receipt — 2h
- [TEST] variant A with/without prior receipt — 2h

### E10-S3 — Variant B (daily dashboard)
- [FE] Dashboard consumption-update widget (variant B) — 3h
- [API] `POST /consumption` update — 1h
- [TEST] variant B update — 1h

### E10-S4 — Feedback → recompute
- [BE] Adjust remaining qty + waste_fraction → status-quo recompute — 2h
- [TEST] waste attribution + recompute — 2h

---

# E11 — Dashboard & Presentation

### E11-S1 — Dashboard hub & navigation
- [FE] Dashboard layout + nav into sub-flows (reuse Lovable tokens) — 4h
- [TEST] navigation smoke — 1h

### E11-S2 — Empty / new-user state
- [FE] Empty state + upload CTA — 2h

### E11-S3 — Score/detail/counter/ranking cards
- [FE] Cards bound to real data; partial-data rendering — 4h
- [API] `GET /dashboard` aggregate (or compose existing endpoints) — 2h
- [TEST] full + partial data render — 2h

### E11-S4 — Consumption entry & hidden comparisons
- [FE] Wire variant-B entry; hide cross-user cards (post-MVP flag) — 2h
- [TEST] comparisons hidden — 1h

---

# E12 — Profile Management & GDPR

### E12-S1 — Edit profile & recompute
- [FE] Edit-profile screen (all fields) — 4h
- [API] `PATCH /profile` + trigger recompute — 2h
- [TEST] edit recomputes; age from DOB — 2h

### E12-S2 — Data export
- [BE] Assemble profile+receipts+derived → JSON/CSV — 3h
- [API] `GET /profile/export` — 1h
- [FE] Export button + download — 1h
- [TEST] export completeness — 2h

### E12-S3 — Account deletion
- [BE] Cascade delete personal data + user's verified-match votes; retain aggregate — 3h
- [API] `DELETE /profile` + sign-out — 1h
- [FE] Delete confirmation flow — 2h
- [TEST] cascade completeness; aggregate retained — 2h

### E12-S4 — Consent revocation
- [BE] Revoke → disable Level-2 processing, hide inputs, multipliers→1.0 — 2h
- [FE] Revoke toggle — 1h
- [TEST] revoke disables Level-2; app usable — 1h

### E12-S5 — Retention, RLS & encryption
- [DB] Row-level security policies (own-rows only) on all user tables — 3h
- [BE] Post-processing image-deletion job (unless opted-in) — 2h
- [TEST] RLS access checks; retention job — 2h
- [DOC] Data-retention + security policy doc — 1h

---

# E13 — Internationalization (DE / EN)

### E13-S1 — i18n framework, default & switch
- [FE] i18n library setup; locale-default; switch + persistence — 3h
- [TEST] default-by-locale; switch persists — 1h

### E13-S2 — DE/EN content catalogs
- [FE] Extract all UI strings → DE/EN catalogs — 4h
- [DOC] Onboarding + Level-2 + feedback copy in DE/EN — 4h
- [TEST] no missing keys; both languages render — 1h

---

# E14 — Post-MVP enhancements *(deferred; high-level)*

### E14-S1 — Recipe engine & shopping list — @blocked-Q5
- [BE] Recipe source integration (curated/API) + filter by profile/gaps — 4h
- [BE] Recipe nutrition via resolver (grounded) + ingredient→product mapping — 4h
- [FE] Recipe selection + shopping-list UI — 4h
- [TEST] grounded nutrition; exclusion respected — 3h

### E14-S2 — Cross-user comparisons
- [DB] Anonymised aggregate percentile view — 2h
- [BE] Opt-in percentile computation — 3h
- [FE] Comparison cards — 2h

### E14-S3 — Health-app integration
- [BE] Google/Apple Health connector → NEAT/EAT — 4h
- [FE] Connect-health flow + permissions — 3h

### E14-S4 — Added-sugar thresholds — @blocked-Q4
- [BE] Swap total-sugar proxy for added-sugar in grouping — 2h
- [TEST] added-sugar grouping — 1h

---

# Infra & Deployment (cross-cutting) — Vercel + Render + Supabase (EU)

- [DB] Create Supabase project in an **EU region**; enable Auth (email+pw + Google) + Storage — 2h
- [DB] Migrations workflow (versioned SQL, apply on deploy) — 2h
- [BE] Deploy backend as a **Render web service (Frankfurt/EU)**; health check; env-var secrets — 3h
- [FE] Deploy frontend to **Vercel**; connect build; env vars — 2h
- [API] CORS + allowed origins for the Vercel domain; Supabase JWT verification — 2h
- [BE] Google OAuth **production callback** on the Vercel domain (Q7) — 1h
- [DB] Backups/restore policy + point-in-time recovery check (Supabase EU) — 2h
- [BE] Structured logging + error tracking + analytics-events sink (observability) — 3h
- [BE] API rate-limiting / abuse protection — 2h
- [DOC] Deploy runbook: environments (dev/staging/prod), EU-residency checklist, secrets, rollback — 2h
- [TEST] Smoke tests against staging (auth, upload, snapshot) in CI — 3h

*(Data residency: Vercel + Render + Supabase all EU-pinned for GDPR Art. 9 data — A6/G1. Gemini/PII processing region is a pre-launch gate — E1.)*

---

*Conventions: each task ≤ 4 h; split further if larger. Cross-cutting non-functional tasks (CI, error logging, analytics events, perf) are handled per-story via their [TEST]/[BE] items, plus the Infra & Deployment section above. Stories tagged @blocked-Q# cannot start until that open question resolves.*
