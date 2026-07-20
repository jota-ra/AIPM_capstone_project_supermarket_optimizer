# Claude Code – Integration Briefing
# NutriWise Nutrition Intelligence Agent

---

## Your task

You are integrating a new **Nutrition Intelligence Agent** into an existing NutriWise project.
Do NOT start from scratch. Read the existing codebase first, then implement.

### Before writing a single line of code:

1. `find . -type f -name "*.py" | head -60` — map the full project structure
2. `cat backend/api/*.py` — understand existing endpoints
3. `cat backend/services/*.py` — understand existing services
4. `cat backend/models/*.py` — understand existing data models
5. `ls backend/app/fixtures/` — check if fixtures already exist
6. `cat requirements.txt` — check which libraries are already installed

Only after reading the above: implement the spec below.

---

## Report conflicts BEFORE implementing

After reading the existing code, stop and report any conflict between this spec
and what already exists. For each conflict, state:

- **What:** which file / function / model is affected
- **Why:** why the conflict exists (naming clash, different schema, already implemented differently)
- **Difference:** what this spec says vs. what already exists
- **Recommendation:** adapt spec to existing code, or refactor existing code — and why

**Do not silently override existing code. Always ask first.**

---

## What to build: Nutrition Intelligence Agent (5-step pipeline)

```
parsed_receipt (already in DB)
        │
        ▼
[Step 1] matcher.py          → MatchedProduct[]
        │
        ▼
[Step 2] nutrition_profile.py → NutritionProfile
        │
        ▼
[Step 3] gap_detector.py      → Gap[]
        │
        ▼
[Step 4] recommender.py       → Recommendation
        │
        ▼
[Step 5] explainer.py         → Recommendation + explanation (only LLM call)
        │
        ▼
GET /receipts/{receipt_id}/next-cart → NextCartResponse
```

---

## Integration rules

### Rule 1 – Reuse existing models
If a Pydantic model already exists that covers the same concept
(e.g. a Product model, a Receipt model), extend it — do not create a duplicate.
Report if the existing schema differs from the spec below.

### Rule 2 – Reuse existing services
If `services/receipt_parser.py` or `services/normalize.py` already exists,
check if Step 1 (matcher.py) overlaps. Report the overlap before adding new code.

### Rule 3 – Reuse existing DB access patterns
Use whatever database access pattern already exists (SQLAlchemy, raw SQL, etc.).
Do not introduce a new ORM if one already exists.

### Rule 4 – Match existing file structure
Put new files where similar files already live.
If services are in `backend/app/services/`, put new ones there — not in `backend/services/`.

### Rule 5 – Never delete existing code
If something needs to change, add a comment `# NutriWise Agent – modified` and explain why.
Do not silently remove existing logic.

---

## Step specs (implement in this order)

### Step 1 – Product Matcher
**Target file:** wherever `services/` lives in the existing project
**Check first:** does `normalize.py` or `receipt_parser.py` already do any matching?
If yes: report the overlap before adding matcher.py.

```python
class MatchedProduct(BaseModel):
    name: str
    off_id: str | None
    fallback_category: str | None  # "vegetables"|"protein"|"dairy"|"grains"|"snack"|"drink"
    nutrition: NutritionValues | None
    match_type: Literal["exact", "fuzzy", "fallback", "failed"]
    confidence: Literal["high", "medium", "low"]
```

Logic:
- OpenFoodFacts API first (exact search)
- Fuzzy match with `rapidfuzz` if no exact match (threshold ≥ 60%)
- Fallback category from keyword rules if fuzzy fails
- Mark as "failed" if all fail — do NOT block pipeline
- Log match stats to analytics

**No LLM call in this step.**

---

### Step 2 – Nutrition Profiler
**Check first:** does a nutrition model already exist? If yes, extend it.

```python
class NutritionProfile(BaseModel):
    protein_g: float
    fiber_g: float
    sugar_g: float
    calories_kcal: float
    processed_score: float      # 0.0–1.0
    items_analyzed: int
    items_failed: int
    confidence: Literal["high", "medium", "low"]
```

