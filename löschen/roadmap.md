# MVP SUMMARY

NutriWise is a receipt-first nutrition coach that removes the #1 barrier to healthy eating: the effort of tracking. 
In 3 weeks, a 2-person team will build a web app where a user uploads one grocery receipt, answers 3 quick profile questions (goal, age range, activity level), and receives a nutrient gap analysis plus exactly one prioritized "Next Cart" recommendation — a specific product swap or addition they can act on at their very next supermarket visit — with a plain-language "why this fits you" explanation and 3 matching recipes. 

Every output is transparently labeled "estimated from your shopping habits, not actual intake" to address the core trust gap identified across all 6 synthetic research personas. 

The MVP proves one hypothesis: that passive behavioral reconstruction from receipt data, combined with a single clear decision, can meaningfully shift grocery behavior — without asking users to change how they shop or log anything manually.

## FEATURE LIST

**01 Receipt Upload + Parsing**: Photo or file upload → product extraction → Open Food Facts API matches nutrients

**02 3-Question Profile Onboarding**: Goal, age range, activity level — completes in under 90 seconds

**03 Nutrient Gap Analysis**: Top 3 gaps vs WHO baseline, visual progress bars, one-sentence "what this means" per gap

**04 Next Cart Engine**: 1 prioritized action — specific product, not generic advice — with cited reasoning and confidence level

**05 "Why This Fits You" Explanation**: LLM-generated, references user profile + specific gap — not a generic recommendation

**06 3 Recipe Suggestions**: Matched to the Next Cart action, each showing prep time and cost in EUR

**07 Transparency Layer**: "Based on estimated consumption from purchases" on every nutrition output — built-in, not optional

**08 GDPR Compliance**: "Not medical advice" disclaimer, no health data stored beyond session, consent on upload

## LEARNING FOCUS

The MVP exists to answer one question that both research files left unresolved: do users trust an AI recommendation inferred from grocery receipt data enough to act on it — specifically, to buy a different product on their next shopping trip? Secondary learning: is a single "Next Cart" action more motivating than a full nutrition dashboard? Success is not 5 users saying "I would use this." Success is 3 users who upload a second receipt without being asked.

## OUTCOME GOALS

In 3 weeks, health-conscious adults aged 25–45 will upload a supermarket grocery receipt and receive AI-generated “Next Cart” recommendations that map purchased items to an inferred nutrition profile and explicitly explain which nutritional gaps or excesses they address.

We will validate whether users trust and act on these recommendations by measuring whether at least 30% of users adjust their next grocery purchase in line with one suggested nutrition improvement (e.g., increasing fiber intake, improving protein coverage, or reducing overconsumption of specific categories), without requiring manual food tracking.

This experiment will validate whether passive grocery receipt data alone is sufficient to generate trusted, actionable nutrition guidance that leads to measurable changes in real-world grocery purchasing behavior without manual logging.

## 📘 ROADMAP
### 🚀 NOW (Week 1–2) — MVP that proves the hypothesis
🎯 Goal:

Prove that receipt → nutrition profile → next cart is possible and meaningful.

**1. Product Foundation**
Define nutrition dimensions:
protein
fiber
sugar
processed food score
calories estimate
Define “Next Cart” logic:
missing nutrients → suggestions
excess → reduction suggestions

**2. Receipt Ingestion Pipeline**
Upload receipt image (or text fallback)
Extract items (OCR or structured mock input)
Normalize products

**3. Nutrition Mapping Engine**
Map items → OpenFoodFacts
fallback heuristics if no match
build nutrition profile per receipt

**4. Gap Detection Engine**
compute:
“low fiber intake”
“high sugar consumption”
“low protein diversity”

**5. Recommendation Engine (“Next Cart”)**

Output:

To improve your diet:

+ Add: Greek yogurt (protein)
+ Add: lentils (fiber)
+ Replace: sugary cereal → oats

**6. Basic UI**
upload receipt
show:
nutrition summary
gaps
next cart recommendations

**7. Agent System (Minimal MVP version)**

Only 4 agents:

Product Owner
Backend Developer
Frontend Developer
QA Agent

