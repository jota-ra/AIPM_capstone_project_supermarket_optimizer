# Nährbert — Acceptance Criteria (Gherkin)
# Derived from naehrbert_prd.md, business_rules.md, user_flows.md.
# Traceability tags: FR-*/BR-*/R-* noted per scenario. Tags: @mvp @post-mvp @gdpr @blocked-Q1 @blocked-Q4
# Nothing added beyond the source documents.

# ─────────────────────────────────────────────────────────────
@mvp @auth
Feature: Authentication and account creation
  # FR-1, BR-P7, R-SESSION

  Scenario: Sign up with email and password
    Given a new visitor on the sign-up screen
    When they choose email+password and submit valid credentials
    And they confirm they are at least 16 years old
    Then a Supabase account is created
    And a persisted session is established
    And they are taken to onboarding

  Scenario: Sign up with Google
    Given a new visitor on the sign-up screen
    When they choose Google and complete the OAuth consent
    Then an account is created and a session is established
    And they are taken to onboarding

  Scenario: Reject users under 16
    Given a new visitor on the sign-up screen
    When they indicate an age under 16
    Then sign-up is denied with an explanation
    And no account is created

  Scenario: Existing email is routed to login
    Given an email already registered
    When the visitor tries to sign up with that email
    Then they are routed to the login screen

  Scenario: Returning user with a valid session skips login
    Given a returning user with a valid persisted session
    When they open the app
    Then they land on the dashboard without re-authenticating

  Scenario: Expired session requires re-login
    Given a returning user whose refresh token has expired
    When they open the app
    Then they are asked to log in again

  Scenario: Wrong credentials are rejected
    Given a returning user on the login screen
    When they submit an incorrect password
    Then an error is shown and they may retry
    And no session is created

  Scenario: Health-data consent is NOT requested at sign-up
    Given a visitor completing sign-up
    When the account is created
    Then no health-data (Level-2) consent is requested at this stage

# ─────────────────────────────────────────────────────────────
@mvp @onboarding
Feature: Onboarding and Level-1 profile
  # FR-2, §7, R-FEEDBACK

  Scenario: Completing onboarding generates the ideal profile
    Given an authenticated user with no profile
    When they answer all required Level-1 questions
    Then an ideal profile (calories, macros, micros) is computed and persisted
    And they are taken to the dashboard with an "upload first receipt" prompt

  Scenario: Preferred form of address is used for tone only
    Given a user who set their preferred form of address
    When any calculation runs
    Then the address is never used as a calculation input

  Scenario: Reassuring feedback after each answer
    Given a user answering an onboarding question
    When they submit an answer
    Then a fixed localized reassuring feedback string for that option is shown

  Scenario: Pregnancy question is shown only for female profiles
    Given a user whose sex assigned at birth is male
    When they proceed through onboarding
    Then the pregnancy/breastfeeding question is not shown

  Scenario: Out-of-range biometric input is rejected
    Given a user entering their weight
    When they enter a value outside the accepted range
    Then inline validation blocks completion until corrected

  Scenario: Required field missing blocks completion
    Given a user who left a required Level-1 field empty
    When they try to finish onboarding
    Then completion is blocked with a prompt to complete it