Logic:
- Sum values from matched products
- Use `data/category_averages.json` for fallback items
- processed_score = ratio of snack/drink/ultra-processed items
- confidence: high ≥ 80% match rate, medium ≥ 50%, low < 50%

**No LLM call in this step.**

---

### Step 3 – Gap Detector
**Check first:** any existing scoring or analysis logic?

```python
class Gap(BaseModel):
    dimension: Literal["protein", "fiber", "sugar", "calories", "processed_foods"]
    status: Literal["low", "high", "ok"]
    message: str                # 1 sentence, no medical claims
    confidence: Literal["high", "medium", "low"]
    priority: int               # 1 = highest
```

WHO baselines (hardcoded, adjust by activity_level):
- protein: 50g (sedentary) → 70g (active)
- fiber: 25g/day
- sugar: flag if > 50g/day
- calories: 2000 (sedentary) → 2500 (active)
- processed_score: flag if > 0.4

**Rule-based only. No ML. No LLM.**

---

### Step 4 – Recommender
**Check first:** does any recommendation logic already exist?

```python
class Recommendation(BaseModel):
    action: Literal["add", "replace", "reduce", "rebalance"]
    item: str
    addresses_gap: str
    confidence: Literal["high", "medium", "low"]
    explanation: str            # filled by Step 5
    source: str
```

Logic:
- Load from `data/recommendations.json`
- Filter by Profile.exclusions before selecting
- Pick first non-excluded option for top-priority gap
- Fallback if nothing suitable: action="rebalance", item="varied whole foods", confidence="low"

**No LLM call in this step.**

Create `data/recommendations.json` if it does not exist:
```json
{
  "fiber_low":      [{"action":"add","item":"oats"},{"action":"add","item":"lentils"}],
  "protein_low":    [{"action":"add","item":"eggs"},{"action":"add","item":"chicken breast"}],
  "sugar_high":     [{"action":"reduce","item":"sugary drinks"},{"action":"replace","item":"flavored yogurt → plain yogurt"}],
  "processed_high": [{"action":"replace","item":"processed snacks → nuts"},{"action":"add","item":"whole grain bread"}],
  "calories_low":   [{"action":"add","item":"avocado"},{"action":"add","item":"olive oil"}]
}
```

---

### Step 5 – Explainer (ONLY LLM call in the pipeline)
**Check first:** is there already an LLM call in the project? If yes, use the same
client setup, API key handling, and model name pattern already in use.

**Model:** `claude-sonnet-4-6`

**System prompt:**
```
You are a nutrition coach assistant for NutriWise.
Write ONE short explanation (2-3 sentences max) for a grocery recommendation.

Rules:
- Reference the user's profile (goal, activity level, dietary pattern)
- Reference the specific gap found
- Name the specific product recommended
- Never invent nutrition facts — use only the values provided
- Never give medical advice or diagnoses
- Always end with: "Based on estimated consumption from your shopping habits, not actual intake."
- Tone: friendly, specific, like a knowledgeable friend
```

**User message:**
```
User profile: goal={goal}, activity={activity_level}, diet={dietary_pattern}
Top gap: {dimension} is {status}
Recommendation: {action} {item}
Confidence: {confidence}

Write the explanation now.
```

---

## Fixture files

Check `backend/app/fixtures/` first.
If fixtures already exist: use them as-is and report their schema.
If missing: create these 6 files with realistic sample data (German Rewe receipt):

```
fixtures/parsed_items.json       # ["Bio Spinat", "Haferflocken", "Hähnchenbrust", ...]
fixtures/matched_products.json   # MatchedProduct[] with nutrition values
fixtures/nutrition_profile.json  # NutritionProfile with realistic German diet values
fixtures/gaps.json               # top 3 Gap[] objects
fixtures/profile.json            # {goal:"eat_healthier", age_range:"25-35", activity_level:"moderate", dietary_pattern:"omnivore", exclusions:[]}
fixtures/recommendation.json     # full Recommendation with placeholder explanation
```

