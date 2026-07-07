# NutriWise — Consolidated Roadmap

*This document merges `roadmap.md` and `codex_roadmap.md` into a single source of truth. Where the two files agreed, content was merged; where they diverged, both perspectives are kept and the conflict is flagged explicitly rather than silently resolved.*

## MVP Summary

NutriWise is a receipt-first nutrition assistant for health-conscious adults (25–45) who want better grocery decisions without manual food logging. In 3 weeks, a 2-person team builds a web app where a user uploads (or pastes the text of) one grocery receipt, answers a short profile (goal, age range, activity level, dietary pattern), and receives:

1. A nutrition snapshot estimated from grocery purchases (protein, fiber, sugar, calories, processed-food signal).
2. The top 1–3 likely nutrition gaps vs. a WHO baseline, in plain language.
3. Exactly **one** prioritized **Next Cart** recommendation — a specific product add, swap, or reduction actionable at the next shopping trip.
4. A plain-language "why this fits you" explanation tied to the user's profile and the specific gap, with a confidence label and data-source citation.
5. Up to 3 matching recipes for the recommended product (should-have).

Every output is transparently labeled "estimated from your shopping habits, not actual intake" — this directly addresses the core trust gap found across all 6 synthetic research personas in both source files.

**Core hypothesis:** passive behavioral reconstruction from receipt data, combined with a single clear decision, can meaningfully shift grocery behavior — without asking users to log food or change how they shop.

This is intentionally **not** a full nutrition tracker, household planner, performance optimizer, or medical advice tool.

## Learning Focus & Outcome Goals

- **Primary question:** do users trust an AI recommendation inferred from receipt data enough to act on it — specifically, to buy a different product next trip?
- **Secondary question:** is a single "Next Cart" action more motivating than a full nutrition dashboard?
- **Target outcome:** at least 30% of users adjust their next grocery purchase in line with the suggested improvement, without manual food tracking.
- **Qualitative success bar (from user testing):**
  - A user can go from upload/paste to result in under 2 minutes.
  - At least 70% of receipt items are parsed or categorized well enough to support a useful recommendation.
  - Users understand outputs are estimates, not exact intake or medical advice.
  - At least 3 of 5 test users say the Next Cart recommendation is specific enough to consider using.
  - At least 2 of 5 test users would upload a second receipt without being asked (the strongest trust signal).

**Positioning:** *"Upload a grocery receipt. Get one smarter thing to buy next time."* Avoid framing this as a calorie tracker, medical coach, meal planner, household manager, or performance platform.

## Consolidated Prioritization