# ─────────────────────────────────────────────────────────────
@mvp @calculation
Feature: Ideal profile calculation
  # FR-3, BR-E*, BR-M*, BR-Gen

  Scenario: BMR via Mifflin–St Jeor
    Given a male user aged 32, 80 kg, 182 cm
    When BMR is computed
    Then BMR equals 1782 kcal

  Scenario: Non-binary BMR is the mean of both formulas
    Given a user who selects "prefer not to say" for sex
    When BMR is computed
    Then BMR equals the arithmetic mean of the male and female Mifflin–St Jeor results

  Scenario Outline: NEAT from daily movement
    Given a user with BMR <bmr> kcal
    When daily movement is "<movement>"
    Then NEAT equals <bmr> multiplied by <pct>

    Examples:
      | movement                | pct  | bmr  |
      | mostly sitting          | 0.00 | 1782 |
      | mixed sitting & walking | 0.10 | 1782 |
      | mostly standing/walking | 0.20 | 1782 |
      | physical labor          | 0.35 | 1782 |

  Scenario Outline: EAT from exercise frequency
    Given a user with exercise frequency "<freq>"
    When EAT is computed
    Then EAT equals <kcal> kcal/day

    Examples:
      | freq          | kcal |
      | none          | 0    |
      | one_two       | 100  |
      | three_four    | 250  |
      | five_six      | 400  |
      | daily_athlete | 600  |

  Scenario: TDEE is additive
    Given BMR 1782, NEAT 178, EAT 250
    When TEF and TDEE are computed
    Then TEF equals 221 kcal
    And TDEE equals 2431 kcal

  Scenario Outline: Goal adjustment produces the calorie target
    Given a TDEE of 2431 kcal
    When the goal is "<goal>"
    Then the calorie target is 2431 adjusted by <adj>

    Examples:
      | goal            | adj   |
      | lose fat        | -15%  |
      | maintain        | 0%    |
      | build muscle    | +10%  |
      | aggressive gain | +15%  |

  Scenario: Protein target is the max of activity- and goal-based values
    Given a user building muscle who exercises 1–2 times per week
    When protein is computed
    Then protein per kg equals 2.0

  Scenario: Fat respects the hormone floor
    Given a calorie target and body weight
    When fat is computed
    Then fat equals the greater of 30% of calories and 0.8 g/kg

  Scenario: Carbohydrates never go negative
    Given a user whose protein and fat targets already meet the calorie target
    When carbohydrates are computed
    Then protein is held fixed
    And fat is reduced toward its 0.8 g/kg floor
    And carbohydrates are floored at 0
    And if still infeasible the target is flagged "constrained" rather than showing negative carbs

  Scenario Outline: Energy density constants
    Given <grams> g of "<nutrient>"
    When converting to energy
    Then it yields <kcal> kcal

    Examples:
      | nutrient              | grams | kcal |
      | protein               | 10    | 40   |
      | available carbohydrate| 10    | 40   |
      | fat                   | 10    | 90   |
      | alcohol               | 10    | 70   |
      | fibre                 | 10    | 20   |

  @blocked-Q1
  Scenario: Micronutrient targets are deferred until the reference list is finalized
    Given the DGE/EFSA micronutrient list is not yet finalized
    When the ideal profile is generated
    Then only calories, macros and fibre targets are produced
    And micronutrient targets are deferred

# ─────────────────────────────────────────────────────────────
@mvp @upload
Feature: Receipt upload and extraction
  # FR-4, R-EXTRACT, R-NONFOOD, R-FILE

  Scenario Outline: Accepted upload formats
    Given a user on the upload screen
    When they upload a "<format>" file
    Then it is accepted for extraction

    Examples:
      | format |
      | jpg    |
      | jpeg   |
      | png    |
      | pdf    |
      | photo  |

  Scenario: Extract structured fields from a receipt
    Given a valid receipt image
    When extraction runs
    Then the date, store, item count, and per-item name/quantity/unit/price are extracted
    And units are normalized to the canonical enum {g, kg, ml, l, piece}

  Scenario: Non-food lines are excluded from nutrition
    Given a receipt containing a deposit (Pfand) line and a plastic bag line
    When extraction classifies the lines
    Then those lines are counted separately as non-food
    And they are excluded from all nutrient calculations

  Scenario: Each uploaded file is treated as one receipt
    Given a user selects three image files in one upload
    When they are processed
    Then each file is treated as a separate receipt

  Scenario: Data-sufficiency disclaimer is shown
    Given a user uploading a receipt
    When the upload screen loads
    Then a disclaimer explains how much data supports what

  Scenario Outline: Typed extraction errors are surfaced
    Given extraction encounters "<condition>"
    When the result returns
    Then the user sees the "<message>" state

    Examples:
      | condition                    | message        |
      | rate limiting                | retry          |
      | service unavailable          | try later      |
      | no parseable line items      | invalid image  |

  Scenario: Storage upload failure is non-fatal
    Given the original file fails to store
    When extraction has already parsed the items
    Then parsing still succeeds and the flow continues