**8. Task Queue**
simple JSON or SQLite
manual trigger or CLI

**9. MVP Success Criteria**
receipt uploads work
nutrition profile generated
recommendations shown
users understand output (qualitative test)

### ⚡ NEXT (Week 3) — Trust + Behavioral Change Layer
🎯 Goal:

Make recommendations credible enough that users actually follow them

**1. Explainability Layer**

For each recommendation:

We suggest adding lentils because:

✔ increases fiber by +18%
✔ improves satiety
✔ balances low vegetable intake in your receipt

**2. “Next Cart Simulation”**

Show:

- current cart nutrition
- improved cart nutrition
- delta visualization

**3. Trust Signals**

“Why this recommendation?”

“How confident are we?”

data source transparency (OpenFoodFacts)

**4. User Feedback Loop**

After recommendation:

“Would you buy this next time?”

“Did this change your intent?”

**5. Agent System Upgrade**

Add:

- Architect Agent
- AI/Nutrition Specialist Agent

Now:

PO → Architect → Devs → QA → Review

**6. Metrics Tracking**

Track:

- recommendation acceptance intent
- simulated cart change rate
- clarity score (user survey)

**7. Goal Validation Prep**

Instrument:

“Would you change your next grocery purchase based on this?”

### 🌍 FUTURE (After Project) — Scale & Intelligence
**1. Real grocery integrations**

REWE / Lidl / barcode scanning

**2. Personalization layer**

dietary preferences
goals (fat loss, muscle gain)

**3. Memory system**

longitudinal nutrition profile

**4. Smart shopping assistant**

auto-generated shopping lists
budget optimization

**5. Agent evolution**

self-improving recommendation agent
reinforcement learning from user feedback


Great—this is exactly the level where your project becomes *buildable instead of abstract*. I’ll break down your **NOW (Week 1–2 MVP)** into concrete engineering components with effort + risks.

I’ll keep it honest: this is scoped for **2 people / 2 weeks**, so I’ll also flag what is *optional vs critical*.

---

# 🚀 MVP FEATURE BREAKDOWN (NOW — Week 1–2)

---

# 1. Product Foundation (Nutrition Model + Logic)

### What this is

Defines how you convert groceries → nutrition → “good/bad gaps”.

---

| Area         | Description                                                                                                              | Effort   | Risks                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------ |
| Data / Model | Define nutrition dimensions (protein, fiber, sugar, calories, processed score). Simple heuristic scoring (no ML needed). | S (1–2d) | Wrong/too simplistic scoring reduces credibility |
| Backend      | Python module: `nutrition_model.py` with scoring functions                                                               | S (1d)   | Hard to extend if not modular                    |
| Frontend     | Optional early display of “nutrition categories”                                                                         | S (0.5d) | Might change often during iteration              |
| Integration  | Used by gap detection + recommendation engine                                                                            | S        | Dependency for everything downstream             |
| Analytics    | Log computed nutrition profiles per receipt                                                                              | S        | None                                             |

---

## ⚠️ Key insight

This is your **MOST IMPORTANT component**.
If this is weak, everything else collapses.

---

# 2. Receipt Ingestion Pipeline

### What this is

Turns receipt image/text → structured product list

---

| Area         | Description                                                                | Effort   | Risks                                     |
| ------------ | -------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| Data / Model | OCR via Tesseract / fallback manual input format (VERY IMPORTANT fallback) | M (3–5d) | OCR accuracy on receipts is unpredictable |
| Backend      | `/upload-receipt` endpoint (FastAPI) + parser module                       | M (3d)   | File handling + parsing edge cases        |
| Frontend     | Upload UI (image upload + “paste text fallback”)                           | S (1–2d) | UX confusion if OCR fails                 |
| Integration  | Pipe output → Nutrition Mapping Engine                                     | S        | Format mismatches                         |
| Analytics    | Track OCR success vs fallback usage                                        | S        | None                                      |

---

## ⚠️ Key risk

OCR is unreliable → **you MUST implement fallback text input**

---

# 3. Nutrition Mapping Engine (OpenFoodFacts)

### What this is

Maps product names → nutrition data

---

