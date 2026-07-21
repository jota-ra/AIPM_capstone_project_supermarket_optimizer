# Nährbert — Pre-Build Questions (client handoff, client now unreachable)

*We (the build team) reviewed the full package (`IMPLEMENTATION_PACKAGE.md` + 7 companion files). The logic/rules are unusually well specified. But several areas are still underdetermined enough that two independent teams would ship materially different products. Questions below are grouped by discipline and prioritized:*

- **P0 [DIVERGENCE]** — unanswered → two teams build materially different apps. Must resolve.
- **P1** — important; wrong guess is costly but recoverable.
- **P2** — minor; sensible defaults exist.

*Convergence assessment is at the end: we are **not** yet under the 5% divergence bar, and we identify exactly which P0s close the gap.*

---

## ✅ Client decisions received (2026-07-13)

| Q | Decision | Impact |
|---|---|---|
| **A1** | **Responsive web app** | Mobile-first responsive; no native/PWA store work |
| **A2 / B2** | Lovable prototype = **loose reference + first style guide** | We design screens using its tokens; client approval waived (client absent) |
| A3 | Disregard timeline/budget | — |
| **A6** | **Germany only** | DE authoritative (DGE values, German keywords); EU data residency required |
| **A7** | **Single-user accounts** | "Shared groceries" stays (household eaters) but no multi-account/family sharing |
| **B1** | **Chat-based UI** | Onboarding (and Level-2) become a **scripted conversational** flow — still static localized copy, *not* LLM-generated. Revises E1-S5 tasks toward a chat component |
| **D1** | **From DGE** | Baseline RDA table produced → `reference_data.md` §D1 (dietitian to verify) |
| **D2** | **LLM-assisted, our design** | Hybrid: static grounded table (MVP) + optional guarded LLM proposer → `reference_data.md` §D2 |
| **D3–D7** | **We produce** | Taxonomy, consumption windows, piece weights, symptom/goal lookups, allergen map → `reference_data.md` §D3–D7 |
| **E1** | **Flag as go-live topic** | Gemini/GDPR receipt-PII risk accepted for build; **must resolve before launch** (redaction / EU processing / DPA) |
| **G1** | **Vercel (frontend) + Render (backend)** | Must select **EU regions** (Render Frankfurt, Supabase EU) for GDPR; OAuth prod callback on the Vercel domain |

**Still open (owner needed, not blocking build start):** **A4/A5** — who provides dietitian sign-off (D1/D6), translations (DE/EN), and legal texts (privacy/terms/consent/disclaimer). These block *go-live*, not development. Plus P1 defaults below (B3–B8, C-series, D8–D12, E2–E7, F-series, G2–G8) — we proceed on documented sensible defaults.

---

## A. Product, scope & legal (cross-cutting)

- **A1 · P0 [DIVERGENCE]** — Target platform: responsive web app, installable PWA, or native mobile? The stack is web (Vite/React), but "photograph a receipt" implies mobile-first. This changes the entire UX and much of the FE/DevOps work.
- **A2 · P0 [DIVERGENCE]** — Is the `lovable_prototypes/src-grocery-shadow-ai` prototype the **canonical design** to match, a loose reference, or to be discarded? Two teams will produce very different UIs otherwise.
- **A3 · P0** — Timeline, budget, and launch date? MVP is ~435 h / 7–8 weeks for 2 devs excluding blocked items — is that acceptable, or must scope shrink?
- **A4 · P0** — Who owns/produces the **content deliverables** (see §D — RDA list, recommendation table, taxonomies, copy, translations, legal text)? If it's us, that's significant extra scope and expertise (dietitian, legal, translator).
- **A5 · P0** — Legal texts: privacy policy, terms, the Level-2 **consent copy**, and the "not medical advice" disclaimer wording — who authors and approves these (Q8, no DPO)? We cannot ship GDPR health-data collection without them.
- **A6 · P1** — Target geography/market — Germany only, DACH, EU? Affects data residency, language set, legal basis, and which reference values (DGE vs EFSA) are authoritative.
- **A7 · P1** — Business model / accounts: single-user only, or households/family sharing? "Shared groceries" implies multi-eater but not multi-account.
- **A8 · P2** — Support/feedback channel and app-store presence (if native/PWA).

