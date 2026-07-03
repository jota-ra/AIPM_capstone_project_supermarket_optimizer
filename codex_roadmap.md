# Codex Roadmap

## Consolidated Research Findings

Across both research files, the strongest opportunity is not a broad nutrition dashboard. It is a low-effort grocery assistant that turns receipts into one clear next shopping action.

The repeated user needs are:

- **Less effort than food logging:** users are interested because receipt upload feels lighter than MyFitnessPal-style meal tracking.
- **Action over analysis:** users do not want another dashboard; they want a clear answer to "what should I buy next?"
- **Trust through transparency:** users question whether purchases equal consumption, so every insight must be framed as an estimate from grocery behavior.
- **Specific recommendations:** generic advice like "eat more vegetables" will not feel valuable. The app must suggest concrete swaps or additions.
- **Confidence and explanation:** users need to know why a recommendation was made and how reliable it is.
- **Fast value moment:** the MVP must show useful output after one receipt, not require weeks of data before anything happens.

The main risks are:

- Receipt data does not fully represent what users actually eat.
- OCR and product matching may be unreliable.
- Nutrition recommendations may feel generic or medically overconfident.
- A full household, vegan, performance, or long-term coaching product is too large for 2 people in 3 weeks.

## MVP Summary

NutriWise MVP is a receipt-first nutrition assistant for health-conscious adults who want better grocery decisions without manual food logging.

In 3 weeks, a 2-person team should build a web app where a user uploads or pastes one grocery receipt, answers a short profile setup, and receives:

1. A simple estimated nutrition snapshot.
2. The top 1-3 likely nutrition gaps.
3. One prioritized **Next Cart** recommendation.
4. A short explanation of why that recommendation fits.
5. A confidence label that makes the limits of receipt-based inference clear.

The MVP should validate one core hypothesis:

> Users will trust and consider acting on a clear grocery recommendation generated from receipt data, as long as the app is transparent that it estimates shopping patterns rather than exact food intake.

This is intentionally not a full nutrition tracker, household planner, performance optimizer, or medical advice tool.

## MVP Feature List

### Must Have

**1. Receipt Input**

- Upload receipt image or paste receipt text.
- Text fallback is required because OCR will be unreliable.
- Extract product names into a structured list.

**2. Product Normalization**

- Clean receipt item names.
- Match items to OpenFoodFacts where possible.
- Use simple fallback categories when exact matching fails.
- Show unmatched items without blocking the flow.

**3. Lightweight User Profile**

- 3-5 onboarding questions only:
  - goal
  - age range
  - activity level
  - dietary pattern
  - optional allergies or exclusions

**4. Nutrition Snapshot**

- Estimate only a few dimensions:
  - protein
  - fiber
  - sugar
  - calories
  - processed-food signal
- Avoid complex micronutrient modeling for the MVP unless data is reliable.

**5. Gap Detection**

- Rule-based gap detection.
- Show the top 1-3 gaps only.
- Use plain language instead of medical or diagnostic wording.

**6. Next Cart Recommendation**

- Generate one primary recommendation:
  - add a product
  - replace a product
  - reduce or rebalance a category
- Recommendation must be specific, realistic, and grocery-oriented.
- Example: "Add lentils or beans next shop to improve fiber coverage."

**7. Explanation and Confidence Layer**

- Each recommendation includes:
  - why it was suggested
  - which gap it addresses
  - confidence level
  - data source or assumption
- Use wording like: "Estimated from your grocery receipt, not confirmed intake."

**8. Feedback Capture**

v1:
- Ask one simple validation question:
  - "Would you consider buying this next time?"
- Capture yes/no/maybe plus optional comment.

v2:
- automatically detect adoption via next uploaded receipt
- log how much of recommendation was followed

**9. Basic Results UI**

- One clean flow:
  - upload receipt
  - review parsed items
  - view nutrition snapshot
  - view next cart recommendation
  - give feedback

## Should Have

**1. Manual Item Editing**

- Let users correct parsed receipt items before analysis.

**2. Simple Recipe Suggestions**