# ─────────────────────────────────────────────────────────────
@mvp @matching
Feature: Product matching
  # FR-5, BR-MT0..MT8

  Scenario: A verified learned match short-circuits the search
    Given a verified-match store entry for the normalized raw text and store
    When an item with that raw text is matched
    Then the verified product is used at confidence 1.0
    And no fuzzy database search is performed

  Scenario: OpenFoodFacts confident identity match
    Given no learned match exists
    When OFF returns a candidate with token-similarity of at least 0.60 and usable nutrition
    Then it is accepted as the item's identity
    And it is labelled "exact" only when the whole-string ratio is at least 0.90

  Scenario: BLS whole-food fallback recovers an OFF miss
    Given OFF returns no confident match for a whole/raw food
    When BLS has a generic entry whose head noun agrees
    Then the BLS generic is accepted as the identity

  Scenario: BLS nutrient bridge only fires under type agreement
    Given an OFF-identified branded product
    When a BLS candidate shares the same canonical category and head-noun stem
    Then BLS macros and micros are borrowed
    But if the type disagrees the OFF product's own values are kept

  Scenario: Plain variant is preferred among BLS candidates
    Given type-agreeing BLS candidates "Gurke roh" and "Gurke gedünstet"
    When the nutrient source is selected
    Then "Gurke roh" is chosen because it has no preparation qualifier

  Scenario: NOVA always comes from OFF
    Given nutrition values borrowed from BLS
    When the processing level is needed
    Then NOVA is taken from OFF or the category table, never from BLS

  Scenario: Category fallback is the last resort
    Given all higher matching tiers fail
    When the item is resolved
    Then a category estimate is used at confidence 0.3 and flagged "unknown"

  Scenario: Provenance and two confidences are recorded
    Given any resolved item
    When the match is stored
    Then each nutrient value carries its source (off/bls/category)
    And an identity_conf and a nutrition_conf are recorded

  Scenario: Matching never blocks the pipeline
    Given the OFF and BLS live searches both fail
    When an item cannot be matched
    Then it degrades to the category estimate rather than erroring

# ─────────────────────────────────────────────────────────────
@mvp @review
Feature: Review, correction and the verified-match store
  # FR-6, BR-MT6, R-WRITE

  Scenario: Review list is editable
    Given a processed receipt
    When the review screen loads
    Then each item shows its extracted text, matched product, quantity and unit, all editable

  Scenario: Manual search shows only nutrition-bearing results
    Given a user searching OFF and BLS from the review
    When results are shown
    Then only candidates with at least one of {kcal, protein, fat, carbs} are listed

  Scenario: A manual pick writes a verified match
    Given a user picks a product via manual search
    When they confirm
    Then a verified-match record is written with raw text, store, source, product, nutrition and a user vote

  Scenario: Passive acceptance of a Tier-0 hit does not vote
    Given an item auto-resolved by an existing verified (Tier-0) match
    When the user passively accepts it
    Then no new vote is cast

  Scenario: No-match items are logged
    Given a user taps "no match found" on an item
    When they continue
    Then the item's raw text and store are logged for later analysis

  Scenario Outline: Verified-store conflict resolution
    Given a raw-text/store key with votes "<votes>"
    When the winning product is resolved
    Then the outcome is "<outcome>"

    Examples:
      | votes                          | outcome                              |
      | A:5, B:2                       | serve A (majority)                   |
      | A:3, B:3 (A most recent)       | serve A (most-recent tiebreak)       |
      | A:2, B:2, C:1 (no >50%)        | low-agreement, not auto-served       |

  Scenario: One vote per distinct user per key
    Given a user who buys the same product on twelve receipts
    When votes are counted
    Then their contribution to that key is exactly one vote

# ─────────────────────────────────────────────────────────────
@mvp @intake
Feature: Status-quo attribution and daily intake
  # FR-7, BR-I1..I6

  Scenario: Not shared means full attribution
    Given a user who says the groceries are not shared
    When their share is computed
    Then user_share is 100%

  Scenario: Shared groceries divide by household including the user
    Given a user who shares groceries among 4 people including themselves
    When their share is computed
    Then the default user_share is 1/4, adjustable by the user

  Scenario: Meals-outside does not scale intake
    Given a user who reports eating outside "often"
    When intake is computed
    Then intake is not multiplied by that answer
    But the confidence is discounted instead

  Scenario: Waste applies to the preceding receipt
    Given a user reports throwing away part of the last shop at the next upload
    When intake is adjusted
    Then the waste reduces the preceding receipt's quantities

  Scenario: Daily intake is a per-item rollup
    Given matched items with per-item consumption windows
    When daily intake per nutrient is computed
    Then it equals the sum of (item_nutrient x share x (1 - waste)) / item_consumption_days

  Scenario: Eating-occasion coverage is shown and does not scale intake
    Given a user with 3 meals and 2 snacks who eats outside "often"
    When coverage is computed
    Then a coverage line shows roughly 3 of 5 occasions tracked
    And intake numbers are not scaled by this

