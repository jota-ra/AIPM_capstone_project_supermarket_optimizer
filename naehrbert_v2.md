## Nährbert App 

should be available in German and English, 

Areas, Logic etc: 

## Login 

via Supabase Auth, with Google Auth Authorized JS Source URIs: 

- https://dyaulhennmkocdvynevx.supabase.co 

- - http://localhost:5173 

- Authorized referral URIs: 

   - https://dyaulhennmkocdvynevx.supabase.co/auth/v1/callback 

   - - http://localhost:5173/auth/callback 

already setup in supabase and google cloud console 

_Auth methods: email+password **and** Google OAuth via Supabase. Session: do **not** force login on every open — persist the Supabase session per current best practice; re-auth only on expiry/logout. No production domain yet, so Authorized URIs are localhost + the Supabase project only (add the prod callback at deploy). See "Review-pass decisions" → Minor items._ 

## Onboarding and user profile 

## User Profile creation 

Data to capture during onboarding: 

- name 

- sex assigned at birth (female / male) — drives the BMR/calorie baseline only (Mifflin–St Jeor is sex-specific); see M7 below. How you'd like to be addressed (name/pronoun) is asked separately in the onboarding flow. 

- date of birth (age) 

- height in cm 

- weight in kg 

- exercise frequency 

   - None (Sedentary) 

   - 1–2 sessions/week (lightly active) 

   - 3–4 sessions/week (Moderately Active) 

   - 5–6 sessions/week (Very Active) 

   - Daily / Competitive athlete (Athlete) 

- Daily Movement 

   - Mostly sitting (+0% Calories)

   - Mixed sitting & walking (+10% Calories)

   - Mostly standing/walking (+20% Calories)

   - Physical labor (+35% Calories)
   alternatively we could implement a connection to Google Health or apple health later on and directly access avg daily steps recorded here 

● Food Intake 

- how many full meals? 
- how often snacks? 

● Goal 
- Lose Fat
- Maintain current physique 
- Build Muscle 
- Aggressive bulk 

● Dietary style 

   - omnivore 

   - pescatarian 

   - vegetarian 

   - vegan 

- allergies and intolerances 

   - lactose 

   - gluten 

   - milk 

   - eggs 

   - peanuts 

   - tree nuts 

   - wheat 

   - soy 

   - fish 

   - crustacean shellfish 

   - sesame 

- other (to add stuff we have missed, can be added later on then) 

- ● dislikes (open field for food the user doesnt like) 

Data to capture once the first gap analysis has been made, to give more accurate recommendations (all optional, but beneficial for better recommendations): 

● Bowel regularity 

- Less than 3/week 

- Every 1–2 days 

- Once daily 

- Multiple times/day 

● Stool consistency 

   - hard 

   - normal 

   - loose 

● Bloating 

   - Never 

   - Sometimes 

   - Often 

   - Almost every day 

● Stomach discomfort 
   - none 
   - stomach pain 
   - heartburn 
   - gas 
   - nausea 

●  Energy 
   - consistently high 
   - afternoon crash 
   - tired most of the day 
   - varies a lot 

●  Hunger 
   - rarely 
   - before meals only 
   - hungry most of the day 
   - constantly hungry 

● Satiety 
   - satisfied 
   - still hungry 
   - overly full 

● Sleep 
   - excellent 
   - good 
   - average 
   - poor 

● Concentration 
   - focused 
   - distracted
   - mentally tired 
   - brain fog 

● Mood 

   - positive 
   - neutral 
   - stressed 
   - low energy 

● Hydration (daily) 

-  <1 L 
- 1–2 L 
- 2–3 L 
-  3 L+ 

● Alcohol 

○ never 
○ occasionally 
○ weekly 
○ several times/week 

● Supplements 

○ none 
○ multivitamin 
○ protein 
○ vitamin D 
○ magnesium 
- omega-3 
- iron 
- other 

## Onbording Flow: 

ask the user how they want to be addressed in the future. 

Introduce them to what the app wants to achieve, and that for this to work we will walk through a few categories together to enable spot on recommendations. Everything can also be edited later in the profile section. 

then walk step by step through each category shortly explaining how this category impacts how we feel, and the calculation of optimal calorie, micro and macro nutrients and then asking them about what best describes them. explain multipliers for exercise, movement etc 

always give a short re-assuring feedback about their answer, either complementing already healthy habbits or telling them to not worry, that many people have similar issues and that we can work on all of it together. 

the chat should feel warm and welcoming, yet still like you are talking to an expert. 

## How the data above should be used: 

## **Level 1: Physiological requirements (objective)** 

This is what we discussed previously. 

It answers: 

## **"How much does this person likely need?"** 

Inputs: 

- Age 

- Sex 

- Height 

- Weight 

- Activity 

- Goal 

These variables directly influence recommended calorie, macro, and some micronutrient targets. They are well established and can be calculated using formulas and dietary reference values. 

Level 2: Functional optimization (subjective) 

This answers: 

## **"Given how this person feels, what nutrients or eating patterns should we prioritize?"** 

These questions generally **do not change the official recommended intake** (RDA/AI/PRI). Instead, they change: 

- which nutrient gaps you prioritize, 

- which foods you recommend, 

- how you present those recommendations, 

- and in some cases, whether you suggest the user seek professional advice. 

So the recommendation engine becomes much smarter, even if the target nutrient values stay the same. 

Example 

Two users 

Both: 

- Male 

- 30 years 

- 80 kg 

- 180 cm 

- Muscle gain 

Ideal target 

- 3,000 kcal 

- 160 g protein 

- 100 g fat 

- 375 g carbs 

Exactly identical. 

User A 

Feels great. 

Recommendation: 

Increase protein by 20 g/day. 