| Area         | Description                                                  | Effort   | Risks                                        |
| ------------ | ------------------------------------------------------------ | -------- | -------------------------------------------- |
| Data / Model | OpenFoodFacts API matching logic + fuzzy matching heuristics | M (4–5d) | Product name mismatch is major failure point |
| Backend      | `/map-products` endpoint + caching layer                     | M (3d)   | API rate limits + slow responses             |
| Frontend     | Show matched/unmatched items                                 | S (1d)   | UX clutter                                   |
| Integration  | Connect receipt parser → nutrition model input               | S        | Pipeline fragility                           |
| Analytics    | Match rate (% products resolved)                             | S        | Critical metric                              |

---

## ⚠️ Key risk

This is your **highest technical uncertainty area**

Mitigation:

* fuzzy matching
* fallback “generic food categories”
* caching results locally

---

# 4. Gap Detection Engine

### What this is

Turns nutrition profile → insights

---

| Area         | Description                                  | Effort   | Risks                             |
| ------------ | -------------------------------------------- | -------- | --------------------------------- |
| Data / Model | Rule-based thresholds (e.g. fiber < X = low) | S (1–2d) | Over-simplification reduces trust |
| Backend      | `/detect-gaps` service                       | S (1d)   | Must align with nutrition model   |
| Frontend     | Display “nutrition gaps” cards               | S (1–2d) | Misinterpretation by users        |
| Integration  | Input = nutrition profile output             | S        | Tight coupling risk               |
| Analytics    | Track most common gaps                       | S        | None                              |

---

## ⚠️ Key insight

DO NOT use ML here. Rules are better for MVP trust.

---

# 5. Recommendation Engine (“Next Cart”)

### What this is

Core value: what user should buy next

---

| Area         | Description                                                         | Effort   | Risks                         |
| ------------ | ------------------------------------------------------------------- | -------- | ----------------------------- |
| Data / Model | Prompt-based recommendation logic OR rule engine + LLM explanations | M (3–5d) | Hallucinated nutrition advice |
| Backend      | `/next-cart` endpoint                                               | S (1–2d) | Dependency on gap engine      |
| Frontend     | “Next Cart” recommendation UI                                       | S (1–2d) | Must be understandable        |
| Integration  | Combines gaps + nutrition model                                     | M        | Logic consistency critical    |
| Analytics    | Track acceptance intent (“would you buy?”)                          | S        | Key experiment metric         |

---

## ⚠️ Key risk

LLM must NOT invent nutrition facts → constrain with structured inputs only

---

# 6. Basic UI (Lovable or simple React)

### What this is

User-facing product experience

---

| Area         | Description                           | Effort   | Risks                       |
| ------------ | ------------------------------------- | -------- | --------------------------- |
| Data / Model | None                                  | -        | -                           |
| Backend      | Connect API responses to frontend     | S (1–2d) | API shape changes           |
| Frontend     | Upload → Results → Next Cart view     | C (5–6d) | UI complexity grows fast    |
| Integration  | Full pipeline wiring                  | M        | Debugging overhead          |
| Analytics    | Event tracking (upload, view, accept) | S        | Needs instrumentation early |

---

## ⚠️ Key risk

Frontend tends to consume most time if not constrained early

---

# 7. Agent System (Minimal MVP version)

### IMPORTANT: keep this SIMPLE

---

| Area         | Description                                           | Effort   | Risks                 |
| ------------ | ----------------------------------------------------- | -------- | --------------------- |
| Data / Model | Prompt templates per agent role                       | S (1–2d) | Prompt drift          |
| Backend      | Agent runner (simple Python functions, not framework) | M (2–3d) | Overengineering risk  |
| Frontend     | Not needed                                            | -        | -                     |
| Integration  | Agents wrap pipeline steps (not replace them)         | M        | Confusion if overused |
| Analytics    | Log agent outputs vs baseline logic                   | S        | Useful for demo       |

---

## ⚠️ Key rule

Agents are **assistants inside pipeline**, NOT autonomous system.

---

# 8. Task Queue (Lightweight)

### What this is

Controls execution flow

---