- Show up to 3 recipes using the recommended product.
- Keep this secondary to the Next Cart action.

**3. Trust Copy**

- Add clear disclaimers:
  - not medical advice
  - estimated from purchases
  - receipt data may miss restaurant meals and shared food

**4. Lightweight Analytics**

- Track:
  - upload completed
  - parsing success
  - product match rate
  - recommendation viewed
  - recommendation accepted/rejected

## Won't Have in 3-Week MVP

- Real REWE/Lidl account integrations.
- Barcode scanning.
- Long-term memory or trend charts.
- Garmin, Whoop, Apple Health, or performance integrations.
- Full household inventory and waste tracking.
- Medical guidance for cholesterol or deficiencies.
- Advanced vegan micronutrient modeling.
- Multi-agent production workflow.
- Payment, subscriptions, or pricing experiments.

## 3-Week Build Plan

### Week 1: Core Pipeline

- Build receipt upload and paste-text fallback.
- Parse receipt into item list.
- Normalize product names.
- Integrate OpenFoodFacts lookup.
- Create fallback food categories for unmatched products.
- Define nutrition dimensions and scoring rules.

### Week 2: Recommendation Experience

- Build nutrition snapshot.
- Build rule-based gap detection.
- Build Next Cart recommendation logic.
- Add explanation and confidence labels.
- Build upload-to-results UI.
- Add parsed-item review/edit screen if time allows.

### Week 3: Trust, Testing, and Demo Readiness

- Add feedback capture.
- Add basic analytics/logging.
- Improve recommendation wording.
- Test with sample German supermarket receipts.
- Fix OCR and matching failures.
- Run 3-5 lightweight user tests.
- Prepare demo script around the core loop.

## Success Criteria

The MVP is successful if:

- A user can upload or paste a receipt and get a result in under 2 minutes.
- At least 70% of receipt items are parsed or categorized well enough for a useful recommendation.
- Users understand that outputs are estimates, not exact intake or medical advice.
- At least 3 of 5 test users say the Next Cart recommendation is specific enough to consider using.
- At least 2 users say they would upload another receipt to see whether the app improves.

## Recommended Product Positioning

Use this framing:

> "Upload a grocery receipt. Get one smarter thing to buy next time."

Avoid positioning the MVP as:

- a calorie tracker
- a medical nutrition coach
- a full meal planner
- a household management system
- a performance optimization platform

The MVP should win by being simple, transparent, and immediately actionable.

## Epics and User Stories

### Epic 1: Receipt Input and Parsing

**Goal:** Let users provide grocery data with minimal effort, while keeping a reliable fallback when OCR fails.

**User Stories**

1. As a user, I want to upload a receipt image so that I do not have to manually log every grocery item.
   - Acceptance criteria:
     - User can upload a receipt image from the web app.
     - The app accepts common image formats.
     - The app shows a loading state while processing.
     - The app shows a clear error if the image cannot be processed.

2. As a user, I want to paste receipt text manually so that I can still use the app when OCR fails.
   - Acceptance criteria:
     - User can paste raw receipt text into a text field.
     - The app can continue to analysis from pasted text.
     - The fallback path is visible and easy to find.

3. As a user, I want to review the detected receipt items so that I can trust the analysis before seeing recommendations.
   - Acceptance criteria:
     - The app displays parsed item names before analysis.
     - User can see which items were recognized.
     - Unclear or unmatched items are not hidden.

4. As a developer, I want a structured receipt schema so that downstream nutrition logic receives consistent data.
   - Acceptance criteria:
     - Parsed receipts produce a consistent item list.
     - Each item includes at least a name and optional quantity or price if available.
     - The schema supports both OCR and pasted-text input.

### Epic 2: Product Normalization and Nutrition Mapping

**Goal:** Convert messy receipt items into usable food data without blocking the user when exact matches are unavailable.

**User Stories**

1. As a user, I want the app to clean up receipt item names so that supermarket abbreviations can still become understandable products.
   - Acceptance criteria:
     - Obvious receipt noise is removed from item names.
     - Product names are displayed in readable language.
     - The original raw item can still be inspected during debugging.