User B 

Reports 

- afternoon fatigue 

- constant hunger 

- constipation 

The macro targets stay identical. 

The recommendations become very different. 

Instead of simply increasing protein, the app might recommend: 

- protein-rich breakfasts, 

- more fiber, 

- higher fruit and vegetable variety, 

- replacing refined grains with whole grains, 

- distributing protein more evenly throughout the day. 

The symptom profile changes **how** the recommendation is delivered, not the numerical target. 

Which questions actually influence nutrition? 

1. Digestion 

Constipation 

Often associated with 

- low fiber 

- inadequate fluid intake 

- low fruit intake 

- low vegetable intake 

Engine prioritizes 

- ↑ Fiber 

- ↑ Water reminders 

↑ Whole grains 

↑ Legumes 

## ↑ Fruit 

## Diarrhea 

Could be influenced by many causes. 

The engine should **not diagnose** the cause. 

Instead it might: 

- avoid recommending a rapid increase in fiber, 

- prioritize hydration, 

- suggest discussing persistent symptoms with a healthcare professional if appropriate. 

Bloating 

This is interesting. 

If receipts show 

- very low fiber 

recommend 

Increase fiber gradually. 

If receipts already show 

- high beans 

- high onions 

- high cabbage 

then perhaps recommend experimenting with meal composition rather than simply increasing fiber. 

## 2. Hunger 

This is one of the strongest signals. 

Constant hunger often correlates with 

- insufficient protein 

- low fiber 

- energy intake below needs 

- low meal volume 

The engine can prioritize 

protein first 

fiber second 

whole foods third 

instead of simply adding calories. 

## 3. Energy 

Low energy does not automatically mean 

"eat more calories." 

It may indicate 

- irregular meals 

- insufficient carbohydrates for activity level 

- low iron intake pattern 

- low B-vitamin intake pattern 

- poor sleep (not nutrition-related) 

If the receipt analysis also shows 

low iron 

low vitamin C 

little red meat 

few legumes 

then iron becomes a higher-priority recommendation. 

4. Muscle soreness / recovery 

For active users 

Persistent soreness might lead the engine to check whether the estimated diet includes: 

- adequate protein 

- sufficient total energy 

- magnesium-rich foods 

- potassium-rich foods 

Again, the RDA doesn't change, but those nutrients move up the recommendation list. 

## 5. Sleep 

Sleep quality itself doesn't change nutrient requirements much. 

However, poor sleep may influence which recommendations feel most relevant. 

For example: 

- limit late-evening caffeine, 

- ensure regular meal timing, 

- include magnesium-rich foods if intake appears low. 

## 6. Hydration 

Receipts don't tell you water intake. 

Someone drinking 

## 0.5 L/day 

with 

40 g fiber/day 

may need hydration advice before increasing fiber further. 

## 7. Alcohol 

Alcohol doesn't increase vitamin requirements in a simple linear way, but higher intake can reduce diet quality and affect nutrient status. 

The engine can: 

- reduce confidence in the nutrient estimate, 

- prioritize whole-food recommendations, 

- remind users that alcohol contributes calories not visible in grocery receipts if consumed elsewhere. 

Where these questions become really powerful 

Rather than changing the targets, they help the engine rank interventions. 

Imagine your receipt analysis finds eight potential gaps: 

- Protein 

- Fiber 

- Calcium 

- Iron 

- Vitamin C 

- Magnesium 

- Potassium 

- Omega-3 sources 

Without symptom data, every user gets roughly the same ranking. 

With symptom data, priorities become personalized. 

Example: 

|**Nutrient gap**|**Severit**|**Symptom relevance**|**Final priority**|
|---|---|---|---|
||**y**|||
|Protein|High|High (hunger, muscle recovery)|⭐⭐⭐⭐⭐|
|Fiber|Medium|High (constipation)|⭐⭐⭐⭐⭐|
|Iron|Mild|High (fatigue pattern)|⭐⭐⭐⭐|
|Calcium|Medium|None|⭐⭐⭐|
|Vitamin C|Mild|None|⭐⭐|



Same nutrient gaps. 

Different recommendation order. 

A recommendation scoring engine 

Rather than simply saying 

Gap = Recommendation 

you can score each recommendation. 

For example 

Recommendation Score 

= 

Gap Severity 

× 

Confidence 

× 

Symptom Relevance 

- × 

Goal Relevance 

Suppose 

Protein 

Gap severity 

90 

Confidence 

95% 

Symptom relevance 

## 1.4 

Goal relevance 

1.5 

90 

× 

0.95 

× 

1.4 

× 

1.5 

= 

180 

Fiber 

Gap 

70 

Confidence 

95% 

Symptom relevance 

1.6 

Goal relevance 

1.0 

70 

× 

0.95 

× 

1.6 

= 

106 

Now the engine naturally ranks protein first. 

I would add one more dimension 

I think the biggest opportunity isn't actually symptoms—it's **behavioral readiness** . 

Suppose two users have identical nutrition profiles. 

User A says: 

I love cooking. 

User B says: 

I only cook once a week. 

The best recommendations are completely different. 

For User A: 

- Add lentils to your chili. 

- Make overnight oats with berries. 

- Roast vegetables in bulk. 

For User B: 

- Buy high-protein yogurt. 

- Keep frozen vegetables on hand. 

- Choose whole-grain wraps. 

- Add pre-cooked chicken or tofu to ready meals. 

The nutrient target is identical, but the likelihood that the user will follow the recommendation is much higher because it matches their lifestyle. 

A useful way to think about your engine 

Your recommendation engine can combine four layers: 

1. **Physiological needs** — what the user should consume (calories, macros, micronutrients). 

2. **Estimated intake** — what the receipts suggest they're consuming. 