| Area         | Description                              | Effort   | Risks           |
| ------------ | ---------------------------------------- | -------- | --------------- |
| Data / Model | JSON or SQLite task objects              | S (1d)   | None            |
| Backend      | CLI runner or simple orchestrator script | M (2–3d) | State bugs      |
| Frontend     | Optional debug panel                     | S (1d)   | Not necessary   |
| Integration  | Connect pipeline steps via tasks         | M        | Sync issues     |
| Analytics    | Track task completion times              | S        | Useful for demo |

---

## ⚠️ Key insight

Do NOT build full workflow engine (too heavy)

---

# 📊 CROSS-FEATURE DEPENDENCY MAP

```text id="d9v3mx"
Receipt Upload
   ↓
Product Parsing
   ↓
OpenFoodFacts Mapping
   ↓
Nutrition Profile
   ↓
Gap Detection
   ↓
Next Cart Recommendation
   ↓
UI Display + Feedback
```

---

# Feature Table

| Feature                                                                           | Estimated Effort | Priority       | Reason                                   |
| --------------------------------------------------------------------------------- | ---------------- | -------------- | ---------------------------------------- |
| Receipt Upload (image + text fallback)                                            | 3 days           | ✅ MUST HAVE    | Entry point of entire system             |
| Product Parsing (OCR + cleanup)                                                   | 2 days           | ⚙️ SHOULD HAVE | OCR unreliable → fallback essential      |
| OpenFoodFacts Mapping (fuzzy matching)                                            | 3 days           | ✅ MUST HAVE    | Enables nutrition intelligence           |
| Nutrition Profile Builder                                                         | 2 days           | ✅ MUST HAVE    | Core transformation layer                |
| Nutrition Dimension Definition (protein, fiber, sugar, calories, processed score) | 1 day            | ✅ MUST HAVE    | Defines entire system logic              |
| Gap Detection Engine (rules-based)                                                | 1.5 days         | ✅ MUST HAVE    | Converts data → insights                 |
| Next Cart Recommendation Engine                                                   | 2 days           | ✅ MUST HAVE    | Core value output                        |
| Explainability Layer (“why this recommendation”)                                  | 2 days           | ⚙️ SHOULD HAVE | Critical for trust, but optional for MVP |
| Basic UI (upload → results page)                                                  | 3 days           | ✅ MUST HAVE    | User-facing demo                         |
| Feedback Capture (“would you buy this?”)                                          | 1 day            | ⚙️ SHOULD HAVE | Needed for evaluation metric             |
| Analytics Logging (events + outputs)                                              | 1 day            | ⚙️ SHOULD HAVE | Required for experiment                  |
| Agent System (4 agents: PO, Backend, Frontend, QA)                                | 2 days           | ⚙️ SHOULD HAVE | Demo value, not core functionality       |
| Task Queue (JSON-based orchestrator)                                              | 1 day            | ⚙️ SHOULD HAVE | Simple workflow control                  |
| Advanced UI (charts, visualizations)                                              | 2 days           | 💡 COULD HAVE  | Nice but not required                    |
| Personalized Nutrition Profiles                                                   | 2–3 days         | 🚫 WON’T HAVE  | Too complex for MVP                      |
| Real supermarket integration (REWE/Lidl)                                          | 3–5 days         | 🚫 WON’T HAVE  | Out of scope                             |
| Barcode scanning                                                                  | 2–3 days         | 🚫 WON’T HAVE  | High complexity, low MVP value           |
| Long-term memory system                                                           | 3–4 days         | 🚫 WON’T HAVE  | Not needed for validation                |


## 🧱 EPIC 1 — Receipt → Structured Food Data Pipeline

Deliverable

**Convert receipt into normalized product list**

Tasks
- Build upload endpoint (image + text fallback)
- Implement OCR or mock parser
- Clean and normalize product names
- Create structured receipt schema

## 🧱 EPIC 2 — Nutrition Intelligence Engine

Deliverable

**Nutrition profile + gap detection system**


Tasks
- Define nutrition dimensions
- Integrate OpenFoodFacts API
- Build fuzzy matching system
- Compute per-receipt nutrition profile
- Implement rule-based gap detection

