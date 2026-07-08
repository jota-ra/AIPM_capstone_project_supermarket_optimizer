# Explanations for the app
## nutrition calculations as of 7.7.26
### The pipeline


receipt items (DB or re-scanned images)
   → map_items()          [Epic 2: OFF match / generalized / category fallback]
   → build_profile()       [nutrition_profile.py — aggregate into densities]
   → confidence_level()    [nutrition_model.py]
   → detect_gaps()         [gap_detector.py]
   → build_dimension_snapshots() [nutrition_model.py — display rows]
   → NutritionSnapshot     [final response]
1. Turning items into densities (nutrition_profile.py)
For every item, two things happen:

a) Convert quantity to grams (grams_for):

g/kg/ml/l convert directly (1 kg = 1000 g, treating 1 ml ≈ 1 g)
Anything else (Stk, unknown units, missing quantity) defaults to 100 g per piece — a rough guess, not measured
b) Weight each nutrient by that item's grams, then sum across all items — but with a specific trick: paired sums. For fiber, I don't just sum fiber grams — I sum fiber grams and the calories of only the items that reported fiber:


fiber_per_1000kcal = (Σ fiber_g × grams/100)  /  (Σ calories_kcal × grams/100)  × 1000
Why paired: if I divided by total basket calories instead, an item with unknown fiber (common for fresh produce in OpenFoodFacts) would silently make the basket look more fiber-poor than it is, just because it has calories but no fiber data. Pairing means "average fiber density among items where we actually know both numbers." Same logic for protein and sugar. Processed score is weighted by grams alone (no calorie pairing needed, it's not a per-calorie thing).

Sugar is converted to % of energy: sugar_g × 4 kcal/g ÷ paired_calories × 100 (sugar has 4 kcal/gram).

The output (NutritionProfile) is day-agnostic — it doesn't care how many receipts or how many days they span, which was the point of the density-ratio approach you chose.

2. Judging the numbers (nutrition_model.py)
Four fixed reference thresholds, no ML:

Dimension	Reference	Flagged when
fiber	14 g / 1000 kcal	below
protein	25 g / 1000 kcal	below
sugar	20% of energy	above
processed (NOVA)	2.5	above
Each dimension gets a status (low/high/ok/info) and a ratio = value / reference — that ratio is what a UI progress bar would render (e.g. fiber ratio 0.85 = bar at 85% of the healthy line).

Confidence is separate from the nutrient values — it's about how much to trust them, based on sample size and match quality:


if items ≥ 5 and matched_ratio ≥ 0.6  → high
elif items ≥ 3 and matched_ratio ≥ 0.3 → medium
else → low
matched_ratio = real OpenFoodFacts matches ÷ total items (category-fallback items count against it). Your last live run — 52 items, 35 matched — landed comfortably in high.

3. Finding gaps (gap_detector.py)
For each of the 4 comparable dimensions, if the value crosses its threshold, it becomes a candidate gap with a severity score = how far past the threshold, as a fraction:


severity = |value - reference| / reference
e.g. fiber at 11.9 vs. reference 14 → severity = (14-11.9)/14 ≈ 0.15. All candidates are sorted by severity descending, and only the top 3 survive — that's the "max 3 gaps" rule from the story. Each surviving gap carries a plain-language message (e.g. "more whole grains, legumes...") and inherits the same confidence label as the whole snapshot.

In your 10-receipt live run, only fiber crossed its line (11.9 < 14), so exactly one gap came back — that's expected behavior, not a bug; a "balanced" basket can legitimately produce zero or one gap.

4. Aggregating across receipts (nutrition_snapshot.py)
This is the part directly answering your "don't use a single receipt" requirement: build_snapshot_from_db() pulls every row from receipt_items (not filtered by receipt_id), and build_snapshot_from_folder() re-parses every image in a folder and concatenates all their items before the pipeline above ever runs. Either way, the profile builder sees one big combined item list, so density ratios are computed over the whole aggregated basket, not per-receipt.

Current status
All of this is implemented and I ran it against real data (offline fixtures, a hand-built controlled 2-item case to verify the math, and a live run across all 10 images in receipts/, 52 items total). It's not using any live DB data yet in this session — that would require your Supabase credentials — but the --db code path is the same logic, just sourced from get_all_receipt_items() instead of a folder scan

## Next Cart recommendations
### Layer 1: what the app knows about (14 candidates, not 1)
data/recommendations.json has 14 total candidate foods across 4 gap types:

Gap	Candidates (in priority order)
fiber:low	Rote Linsen, Kichererbsen, Vollkornhaferflocken, Vollkornbrot
protein:low	Griechischer Joghurt, Tofu, Rote Linsen, Eier
sugar:high	Ungesüßter Tee/Wasser, Naturjoghurt, Ungesalzene Nüsse
processed:high	Frisches Gemüse, Vollkornreis/-nudeln, Ungesalzene Nüsse
So the engine isn't limited to lentils — it's limited to whichever gap type is currently detected, and lentils just happens to be candidate #1 for the gap type your data keeps triggering (fiber).

### Layer 2: what the API returns (always exactly 1)
This is deliberate, per Epic 5 Story 5.1: "I want one prioritized recommendation... not generic advice." The engine is intentionally designed to surface a single, decisive action rather than a list — that was a core hypothesis from the roadmap (a single clear decision beats a dashboard of options).

Why it's always lentils in your tests
Two things converge:

Your actual receipt data has a persistent low-fiber gap (11.9 g/1000kcal vs. the 14 g reference) — that's real, not hardcoded. As long as fiber stays the worst gap, fiber:low is the gap type consulted.
Lentils is listed first in fiber:low's candidate list, and nothing in your test profiles excludes it, so it wins every time via the "first allowed candidate" rule.
If you want to see a different recommendation right now, without waiting for your basket's nutrition to change, you have two levers:

Change which gap surfaces — feed it a different Gap (like I did in the protein-gap test, which returned Tofu instead).
Exclude the top candidate — e.g. a profile with exclusions: ["linsen"] would skip lentils and fall to Kichererbsen for the same fiber gap.