3. **Functional signals** — symptoms and well-being that help prioritize which gaps matter most. 

4. **Behavioral context** — cooking habits, shopping habits, dietary preferences, and time constraints that determine _how_ to recommend changes. 

That fourth layer doesn't change nutritional science, but it can dramatically improve adherence. In practice, the most effective recommendation is often not the nutritionally perfect one—it's the one the user is most likely to adopt consistently. 

## Ideal Intake Profile Generation 

### Total Daily Energy Expenditure 

The complete energy calculation

Every person's daily calorie expenditure consists of four components:

| Component                    | % of Total | Can we estimate it?          |
| ---------------------------- | ---------: | ---------------------------- |
| Basal Metabolic Rate (BMR)   |     60–70% | Yes (Mifflin-St Jeor)        |
| Daily Movement (NEAT)        |     10–30% | Yes (your movement question) |
| Exercise (EAT)               |      5–20% | Yes (your exercise question) |
| Thermic Effect of Food (TEF) |       ~10% | Approximate                  |

So your app estimates:

> **Calories = BMR + NEAT + Exercise + TEF**

rather than using one coarse multiplier.

---

### Step 1 – Calculate BMR

Nothing changes.

Example

Male

32 years

80 kg

182 cm

```
BMR = 1782 kcal
```

---

### Step 2 – Estimate Daily Movement (NEAT)

Instead of directly asking for an activity multiplier, ask about lifestyle.

For example:

| Daily movement          | Description             | Estimated NEAT multiplier |
| ----------------------- | ----------------------- | ------------------------: |
| Mostly sitting          | Office, student         |                       +0% |
| Mixed sitting & walking | Retail, teacher         |                      +10% |
| Mostly standing/walking | Nurse, waiter           |                      +20% |
| Physical labor          | Construction, warehouse |                      +35% |

Applied to BMR:

```
NEAT Calories

=

BMR × NEAT%
```

Example:

Desk job

```
1782 × 0.10

=

178 kcal
```

---

### Step 3 – Estimate Exercise (EAT)

Ask:

> How many workouts do you complete each week?

For example:

| Exercise frequency | Estimated daily exercise calories |
| ------------------ | --------------------------------: |
| None               |                                 0 |
| 1–2/week           |                      100 kcal/day |
| 3–4/week           |                      250 kcal/day |
| 5–6/week           |                      400 kcal/day |
| Daily / Athlete    |                     600+ kcal/day |

Example

4 workouts/week

```
Exercise

=

250 kcal/day
```

Notice this is **added**, not multiplied.

---

### Step 4 – Thermic Effect of Food (TEF)

Digesting food costs energy.

Usually estimated as

```
TEF

≈

10%

of total intake
```

For an MVP, simply estimate

```
TEF

=

10%

×

(BMR + NEAT + Exercise)
```

Example

```
1782

+

178

+

250

=

2210
```

TEF

```
221 kcal
```

---

### Step 5 – Total Daily Energy Expenditure (TDEE)

```
1782

+

178

+

250

+

221

=

2431 kcal
```

---

### Step 6 – Apply the Goal

Now apply the user's goal.

| Goal            | Adjustment |
| --------------- | ---------: |
| Lose fat        |       -15% |
| Maintain        |         0% |
| Build muscle    |       +10% |
| Aggressive gain |       +15% |

Example

```
2431

×

1.10

=

2674 kcal
```

This becomes the daily calorie target.

---

### How do exercise and movement affect macros?

Not equally.

#### Protein

Protein depends mostly on:

* body weight
* goal
* exercise

Movement has almost no effect.

For example:

| User                |      Protein |
| ------------------- | -----------: |
| Office worker       |     1.2 g/kg |
| 4 gym sessions/week | 1.8–2.2 g/kg |
| Endurance athlete   | 1.4–1.8 g/kg |

---

#### Fat

Usually remains

20–35% of calories.

Exercise doesn't significantly change the percentage.

---

#### Carbohydrates

This is where exercise matters most.

Suggested ranges:

| Exercise  |     Carbs |
| --------- | --------: |
| None      |  2–3 g/kg |
| Moderate  |  3–5 g/kg |
| Heavy     |  5–7 g/kg |
| Endurance | 6–10 g/kg |

Daily movement has a smaller influence than structured training.

---

## How do they affect micronutrients?

Generally, **they don't change the official recommended intakes much**.

However, they do influence which nutrients become more important to monitor or emphasize.

| Nutrient      | Higher priority when...                |
| ------------- | -------------------------------------- |
| Protein       | More exercise                          |
| Carbohydrates | More exercise                          |
| Magnesium     | Heavy exercise (monitor intake)        |
| Potassium     | Heavy exercise / sweating              |
| Sodium        | Heavy sweating (context-dependent)     |
| Iron          | Endurance athletes, menstruating women |
| Calcium       | Consistently important                 |
| Vitamin D     | Independent of activity                |

The key distinction is that activity usually changes **priority**, not the underlying dietary reference values.

---

## The model I would use for NutriWise

Instead of asking users to classify themselves as "lightly active" or "very active," collect two separate pieces of information and combine them:

#### 1. Daily movement (NEAT)

| Option                  | Multiplier applied to BMR |
| ----------------------- | ------------------------: |
| Mostly sitting          |                      0.00 |
| Mixed sitting & walking |                      0.10 |
| Mostly standing         |                      0.20 |
| Physical labor          |                      0.35 |

#### 2. Exercise frequency (EAT)

| Option            | Average kcal/day added |
| ----------------- | ---------------------: |
| None              |                      0 |
| 1–2 workouts/week |                    100 |
| 3–4 workouts/week |                    250 |
| 5–6 workouts/week |                    400 |
| Daily / Athlete   |                    600 |