## 🧱 EPIC 3 — Next Cart Recommendation System

Deliverable

**Actionable shopping recommendations**

Tasks
- Build recommendation logic (rule + LLM hybrid)
- Map gaps → food substitutions/additions
- Generate “Next Cart” output format
- Ensure deterministic output structure

## 🧱 EPIC 4 — User Experience Layer (UI)

Deliverable

**Simple but clear user interface**

Tasks
- Build upload screen
- Display nutrition profile summary
- Show detected gaps
- Render next cart recommendations
- Add feedback prompt (“Would you follow this?”)

## 🧱 EPIC 5 — Explainability + Trust Layer

Deliverable

**Make recommendations understandable and credible**

Tasks
- Generate explanation per recommendation
- Add “why this?” section
- Add confidence or data source labels (OpenFoodFacts)

## 🧱 EPIC 6 — Experiment Tracking Layer

Deliverable

**Measure hypothesis (30% behavior change intent)**

Tasks
- Log receipt uploads
- Track where recommendation was followed
- Log how much the user followed suggestions
- Store minimal analytics events

## 🧱 EPIC 7 — Lightweight Agent System (Demo Layer)

Deliverable

**AI-assisted development simulation (NOT production critical)**

Tasks
- Create Product Owner prompt
- Create Backend Developer prompt
- Create QA prompt
- Build simple orchestrator script (sequential execution)




---

#  Translation from epics to user stories and tasks

---

# 🧱 EPIC 1 — Receipt → Structured Food Data Pipeline

## 👤 User Stories

### Story 1.1 — Receipt Upload

**As a user, I want to upload a receipt so that the system can analyze my grocery purchases automatically.**

**Acceptance Criteria**

* Upload works via image or text
* API returns structured receipt object
* System handles missing OCR gracefully (fallback supported)

---

### Story 1.2 — Structured Product Extraction

**As a system, I want to convert raw receipt data into normalized product names so that nutrition mapping is reliable.**

**Acceptance Criteria**

* Products extracted consistently
* Noise (prices, formatting artifacts) removed
* Output is a clean product list

---

## 🧪 Atomic Tasks

### Task 1.1 — Upload API

| Component | `backend/api/upload_receipt.py` |
| Input | image OR text |
| Output | raw receipt object |
| Success | HTTP 200 + stored receipt_id |
| Test | curl upload returns receipt_id |

---

### Task 1.2 — OCR / Text Fallback Parser

| Component | `services/receipt_parser.py` |
| Input | image or raw text |
| Output | list of raw product strings |
| Success | ≥80% readable extraction on test receipts |
| Test | sample receipt → product list |

---

### Task 1.3 — Product Normalization

| Component | `services/normalize.py` |
| Input | raw product strings |
| Output | cleaned product names |
| Success | removes prices, duplicates, symbols |
| Test | "MILK 1.5L 1.29€" → "milk" |

---

### Task 1.4 — Receipt Schema

| Component | `models/receipt.py` |
| Input | parsed products |
| Output | structured JSON |
| Success | validated Pydantic schema |
| Test | schema validation passes |

---

# 🧱 EPIC 2 — Nutrition Intelligence Engine

## 👤 User Stories

### Story 2.1 — Nutrition Mapping

**As a system, I want to map grocery items to nutrition data so that I can understand dietary composition.**

**Acceptance Criteria**

* Each product has nutrition values or fallback category
* Mapping uses OpenFoodFacts where possible
* Missing items handled gracefully

---

### Story 2.2 — Nutrition Profile + Gaps

**As a user, I want a nutrition summary so that I understand my dietary strengths and weaknesses.**

**Acceptance Criteria**

* protein, fiber, sugar, calories computed
* gaps are clearly labeled (low/high)
* deterministic rule-based output

---

## 🧪 Atomic Tasks

### Task 2.1 — OpenFoodFacts API Wrapper

| Component | `services/off_api.py` |
| Input | product name |
| Output | nutrition JSON |
| Success | returns structured food data |
| Test | "banana" → nutrition response |

---

### Task 2.2 — Fuzzy Matching Engine