# ─────────────────────────────────────────────────────────────
@mvp @timeframe
Feature: Consumption timeframe
  # BR-T1..T3

  Scenario Outline: Default consumption windows by category
    Given a newly purchased item in category "<category>"
    When no purchase history exists
    Then the default consumption window is "<window>"

    Examples:
      | category        | window   |
      | fresh produce   | 3-7 d    |
      | dairy           | 7-10 d   |
      | pantry staple   | 60-90 d  |

  Scenario: Repeat purchases refine the window
    Given the same product purchased several times
    When at least two purchases exist
    Then the window is the mean of the last 3 inter-purchase intervals

  Scenario: Too few purchases fall back to the default
    Given a product purchased only once
    When the window is needed
    Then the category default is used

  Scenario: One-off items are corrected only by feedback
    Given a stockpiled item that never reappears
    When eaten/left/thrown feedback is given
    Then its remaining quantity is adjusted from that feedback

# ─────────────────────────────────────────────────────────────
@mvp @feedback
Feature: Eaten / consumption feedback (A/B)
  # FR-8, FR-11.7, R-EATEN, BR-T3, BR-I3

  Scenario: Variant A is asked at the next upload
    Given a user assigned to variant A with a prior receipt
    When they start a new upload
    Then they are asked what was eaten / still have / thrown away while extraction runs

  Scenario: Variant B is a daily dashboard update
    Given a user assigned to variant B
    When they open the dashboard
    Then they can update consumption there

  Scenario: A/B assignment is sticky
    Given a user assigned to a variant at account creation
    When they return later
    Then they remain in the same variant

  Scenario: No prior receipt means no variant-A prompt
    Given a variant-A user uploading their first ever receipt
    When extraction runs
    Then no eaten-feedback prompt is shown

# ─────────────────────────────────────────────────────────────
@mvp @gap
Feature: Gap detection and health score
  # FR-9, BR-HS1..HS4, BR-S2a

  Scenario: Gaps are compared per sub-profile
    Given an ideal profile and a status-quo profile
    When gaps are detected
    Then calories, macros and micros are compared sub-profile by sub-profile

  Scenario Outline: Per-dimension closeness
    Given intake "<intake>" against target/limit "<ref>" for a "<kind>" nutrient
    When closeness is computed
    Then it is "<closeness>"

    Examples:
      | kind    | intake        | ref  | closeness                          |
      | target  | equal target  | 100  | 100                                |
      | target  | 50% of target | 100  | 50 (penalized for being under)     |
      | ceiling | below limit   | 100  | 100                                |
      | ceiling | above limit   | 100  | penalized only for exceeding       |

  Scenario: A nutrient with no data is not a fake gap
    Given a micronutrient with snapshot confidence 0
    When gaps and the health score are computed
    Then that nutrient is excluded, never scored as a 100% deficit

  Scenario: Absent dimensions are dropped and weights renormalized
    Given some dimensions have no data
    When the overall score is computed
    Then only measured dimensions are weighted and the weights renormalize to 1

  @blocked-Q1
  Scenario: Micronutrients carry zero weight until the list is finalized
    Given the DGE/EFSA micronutrient list is not finalized
    When the overall health score is computed
    Then the micronutrient group weight is 0 and only calories, macros and fibre score

  Scenario: Score is shown with its confidence badge and is not shrunk
    Given a low-confidence basket
    When the health score is displayed
    Then the score is shown alongside a "Low" confidence badge
    And no probabilistic shrink is applied

  Scenario: Balanced basket shows an on-target state
    Given intake close to all targets
    When results render
    Then an "on target / no gaps" state is shown

  Scenario: Trends appear once data permits
    Given insufficient receipt history
    When results render
    Then weekly/monthly trends are not shown until enough data exists

  Scenario: Improvement is congratulated
    Given a health score higher than the previous upload
    When results render
    Then the improvement is acknowledged