#### 3. Goal

| Goal         | Calorie adjustment |
| ------------ | -----------------: |
| Lose fat     |               −15% |
| Maintain     |                 0% |
| Build muscle |               +10% |

#### 4. Macros

* **Protein:** determined by body weight, exercise level, and goal (e.g., 1.6–2.2 g/kg for active users building muscle).
* **Fat:** approximately 25–30% of target calories (with a minimum around 0.8 g/kg body weight).
* **Carbohydrates:** receive the remaining calories, with higher exercise levels pushing the target toward the upper end of carbohydrate recommendations.

This approach has three major advantages:

1. **Greater accuracy** because it separates occupational movement from intentional exercise.
2. **More explainable calculations**, making it easier to show users *why* their calorie target differs.
3. **Future flexibility**, since you can later refine the exercise component by incorporating workout duration, sport type, or wearable data without changing the rest of your model.


## Macro & Micro Nutrient Profiles 

## **Protein** 

- depends primarily on **goal** and **activity** . 

- Typical recommendations per weight (kg) 

- Sedentary0.8g 

- Healthy adult1.0g 

- Recreational training1.2–1.6g 

- Muscle gain1.6–2.2g 

- Fat loss1.8–2.4g 

- Endurance athlete1.2–1.8g 

- Notice that **weight** is much more important than calorie intake. 

## **Fat** 

- Usually 

- 20–35% of calories 

- or 

- 0.8–1.2 g/kg body weight 

- Healthy fats are usually kept above a minimum because of hormone production. 

## **Carbohydrates** 

- Carbs are generally the "remaining calories." 

- High activity users receive more carbs. 

- Examples 

- Sedentary 

- 2–3 g/kg 

- Active 

- 4–6 g/kg 

- Endurance athletes 

- 6–10 g/kg 

## **Micronutrients** 

## - **ideally pull from WHO database** 

Micronutrients are mostly **independent of calories.** 

Instead, they depend on: 

- age 

- sex 

- pregnancy (if applicable) 

- lactation 

- sometimes activity level 

For example 

- Iron 

- Male: 8 mg 

- Female (19–50): 18 mg 

- Calcium 

- Adults: ~1000 mg 

- Older adults: 1200 mg 

- Vitamin D 

- 600–800 IU 

- Fiber 

- Depends on calories and sex. 

- Typical recommendation 

- 14 g per 1000 kcal 

- or 

- 25–38 g/day 

→ results in our 3 ideal profiles for calories, macro nutrients and micro nutrients. 

## Receipt Upload (Loop) 

possible via jpg, jpeg, png, pdf, or direct photo multiple selection should be possible as well 

give a short disclaimer: 

explain how much data is needed for what, e.g.: 

- 1 receipt - Snapshot only. Good for product-level feedback (“low fiber basket”), not daily intake. 

- ~7 days - Rough calorie and macro trend if shopping is frequent. 

- 14 days - First meaningful comparison to targets. 

- 28–30 days - Best MVP baseline. Captures weekly shopping cycles, bulk purchases, and most recurring foods. 

- 60–90 days - Strong signal for micronutrient patterns and seasonality. 

Or even better- Practical thresholds: 

- Too sparse - <20 items 

- Low confidence - 20–50 items 

- Moderate confidence -50–100 items 

- Good confidence - 100–200 items 

- Very good confidence - 200+ items 

A typical German supermarket household generates 120–250 line items per month, so 100+ matched items is a realistic target. 

data to extract: 

- date of supermarket trip 

- - name of store 

- number of food items 

- food items 

   - name for matching 

   - quantity 

   - unit 

   - price 

## Product Matching (Loop) 

via BLS.de data or via Open Food Facts API. outcome of test between the 2:
"What did they actually buy?" — identity resolution. This is the hard part, and OFF wins it decisively (71% vs 33% strictly correct). OFF is a branded retail catalogue, so when it hits, it hits the real product.
"What is the full nutrient profile of that food?" — nutrition lookup. This is where BLS wins: 100% macro completeness, and — the part that matters most for Nährbert — BLS is a 418-column scientific composition table that carries the full micronutrient spectrum (vitamins, minerals, amino acids, fatty-acid fractions). OFF has essentially none of that. We only pulled 4 macro fields for the comparison, but the micros are sitting in BLS.
So: OFF decides which food; BLS supplies what's in it.

**Tier 0 (runs before everything below): a learned "verified-match" lookup keyed on the raw receipt text — see M12 in "Review-pass decisions". User-confirmed matches are reused automatically, so accuracy rises with use instead of being capped at the 71%/33% ceiling.**

The ideal pipeline

Receipt item (normalized text)
        │
 ┌──────▼───────────────────────────────────────┐
 │ STEP 1 — IDENTITY                             │
 │  1a. OFF search (current scoring + form-word  │
 │      /NOVA guards). Confident hit → identity, │
 │      keep its name, brand, NOVA.              │
 │  1b. else → BLS generic head-noun match, but  │
 │      ONLY accept for whole/raw foods with     │
 │      head-noun agreement (recovers the ~30%   │
 │      OFF misses: Radieschen, Himbeeren, …)    │
 └──────┬───────────────────────────────────────┘
        │  identity known
 ┌──────▼───────────────────────────────────────┐
 │ STEP 2 — NUTRITION (per identified food)      │
 │  • macros + micros: prefer BLS, mapped from   │
 │    the identity's head noun + category,       │
 │    picking the "roh"/plain variant.           │
 │    GUARD: only borrow BLS values when food    │
 │    type agrees; else keep OFF's own values.   │
 │  • NOVA / processing: always OFF (BLS has     │
 │    none) → falls back to category table.      │
 └──────┬───────────────────────────────────────┘
        │  still nothing usable
 ┌──────▼───────────────────────────────────────┐
 │ STEP 3 — category estimate (unchanged),       │
 │  flagged low-confidence / "unknown" bucket    │
 └───────────────────────────────────────────────┘