## B. Design / UX

- **B1 · P0 [DIVERGENCE]** — Onboarding modality: the source says "the chat should feel warm… like talking to an expert." Is onboarding a **conversational chat UI** or a **step wizard** with friendly copy? These are completely different builds. (We assumed a wizard with static localized feedback; confirm.)
- **B2 · P0 [DIVERGENCE]** — Is there a full **visual design system** (brand palette beyond canvas/ink, typography, logo, spacing, components) or do we design it? Is "Nährbert" a **mascot/character** with a voice, or just a product name?
- **B3 · P0** — Screen inventory & navigation IA: exact screens, tab/nav structure, and the map between the 16 flows and concrete screens. Provide wireframes or approve ours?
- **B4 · P1** — Nutrient **bar visualization** spec: the 0→100(ideal)→over-100 bar — exact color gradient stops, how "over-consumption" is drawn, and the ceiling-nutrient variant.
- **B5 · P1** — Health-score presentation: dial/number/ring? How is the confidence badge shown alongside it?
- **B6 · P1** — Loading/empty/error state designs, especially the long extraction wait (see C3) and "no suitable recommendation" / "on target" states.
- **B7 · P1** — Accessibility target (WCAG 2.1 AA?), color-contrast, screen-reader, font scaling.
- **B8 · P2** — Tone/length guidelines and examples for the per-answer reassuring feedback; who signs off on tone across DE/EN?

## C. Frontend engineering

- **C1 · P0** — Extraction is a slow AI call. Is the FE model **synchronous request**, or **submit → poll/subscribe** for status? Websocket, SSE, or polling? This shapes the upload UX and the API (see G3).
- **C2 · P1** — Mobile camera capture: native `<input capture>`, in-app camera, client-side image compression/resizing before upload? Max file size/count per upload?
- **C3 · P1** — Per-field **validation ranges** for every numeric input (weight, height, age, meals, share %, etc.) — exact min/max/step.
- **C4 · P1** — i18n library and string-key conventions; who supplies the DE/EN catalogs (see A4)? Formatting (decimal comma vs point, units) per locale.
- **C5 · P1** — Charting library for weekly/monthly trends; offline behavior/caching expectations.
- **C6 · P2** — State management + routing conventions; design-token source of truth.

## D. Backend engineering — the reference-data packages (largest divergence risk)

*The rules are precise, but they consume lookup tables that are only partially specified. Without the exact contents, two teams produce different numeric outputs from identical logic.*

- **D1 · P0 [DIVERGENCE]** — The **DGE/EFSA micronutrient list + exact RDA values** by age/sex/pregnancy (Q1a). Which micronutrients are tracked, and their reference numbers? Gaps, scores, and recommendations all depend on this.
- **D2 · P0 [DIVERGENCE]** — The **recommendation candidate table**: for each gap dimension × status (e.g. `fiber:low`, `sugar:high`, `processed:high`, each micro), the exact list of candidate foods, their tags, action types, and rationale copy. This directly determines what the app recommends.
- **D3 · P0 [DIVERGENCE]** — The **canonical food-category taxonomy** (the exact category list) used by the category fallback, consumption-timeframe windows, and exclusion logic.
- **D4 · P0 [DIVERGENCE]** — The full **category → consumption-window table** (only 3 examples given: produce 3–7 d, dairy 7–10 d, staples 60–90 d). Every category needs a value.
- **D5 · P0 [DIVERGENCE]** — The **piece-weight table** (grams per "piece" per category/item) used for unit normalization; and the canonical unit-conversion rules for ambiguous German units.
- **D6 · P0 [DIVERGENCE]** — The **complete symptom → nutrient relevance lookup** and **goal → nutrient relevance lookup** (only representative rows are in BR-S4/S5). All symptom answers and all goals need explicit multipliers.
- **D7 · P0 [DIVERGENCE]** — The **allergen/intolerance → excluded-ingredient mapping** (how "peanuts" excludes candidate/recipe items; synonym handling, German terms).
- **D8 · P1** — Exact **data-sufficiency thresholds** for enabling daily intake and weekly/monthly trends (how many dated receipts / days minimum?).
- **D9 · P1** — Health-score **weights** are given as an example ("e.g. calories 20%…") — are those the committed weights or a placeholder?
- **D10 · P1** — Duplicate-receipt detection / idempotency on upload; how "store" names are normalized across chains (Edeka/EDEKA/E center…).
- **D11 · P1** — Migration of existing session-scoped data to authenticated users, if the current app's data must be preserved.
- **D12 · P2** — Pagination, receipt-history limits, ideal-profile version history retention.

