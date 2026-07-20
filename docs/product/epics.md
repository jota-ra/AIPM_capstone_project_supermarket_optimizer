# Nährbert — Implementation Epics

*Groups every requirement from `naehrbert_prd.md` / `business_rules.md` / `user_flows.md` / `acceptance_criteria.feature` into sequenced, demoable increments. Each Epic lists Goal · Scope · Dependencies · Deliverables · Estimated complexity.*

**Complexity scale:** S (≈days) · M (≈1 wk) · L (≈2 wks) · XL (≈3+ wks), for a 2-dev team. Estimates account for reuse of the existing NutriWise codebase where noted.

**Gating open questions:** **Q1** = DGE/EFSA micronutrient list (gates micro targets/score); **Q2** = BLS license (resolved: €2,000/yr) ; **Q4** = added-sugar source; **Q5** = recipe source.

---

## E1 — Accounts & Onboarding foundation

- **Goal:** a user can create an account and a Level-1 profile, and return to a persisted session.
- **Scope:** FR-1 (auth: email+password + Google, age gate ≥16, persisted session), FR-2.1–2.3 (onboarding walk-through, form of address, Level-1 inputs), §7 Level-1 inputs, R-SESSION, R-FEEDBACK (per-answer feedback wiring), BR-P7. Flows F1, F2, F3.
- **Dependencies:** none (foundation). *Reuse:* existing profile model/table (add auth, biometric fields, pregnancy).
- **Deliverables:** Supabase auth (both methods) + age gate; session persistence; onboarding UI with reassuring-feedback content hooks; profile schema + persistence; "resume incomplete onboarding" path.
- **Estimated complexity:** **M**

## E2 — Ideal Profile Engine (Level-1 calculations)

- **Goal:** turn a Level-1 profile into personalized ideal targets (calories, macros, [micros gated]).
- **Scope:** FR-3, BR-Gen1–3 (dates/rounding/energy constants), BR-E1–E6 (BMR→NEAT→EAT→TEF→TDEE→goal), BR-M1–M6 (protein/fat/carb/fiber/micro/energy densities), R-RECALC (recompute triggers). Flow F3 (calc step).
- **Dependencies:** E1 (profile inputs). **Micronutrient targets gated by Q1.**
- **Deliverables:** deterministic calculation service (unit-tested against the worked example: BMR 1782 → TDEE 2431 → target); "constrained macro" handling; recompute-on-change; ideal profile persisted as 3 sub-profiles (micros = calories+macros+fibre until Q1).
- **Estimated complexity:** **M** (S if micros stay deferred)

## E3 — Receipt Ingestion (upload + extraction)

- **Goal:** turn uploaded receipts into structured, food-only line items.
- **Scope:** FR-4, R-EXTRACT (fields + canonical unit enum), R-NONFOOD (food/non-food classification), R-FILE (one file = one receipt), FR-4.2 disclaimer, FR-4.4 typed errors + non-fatal storage. Flow F4.
- **Dependencies:** E1 (attach receipts to user). *Reuse:* existing Gemini parser (add unit normalization, food/non-food, one-file-one-receipt).
- **Deliverables:** multi-format/multi-file upload; extraction → {date, store, count, items(name/qty/unit/price)}; unit normalization to {g,kg,ml,l,piece}; food/non-food split; typed error states; data-sufficiency disclaimer.
- **Estimated complexity:** **L**

## E4 — Matching & Nutrition Resolution (OFF + BLS hybrid, automatic)

- **Goal:** resolve each item to a nutrition profile via the tiered hybrid (identity vs nutrition), automatically.
- **Scope:** FR-5, BR-MT0a (normalization), BR-MT1 (OFF identity + thresholds), BR-MT2 (BLS whole-food), BR-MT3 (OFF→BLS bridge + type-agreement guard + plain variant), BR-MT4 (category fallback), BR-MT5 (provenance + two confidences), BR-MT7 (per-product caching), BR-MT8 (never invent), R-CATTAX. Flow F5 (auto-match part). *(Tier-0 learned lookup ships dark here, populated in E5.)*
- **Dependencies:** E3; **Q2 (BLS license) required to ship BLS**; **Q1 for micros**. *Reuse:* OFF matcher + BLS matcher prototype from the investigation.
- **Deliverables:** BLS ingestion + cache; the ordered resolver with the type-agreement guard and plain-variant rule; provenance + confidence tagging; per-product bridge cache; nutrition totals per receipt.
- **Estimated complexity:** **XL** (correctness-critical tentpole)