The one new component is the OFF→BLS bridge in Step 2: take the product OFF identified ("Gouda Jung", branded), reduce to its head noun, and pull the authoritative complete profile from the matching BLS generic ("Gouda 48% Fett i.Tr."). This second match is easier and safer than raw receipt matching, because the OFF name is already clean and OFF's category/NOVA constrain the BLS search.

The one guardrail that makes it work
BLS is only ever trusted for nutrition when the food type is independently confirmed — either OFF identified it and the head noun agrees, or it's an unambiguous whole-food generic match. Never let BLS free-match branded or prepared items. That single rule is what quarantines BLS's entire 33%-accuracy problem: every BLS failure in the study (duck giblets for raspberries, beer for eggs, meatloaf for Gouda) came from BLS free-matching a branded/compound name it had no real entry for. Gate that off and you keep BLS's strengths (complete macros + micros) without its weakness.

Why this beats either alone
OFF only (today)	BLS only	Two-role hybrid
Identity accuracy	71%	33%	71%+ (OFF) with whole-food recovery
Coverage	70%	87% (but wrong-food)	~85% of correct matches
Macro completeness	85%	100%	~100% (BLS-filled)
Micronutrients	~none	full	full ← unblocks Nährbert
NOVA/processing	yes	none	yes (OFF preserved)
Notably, this is the design that unblocks C1 in the Nährbert review — the symptom→micronutrient prioritization ("fatigue → iron", the gap list of Calcium/Iron/Vit C/Mg/K) is only implementable if something supplies per-food micros, and BLS-as-nutrient-authority is that something. Without this split, micros have no source at all.

Practical details worth baking in
Provenance per field. Tag every nutrient value with its source (off / bls / category) and carry two separate confidences: identity confidence and nutrition confidence. This keeps the "estimated, not measured" honesty and lets the health-grouping keep excluding guessed data (the "unknown" bucket we just added).
Compute the OFF→BLS bridge once per distinct product, cached in the products registry (MATCH-3) — not per receipt line.
Default to the raw/plain BLS variant. BLS often has "Gurke roh" vs "Gurke gedünstet" (steamed) — cooking state changes the numbers. Pick the raw entry for raw-purchased items (same spirit as the existing prefer_low_processed).
A "micro-coverage" metric — % of basket items with real (non-category) micronutrient data — tells you at a glance whether the Nährbert micro features are viable on a given user's data yet.
Licensing check before shipping. BLS 4.0 is a licensed dataset; confirm redistribution terms for bundling the xlsx in the app (OFF is open-data, BLS is not).
Honest risks
The OFF→BLS bridge is itself a fuzzy match and can err — mitigated by the type-agreement gate and the "keep OFF's own values when uncertain" default.
Manual pins (REV-2) should override identity and then re-run Step 2, so a user correction propagates to the nutrient profile.

Calculate total calories, macro and micro nutrients from matched food items, their quantities and units. 

## review steps
shows extracted and matched products alongside their original extracted text, their detected Quantity and unit. All can be corrected by the user.

user can also directly search Open Food Facts and BLS data from the review. Only results are shown with nutrient data. user can also tap a "no match found" option to give direct feedback here.

app should collect no match found products, so they can be analyzed later and either added manually or matching should be improved somehow

## Status Quo Profile creation (Loop) 

ask user: 

- People eating from these groceries or if easier: how much of this do you eat in % 

- when adding a new receipt, you can select if/how much of the last purchase you had to throw away 

- Meals eaten outside groceries? 

   - Rarely (<10%) 

   - Sometimes (10–30%) 

   - Often (30–50%) 

   - Most meals (>50%) 

- Do these receipts represent all (or almost all) of your grocery shopping? 

   - Yes, almost everything 

   - Most of it (about 75%) 

   - About half 

   - Less than half 

Use input to adjust calorie intake, macro and micro nutrient intake of Status quo profile 

how to know in which timeframe food from receipts was consumed: because of Stockpiling and bulk purchases like Rice, oats, oil, frozen food, and supplements: may be purchased once and consumed over months. 

MVP solution: assume these goods are used over time (30-90 days, typical “best used by timeframes or ideally: set the consumption timeframe once they are purchased the next time, so if last week friday I purchased milk, and this week wednesday I upload another receipt with milk, not stating that i threw anything away, the app can set my consumption timeframe for milk automatically and can adjust this over time to have an average consumption timeframe across all things I buy gradually). This can also show how diverse users eat. 

+ add consumption timeframes for purchased goods in table, allows later to see how frequently specific products need to be purchased, unlocks possibilities to do optimized shopping in the future regarding money savings. 

## A/B TESTING: 

feedback what was eaten: 

A - at time of next receipt upload (if last upload exists, while waiting for the product extraction and matching on the new recipe, ask: what of your last receipt did you eat, what is still left over, what did you have to throw away?) 

B - daily update of what you ate via dashboard 

## Gap Detection (Loop) 

Ideal Profiles vs Status Quo profiles outcome: 

Status Quo: 

- **overall healthscore out of a 100** (100 would be if everything was perfect) 

- **detail overview of macro and micronutrients** . 

   - display via horizontal bars from 0 to 100(ideal) to over 100 (oversonumption), the closer we are to ideal, the greener the bar, the further away (over or underconsumption) the more red the bar gets 

What to drop - unhealthy/unsuited items (respect dietary profile, intolerances/allergies and dislikes) 