---

## API endpoint

**Check first:** does `/receipts/{id}/next-cart` or similar already exist?
If yes: extend it. If not: create it.

```python
# GET /receipts/{receipt_id}/next-cart
class NextCartResponse(BaseModel):
    receipt_id: str
    recommendation: Recommendation
    nutrition_profile: NutritionProfile
    gaps: list[Gap]             # top 3 only
    disclaimer: str             # hardcoded: "Based on estimated consumption from your shopping habits, not actual intake. Not medical advice."
```

---

## Tests

For each step, write a pytest test that:
1. Loads the fixture file as input
2. Runs the step function
3. Validates the Pydantic schema of the output
4. Checks key business rules:
   - excluded items are never recommended (Step 4)
   - explanation is non-empty string (Step 5)
   - failed items don't break the pipeline (Step 1)
   - gaps are sorted by priority ascending (Step 3)

---

## Done = definition

```bash
curl -X GET http://localhost:8000/receipts/test-123/next-cart \
  -H "session-id: test-session-123"
```

Returns HTTP 200 with valid `NextCartResponse` JSON including a non-empty
`explanation` field — for BOTH the clean fixture receipt AND the messy one.

All pytest tests pass: `pytest backend/tests/ -v`

---

## Final check after implementation

Run this and report the output:

```bash
# 1. All tests pass?
pytest backend/tests/ -v

# 2. Any existing tests broken?
pytest --tb=short

# 3. API responds correctly?
curl -X GET http://localhost:8000/receipts/test-123/next-cart \
  -H "session-id: test-session-123" | python -m json.tool

# 4. Report: what did you change vs. what already existed?
git diff --stat
```

---

## ADDENDUM – Progress Tracking Agent

> **Prerequisite check before implementing this agent:**
> Run the following and report the output before writing any code:
> ```bash
> grep -r "session_id" backend/ --include="*.py" -l
> grep -r "receipt_history\|receipt_items" backend/ --include="*.py" -l
> ls backend/app/fixtures/
> ```
> If `session_id` does not exist in the codebase yet, stop and report.
> This agent requires Epic 8 (session management + receipt history storage) to be in place.
> Do not implement Progress Tracking until sessions and receipt history work end-to-end.

---

### Progress Tracking Agent

**Purpose:** Compare the user's current nutrition profile against their previous receipt(s)
to show whether their diet is improving over time. This proves the loop hypothesis:
"Does uploading a second receipt show measurable change?"

**File:** `backend/services/progress_tracker.py`

**When it runs:** After Step 2 (NutritionProfile) completes, if the user has ≥ 2 receipts
stored under their session_id.

---

#### Input

```python
class ProgressInput(BaseModel):
    session_id: str
    current_profile: NutritionProfile     # output of Step 2, this receipt
    previous_profiles: list[NutritionProfile]  # loaded from DB, ordered newest-first
    addressed_gap: str                    # Gap.dimension from the last recommendation
```

#### Output

```python
class ProgressReport(BaseModel):
    has_history: bool                     # False if < 2 receipts — return early, no delta
    receipts_compared: int                # how many receipts contributed to this report
    deltas: list[DimensionDelta]          # one per tracked dimension
    trend: Literal["improving", "stable", "declining", "insufficient_data"]
    addressed_gap_improved: bool | None   # did the recommended gap actually close?
    message: str                          # 1 sentence, plain language, no medical claims
    disclaimer: str                       # always: "Based on estimated consumption from shopping habits only."

class DimensionDelta(BaseModel):
    dimension: str                        # "protein", "fiber", "sugar", "calories", "processed_foods"
    previous_value: float
    current_value: float
    delta: float                          # current - previous (positive = more, negative = less)
    direction: Literal["up", "down", "stable"]
    is_improvement: bool                  # True if direction matches what's healthy for this dimension
```

---

#### Logic