| Component | `services/matcher.py` |
| Input | product string |
| Output | best match + confidence |
| Success | ≥60% match rate on sample receipts |
| Test | "bio milk" → "milk" |

---

### Task 2.3 — Nutrition Profile Builder

| Component | `services/nutrition_profile.py` |
| Input | list of products |
| Output | aggregated nutrition profile |
| Success | sums + averages correct |
| Test | 3 items → correct totals |

---

### Task 2.4 — Gap Detection Engine

| Component | `services/gap_detector.py` |
| Input | nutrition profile |
| Output | structured gaps |
| Success | detects low fiber / high sugar etc. |
| Test | low fiber input → "fiber gap" |

---

### Task 2.5 — Nutrition Schema

| Component | `models/nutrition.py` |
| Input | raw values |
| Output | structured object |
| Success | validated schema |
| Test | Pydantic validation passes |

---

# 🧱 EPIC 3 — Next Cart Recommendation System

## 👤 User Stories

### Story 3.1 — Actionable Recommendations

**As a user, I want suggestions for what to buy next so that I can improve my nutrition.**

**Acceptance Criteria**

* each gap produces ≥1 recommendation
* suggestions are grounded in nutrition logic
* output is structured JSON

---

### Story 3.2 — Explainable Suggestions

**As a user, I want to understand why a recommendation is made so that I trust it.**

**Acceptance Criteria**

* each recommendation has explanation
* link to nutrition gap included

---

## 🧪 Atomic Tasks

### Task 3.1 — Recommendation Mapping Table

| Component | `data/recommendations.json` |
| Input | nutrition gaps |
| Output | food suggestions |
| Success | ≥5 mappings exist |
| Test | fiber gap → lentils/oats |

---

### Task 3.2 — Recommendation Engine

| Component | `services/recommender.py` |
| Input | gaps |
| Output | next cart items |
| Success | deterministic output |
| Test | same input → same output |

---

### Task 3.3 — Explanation Generator

| Component | `services/explainer.py` |
| Input | recommendation + gap |
| Output | explanation text |
| Success | human-readable justification |
| Test | "add oats" → fiber explanation |

---

### Task 3.4 — Output Formatter

| Component | `models/next_cart.py` |
| Input | recommendations |
| Output | structured API response |
| Success | UI-ready JSON |
| Test | frontend consumes cleanly |

---

# 🧱 EPIC 4 — User Experience Layer (UI)

## 👤 User Stories

### Story 4.1 — Upload & Insights

**As a user, I want to upload a receipt and immediately see insights so that I understand my nutrition.**

**Acceptance Criteria**

* upload → results flow works end-to-end
* results are understandable in <5 seconds
* no technical friction

---

### Story 4.2 — Next Cart Visualization

**As a user, I want to see what I should buy next so that I can improve my grocery choices.**

**Acceptance Criteria**

* recommendations are clearly listed
* structured + readable UI
* connects to nutrition gaps

---

## 🧪 Atomic Tasks

### Task 4.1 — Upload Screen

| Component | `frontend/Upload.tsx` |
| Input | image/text |
| Output | API call |
| Success | receipt_id returned |
| Test | file upload triggers backend |

---

### Task 4.2 — Results Dashboard

| Component | `frontend/Results.tsx` |
| Input | nutrition profile |
| Output | visual cards |
| Success | shows gaps correctly |
| Test | mock API renders UI |

---

### Task 4.3 — Next Cart UI

| Component | `frontend/NextCart.tsx` |
| Input | recommendations |
| Output | list UI |
| Success | readable suggestions |
| Test | JSON → UI render |

---

# 🧱 EPIC 5 — Explainability + Trust Layer

## 👤 User Stories

### Story 5.1 — Why Explanation

**As a user, I want to understand why a recommendation is made so that I trust it.**

**Acceptance Criteria**

* every recommendation has explanation
* maps explicitly to nutrition gap
* no hallucinated claims

---

## 🧪 Atomic Tasks

### Task 5.1 — Explanation Generator

| Component | `services/explainer.py` |
| Input | gap + recommendation |
| Output | explanation string |
| Success | consistent logic |
| Test | fiber gap → fiber explanation |

---