What to add - healthy alternatives or items to add to get closer to ideal profile (respect dietary profile, intolerances/allergies and dislikes) 

possibility to check out a full grouping of all bought food items in **3 tiers** (aligned with the current app), from NOVA processing level + sugar — see M8 for thresholds: 

- Healthy (green) 

- OK (yellow) 

- Unhealthy (red) 

- (+ "Not enough data" — items with no confirmed nutrition are shown separately, never guessed) 

Motivate users to shift here, also congratulate users if they manage to improve this over new uploads 

weekly and monthly trends to be displayed as soon as uploaded receipt data permits it. 

First time a user gets here: ask the additional profile questions from User Profile creation. 

## Next Cart Recommendations (Loop) 

user needs to tap on the Next Cart Recommendations area, then gets asked: 

to meaningfully give you recommendations, please let me know: 

- for how many days do you plan to shop? 

- How often do you want to eat home cooked meals 

Then combine this output with our detected gaps, dietary profile, intolerances/allergies and dislikes to propose recipes, let the user select an appropriate amount of recipes and then generate their shopping list 

Everything inside the Loop is the general flow inside the app, it gradually takes more and more data and improves recommendations, updates profile and status quo etc. 

## Dashboard 

- Overall Health Score _(cross-user comparison — "top x% of healthiest users" — is **post-MVP**)_ 

- **detail overview of macro and micronutrients** 

- upload new receipt 

- counter: uploaded receipts & items _(cross-user comparison is **post-MVP**)_ 

- selected recipes 

- item health ranking 

- update consumption 

   - what was eaten / trhown away / still exists 

- edit profile 

Edit Profile leads to the profile overview, here all given data can be seen and adjusted, language can be switched between german and english, and there is a possibility to delete the profile


---

# Review-pass decisions & detailed specs (2026-07-13)

Resolves the open items from the PM review. Where a spec here refines an area above, it takes precedence. All numeric constants are **tunable config defaults**, not hard-coded magic numbers.

## Scope: MVP vs later

**MVP = everything in this document except the items below.**

**Post-MVP (explicitly deferred):**
- Google Health / Apple Health integration (auto activity/step import).
- Cross-user comparisons ("top x% of healthiest users"; "how intensely you use the app vs others").
- Recipe generation + recipe-based shopping lists — MVP keeps only item-level Next-Cart recommendations (see M9).
- Added-sugar-specific health thresholds — MVP uses total sugar as a proxy (see M8).

## C3 — GDPR / privacy (health data)

The app collects Art. 9 GDPR **special-category health data** (symptoms, digestion, sleep, mood, alcohol, supplements). No lawyer/DPO is engaged, so we stay deliberately conservative:

- **Explicit, separate consent** for health-data processing, captured at the *start of the Level-2 (symptom) questionnaire* — not bundled into general terms. Opt-in, specific, revocable. The app stays fully usable (login, profile, Level-1 targets, macro gap analysis) **without** consenting to Level-2.
- **Lawful basis:** explicit consent (Art. 9(2)(a)), stored with timestamp + the version of the consent text shown.
- **Data minimization:** collect only fields used in a calculation or recommendation; every Level-2 field is optional.
- **Purpose limitation:** health data personalizes *this user's* recommendations only. Never sold; never used for cross-user ranking (that feature is aggregated/anonymised and post-MVP regardless).
- **Access & portability:** user can export their full profile + receipts + derived profiles (JSON/CSV) from Edit Profile.
- **Erasure:** "delete profile" performs a **hard cascade delete** (profile, receipts, uploaded images, derived nutrition rows), not a soft flag.
- **Retention:** delete raw receipt **images** after successful processing unless the user opts to keep them; keep derived nutrition rows while the account is active.
- **Storage:** encrypted at rest (Supabase default) + row-level security so a user reads only their own rows.
- **Not medical advice:** persistent, unmissable disclaimer wherever symptoms → recommendations appear — *"Nährbert provides general nutrition information, not medical advice or diagnosis. Consult a healthcare professional for medical concerns."* The engine never diagnoses (already stated for diarrhea); this is a global rule.
- **Minimum age:** 16 (GDPR default) at sign-up; the calculations aren't validated for children.

## C4 — micronutrient inputs & source (resolved)

Micronutrient **targets** come from age/sex-specific DGE/EFSA reference values; micronutrient **intake** comes from the OFF→BLS resolver (OFF identity → BLS nutrient profile). Pregnancy/lactation materially change iron/calcium/folate targets and are **now required onboarding inputs** — add to User Profile creation: *"Currently pregnant or breastfeeding?"* (none / pregnant / breastfeeding), female profiles only, optional, editable.

## M3 — Resolving published ranges to single deterministic targets

Every range collapses to **one** runtime value (ranges are the safe envelope, never shown to the user):

| Target | Rule → single value |
| --- | --- |
| Goal calorie adjustment | already single: lose −15%, maintain 0%, build +10%, aggressive +15% |
| Protein (g/kg) | `max(activity_value, goal_value)` — activity: none 1.0 / 1–2wk 1.4 / 3–4wk 1.6 / 5–6wk 1.8 / athlete 1.8; goal: fat-loss 2.0, build 2.0, aggressive 2.0, maintain 1.2 |
| Fat | `max(30% of target kcal, 0.8 g/kg)` |
| Carbohydrates | remaining kcal after protein + fat (deterministic by construction) |
| Fiber | 14 g per 1000 kcal of the calorie target |
| Micronutrients | single age/sex/pregnancy-specific RDA (DGE/EFSA) |

## M4 — Recommendation scoring engine (concrete)

Replaces "worst gap first" with a weighted score. For each candidate intervention tied to a nutrient:

```
Score = GapSeverity × Confidence × SymptomRelevance × GoalRelevance
```