| Feature | Priority | Source | Notes |
|---|---|---|---|
| Receipt upload (image) + text-paste fallback | Must Have | both | Entry point; text fallback is non-negotiable because OCR is unreliable |
| Product parsing/normalization | Must Have | both | |
| OpenFoodFacts mapping + fuzzy matching + fallback categories | Must Have | both | Highest technical uncertainty — mitigate with fuzzy matching, generic categories, caching |
| Lightweight profile onboarding (goal, age range, activity, dietary pattern) | Must Have | codex (feature also listed in roadmap's original feature list, but no epic existed for it) | <90 seconds, ≤5 questions |
| Nutrition dimension definitions + profile builder | Must Have | both | Rule-based heuristics, no ML |
| Gap detection engine (rule-based) | Must Have | both | Explicit call in roadmap.md: do **not** use ML here — rules are more trustworthy for an MVP |
| Next Cart recommendation engine | Must Have | both | Structured-data-constrained; LLM (if used) must not invent nutrition facts |
| Explainability layer (why + confidence + source) | Should Have (roadmap) / effectively Must Have (codex folds it into MVP) | both | Treat as Must Have — both files agree it's what makes recommendations credible |
| Basic results UI (upload → review → results → next cart) | Must Have | both | |
| Feedback capture ("would you buy this?") | Should Have | both | v1 = explicit yes/no/maybe; v2 = automatic adoption detection via next receipt |
| Recipe suggestions (3, matched to Next Cart item) | Should Have | roadmap (in original feature list) / codex (P2) | Secondary to the Next Cart action |
| Trust/disclaimer copy + GDPR consent | Must Have | both | "Not medical advice," no health data stored beyond session, consent on upload |
| Analytics/event logging | Should Have | both | Needed to evaluate the experiment, not to run it |
| Manual item-editing before analysis | Should Have | codex | Lets users correct parsed items |
| Sample receipt fixtures + graceful error states | Should Have | codex | Demo-safety net |
| Agent system (PO/Backend/Frontend/QA agents) | ⚠️ Conflicting — see [Epic 10](#epic-10--lightweight-agent-system-demo-layer--️-conflicting-priority) | roadmap: Should Have · codex: **Won't Have** | Resolve by treating as stretch-only |
| Task queue / orchestrator | Should Have (roadmap only) | roadmap | Only relevant if Epic 10 is attempted |
| Real supermarket integrations, barcode scanning, long-term memory, health-device integrations, advanced micronutrient modeling, payments | Won't Have | both | Explicitly out of scope for the 3-week MVP |

## 3-Week Build Plan

**Week 1 — Core Pipeline**
Receipt upload + paste-text fallback → parsing → product normalization → OpenFoodFacts integration + fallback categories → nutrition dimension definitions and scoring rules.

**Week 2 — Recommendation Experience**
Nutrition snapshot → rule-based gap detection → Next Cart recommendation logic → explanation + confidence labels → upload-to-results UI → item review/edit screen if time allows.

**Week 3 — Trust, Testing & Demo Readiness**
Feedback capture → basic analytics/logging → recipe suggestions if time allows → refine recommendation wording → test against real German supermarket receipts → fix OCR/matching failures → run 3–5 lightweight user tests → prepare demo script. This is also when the (optional, should-have) agent system and task queue would be attempted, if core work finished early.

**Technical approach note:** roadmap.md's file includes a later addendum considering an upgraded stack — **Claude Vision** for receipt OCR (instead of Tesseract) and the **USDA nutrition database** (instead of / alongside OpenFoodFacts). This wasn't fully specced into epics but is worth evaluating if OCR accuracy or OpenFoodFacts match rates prove to be the bottleneck during Week 1 testing.

---

# Epics, User Stories & Atomic Tasks

Ten epics below consolidate the two files' epic sets (roadmap.md's 7 epics + codex's 8 epics). Overlapping epics were merged; codex-only epics (Profile, dedicated Feedback/Validation, Analytics/QA/Demo) were added since roadmap.md's feature list referenced them without ever giving them an epic. Atomic tasks use roadmap.md's component-table format throughout, including new tasks written in that style to cover codex-only stories that had no corresponding task breakdown.

## Epic 1 — Receipt Input & Structured Data Pipeline

**Goal:** Let users provide grocery data with minimal effort, with a reliable fallback when OCR fails, producing a consistent structured schema for everything downstream.

**User Stories**

1.1 **Receipt Upload** — As a user, I want to upload a receipt image so the system can analyze my purchases automatically.
- Upload works via image or pasted text; API returns a structured receipt object + `receipt_id`.
- Common image formats accepted; loading state shown while processing.
- Clear error shown if the image can't be processed, with the text-fallback path visible from that error.

1.2 **Text Fallback** — As a user, I want to paste receipt text manually so I can still use the app when OCR fails.
- Raw text can be pasted into a field and pushed through the same analysis path as image uploads.
- Fallback is easy to find, not buried — OCR is explicitly called out as unreliable in both source files, so this is a **must-have**, not a nice-to-have.

1.3 **Item Review** — As a user, I want to review the detected receipt items before analysis so I can trust the result.
- Parsed item names are shown pre-analysis; unclear/unmatched items are not hidden.
- Noise (prices, formatting artifacts, quantities) is stripped from displayed names.

1.4 **Structured Product Extraction** — As a developer, I want a structured receipt schema so nutrition mapping receives consistent data regardless of input path (OCR or pasted text).

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 1.1 Upload API | `backend/api/upload_receipt.py` | image OR text | raw receipt object | HTTP 200 + stored `receipt_id` | curl upload returns `receipt_id` |
| 1.2 OCR / Text Fallback Parser | `services/receipt_parser.py` | image or raw text | list of raw product strings | ≥80% readable extraction on test receipts | sample receipt → product list |
| 1.3 Product Normalization | `services/normalize.py` | raw product strings | cleaned product names | removes prices, duplicates, symbols | "MILK 1.5L 1.29€" → "milk" |
| 1.4 Receipt Schema | `models/receipt.py` | parsed products | structured JSON | validated Pydantic schema | schema validation passes |
| 1.5 Sample Receipt Fixtures *(new)* | `fixtures/receipts/` | none | ≥2 sample receipts (clean + messy, image + text) | pipeline runs end-to-end on both | demo falls back to known-good sample if live OCR fails |

## Epic 2 — Product Normalization & Nutrition Mapping

**Goal:** Convert messy receipt items into usable nutrition data without blocking the flow when an exact match isn't available.

**User Stories**

2.1 **Nutrition Mapping** — As a system, I want to map grocery items to nutrition data via OpenFoodFacts so dietary composition can be understood, with missing items handled gracefully.

2.2 **Fallback Categorization** — As a user, I want unmatched products categorized approximately (dairy, grain, vegetable, snack, drink, protein) so one failed lookup doesn't break the whole result; fallback estimates are marked lower confidence.

2.3 **Match Quality Tracking** — As a developer, I want match quality (total / matched / fallback / failed items, match rate) logged so we know whether the pipeline is good enough for user testing. This is a **critical metric** per roadmap.md's own risk analysis.

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 2.1 OpenFoodFacts API Wrapper | `services/off_api.py` | product name | nutrition JSON | returns structured food data | "banana" → nutrition response |
| 2.2 Fuzzy Matching Engine | `services/matcher.py` | product string | best match + confidence | ≥60% match rate on sample receipts | "bio milk" → "milk" |
| 2.3 Fallback Category Mapper *(new)* | `services/fallback_categories.py` | unmatched product string | approximate category + low-confidence flag | no item blocks the pipeline | "unknown snack XYZ" → "snack" (fallback, low confidence) |
| 2.4 Nutrition Schema | `models/nutrition.py` | raw nutrition values | structured object | validated schema | Pydantic validation passes |
| 2.5 Match Quality Logger *(new)* | `analytics/match_quality.py` | receipt processing run | total/matched/fallback/failed counts + match rate | reviewable after a test session | known receipt → correct rate computed |

## Epic 3 — Lightweight User Profile & Personalization

**Goal:** Capture just enough context (goal, age range, activity level, dietary pattern, optional exclusions) to personalize recommendations, in under 90 seconds. *(codex-only epic — roadmap.md's feature list names this feature but never broke it into an epic or tasks; both are added here for completeness.)*

**User Stories**

3.1 **Quick Profile Setup** — As a user, I want to answer a few quick profile questions so the app avoids generic advice. Completes in <90 seconds, ≤5 questions; required fields limited to goal, age range, activity level, dietary pattern.

3.2 **Dietary Pattern & Exclusions** — As a vegan, vegetarian, or allergy-aware user, I want my dietary pattern and exclusions respected so recommendations never conflict with my choices.

3.3 **Skip Optional Details** — As a user, I want to skip nonessential questions (e.g., detailed biometrics) so I reach my receipt result quickly.

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 3.1 Profile Questionnaire UI *(new)* | `frontend/Profile.tsx` | none | goal, age range, activity level, dietary pattern, optional exclusions | completed in <90s, ≤5 questions | form submit returns profile object |
| 3.2 Profile Schema *(new)* | `models/profile.py` | questionnaire answers | structured profile JSON | validated Pydantic schema | schema validation passes |
| 3.3 Dietary Exclusion Filter *(new)* | `services/exclusion_filter.py` | profile exclusions + candidate recommendation | allowed/blocked decision | excluded foods never recommended | vegan profile + "add Greek yogurt" → blocked, alternate suggested |

## Epic 4 — Nutrition Snapshot & Gap Detection

**Goal:** Show a simple, estimated nutrition picture and the top 1–3 gaps in plain language — insight without dashboard overload.

**User Stories**

4.1 **Nutrition Snapshot** — As a user, I want a simple nutrition snapshot (protein, fiber, sugar, calories, processed-food signal) labeled as an estimate from purchases, shown with visual progress bars and a one-sentence "what this means" per dimension, avoiding medical/diagnostic language.

4.2 **Top Gaps vs. Baseline** — As a user, I want to see my top gaps (max 3) vs. a WHO baseline, generated via simple rule-based thresholds. **Explicit design decision from roadmap.md: do not use ML here — rules are more trustworthy for an MVP.**

4.3 **Uncertainty Explanation** — As a user, I want confidence labels and a plain statement that receipts don't capture eating out, shared food, or actual consumption, so I don't mistake grocery estimates for exact intake.

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 4.1 Nutrition Dimension Definitions | `nutrition_model.py` | config (none) | dimensions (protein, fiber, sugar, processed score, calories) + heuristic scoring functions | modular, reusable scoring | unit tests per dimension |
| 4.2 Nutrition Profile Builder | `services/nutrition_profile.py` | list of matched/fallback products | aggregated nutrition profile | sums + averages correct | 3 items → correct totals |
| 4.3 Gap Detection Engine | `services/gap_detector.py` | nutrition profile vs. WHO baseline | structured top-3 gaps | detects low fiber / high sugar / low protein diversity | low fiber input → "fiber gap" |
| 4.4 Gap Display Cards | `frontend/GapCards.tsx` | structured gaps | visual progress bars + one-sentence explanation | user comprehension confirmed in qualitative test | mock gaps → renders correctly |

## Epic 5 — Next Cart Recommendation System

**Goal:** Turn analysis into exactly one concrete, prioritized grocery action — specific, realistic, and constrained by structured data so nothing is hallucinated.

**User Stories**

5.1 **One Prioritized Recommendation** — As a user, I want one Next Cart recommendation so I know exactly what to buy or change next time. Framed as an addition, replacement, reduction, or rebalance — never generic advice — with cited reasoning and a confidence level.

5.2 **Recommendation Respects Constraints** — As a user with dietary restrictions, recommendations must fit my diet; if nothing suitable exists, the app says so rather than forcing a poor suggestion.

5.3 **Grounded, Non-Hallucinated Logic** — As a product team, recommendation logic must be constrained to known gaps, matched items, fallback categories, and profile constraints. **Explicit key risk from roadmap.md: the LLM must not invent nutrition facts — constrain it to structured inputs only, and use it for explanation wording, not new claims.**

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 5.1 Recommendation Mapping Table | `data/recommendations.json` | nutrition gaps | food suggestions | ≥5 mappings exist | fiber gap → lentils/oats |
| 5.2 Recommendation Engine | `services/recommender.py` | gaps + profile constraints | Next Cart item(s) | deterministic output; respects exclusions | same input → same output; vegan + fiber gap → non-animal suggestion |
| 5.3 Output Formatter | `models/next_cart.py` | recommendation | structured, UI-ready API response | frontend consumes cleanly | frontend renders from JSON |

## Epic 6 — Explainability & Trust Layer

**Goal:** Make every recommendation understandable and credible — why it was suggested, which gap it addresses, how confident the system is, and where the data came from. Both source files independently identify this as make-or-break for the core hypothesis.

**User Stories**

6.1 **Why This Fits You** — As a user, I want an explanation referencing my profile and the specific gap so I trust the recommendation. Every recommendation has an explanation; no hallucinated claims; short enough to read in seconds.

6.2 **Data Source & Confidence** — As a user, I want to see the data source (OpenFoodFacts) and a confidence label (low/medium/high, driven by match quality) so I understand how reliable the output is.

6.3 **Always-On Transparency** — As a user, every nutrition output carries "estimated from your shopping habits, not actual intake" — built-in, not optional (roadmap.md Feature 07).

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 6.1 Explanation Generator | `services/explainer.py` | recommendation + gap | human-readable explanation | consistent logic, no invented facts | "add oats" → fiber explanation |
| 6.2 Data Source Labeling | `services/source_labels.py` | nutrition data | "OpenFoodFacts" (or fallback-category) tags | visible in UI | label appears per item |
| 6.3 Confidence Tagging | `services/confidence.py` | match score (from fuzzy matcher / fallback) | confidence level (low/medium/high) | fuzzy match score affects tag | exact match → high, fallback category → low |

## Epic 7 — Results UI & User Flow

**Goal:** A focused end-to-end flow — upload → item review → profile → results → feedback — that surfaces the Next Cart recommendation as the clear primary outcome, scannable in under 5 seconds.

**User Stories**

7.1 **End-to-End Flow** — As a user, I want a clear step-by-step flow so I always know what to do next, completable without outside instructions.

7.2 **Scannable Results** — As a user, the results page should put the recommendation above detailed analysis, limit nutrition detail to the MVP dimensions, and avoid excessive charts.

7.3 **Visible Trust Copy & Consent** — As a user, I want visible "not medical advice" / "estimated from purchases" copy near every nutrition output, and I want my consent captured before upload (GDPR: no health data stored beyond session — roadmap.md Feature 08).

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 7.1 Upload Screen | `frontend/Upload.tsx` | image/text | API call to Upload API | `receipt_id` returned | file upload triggers backend |
| 7.2 Item Review Screen | `frontend/ItemReview.tsx` | parsed product list | confirmed/edited item list | user can correct items before analysis | edit item → updated list sent downstream |
| 7.3 Results Dashboard | `frontend/Results.tsx` | nutrition profile + gaps | visual cards | shows gaps correctly | mock API renders UI |
| 7.4 Next Cart UI | `frontend/NextCart.tsx` | recommendation + explanation + confidence | list UI | readable, trust copy visible | JSON → UI render |
| 7.5 Consent & Disclaimer Component *(new)* | `frontend/ConsentBanner.tsx` | none | GDPR consent capture on upload + persistent "not medical advice" disclaimer | consent recorded before upload proceeds | upload blocked until consent given |

## Epic 8 — Feedback Capture & Behavioral Validation

**Goal:** Measure whether users understand, trust, and intend to act on the recommendation — and, in v2, whether they actually did, by linking sequential receipts to a session. This epic directly instruments the MVP's core 30%-adoption hypothesis. *(Merges roadmap.md's "Experiment Tracking Layer" with codex's "Feedback and Validation".)*

**User Stories**

8.1 **Quick Feedback (v1)** — As a user, I want to answer "Would you consider buying this next time?" (yes/no/maybe + optional comment) so feedback takes no extra effort.

8.2 **Feedback Storage** — As a product team, I want recommendation-viewed events and yes/no/maybe responses stored, linked to the recommendation shown, so we can validate the hypothesis.

8.3 **Session Tracking (v2 groundwork)** — As a researcher, I want a persistent `session_id` across uploads so I can compare receipt N vs. N+1 and measure behavioral change over time.

8.4 **Adoption Scoring (v2)** — As a researcher, I want an adoption score (% recommended items actually purchased) and a nutrition delta (fiber ↑ / sugar ↓) so the intervention's effect is quantifiable. **Both files agree this is v2 scope** — the data model should support it, but it is not required for first MVP delivery.

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 8.1 Feedback Capture UI | `frontend/Feedback.tsx` | none | yes/no/maybe + optional comment | captured per recommendation shown | submit → stored record |
| 8.2 Feedback Storage | `database/feedback.py` | feedback response + `recommendation_id` | stored record | traceable to recommendation | fetch feedback by `recommendation_id` |
| 8.3 Session Management | `services/session.py` | user request | `session_id` | persistent ID across requests | same user → same session |
| 8.4 Receipt History Storage | `database/receipts.py` | receipt data | stored record | retrieval by `session_id` | fetch previous receipts |
| 8.5 Recommendation Storage | `database/recommendations.py` | Next Cart output | stored, linked record | traceable to receipt | join works correctly |
| 8.6 Receipt Comparison Engine *(v2)* | `analytics/comparator.py` | receipt N, receipt N+1 | overlap score | detects matched products | recommendation overlap computed |
| 8.7 Nutrition Delta Calculator *(v2)* | `analytics/nutrition_delta.py` | two nutrition profiles | delta metrics | fiber ↑ / sugar ↓ computed correctly | correct arithmetic changes |
| 8.8 Adoption Scoring Algorithm *(v2)* | `analytics/adoption_score.py` | recommendations + next receipt | % adoption score | interpretable 0–100% value | known overlap → correct score |

## Epic 9 — Analytics, QA & Demo Readiness

**Goal:** Make the MVP testable, explainable, and stable enough for a final demo — every pipeline stage should degrade gracefully instead of breaking the flow. *(codex-only epic, added because roadmap.md scattered these concerns across other epics' "Analytics" rows without giving them a home.)*

**User Stories**

9.1 **Event Tracking** — As a product team, I want basic event tracking (upload started/completed, analysis completed, recommendation viewed, feedback submitted, match rate) so we understand drop-off and pipeline health.

9.2 **Sample Fixtures** — As a developer, I want sample receipts (clean + messy, image + text) so the pipeline can be tested repeatedly and the demo can fall back to a known-good sample if live OCR fails. *(Shared with [Task 1.5](#epic-1--receipt-input--structured-data-pipeline).)*

9.3 **Graceful Error States** — As a developer, I want clear error states at every stage — OCR failure routes to paste fallback, match failure still allows a category-based recommendation, API failures show a useful message instead of a blank screen — so failures don't kill the demo.

9.4 **Demo Script** — As a project team, I want a demo script following the core loop (receipt input → item review → nutrition snapshot → Next Cart recommendation → feedback) that explains the hypothesis and limitations without promising post-MVP features.

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 9.1 Analytics Event Logger | `analytics/events.py` | event name + payload | stored event | all key events logged (upload_started, upload_completed, parsing_success, match_rate, recommendation_viewed, feedback_submitted) | trigger flow → all events present |
| 9.2 Sample Receipt Fixtures | *(see Task 1.5)* | — | — | — | — |
| 9.3 Error State Handling | `services/error_handler.py` + matching frontend states | pipeline failure at any stage | user-facing fallback message/path | no blank screens; OCR failure routes to paste fallback | simulate OCR failure → paste-fallback prompt shown |
| 9.4 Demo Script Document | `docs/demo_script.md` | none | step-by-step demo narrative + hypothesis/limitations framing | team can run full demo without ad-libbing | dry-run demo completes in target time |

## Epic 10 — Lightweight Agent System (Demo Layer) — ⚠️ Conflicting Priority

**Goal (per roadmap.md):** Simulate AI-assisted development using a minimal agent set (Product Owner, Backend, Frontend, QA) that wraps — never replaces — the real pipeline steps, purely for demo value.

> **Source conflict, kept intentionally visible:** roadmap.md scores this a "Should Have" (~2 days effort) and gives it a full epic + task queue. codex_roadmap.md explicitly places "multi-agent production workflow" under **Won't Have in 3-Week MVP**, judging it a distraction from the 2-person team's limited time.
>
> **Recommendation:** treat this as a stretch epic only. Build Epics 1–9 first; only attempt this if the core product is demo-ready with time to spare in Week 3. Agents must remain assistants inside the pipeline, not an autonomous system — this is roadmap.md's own explicit rule for the epic.

**User Stories**

10.1 **AI Development Simulation** — As a developer, I want AI agents to assist in generating structured development outputs (reviewable, deterministic, not autonomous) so we can demonstrate AI-assisted engineering.

**Atomic Tasks**

| Task | Component | Input | Output | Success | Test |
|---|---|---|---|---|---|
| 10.1 PO Agent Prompt | `agents/po.py` | roadmap | user stories JSON | structured stories | deterministic output |
| 10.2 Backend Agent Prompt | `agents/backend.py` | task spec | code snippet | runnable output | compiles/executes |
| 10.3 QA Agent Prompt | `agents/qa.py` | code + acceptance criteria | pass/fail | consistent evaluation | repeatable results |
| 10.4 Orchestrator Script | `orchestrator/run.py` | task queue (JSON/SQLite) | executed pipeline | end-to-end run | full flow completes |

---

## Cross-Epic Dependency Map

```
Receipt Upload/Paste (Epic 1)
   ↓
Product Normalization + OFF Mapping + Fallback Categories (Epic 2)
   ↓                                   ↖
Nutrition Profile + Gap Detection (Epic 4)   Profile Onboarding (Epic 3)
   ↓                                   ↗
Next Cart Recommendation (Epic 5) ←— (constrained by Epic 3 exclusions)
   ↓
Explainability + Confidence + Source (Epic 6)
   ↓
Results UI + Consent (Epic 7)
   ↓
Feedback Capture + Session/Adoption Tracking (Epic 8)
   ↓
Analytics, QA, Demo Readiness (Epic 9) — instruments every stage above
```

Epic 10 (Agent System) is orthogonal to this pipeline — it is tooling for *how the team builds*, not part of the user-facing product, which is why it's kept separate and marked optional.