### Task 5.2 — Data Source Labeling

| Component | `services/source_labels.py` |
| Input | nutrition data |
| Output | "OpenFoodFacts" tags |
| Success | visible in UI |
| Test | label appears per item |

---

### Task 5.3 — Confidence Tags (simple heuristic)

| Component | `services/confidence.py` |
| Input | match score |
| Output | confidence level |
| Success | low/medium/high tagging |
| Test | fuzzy match affects score |

---

# 🧱 EPIC 6 — Experiment Tracking (Behavior Change Validation via Receipts)

## 👤 User Stories

### Story 6.1 — Session Tracking

**As a researcher, I want to link multiple receipts to the same user so that I can measure behavioral change over time.**

**Acceptance Criteria**

* session_id persists across uploads
* receipts are ordered per user
* history is queryable

---

### Story 6.2 — Behavioral Change Detection

**As a researcher, I want to compare receipt N vs receipt N+1 so that I can measure whether recommendations influenced purchases.**

**Acceptance Criteria**

* system computes overlap between recommended items and next receipt
* generates adoption score
* outputs nutrition delta (fiber ↑, sugar ↓)

---

### Story 6.3 — Adoption Metric Computation

**As a researcher, I want a quantifiable adoption score so that I can evaluate success of the intervention.**

**Acceptance Criteria**

* % recommended items purchased computed
* nutrition improvement score computed
* aggregated metric available

---

## 🧪 Atomic Tasks

### Task 6.1 — Session Management

| Component | `services/session.py` |
| Input | user request |
| Output | session_id |
| Success | persistent ID across requests |
| Test | same user → same session |

---

### Task 6.2 — Receipt History Storage

| Component | `database/receipts.py` |
| Input | receipt data |
| Output | stored record |
| Success | retrieval by session_id |
| Test | fetch previous receipts |

---

### Task 6.3 — Recommendation Storage

| Component | `database/recommendations.py` |
| Input | next cart |
| Output | stored linked record |
| Success | traceable to receipt |
| Test | join works correctly |

---

### Task 6.4 — Receipt Comparison Engine

| Component | `analytics/comparator.py` |
| Input | receipt N, N+1 |
| Output | overlap score |
| Success | detects matched products |
| Test | recommendation overlap computed |

---

### Task 6.5 — Nutrition Delta Calculator

| Component | `analytics/nutrition_delta.py` |
| Input | two nutrition profiles |
| Output | delta metrics |
| Success | fiber ↑ / sugar ↓ computed |
| Test | correct arithmetic changes |

---

### Task 6.6 — Adoption Scoring Algorithm

| Component | `analytics/adoption_score.py` |
| Input | recommendations + next receipt |
| Output | % adoption score |
| Success | interpretable 0–100% value |
| Test | known overlap → correct score |

---

# 🧱 EPIC 7 — Lightweight Agent System (Demo Layer)

## 👤 User Stories

### Story 7.1 — AI Development Simulation

**As a developer, I want AI agents to assist in generating structured development outputs so that we can accelerate implementation and demonstrate AI-assisted engineering.**

**Acceptance Criteria**

* agents produce structured outputs
* outputs are reviewable (not autonomous chaos)
* system is deterministic

---

## 🧪 Atomic Tasks

### Task 7.1 — PO Agent Prompt

| Component | `agents/po.py` |
| Input | roadmap |
| Output | user stories JSON |
| Success | structured stories |
| Test | deterministic output |

---

### Task 7.2 — Backend Agent Prompt

| Component | `agents/backend.py` |
| Input | task spec |
| Output | code snippet |
| Success | runnable output |
| Test | compiles or executes |

---

### Task 7.3 — QA Agent Prompt

| Component | `agents/qa.py` |
| Input | code + acceptance criteria |
| Output | pass/fail |
| Success | consistent evaluation |
| Test | repeatable results |

---

### Task 7.4 — Orchestrator Script

| Component | `orchestrator/run.py` |
| Input | task queue |
| Output | executed pipeline |
| Success | end-to-end run |
| Test | full flow completes |

---