2. As a user, I want the app to match grocery items to nutrition data so that recommendations are based on actual food information.
   - Acceptance criteria:
     - The app attempts to match products with OpenFoodFacts.
     - Matched products include nutrition values when available.
     - The app records whether a match was exact, fuzzy, or fallback.

3. As a user, I want unmatched products to be categorized approximately so that one failed lookup does not break the whole result.
   - Acceptance criteria:
     - Unmatched items can fall back to simple categories such as dairy, grain, vegetable, snack, drink, or protein.
     - The app marks fallback estimates as lower confidence.
     - Analysis can continue even when some items are unmatched.

4. As a developer, I want to track product match quality so that we know whether the pipeline is good enough for user testing.
   - Acceptance criteria:
     - The app logs total items, matched items, fallback items, and failed items.
     - The match rate can be reviewed after a test session.

### Epic 3: Lightweight User Profile

**Goal:** Capture enough context to personalize recommendations without turning onboarding into a chore.

**User Stories**

1. As a user, I want to answer a few quick profile questions so that the app can avoid generic advice.
   - Acceptance criteria:
     - Onboarding takes less than 90 seconds.
     - The app asks no more than 5 profile questions.
     - Required questions are limited to goal, age range, activity level, and dietary pattern.

2. As a vegan, vegetarian, or allergy-aware user, I want my dietary pattern to be respected so that recommendations do not conflict with my choices.
   - Acceptance criteria:
     - User can select a dietary pattern.
     - User can optionally add exclusions or allergies.
     - Recommendations do not suggest excluded foods.

3. As a user, I want to skip nonessential profile details so that I can reach the receipt result quickly.
   - Acceptance criteria:
     - Optional questions are clearly marked.
     - User can complete the MVP flow without detailed biometric data.

### Epic 4: Nutrition Snapshot and Gap Detection

**Goal:** Show a simple estimated nutrition picture that helps users understand the recommendation without creating dashboard overload.

**User Stories**

1. As a user, I want a simple nutrition snapshot so that I can understand what my receipt suggests about my shopping pattern.
   - Acceptance criteria:
     - The app shows protein, fiber, sugar, calories, and processed-food signal.
     - Outputs are labeled as estimates from grocery purchases.
     - The snapshot avoids medical or diagnostic language.

2. As a user, I want to see my top nutrition gaps so that I know where to focus first.
   - Acceptance criteria:
     - The app shows no more than 3 gaps.
     - Each gap includes a plain-language explanation.
     - Gaps are generated from simple, rule-based thresholds.

3. As a user, I want the app to explain uncertainty so that I do not mistake grocery estimates for exact intake.
   - Acceptance criteria:
     - Nutrition outputs include confidence labels.
     - Lower-confidence outputs explain why confidence is lower.
     - The app states that receipts do not capture eating out, shared food, or actual consumption.

### Epic 5: Next Cart Recommendation

**Goal:** Turn analysis into one concrete grocery action the user can consider during their next supermarket visit.

**User Stories**

1. As a user, I want one prioritized Next Cart recommendation so that I know exactly what to buy or change next time.
   - Acceptance criteria:
     - The app produces one primary recommendation.
     - The recommendation is a specific grocery action, not generic nutrition advice.
     - The action is framed as an addition, replacement, reduction, or rebalance.

2. As a user, I want to know why the recommendation fits me so that I can decide whether to trust it.
   - Acceptance criteria:
     - The recommendation explains which gap it addresses.
     - The explanation references the receipt and profile where relevant.
     - The explanation is short enough to understand quickly.

3. As a user with dietary restrictions, I want recommendations that fit my diet so that the app does not lose credibility.
   - Acceptance criteria:
     - Recommendations respect dietary pattern and exclusions.
     - If no suitable recommendation is available, the app explains the limitation instead of forcing a poor suggestion.

4. As a product team, we want recommendations to be constrained by structured data so that the app does not invent unsupported nutrition claims.
   - Acceptance criteria:
     - Recommendation logic uses known gaps, matched items, fallback categories, and profile constraints.
     - LLM-generated wording, if used, is limited to explanation and does not create new facts.