## E5 — Review & Learned Matching (human-in-the-loop, Tier-0)

- **Goal:** let users correct matches, and learn from those corrections globally so accuracy rises with use.
- **Scope:** FR-6, BR-MT0 (Tier-0 lookup), BR-MT6 (verified-match store: global, de-identified, 1 vote/user, majority + most-recent tiebreak, <50% low-agreement), R-WRITE (write triggers). Flow F5 (review part).
- **Dependencies:** E4 (automatic tiers), E3. *Reuse:* existing review step, `match_corrected` events, products registry, manual pin.
- **Deliverables:** review UI (editable rows, dual-DB nutrition-only search, "no match"); verified-match store + voting/conflict resolution; Tier-0 lookup wired as first matching tier; no-match capture queue.
- **Estimated complexity:** **L**

## E6 — Status-Quo Profile & Consumption Model

- **Goal:** estimate what the user actually consumes per day from their receipts.
- **Scope:** FR-7, BR-I1–I6 (intake math, share, no-double-count, daily rollup, eating-occasion coverage), BR-T1–T3 (consumption timeframe: default → refine → correct). Flow F6.
- **Dependencies:** E4 (per-item nutrition), E3, R-CATTAX (from E4). Waste input comes from E10.
- **Deliverables:** attribution questions (shared/N/share); per-item consumption-timeframe engine + per-product table; daily-intake rollup; eating-occasion coverage line; status-quo 3 sub-profiles.
- **Estimated complexity:** **L**

## E7 — Gap Detection, Health Score, Grouping & Confidence

- **Goal:** show the user their nutritional picture — score, per-nutrient bars, item tiers — with honest confidence.
- **Scope:** FR-9, BR-HS1–HS4 (per-sub-profile compare, target/ceiling closeness, weighted score + renormalize + micro gate, show-with-badge), BR-G1–G6 (3-tier grouping + grey + missing-NOVA), BR-S2a (missing-data exclusion), BR-C1–C5 (the unified confidence model). Flow F7.
- **Dependencies:** E2 (ideal), E6 (status-quo), E4 (per-item confidence inputs). **Micro bars/score gated by Q1.** *Reuse:* existing snapshot/health-score/grouping (extend with ceiling math, confidence unification, renormalization).
- **Deliverables:** gap engine; health score 0–100 + confidence badge; per-nutrient bars (target vs ceiling); 3-tier + grey grouping; confidence model (per-item→snapshot, bands); trends when data permits; on-target and low-confidence states.
- **Estimated complexity:** **L**

## E8 — Next-Cart Recommendation Engine

- **Goal:** prioritized, profile-safe next-cart recommendations.
- **Scope:** FR-10.1–10.2, BR-S1 (formula + output structure), BR-S2/S2a (severity), BR-S3 (confidence term), BR-S5 (goal relevance), BR-S6 (exclusion filter). Flow F9. *(BR-S4 symptom relevance is enriched by E9; defaults to 1.0 without it.)*
- **Dependencies:** E7 (gaps, grouping, confidence), E2 (goal). *Reuse:* existing rule-based recommender (rescore + output structure).
- **Deliverables:** scoring engine; goal-relevance lookup; exclusion filter; output = 1 primary + ≤2 alternatives + ≤2 reduce; "no suitable candidate" state; days-to-shop / home-cooked inputs.
- **Estimated complexity:** **M**

## E9 — Functional Layer (Level-2 symptoms, consent, prioritization)

- **Goal:** personalize recommendation *prioritization* via symptoms, under explicit GDPR consent.
- **Scope:** FR-2.4 (non-blocking trigger), FR-2.5 (consent), §7 Level-2 inputs, BR-S4 (symptom-relevance lookup), BR-P1/P6 (consent record, disclaimer), R-L2TRIG. Flows F8, and the disclaimer parts of F7/F9.
- **Dependencies:** E7 (first gap analysis triggers it), E8 (feeds scoring). *Content-heavy (localized questions + feedback).*
- **Deliverables:** consent screen + record; Level-2 questionnaire (non-blocking, re-invite cap); symptom→nutrient multiplier wiring into E8; "not medical advice / never diagnose" enforcement.
- **Estimated complexity:** **M**

## E10 — Eaten-Feedback & the Loop (A/B)

- **Goal:** keep intake current across uploads and A/B the feedback UX; close the recurring loop.
- **Scope:** FR-8 (A: at next upload; B: daily), FR-11.7 (consumption update), R-EATEN (sticky 50/50 assignment), BR-I3 (waste), BR-T3 (feedback correction). Flows F0, F10.
- **Dependencies:** E3 (variant A at upload), E6 (feeds status-quo), E11 (variant B surface).
- **Deliverables:** both feedback variants; deterministic sticky assignment; consumption-update UI; waste/leftover capture feeding E6/E7 recompute.
- **Estimated complexity:** **M**