# PROMPT AFTER SWITCH TO SUPERIOR MODELS:
please prepare Epics, User Stories and Atomic Tasks for 2 people over 3 weeks for this:
MVP SUMMARY
NutriWise is a receipt-first nutrition coach that removes the #1 barrier to healthy eating: the effort of tracking. In 3 weeks, a 2-person team will build a web app where a user uploads one grocery receipt, answers 3 quick profile questions (goal, age range, activity level), and receives a nutrient gap analysis plus exactly one prioritized "Next Cart" recommendation — a specific product swap or addition they can act on at their very next supermarket visit — with a plain-language "why this fits you" explanation and 3 matching recipes.

Every output is transparently labeled "estimated from your shopping habits, not actual intake" to address the core trust gap identified across all 6 synthetic research personas.

The MVP proves one hypothesis: that passive behavioral reconstruction from receipt data, combined with a single clear decision, can meaningfully shift grocery behavior — without asking users to change how they shop or log anything manually.

FEATURE LIST
01 Receipt Upload + Parsing: Photo or file upload → Claude Vision extracts item list → USDA API matches nutrients

02 3-Question Profile Onboarding: Goal, age range, activity level — completes in under 90 seconds

03 Nutrient Gap Analysis: Top 3 gaps vs WHO baseline, visual progress bars, one-sentence "what this means" per gap

04 Next Cart Engine: 1 prioritized action — specific product, not generic advice — with cited reasoning and confidence level

05 "Why This Fits You" Explanation: LLM-generated, references user profile + specific gap — not a generic recommendation

06 3 Recipe Suggestions: Matched to the Next Cart action, each showing prep time and cost in EUR

07 Transparency Layer: "Based on estimated consumption from purchases" on every nutrition output — built-in, not optional

08 GDPR Compliance: "Not medical advice" disclaimer, no health data stored beyond session, consent on upload

Please create the EPICs, User Stories and Atomic Tasks for these features:
# Feature Table

| Feature                                                                           | Estimated Effort | Priority       | Reason                                   |
| --------------------------------------------------------------------------------- | ---------------- | -------------- | ---------------------------------------- |
| Receipt Upload (image + text fallback)                                            | 3 days           | ✅ MUST HAVE    | Entry point of entire system             |
| Product Parsing (OCR + cleanup)                                                   | 2 days           | ⚙️ SHOULD HAVE | OCR unreliable → fallback essential      |
| OpenFoodFacts Mapping (fuzzy matching)                                            | 3 days           | ✅ MUST HAVE    | Enables nutrition intelligence           |
| Nutrition Profile Builder                                                         | 2 days           | ✅ MUST HAVE    | Core transformation layer                |
| Nutrition Dimension Definition (protein, fiber, sugar, calories, processed score) | 1 day            | ✅ MUST HAVE    | Defines entire system logic              |
| Gap Detection Engine (rules-based)                                                | 1.5 days         | ✅ MUST HAVE    | Converts data → insights                 |
| Next Cart Recommendation Engine                                                   | 2 days           | ✅ MUST HAVE    | Core value output                        |
| Explainability Layer (“why this recommendation”)                                  | 2 days           | ⚙️ SHOULD HAVE | Critical for trust, but optional for MVP |
| Basic UI (upload → results page)                                                  | 3 days           | ✅ MUST HAVE    | User-facing demo                         |
| Feedback Capture (“would you buy this?”)                                          | 1 day            | ⚙️ SHOULD HAVE | Needed for evaluation metric             |
| Analytics Logging (events + outputs)                                              | 1 day            | ⚙️ SHOULD HAVE | Required for experiment                  |
| Agent System (4 agents: PO, Backend, Frontend, QA)                                | 2 days           | ⚙️ SHOULD HAVE | Demo value, not core functionality       |
| Task Queue (JSON-based orchestrator)                                              | 1 day            | ⚙️ SHOULD HAVE | Simple workflow control                  |
| Advanced UI (charts, visualizations)                                              | 2 days           | 💡 COULD HAVE  | Nice but not required                    |
prioritize MUST HAVE for the first two weeks and the SHOULD HAVE and COULD HAVE for week 3 when creating the EPICS, USER STORIES and ATOMIC TASKS