### Epic 6: Results UI and User Flow

**Goal:** Build a focused web experience that gets users from receipt to recommendation quickly.

**User Stories**

1. As a user, I want a clear step-by-step flow so that I always know what to do next.
   - Acceptance criteria:
     - The MVP flow includes upload, item review, profile, results, and feedback.
     - The user can complete the full flow without reading instructions outside the app.
     - The UI highlights the Next Cart recommendation as the primary outcome.

2. As a user, I want the results page to be easy to scan so that I do not have to interpret a complex dashboard.
   - Acceptance criteria:
     - The results page prioritizes the recommendation first or clearly above detailed analysis.
     - Nutrition details are limited to the MVP dimensions.
     - The page avoids excessive charts and metrics.

3. As a user, I want visible trust copy so that I understand what the app can and cannot tell me.
   - Acceptance criteria:
     - The app includes "not medical advice" language.
     - The app explains that results are estimated from purchases.
     - Trust copy is visible near nutrition outputs and recommendations.

### Epic 7: Feedback and Validation

**Goal:** Measure whether users understand, trust, and intend to act on the recommendation.

**User Stories**

1. As a user, I want to respond to the recommendation quickly so that I can give feedback without extra work.
   - Acceptance criteria:
     - The app asks: "Would you consider buying this next time?"
     - User can answer yes, no, or maybe.
     - User can optionally add a short comment.

2. As a product team, we want to capture recommendation feedback so that we can validate the MVP hypothesis.
   - Acceptance criteria:
     - The app stores recommendation viewed events.
     - The app stores yes/no/maybe responses.
     - The app stores optional comments connected to the recommendation shown.

3. As a product team, we want to compare a later receipt against the previous recommendation so that v2 can estimate adoption.
   - Acceptance criteria:
     - The roadmap documents this as v2, not required for first MVP delivery.
     - The data model can store a recommendation in a way that makes later comparison possible.

### Epic 8: Analytics, QA, and Demo Readiness

**Goal:** Make the MVP testable, explainable, and stable enough for a final project demo.

**User Stories**

1. As a product team, we want basic event tracking so that we can understand where users drop off.
   - Acceptance criteria:
     - The app tracks upload started, upload completed, analysis completed, recommendation viewed, and feedback submitted.
     - Events can be reviewed after a user test.

2. As a developer, I want a small set of sample receipts so that I can test the pipeline repeatedly.
   - Acceptance criteria:
     - The project includes sample receipt text or images.
     - Tests cover at least one clean receipt and one messy receipt.
     - The demo can fall back to a known-good sample if live OCR fails.

3. As a developer, I want clear error states so that failures do not kill the demo.
   - Acceptance criteria:
     - OCR failure points users to pasted-text fallback.
     - Product matching failure still allows category-based recommendations.
     - API or lookup failures show a useful message instead of a blank screen.

4. As a project team, we want a demo script so that we can show the core value clearly.
   - Acceptance criteria:
     - Demo script follows the loop: receipt input, item review, nutrition snapshot, Next Cart recommendation, feedback.
     - Demo script explains the MVP hypothesis and limitations.
     - Demo script avoids promising post-MVP features.

## Prioritized Backlog

### P0: Required for MVP Demo

- Receipt upload or pasted-text input.
- Structured receipt item extraction.
- Product normalization with fallback categories.
- Basic OpenFoodFacts matching.
- Lightweight profile setup.
- Nutrition snapshot.
- Rule-based gap detection.
- One Next Cart recommendation.
- Explanation and confidence label.
- Basic results UI.
- Feedback capture.

### P1: Strongly Recommended

- Manual item editing.
- Match-quality logging.
- Trust copy near every nutrition output.
- Sample receipt fixtures.
- Clear error states.
- Basic analytics events.

### P2: Only If Time Allows

- Simple recipe suggestions.
- More polished visual design.
- Recommendation history.
- v2 adoption check using a second uploaded receipt.
