# NutriWise: Metrics Framework & Data Collection Plan

---

# Part 1: Top 10 Metrics

Each metric is tied to a specific assumption from the synthetic research that needs proving or disproving — not tracked for its own sake.

## User Behavior Metrics

**1. Receipt upload rate (uploads / expected grocery trips per week)**
Tests Assumption #1 (receipts are a viable consumption proxy) and #2 (habit survives past novelty). This is the single most important metric in the whole plan — if this fails, the core mechanic fails.
*Target signal:* Sustained rate above ~50% of expected trips by week 4. A sharp drop-off between week 1 and week 3 (matching Tobias's MyFitnessPal pattern) disproves the "no logging = sustainable" pitch.

**2. Time-to-first-gap-analysis (days/uploads from signup to first personalized insight)**
Tests whether the free tier (2 uploads/month) can actually deliver the promised "aha moment" Lena and Sara both said they needed to trust the product.
*Target signal:* Under 14 days. If most free users churn before reaching this, the funnel is broken before value is ever shown.

**3. Week-1 → Week-4 retention curve**
Tests Assumption #2 directly and separates "liked the concept" from "kept the habit."
*Target signal:* Compare against known nutrition-app benchmarks (typically 15–25% W4 retention industry-wide); anything notably below suggests the receipt mechanic isn't reducing friction as promised.

**4. Recommendation action rate (% of AI suggestions marked "done" or acted on)**
Tests Assumption #4 (users trust AI nutrition guidance enough to act on it) — the most untested assumption from the synthetic round.
*Target signal:* Meaningful minority acting on suggestions (>20%) with low "dismissed without reading" rate.

**5. Diet-type/profile customization completion rate**
Tests Assumption #3 (personalization drives activation, not just satisfaction). If most users skip this step, personalization may matter less than the synthetic Sara persona suggested.

## Business Metrics

**6. Free-to-paid conversion rate**
Tests Assumption #5 (stated price tolerance ≠ real payment behavior) — directly resolves Tobias's "price isn't the barrier" claim against actual behavior.
*Target signal:* Compare against freemium health-app benchmarks (~2–5% typical); segment by archetype to see who actually converts.

**7. Plan-tier distribution (Free / Plus / Family split among paying users)**
Tests whether the Family/allergy-aware tier is a real business driver (as Tobias's profile suggested) or a niche feature nobody pays for.

**8. Referral / invite rate (for Family plan and word-of-mouth generally)**
Tests the "trusted recommendation" adoption path — Tobias explicitly said he only adopts tools his wife or colleagues vouch for; this measures whether that pathway actually materializes at scale.

## Satisfaction Metrics

**9. Post-recommendation trust score (single-item: "I would act on this without checking elsewhere")**
Directly measures the emotional/trust gap identified as a blind spot in the synthetic research — captured in-context, right after a real recommendation is shown, not abstractly.

**10. Archetype-segmented NPS or CSAT (not blended)**
A single blended satisfaction score will hide the exact tension we predicted: allergy-aware planning delighting Tobias while alienating Sara. Segment by self-reported diet type / life stage so contradictory reactions don't cancel out in an average.

---

# Part 2: Data Collection Plan

## 1) User Actions to Track (event-level instrumentation)

| Event | Properties to capture |
|---|---|
| `receipt_uploaded` | timestamp, item count, upload method (camera/gallery/forward), time since last upload |
| `gap_analysis_viewed` | days since signup, number of uploads that triggered it |
| `recommendation_shown` | recommendation type (swap, addition, general tip), nutrient gap addressed |
| `recommendation_action_taken` | marked done / dismissed / saved / ignored (no action after N days) |
| `onboarding_step_completed` / `onboarding_step_skipped` | step name, especially diet-type/goal selection |
| `paywall_viewed` | tier shown, entry point (which feature triggered it) |
| `subscription_started` / `subscription_cancelled` | tier, days-to-decision, cancellation reason (if captured) |
| `session_opened` | time since last session, entry point (push notification / organic / referral) |
| `family_member_invited` | accepted vs. pending |
| `app_uninstalled` or `90-day dormancy` | last meaningful action taken before drop-off |

## 2) Questions to Ask Users (survey + interview touchpoints, not just analytics)

**In-app micro-surveys (short, contextual, triggered by behavior):**
- After first gap analysis: "How well does this reflect what you actually eat?" (1–5) + open text
- After a shown recommendation: "Would you act on this without checking elsewhere?" (ties to Metric 9)
- After a skipped/dismissed recommendation: "What made you skip this one?" (open text, single tap options)
- At day-30 if inactive: "What got in the way of using NutriWise this month?" (multiple choice + other)
- At cancellation: mandatory single-question reason (price / didn't see value / too much effort / found alternative / other)

**Periodic longer survey (monthly cohort, ~5 min):**
- Diet type / restriction status (self-report, to enable Metric 10 segmentation)
- "How much do you trust the recommendations you've received?" (1–7 Likert)
- "How does this compare to other health/nutrition apps you've tried?" (open text — captures switching reasons the interview guide flagged as often inarticulate)

**Moderated follow-up interviews (quarterly, small-N):**
- Reuse the contradiction-probing and behavioral questions from the interview guide, but now anchored to the participant's *actual* usage data pulled beforehand ("I see you uploaded 3 receipts in week 1 and none since — walk me through that week").

## 3) Success/Failure Measurements

Define explicit go/no-go thresholds *before* collecting data, tied back to the five assumptions:

| Assumption | Success threshold | Failure signal |
|---|---|---|
| Receipts proxy consumption well | Upload rate >50% of expected trips at W4 | Upload rate <25% at W4, or high "receipt didn't match my actual eating" survey scores |
| Habit survives novelty | W4 retention within range of category benchmarks | Retention drop >50% between W1 and W3 |
| Personalization drives activation | Users completing diet-type step show higher W1 activation than those who skip it | No activation difference between completers and skippers |
| Users trust AI guidance | >20% recommendation action rate, trust score >5/7 | Action rate <10%, or high "dismissed without reading" |
| Price tolerance matches stated intent | Free-to-paid conversion within/above freemium benchmark (~2–5%) | Conversion <1%, or high paywall-view-to-abandon ratio |

## 4) Statistical Sample Sizes Needed

Using standard sample size formula for proportions: n = (Z² × p(1−p)) / e², Z=1.96 (95% confidence), assuming p≈0.5 (conservative, maximizes required n) unless a tighter prior estimate exists.

| Metric type | Target margin of error | Approx. sample size needed |
|---|---|---|
| Behavioral funnel metrics (upload rate, retention, action rate) | ±5% | ~385 users per cohort |
| Conversion rate (with expected low base rate ~3%) | ±1.5% (relative), using p=0.03 | ~500 users per cohort (larger due to low base rate variance) |
| Satisfaction/trust scores (Likert, comparing means) | Detect a 0.5-point difference on 7-point scale, power=0.8 | ~85–100 responses per segment (using standard two-sample t-test power calc, σ≈1.5) |
| Segmented NPS/CSAT (3 archetypes) | ±7% per segment (smaller n acceptable per segment) | ~150–200 per archetype segment, ~450–600 total |
| Qualitative/moderated interviews | Saturation-based, not statistical | 8–12 per archetype segment (24–36 total) is typically sufficient to reach thematic saturation |

**Practical implication:** aim for at least 400–500 active users in the tracked cohort before drawing conclusions on behavioral/funnel metrics, and recruit no fewer than 8 people per archetype for qualitative follow-up. Below these thresholds, treat findings as directional only.

## 5) Tools/Methods for Collection

| Purpose | Suggested method |
|---|---|
| Event tracking / product analytics | Product analytics platform (e.g. Amplitude, Mixpanel, or PostHog) instrumented on the events in section 1 |
| Funnel & retention analysis | Cohort/retention views within the analytics tool, segmented by archetype and signup week |
| In-app micro-surveys | Lightweight in-product survey tool (e.g. in-app modal triggered by event, or a service like Sprig/Pendo) so surveys are contextual rather than generic |
| Cancellation/churn reason capture | Mandatory single-question flow at the cancellation step, logged as structured data, not free text only |
| Periodic longitudinal survey | Email/push-triggered survey (e.g. Typeform or in-app) sent monthly to an opted cohort |
| Moderated interviews | Recruit via in-app prompt or panel service; conduct via video call using the existing interview guide, anchored with real usage data pulled in advance |
| Statistical analysis | Basic proportion/mean comparison (t-tests, confidence intervals) run in a notebook or BI tool once minimum sample sizes are met — avoid declaring results before thresholds in Section 4 are hit |

---

## Sequencing Recommendation

Don't try to validate all 10 metrics simultaneously. Suggested order given limited early traffic:
1. **Weeks 1–4:** Instrument and watch Metrics 1–3 (upload rate, time-to-first-insight, retention curve) — these gate everything else. If the core loop doesn't hold, later metrics are moot.
2. **Weeks 4–8:** Layer in Metrics 4, 5, 9 (recommendation trust/action) once enough users have reached the gap-analysis stage.
3. **Month 2–3 onward:** Business metrics (6, 7, 8) become meaningful once there's enough volume through the funnel to see paywall behavior at the sample sizes in Section 4.
4. **Ongoing:** Metric 10 (segmented satisfaction) runs continuously from day one but should be reviewed in aggregate no more often than monthly, once each archetype segment clears ~150–200 respondents.