```python
def track_progress(input: ProgressInput) -> ProgressReport:

    # 1. Guard: not enough history
    if not input.previous_profiles:
        return ProgressReport(
            has_history=False,
            receipts_compared=1,
            deltas=[],
            trend="insufficient_data",
            addressed_gap_improved=None,
            message="Upload another receipt next time you shop to see your progress.",
            disclaimer="Based on estimated consumption from shopping habits only."
        )

    # 2. Compare current vs. most recent previous profile
    prev = input.previous_profiles[0]
    curr = input.current_profile

    # 3. Calculate deltas per dimension
    # improvement logic (direction matters):
    # protein:  up   = improvement
    # fiber:    up   = improvement
    # sugar:    down = improvement
    # calories: depends on goal — skip for MVP, always mark as "stable"
    # processed_score: down = improvement

    # 4. Check if addressed_gap improved
    # e.g. if last recommendation was "fiber_low" and fiber delta > 0 → improved

    # 5. trend logic:
    # "improving"  → majority of deltas are is_improvement=True
    # "declining"  → majority of deltas are is_improvement=False
    # "stable"     → no clear direction
    # "insufficient_data" → only 1 receipt

    # 6. message: plain language, 1 sentence
    # e.g. "Your fiber intake looks higher this week compared to last time — great progress."
    # Do NOT call LLM here. Use template strings only.
```

**No LLM call in this agent.** Template-based messages only. Examples:

```python
MESSAGES = {
    "improving": "Your nutrition profile looks better compared to your last receipt — keep it up.",
    "stable": "Your shopping habits look similar to last time — small changes add up over time.",
    "declining": "A few dimensions look lower than last time — your next receipt will show if it evens out.",
    "insufficient_data": "Upload another receipt next time you shop to start tracking your progress.",
}
```

---

#### API – extend the existing next-cart endpoint

```python
# Extend NextCartResponse to include progress
class NextCartResponse(BaseModel):
    receipt_id: str
    recommendation: Recommendation
    nutrition_profile: NutritionProfile
    gaps: list[Gap]
    progress: ProgressReport | None     # None if first receipt (has_history=False)
    disclaimer: str
```

**Do not create a separate endpoint.** Progress is returned as part of the existing
`GET /receipts/{receipt_id}/next-cart` response. The frontend decides whether to show it.

---

#### DB query needed

```python
# Load previous NutritionProfiles for this session
# ordered by created_at DESC, limit 4 (compare last 4 receipts max)
async def get_previous_profiles(session_id: str, exclude_receipt_id: str) -> list[NutritionProfile]:
    # Check first: does a nutrition_profiles table or column already exist?
    # If NutritionProfile is not persisted yet, report this dependency before implementing.
    pass
```

**Check first:** is `NutritionProfile` already persisted to the DB?
If not, Step 2 must save its output before Progress Tracking can read history.
Report this dependency if it is missing.

---

#### Fixture files to add

```
fixtures/previous_nutrition_profile.json    # a slightly different NutritionProfile
                                            # simulating last week's receipt
fixtures/progress_report.json              # expected ProgressReport output
```

---

#### Tests

```python
# backend/tests/test_progress_tracker.py

def test_no_history_returns_insufficient_data():
    # input: current_profile, previous_profiles=[]
    # assert: has_history=False, trend="insufficient_data"

def test_improvement_detected():
    # input: previous fiber=15g, current fiber=28g, addressed_gap="fiber"
    # assert: addressed_gap_improved=True, direction="up", is_improvement=True

def test_decline_detected():
    # input: previous sugar=30g, current sugar=65g
    # assert: is_improvement=False for sugar dimension

def test_disclaimer_always_present():
    # assert: disclaimer field is never empty regardless of input
```

---

#### What this agent proves on Demo Day

When you show Progress Tracking in the demo, you are directly demonstrating the
core hypothesis: **"Passive receipt tracking drives behavior change."**

Script for demo:
> "Here is receipt #1 — fiber looks low, we recommended oats.
> Here is receipt #2, uploaded after the next shopping trip —
> fiber intake is up. The loop works."

This is the strongest moment in the entire presentation.
Everything else supports it. This is the proof.