## E. AI engineering

- **E1 · P0 [DIVERGENCE]** — **GDPR + Gemini:** receipts routinely contain personal data (loyalty IDs, partial card numbers, names, location/time). Is sending raw receipt images to Google Gemini acceptable under our lawful basis? Do we need redaction, an EU processing region, a DPA with Google, or an on-prem/EU OCR alternative? This can change the entire extraction architecture.
- **E2 · P0** — Model pinning: which exact Gemini model + version, and the **cost/latency budget** per extraction? Fallback model or degraded path on quota exhaustion?
- **E3 · P1** — Extraction **accuracy acceptance target** and the evaluation harness/gold set. What field-level accuracy is "good enough" to ship? Who provides labeled receipts?
- **E4 · P1** — Confirm matching stays **rule-based** (token similarity + head-noun), i.e. no embeddings/ML matcher — or is an ML matcher expected if accuracy targets aren't met?
- **E5 · P1** — Food/non-food classification: LLM-based or rule-based? Its accuracy target and failure handling.
- **E6 · P1** — Prompt ownership/versioning and how prompt changes are regression-tested (non-deterministic outputs).
- **E7 · P2** — Handling of poor-quality/rotated/partial images; multi-page/long receipts; non-German receipts.

## F. QA engineering

- **F1 · P0** — What is the **release gate** for matching quality? The success metrics (OFF ~71% etc.) are baselines, not pass/fail thresholds. What accuracy/coverage must the hybrid hit to ship?
- **F2 · P0** — Test data: do we get **real, labeled receipts** (with consent/anonymization) or must we synthesize them? Handling PII in test fixtures.
- **F3 · P1** — Golden fixtures for the deterministic formulas beyond the one worked example (BMR 1782) — will the client's dietitian confirm expected outputs for a set of profiles?
- **F4 · P1** — Performance/latency **SLAs** (extraction, snapshot, page loads) — none are specified; what are the targets to test against?
- **F5 · P1** — Browser/device support matrix; localization QA ownership for DE/EN correctness and tone.
- **F6 · P1** — How do we verify GDPR erasure completeness and RLS isolation (security test scope, pen-test expectations)?
- **F7 · P2** — Accessibility test level; load/concurrency targets.

## G. DevOps engineering

- **G1 · P0 [DIVERGENCE]** — Where does this run? Backend host (which cloud/PaaS/serverless), frontend host, and **data residency** — GDPR health data almost certainly requires an **EU region** for Supabase + compute + any AI processing. Confirm.
- **G2 · P0** — Environments (dev/staging/prod), CI/CD expectations, and the migrations workflow for Supabase schema changes.
- **G3 · P0** — If extraction is async (C1), do we need a **job queue/worker** infrastructure, or is a synchronous request with a long timeout acceptable?
- **G4 · P1** — Secrets management; Supabase plan/tier; **backups + restore** (RPO/RTO) for user data; DB monitoring.
- **G5 · P1** — Observability stack (logging, metrics, alerting, error tracking) and where analytics `events` are sent.
- **G6 · P1** — **Cost budget & limits** across Gemini, OFF, Supabase, and the BLS €2,000/yr license — who procures the BLS license and hosts the dataset compliantly?
- **G7 · P1** — Domain/DNS/TLS and OAuth production callback (Q7); rate-limiting / abuse protection on our API.
- **G8 · P2** — Uptime SLA / on-call expectations; DR plan.