## E11 — Dashboard & Presentation

- **Goal:** the hub that ties the loop together and surfaces the outputs.
- **Scope:** FR-11.1–11.8 (score, macro/micro detail, upload, counter, item ranking, consumption update, edit, [recipes post-MVP]), empty states, trends display. Flow F11.
- **Dependencies:** E7 (score/detail), E8 (recs), E10 (consumption), E12 (edit entry). *Reuse:* Lovable prototype layout/design tokens.
- **Deliverables:** dashboard hub; empty/new-user state; cards wired to real data; navigation into all sub-flows; cross-user cards explicitly hidden (post-MVP).
- **Estimated complexity:** **M**

## E12 — Profile Management & GDPR compliance

- **Goal:** user control over their data + regulatory compliance.
- **Scope:** FR-12 (view/edit, language switch, delete, export), BR-P2–P6 (minimization, access/erasure, retention, encryption/RLS, disclaimer), consent revocation (F15), R-RECALC on edit. Flows F12, F13, F14, F15.
- **Dependencies:** E1 (profile), E5 (verified-store deletion nuance — retain aggregate), E9 (consent revocation).
- **Deliverables:** edit-profile (recompute on change); export (JSON/CSV); hard cascade delete (retaining de-identified aggregate); consent revocation toggle; retention job (delete images post-processing); row-level security + encryption.
- **Estimated complexity:** **L**

## E13 — Internationalization (DE / EN)  *(cross-cutting)*

- **Goal:** the whole app operates in German and English.
- **Scope:** C-1, R-LANG (locale default + persisted choice), R-FEEDBACK (localized per-answer feedback table), all UI + onboarding + Level-2 static copy. Flow F12 (language switch).
- **Dependencies:** cross-cutting — best delivered incrementally alongside E1 (onboarding copy) and E11 (UI), finalized last.
- **Deliverables:** i18n framework; DE/EN string catalogs incl. onboarding + feedback + Level-2 copy; locale-default + switch + persistence.
- **Estimated complexity:** **M**

## E14 — Post-MVP enhancements *(deferred)*

- **Goal:** enhancements beyond the MVP baseline.
- **Scope:** FR-10.3 (recipes + shopping list), cross-user comparisons (top x%, usage), Google/Apple Health import, added-sugar-specific thresholds (BR-G5 refinement).
- **Dependencies:** E8/E11; **Q5 (recipe source)**, **Q4 (added-sugar source)**.
- **Deliverables:** retrieval-based recipe engine + grounded recipe nutrition + shopping list; opt-in aggregated cross-user comparison; wearable/health integration; added-sugar grouping.
- **Estimated complexity:** **XL**

---

## Build sequence & milestones

| Phase | Epics | Milestone (demoable) |
|---|---|---|
| **P1 — Foundation** | E1, E2, E3 | **M1:** sign up → personalized ideal targets; upload → extracted items |
| **P2 — Core value** | E4, E5, E6, E7 | **M2:** receipt → nutrition (E4); **M3 (key):** first full end-to-end — upload → matched → daily intake → health score + grouping |
| **P3 — Recommendations & personalization** | E8, E9, E10 | **M4:** grounded Next-Cart recs; symptoms re-prioritize; loop closes across uploads |
| **P4 — Surface & compliance** | E11, E12, E13 | **M5 (MVP complete):** dashboard hub, full GDPR controls, DE/EN |
| **Post-MVP** | E14 | recipes, cross-user, health integrations, added sugar |

**Critical path:** E1 → E2 → E3 → **E4** → E5/E6 → E7 → E8. E4 is the tentpole (highest complexity + correctness-critical); protect it with the acceptance-criteria matching scenarios and the BLS/OFF investigation as the test oracle.

**Dependency notes:**
- Tier-0 learned matching is a mutual dependency between E4 (reads it) and E5 (writes it) — E4 ships tiers 1–3, E5 lights up Tier-0.
- Confidence model (BR-C) is consumed by E7 and E8 but sourced from E4 (per-item) + E6 (coverage/discounts) — land it in E7.
- E9's symptom multipliers enrich E8 but are not required for E8 to ship (default 1.0).
- **Q1 gates the micronutrient portions of E2 and E7** — both ship macros-first with micros dark until the DGE/EFSA list is fixed.