# ─────────────────────────────────────────────────────────────
@mvp @grouping
Feature: Item health grouping
  # BR-G1..G6

  Scenario Outline: Three-tier grouping by NOVA and sugar
    Given an item with NOVA "<nova>" and sugar "<sugar>" g/100g
    When it is grouped
    Then it is placed in the "<tier>" tier

    Examples:
      | nova | sugar | tier      |
      | 4    | 5     | Unhealthy |
      | 1    | 25    | Unhealthy |
      | 1    | 5     | Healthy   |
      | 3    | 12    | OK        |

  Scenario: Items without nutrition go to "not enough data"
    Given an item with no confirmed nutrition
    When it is grouped
    Then it is placed in the grey "not enough data" group, never guessed

  Scenario: Missing NOVA groups on sugar alone
    Given a BLS-only item with sugar 25 g/100g and no NOVA
    When it is grouped
    Then it is Unhealthy based on sugar alone

# ─────────────────────────────────────────────────────────────
@mvp @recommendations
Feature: Next-Cart recommendations and scoring
  # FR-10, BR-S1..S6

  Scenario: Recommendations are scored and ranked
    Given detected gaps with severities and confidences
    When candidates are scored
    Then score = severity x confidence x symptom-relevance x goal-relevance and they are ranked descending

  Scenario: Output structure
    Given a ranked candidate set
    When recommendations are produced
    Then there is 1 primary, up to 2 alternatives (add/replace), and up to 2 reduce suggestions

  Scenario Outline: Symptom relevance re-prioritizes
    Given a Level-2 answer "<symptom>"
    When scoring runs
    Then "<nutrient>" is multiplied by <factor>

    Examples:
      | symptom                     | nutrient  | factor |
      | bowel < 3/week              | fiber     | 1.6    |
      | hunger most of day          | protein   | 1.5    |
      | afternoon energy crash      | iron      | 1.4    |

  Scenario Outline: Goal relevance
    Given the goal "<goal>"
    When scoring runs
    Then "<nutrient>" is multiplied by <factor>

    Examples:
      | goal         | nutrient | factor |
      | build muscle | protein  | 1.5    |
      | lose fat     | fiber    | 1.3    |
      | maintain     | protein  | 1.1    |

  Scenario: Exclusions filter candidates before scoring
    Given a user allergic to peanuts who dislikes tofu and is vegan
    When candidates are assembled
    Then peanut, tofu and non-vegan items are removed before scoring

  Scenario: No suitable candidate
    Given every candidate is excluded by the profile
    When recommendations are produced
    Then a "no suitable recommendation" state is shown

  Scenario: Reduce suggestions require over-consumed red items
    Given no over-consumed red-tier items in the basket
    When recommendations are produced
    Then no reduce suggestions are shown

  @post-mvp
  Scenario: Recipes and shopping list are not in MVP
    Given a user viewing Next-Cart in the MVP
    When recommendations render
    Then only item-level recommendations are shown, no recipes or shopping list

# ─────────────────────────────────────────────────────────────
@mvp @level2 @gdpr
Feature: Level-2 functional questionnaire and consent
  # FR-2.4, FR-2.5, BR-P1, R-L2TRIG

  Scenario: Non-blocking prompt on first results
    Given a user seeing the results screen for the first time
    When the screen renders
    Then a non-blocking invitation to answer Level-2 questions appears

  Scenario: Re-invite is capped
    Given a user who has dismissed the Level-2 invitation twice
    When they see later results screens
    Then they are not invited again

  Scenario: Consent is required before Level-2 questions
    Given a user opening the Level-2 questionnaire
    When it starts
    Then an explicit health-data consent opt-in is presented first

  Scenario: Declining consent keeps the app fully usable
    Given a user who declines Level-2 consent
    When they use the app
    Then all Level-1 features work and all symptom multipliers default to 1.0

  Scenario: Consent record is stored
    Given a user grants Level-2 consent
    When it is recorded
    Then a single consent record with a boolean, timestamp and consent-text version is stored