---

## Convergence assessment

**Where the spec already forces convergence (low divergence):** the deterministic calculation chain (BMR→TDEE→macros), the matching tier order and type-agreement guard, the confidence model, the health-score/grouping formulas, the GDPR flow logic, the API resource shape, and the data model. Two teams following the rules would compute the **same numbers from the same inputs**. This is genuinely tight — credit to the spec.

**Where two teams still diverge materially today (we are NOT yet under 5%):** three clusters dominate the residual risk, and all are answerable:

1. **UX & platform (A1, A2, B1, B2, B3)** — biggest single divergence source. Chat-vs-wizard onboarding, mobile-vs-desktop, and "is the prototype canonical" mean two teams could ship apps that *look and feel like different products* even with identical logic. **Highest priority to resolve.**
2. **Reference-data packages (D1–D7)** — the rules are deterministic, but they read tables that aren't fully populated (micronutrient RDAs, recommendation candidates, category taxonomy, consumption windows, piece weights, symptom/goal multipliers, allergen mappings). Two teams *will invent different tables* → different recommendations, scores, and gaps from the same logic. **These convert "same logic" into "same behavior."**
3. **AI/GDPR processing boundary (E1) + data residency (G1)** — whether raw receipts may go to Gemini, and in which region, can force a different extraction architecture entirely.

**Our estimate:** with the current package alone, two independent teams would build **materially different applications (well above 5% — realistically near-certain)**, driven almost entirely by clusters 1 and 2 — *not* by the core logic, which is tight.

**To cross under the 5% bar, the minimum set that must be answered:** **A1, A2, B1, B2, B3** (locks the product's shape) and **D1–D7** (locks the behavior-defining data), plus **E1 + G1** (locks the extraction/compliance architecture). The remaining P1/P2 questions can ride on sensible, documented defaults without causing *material* divergence.

Absent the client, our recommendation is to **not begin implementation of clusters 1–2 until these are answered**; we can safely start the logic-heavy, well-specified backend epics (E2 Ideal Profile Engine, the E4 matching *engine* minus the data tables, the confidence/score math) against the deterministic rules while those answers are sought.

---

## Post-decision convergence update (2026-07-13)

The client's answers **closed all three material-divergence clusters:**
- **Cluster 1 (UX/platform):** resolved — responsive web (A1), chat-based UI (B1), prototype as style-guide reference (A2/B2), Germany-only single-user (A6/A7). Residual: exact screen wireframes (B3) — we design them on the prototype's tokens; not *material* divergence now that modality + platform + style are fixed.
- **Cluster 2 (reference data):** resolved — D1–D7 now exist in **`reference_data.md`** (deterministic tables + the D2 hybrid design). Two teams now read the *same* tables → same behavior.
- **Cluster 3 (AI/compliance):** architecturally fixed — Vercel+Render on **EU regions** (G1); Gemini/PII (E1) accepted for build, **flagged as a hard go-live gate**.

**Revised estimate:** for the **build**, two independent teams would now converge to **materially the same application** — we judge residual behavioral divergence **below the 5% bar**, because the product shape, the deterministic logic, and the data tables it consumes are all pinned. Remaining differences would be cosmetic (exact screen layouts) or non-behavioral (infra details), not "different applications."

**Two caveats that are go-live gates, not build blockers:**
1. **A4/A5 sign-off** — the RDA (D1) and symptom heuristics (D6) are a dietitian-review baseline, and the legal/consent texts (A5) are unwritten. The app can be *built and tested* on these, but must not *launch* to real users collecting health data until a dietitian and legal owner sign off.
2. **E1 Gemini/PII** — sending raw receipts (with personal data) to Google must be resolved (redaction / EU-region processing / DPA) before processing real users' receipts.

**Green light to build** the full MVP against `IMPLEMENTATION_PACKAGE.md` + `reference_data.md`; hold the two go-live gates for pre-launch.