- **GapSeverity ∈ [0,1]** — deficit: `clamp((target − intake)/target, 0, 1)`; excess (sugar, sat fat, calories): `clamp((intake − target)/target, 0, 1)`.
- **Confidence ∈ [0,1]** — the snapshot/nutrient confidence (M10); gaps built on guessed or thin data score lower.
- **SymptomRelevance ≥ 1** and **GoalRelevance ≥ 1** — from the lookups below (default 1.0; multiple symptom hits stack multiplicatively, capped at 2.0).

Rank descending, surface the **top 3** (consistent with the current app). This extends the existing rule-based recommender: still deterministic, still no invented nutrition facts — only the *ordering* becomes symptom/goal-aware.

**Symptom → nutrient relevance (MVP lookup):**

| Trigger (answer) | Effect |
| --- | --- |
| Bowel < 3/week OR hard stool | fiber ×1.6 + water reminder |
| Bloating often/daily **and** basket already high-fiber | fiber ×0.7 (suppress) + "adjust meal composition" note |
| Hunger "most of day" / "constantly" | protein ×1.5, fiber ×1.3 |
| Energy "afternoon crash" / "tired most of day" | iron ×1.4, complex-carbs ×1.2 (+ sleep flag) |
| Muscle soreness (active users) | protein ×1.3, magnesium ×1.3, potassium ×1.2 |
| Sleep "poor" | magnesium ×1.2 (+ caffeine-timing tip) |
| Hydration < 1 L **and** high fiber | fiber ×0.7 + hydration advice first |
| Alcohol weekly+ | global confidence ×0.85 + whole-food nudge |

**Goal → nutrient relevance (MVP lookup):**

| Goal | Effect |
| --- | --- |
| Build muscle / aggressive | protein ×1.5, carbs ×1.2 |
| Lose fat | protein ×1.4, fiber ×1.3 |
| Maintain | protein ×1.1 |

## M5 — Turning receipts into actual intake (flow + math)

```
intake_from_receipts = grocery_total × user_share × (1 − waste_fraction)
```

Question flow:
1. "Are these groceries shared with others?" → **No** ⇒ `user_share = 100%`. **Yes** ⇒ "With how many people in total?" then "Roughly what share do you eat?" (default `1/household_size`, adjustable).
2. At each later upload: "Of your last shop, how much did you have to throw away?" → `waste_fraction`.

The other two original questions do **not** multiply intake (that would double-count): *"meals eaten outside"* and *"do receipts represent all your shopping"* describe intake the receipts can't see, so they feed the **confidence discount** (M10) and a caveat — not the intake number.

## M6 — Consumption timeframe (three layers)

Converts a basket into daily intake despite stockpiling. Product identity across receipts uses the resolver's `matched_product_id`.