# ─────────────────────────────────────────────────────────────
@mvp @confidence
Feature: Confidence model
  # BR-C1..C5

  Scenario Outline: Coverage confidence by matched item count
    Given "<count>" matched items
    When coverage_conf is computed
    Then coverage_conf equals <value>

    Examples:
      | count | value |
      | 10    | 0.2   |
      | 35    | 0.4   |
      | 75    | 0.6   |
      | 150   | 0.8   |
      | 250   | 1.0   |

  Scenario: Snapshot confidence is multiplicative
    Given the five confidence factors
    When snapshot confidence is computed
    Then it is their product, so any single weak factor lowers it

  Scenario Outline: Confidence bands
    Given a snapshot confidence of <value>
    When it is surfaced
    Then it is labelled "<band>"

    Examples:
      | value | band   |
      | 0.20  | Low    |
      | 0.50  | Medium |
      | 0.80  | High   |

  Scenario Outline: External-intake and alcohol discounts
    Given "<answer>" for "<factor>"
    When the discount is applied
    Then the multiplier is <mult>

    Examples:
      | factor              | answer | mult |
      | meals eaten outside | rarely | 1.0  |
      | meals eaten outside | most   | 0.60 |
      | receipts completeness | all  | 1.0  |
      | receipts completeness | <half| 0.50 |
      | alcohol             | weekly+| 0.85 |

# ─────────────────────────────────────────────────────────────
@mvp @dashboard
Feature: Dashboard
  # FR-11

  Scenario: New user sees an empty state
    Given an onboarded user who has uploaded no receipts
    When they open the dashboard
    Then an empty state with an upload call-to-action is shown

  Scenario: Dashboard renders available cards
    Given a user with processed receipts
    When the dashboard loads
    Then the health score, macro/micro detail, item ranking and counters are shown

  @post-mvp
  Scenario: Cross-user comparisons are hidden
    Given the MVP dashboard
    When it loads
    Then "top x% of healthiest users" and usage-vs-others comparisons are not shown

# ─────────────────────────────────────────────────────────────
@mvp @profile
Feature: Profile management and language
  # FR-12, R-RECALC, R-LANG

  Scenario: Editing weight recomputes the ideal profile
    Given a user with a computed ideal profile
    When they change their weight in Edit Profile
    Then the ideal profile is recomputed

  Scenario: Age updates from date of birth
    Given a user whose date of birth implies a new age
    When the profile recomputes
    Then age is derived from the date of birth at compute time

  Scenario: Language defaults by device locale
    Given a first-time user whose device locale is German
    When the app starts
    Then the language defaults to German

  Scenario: Language default falls back to English
    Given a first-time user whose device locale is neither German nor English
    When the app starts
    Then the language defaults to English

  Scenario: Explicit language choice persists
    Given a user who switches language to English
    When they return later
    Then the app is in English

# ─────────────────────────────────────────────────────────────
@mvp @gdpr
Feature: Data export
  # FR-12.4, BR-P3

  Scenario: Export the full record
    Given an authenticated user in Edit Profile
    When they request an export
    Then their profile, receipts and derived profiles are exported as JSON or CSV

# ─────────────────────────────────────────────────────────────
@mvp @gdpr
Feature: Account deletion (erasure)
  # FR-12.3, BR-P3

  Scenario: Hard cascade delete of personal data
    Given an authenticated user who confirms deletion
    When erasure runs
    Then their profile, receipts, images, derived profiles and their verified-match votes are hard-deleted
    And they are signed out

  Scenario: The de-identified aggregate mapping is retained
    Given a user deletes their account
    When erasure completes
    Then the global aggregate verified-match mapping (winning product per key) is retained

# ─────────────────────────────────────────────────────────────
@mvp @gdpr
Feature: Consent revocation
  # BR-P1, FR-2.5

  Scenario: Revoking consent disables Level-2
    Given a user with Level-2 consent granted
    When they revoke it
    Then Level-2 processing is disabled and the Level-2 inputs are hidden
    And recommendation prioritization reverts to all multipliers 1.0
    And the app remains fully usable

# ─────────────────────────────────────────────────────────────
@mvp @privacy
Feature: Not medical advice
  # NG1, BR-P6

  Scenario: Disclaimer appears wherever symptoms drive recommendations
    Given a symptom-driven recommendation is shown
    When it renders
    Then a "not medical advice / consult a professional" disclaimer is present

  Scenario: The engine never diagnoses
    Given a user reports diarrhea
    When recommendations are produced
    Then no cause is diagnosed
    And persistent symptoms are deferred to a healthcare professional