1. **Default (works from receipt #1):** category shelf/consumption-window lookup — fresh produce 3–7 d, dairy 7–10 d, bread 3–5 d, fresh meat/fish 2–4 d (frozen 30–60 d), pantry staples (rice/oil/flour/pasta) 60–90 d, supplements ~90 d.
2. **Refine (repeat purchases):** when the same product reappears, use the actual inter-purchase interval and keep a rolling per-product average (the milk example) — the most accurate signal, improving over time.
3. **Correct (feedback):** the "eaten / still have / threw away" question at each upload adjusts remaining quantity — and for one-off items that never reappear, this is the *only* correction signal, so it's the fallback for stockpiled/one-off goods.

## M7 — Sex vs. gender for the calculation

- Capture **"sex assigned at birth (female / male)"** as the metabolic input, with a one-line reason ("used only to estimate your calorie/BMR baseline — the formula is sex-specific"). This is the physiologically correct input for Mifflin–St Jeor.
- Keep the separate onboarding question **"how would you like to be addressed?"** (name/pronoun) for tone/identity — never derive BMR from it.
- "Prefer not to say" / non-binary → compute BMR as the **average of the male and female formulas** (a defensible neutral estimate) and say so.

## M8 — Item health grouping: 3 tiers (aligns with current app)

From NOVA processing level + sugar:
- **Unhealthy (red):** NOVA ≥ 4 **OR** sugar ≥ 20 g/100 g.
- **Healthy (green):** NOVA ≤ 2 **AND** sugar < 10 g/100 g.
- **OK (yellow):** everything in between.
- **Not enough data (grey):** no confirmed nutrition — shown separately, never guessed (bucket already added to the current app).

Caveat: OFF/BLS carry **total** sugar, not added sugar; MVP uses total sugar as the proxy and tightens to added-sugar thresholds later when that data exists (added-sugar thresholds = post-MVP).

## M9 — Recipes (post-MVP) + recommended approach

MVP ships the existing **item-level Next-Cart recommendations** (add / replace / reduce, grounded in detected gaps + dietary profile) — no recipe engine yet. When recipes are built:

- **Retrieval, not free LLM generation:** a curated recipe set or a recipe API with **structured ingredient lists**.
- Filter candidates by dietary style, allergies, dislikes, and the top scored gaps.
- Compute each recipe's nutrition through the **same OFF/BLS resolver** — recipe nutrition is grounded, never invented.
- Map recipe ingredients → buyable products + quantities to generate the shopping list.
- The LLM only phrases/orders suggestions; it never produces nutrition numbers (same rule as the rest of the app).

## M10 — The "confidence" model (one definition, used everywhere)

A single 0–1 score, surfaced as **Low / Medium / High**.

- **Per item:** `identity_conf × nutrition_conf` from the resolver; category-fallback items fixed at 0.3; unknown 0.
- **Snapshot / per nutrient:**

```
snapshot_conf = data_conf × coverage_conf × completeness
                × external_intake_discount × alcohol_discount
```

  - `data_conf` = contribution-weighted mean of per-item confidence for that nutrient.
  - `coverage_conf` from the item-count tiers already in this doc (<20 → 0.2, 20–50 → 0.4, 50–100 → 0.6, 100–200 → 0.8, 200+ → 1.0).
  - `completeness` = share of the basket with a real (non-category) match.
  - `external_intake_discount` from "meals eaten outside" (rarely 1.0 … most meals 0.6) and "receipts represent all shopping" (all 1.0 … <half 0.5).
  - `alcohol_discount` = 0.85 if weekly+.

This one number feeds the scoring engine's Confidence term (M4), the health-score badge (M11), and every "estimated, not measured" label.

## M11 — Overall health score + the "3 profiles" terminology

- The **ideal profile** and the **status-quo profile** each consist of **three sub-profiles**: calories, macros, micros. Gap detection compares them sub-profile by sub-profile (the bar view). The **overall health score** is the single roll-up across all dimensions.
- **Per-dimension closeness (0–100):** `100 × (1 − clamp(|intake − target| / target, 0, 1))` — full marks at target, declining as you go under **or** over. For ceiling nutrients (sugar, sat fat) only over-consumption is penalized.
- **Overall score:** weighted mean of closeness scores — e.g. calories 20%, protein 15%, fat 10%, carbs 10%, fiber 15%, micronutrients-as-a-group 30% (split evenly). Weights tunable.
- **Confidence handling:** display the score **with** the confidence badge; do **not** let a low-confidence basket present a misleadingly high number (MVP: show both side by side; optionally shrink toward 50 when confidence is Low). Consistent with the current app's separate confidence label.

## M12 — Learned, human-in-the-loop matching (verified-match store)

Our experiments showed receipt names ("Vand.Mai Gouda", "BesteErnte Himbeeren 500g", "THUER.METT/HACKEP.") match poorly to either database — OFF tops out ~71% correct, BLS ~33%. Automatic matching alone will always leave a meaningful error tail. The fix is to **learn from the user's own corrections and reuse them**, so accuracy compounds over time instead of being capped.

**Flow (extends the Review step):**
1. **Extract** raw text from the uploaded receipt (unchanged).
2. **Auto-match** each item through the resolver — **Tier 0 learned lookup first** (below), then the OFF → BLS → category tiers from Product Matching.
3. **Review UI:** for each item, show the auto-match plus, on demand, a **candidate overview searched live from *both* OFF and BLS**, filtered to **only results that carry nutritional data**. The user confirms the auto-match, picks a better candidate, searches manually, or taps **"no match found."**
4. **Persist the confirmation** to the verified-match store (below). This is the training signal.

**Tier 0 — learned lookup (new first step of matching):**
Before any fuzzy DB search, check the verified-match store keyed on `(normalized_raw_text, store)`:
- **exact key hit** → use it directly, confidence = 1.0 (user-verified), skip the fuzzy search entirely.
- **store-agnostic hit** (same raw text, no/other store) → use it at slightly lower confidence.
- **else** → fall through to the OFF/BLS resolver as specified in Product Matching.

**What we save on every confirmed / corrected match:**

| Field | Why |
| --- | --- |
| `raw_text` (normalized) | the lookup key |
| `store` (if extracted) | private-label names collide across chains — scope the key |
| `chosen_source` (`off` / `bls` / `manual`) | provenance |
| `product_id` (`off_id` or `bls_code`) | stable identifier to re-fetch / verify |
| `matched_name` | display + audit |
| nutrition snapshot (kcal, macros, micros) | future matches don't re-query the API |
| `nova` / processing (if from OFF) | needed for health grouping |
| `verified = true`, `confidence = 1.0` | user-verified |
| occurrence / vote count, last-updated | crowd aggregation + freshness |

**Per-user vs shared:** the store is **global, de-identified reference data** — a raw-text → product mapping is not health data. Sharing it creates a network effect: every correction improves matching for *everyone*, without exposing who bought what. Keep it in a **separate table from personal receipt rows, with no user foreign key**. Conflicts (same raw text → different products across users) resolve by majority vote / most-recent, with low-agreement keys flagged for manual review.

**"No match found" capture:** unmatched items are logged (raw text + store + frequency) as the doc already notes — high-frequency unmatched strings become the priority queue for manually adding products or improving matching.

**Why this is the right call:** it turns the hard 71%/33% ceiling into a floor that rises with usage — the first user to correct "Vand.Mai Gouda → Gouda 48% Fett" fixes it for every future occurrence, for everyone. It also reuses machinery already in the current app (review step, `match_corrected` events, products registry [MATCH-3], manual pin [REV-2]); this decision formalizes them into a first-class learned-lookup tier.

## Minor items

- **Login:** email+password **and** Google via Supabase; do **not** force login every open — persist the session per best practice; no production domain yet (add prod callback at deploy).
- **Worked TDEE example:** state the assumption explicitly (the example user is "moderately active / ~4 workouts a week") so readers can reproduce the numbers.
- **A/B test (eaten-feedback):** implement **both** variants (A: at next upload, B: daily dashboard) and decide by user testing; success metric = feedback-completion rate + retention.
- **Error / empty states — reuse the current app's MVP behaviour:** typed extraction errors surfaced to the user (rate-limited → retry, unavailable → try later, invalid image), storage failure non-fatal (parsing still succeeds), a clear "we couldn't match X% of your basket" notice, and an explicit "no gaps / you're on target" state.
- **Additional (Level-2) profile questions** are asked **after the first gap analysis** — the first time the health score & recommendations are shown.
- **Onboarding flow** (including the short reassuring feedback after each answer) is **static, localized copy** (DE/EN), not LLM-generated.
