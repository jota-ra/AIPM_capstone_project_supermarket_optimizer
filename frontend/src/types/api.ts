// Mirrors backend Pydantic models. Kept as plain interfaces (not zod)
// since this is an internal testing UI, not a public-facing app.

export interface ParsedReceiptItem {
  name: string;
  original_text?: string | null;
  quantity: number;
  unit?: string | null; // canonical enum: g | kg | ml | l | piece (E3-S3)
  price?: number | null; // per-item price in EUR, when legible (E3-S2)
  category: string;
  uncertain: boolean;
}

export interface ParsedReceipt {
  store: string;
  date?: string | null; // purchase date, ISO "YYYY-MM-DD" (E3-S2)
  scan_quality: string;
  items: ParsedReceiptItem[];
  non_food_items_ignored: string[];
  items_count: number;
  error?: string | null;
}

export interface UploadReceiptResponse {
  receipt_id: string;
  input_type: "image" | "text";
  storage_path: string | null;
  parsed: ParsedReceipt;
}

// Onboarding's baseline-upload gate (E1): cumulative food items uploaded
// across every receipt so far, vs. the target that unlocks the rest of
// the app (see backend GET /receipts/progress).
export interface ReceiptUploadProgress {
  count: number;
  target: number;
  complete: boolean;
}

export interface ReceiptItemRow {
  id: string;
  receipt_id: string;
  raw_name: string | null;
  normalized_name: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  price: number | null;
  matched_product_id: string | null;
  confidence: number | null;
}

export interface ReceiptRow {
  id: string;
  file_name: string | null;
  file_type: string | null;
  storage_path: string | null;
  status: string;
  // Promoted columns (E3-S2) — null until parsing finishes.
  store?: string | null;
  purchase_date?: string | null;
  // The full parsed payload (store/date/items/scan_quality/items_count) —
  // always present once processed, kept as the one source of truth so
  // nothing needs re-deriving from the promoted columns above.
  raw_text?: ParsedReceipt | null;
}

export interface ReceiptDetailResponse {
  receipt: ReceiptRow;
  items: ReceiptItemRow[];
}

// A short-lived signed URL for the receipt's original photo (Review's
// "show what you uploaded" — GET /receipts/{id}/image). Absent/404 for a
// text-pasted receipt or once DELETE .../image has run.
export interface ReceiptImageResponse {
  receipt_id: string;
  url: string;
}

export interface ReceiptItemUpdate {
  normalized_name?: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

// E7: gap detection, health score, grouping & confidence.
export interface AnalysisBar {
  nutrient: string;
  kind: "target" | "ceiling";
  intake: number | null;
  reference: number | null;
  bar_pct: number | null;
  closeness: number | null;
  in_score: boolean;
  weight: number;
}

export interface GroupedItem {
  name: string;
  nova: number | null;
  sugar_g: number | null;
}

export interface NutritionAnalysis {
  has_ideal_profile: boolean;
  score: number | null;
  confidence: { value: number; band: string };
  bars: AnalysisBar[];
  on_target: boolean;
  micros_gated: boolean;
  grouping: Record<string, GroupedItem[]>;
  coverage: { total_occasions: number; tracked_occasions: number; untracked_share: number };
}

// E8: structured Next-Cart recommendation.
export interface ScoredRecommendation {
  item: string;
  action_type: "add" | "replace" | "reduce" | "none";
  targets_gap: string;
  score: number;
  severity: number;
  goal_relevance: number;
  rationale?: string | null;
}

export interface StructuredNextCart {
  status: "recommended" | "no_gaps" | "no_suitable_candidate";
  primary: ScoredRecommendation | null;
  alternatives: ScoredRecommendation[];
  reduce: string[];
  message: string;
  confidence: string;
  disclaimer: string;
}

// E5-S2: a candidate from the OFF or BLS manual search (nutrition-bearing only).
export interface ProductSearchResult {
  source: "off" | "bls";
  off_id?: string | null;
  bls_code?: string | null;
  name: string;
  brand?: string | null;
  nutrition: Record<string, unknown>;
}

// E5-S3: the user's manual product pick, written as a verified-match vote.
export interface ItemMatchPick {
  source: "off" | "bls";
  matched_name: string;
  off_id?: string | null;
  bls_code?: string | null;
  nova?: number | null;
  nutrition?: Record<string, unknown> | null;
}

// --- Epic 3: Profile -------------------------------------------------

export type Goal = "lose_weight_gradually" | "maintain" | "build_muscle";

// Self-reported bucket (chat Q5, optional) — no birthday collected.
export type AgeRange = "under_25" | "25-35" | "36-45" | "46-55" | "55+";

export type ActivityLevel =
  | "mostly_sitting"
  | "light_activity"
  | "moderately_active"
  | "very_active";

export type DietaryPattern =
  | "high_protein"
  | "low_carb_keto"
  | "low_fat"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "omnivore" // "no specific diet" (chat Q2)
  | "gluten_free"
  | "lactose_free";

export type Language = "de" | "en";
export type Digestion = "fine" | "bloated" | "slow" | "sensitive";
export type VegFrequency = "every_meal" | "once_daily" | "few_times_week" | "rarely";
export type Gender = "female" | "male" | "other";

// --- Level-1 onboarding types (E1) — feed the Ideal Profile Engine (E2) ---
export type FormOfAddress = "neutral" | "informal_du" | "formal_sie";
export type Sex = "female" | "male" | "prefer_not_to_say";
export type ExerciseFrequency =
  | "none"
  | "one_two"
  | "three_four"
  | "five_six"
  | "daily_athlete";
export type DailyMovement =
  | "mostly_sitting"
  | "mixed"
  | "mostly_standing"
  | "physical_labor";
export type PregnancyStatus = "none" | "pregnant" | "breastfeeding";

export interface ProfileCreate {
  goal: Goal;
  age_range?: AgeRange | null;
  activity_level: ActivityLevel;
  dietary_pattern: DietaryPattern;
  // Soft dislikes — kept for backward compatibility, not asked by chat.
  exclusions: string[];

  name?: string | null;

  // Used only to personalize the protein reference (Mifflin-St Jeor
  // BMR + activity TDEE) — see backend nutrition_personalization.py.
  gender?: Gender | null;
  weight_kg?: number | null;
  height_cm?: number | null;

  // Hard, safety-relevant — checked separately from `exclusions`.
  allergies: string[];

  // Optional Q6-Q8 — only nudge priority among already-tracked
  // dimensions (fiber/protein/processed) server-side, see
  // recommender.py; never surfaced as a fabricated nutrient gap.
  symptoms: string[];
  digestion?: Digestion | null;
  veg_frequency?: VegFrequency | null;

  language: Language;

  // --- Level-1 fields (E1). All optional so partial onboarding persists
  // and can be resumed (E1-S6). ---
  form_of_address?: FormOfAddress | null;
  sex?: Sex | null;
  date_of_birth?: string | null; // ISO "YYYY-MM-DD"
  exercise_frequency?: ExerciseFrequency | null;
  daily_movement?: DailyMovement | null;
  pregnancy_status?: PregnancyStatus | null;
  meals_per_day?: number | null;
  snacks_per_day?: number | null;
  dislikes?: string[];
  address?: string | null;
  // E6 status-quo attribution
  groceries_shared?: boolean | null;
  household_size?: number | null;
  user_share?: number | null;
  meals_outside?: "never" | "rarely" | "sometimes" | "often" | "daily" | null;
  receipts_complete?: "all" | "most" | "some" | "few" | null;
  // E8 Next-Cart inputs
  days_to_shop?: number | null;
  home_cooked_frequency?: "rarely" | "sometimes" | "often" | "daily" | null;
  // E9 Level-2 (health data — consent-gated)
  consent_level2?: boolean | null;
  consent_at?: string | null;
  l2_bowel_frequency?: string | null;
  l2_bloating?: string | null;
  l2_hunger?: string | null;
  l2_energy?: string | null;
  l2_sleep?: string | null;
  l2_hydration?: string | null;
  l2_alcohol?: string | null;
  l2_muscle_soreness?: string | null;
  profile_complete?: boolean;
}

// E9: Level-2 consent + symptom answers submission.
export interface Level2Payload {
  consent: boolean;
  consent_text_version?: string;
  l2_bowel_frequency?: string | null;
  l2_bloating?: string | null;
  l2_hunger?: string | null;
  l2_energy?: string | null;
  l2_sleep?: string | null;
  l2_hydration?: string | null;
  l2_alcohol?: string | null;
  l2_muscle_soreness?: string | null;
}

// Personalized daily targets computed by the Ideal Profile Engine (E2),
// attached to profile responses once the Level-1 biometrics are present.
export interface IdealProfile {
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  micronutrients: Record<string, number>;
  bmr_kcal: number;
  neat_kcal: number;
  eat_kcal: number;
  tef_kcal: number;
  tdee_kcal: number;
  // BR-M3: protein alone meets/exceeds the calorie goal, so the macro
  // split can't be satisfied (fat at its floor, carbs at 0).
  constrained?: boolean;
  notes: string[];
}

export interface Profile extends ProfileCreate {
  profile_id: string;
  ideal_profile?: IdealProfile | null;
}

// --- Epic 4: Nutrition snapshot ---------------------------------------

export type ConfidenceLevel = "low" | "medium" | "high";

export interface NutritionProfile {
  total_calories_kcal: number;
  total_grams: number;
  fiber_per_1000kcal: number | null;
  protein_per_1000kcal: number | null;
  sugar_pct_energy: number | null;
  processed_avg: number | null;
  items_total: number;
  items_with_nutrition: number;
  items_matched: number;
  items_fallback: number;
}

export interface DimensionSnapshot {
  dimension: string;
  value: number | null;
  unit: string;
  reference: number | null;
  ratio: number | null;
  status: "low" | "high" | "ok" | "info";
  what_this_means: string;
}

export interface Gap {
  dimension: string;
  status: "low" | "high";
  current_value: number;
  reference_value: number;
  message: string;
  confidence: ConfidenceLevel;
}

// Bedarf vs. Ist, in real daily units (e.g. mg/day iron) — separate from
// `Gap` above, which compares day-agnostic density ratios. See backend
// models/absolute_gap.py for why these aren't merged into one shape.
export interface AbsoluteGap {
  dimension: string;
  status: "low" | "high";
  daily_estimate: number;
  daily_requirement: number;
  ratio: number;
  message: string;
  confidence: ConfidenceLevel;
}

export type HealthScoreLabel = "great" | "good" | "needs_improvement" | "poor";

// One composite "how's your basket doing" number + plain-language
// summary — rule-based, derived from the dimensions/gaps below (see
// backend services/health_score.py), not a new fact of its own.
export interface HealthScore {
  value: number; // 0-100
  label: HealthScoreLabel;
  summary: string;
}

// A purchased item that conflicts with the profile's dietary pattern, an
// allergy, or a dislike — see backend services/conflict_detector.py.
// Never changes the profile itself; just surfaced so the user can
// clarify ("did this change, or was it for someone else?").
export interface Conflict {
  item: string;
  blocked_by: string;
  blocked_by_type: "diet" | "allergy" | "dislike";
  message: string;
}

export interface NutritionSnapshot {
  receipts_analyzed: number;
  items_analyzed: number;
  profile: NutritionProfile;
  dimensions: DimensionSnapshot[];
  gaps: Gap[];
  // [] until the user has confirmed any pantry consumption/removal —
  // see backend services/absolute_gap_detector.py.
  absolute_gaps: AbsoluteGap[];
  // Distinguishes "[] because nothing's confirmed yet" from "[] because
  // everything's within range" — both look identical otherwise (Epic 11.1).
  has_sufficient_data: boolean;
  health_score: HealthScore;
  conflicts: Conflict[];
  confidence: ConfidenceLevel;
  disclaimer: string;
}

// --- Pantry (Lager-Bestand) --------------------------------------------

export interface PantryItem {
  id: string;
  user_id: string;
  normalized_name: string;
  quantity_available: number;
  unit?: string | null;
  category?: string | null;
  last_replenished_at?: string | null;
  // Computed fresh on every read from last_replenished_at + a rough
  // per-category shelf life (see backend services/shelf_life.py) —
  // never persisted, not food-safety guidance, just an "expiring soon" nudge.
  estimated_expiry?: string | null;
  days_until_expiry?: number | null;
}

export interface PantryResponse {
  user_id: string;
  items: PantryItem[];
  // null if nothing's ever been confirmed — used for the "you haven't
  // logged in a while" in-app nudge (Epic 13.1).
  days_since_last_confirmation: number | null;
}

// One consumption event for the Tages-Log's per-day view — either a
// normal pantry confirmation or a manual (free-text) entry.
export interface ConsumptionLogEntry {
  id: string;
  user_id: string;
  normalized_name: string;
  quantity_consumed: number;
  consumed_at: string;
}

export interface ConsumptionLogResponse {
  user_id: string;
  date: string;
  entries: ConsumptionLogEntry[];
}

// --- Epic 5: Next Cart --------------------------------------------------

export type ActionType = "add" | "replace" | "reduce" | "none";
export type RecommendationStatus =
  | "recommended"
  | "no_gaps"
  | "no_suitable_candidate";

export interface EvaluatedCandidate {
  item: string;
  targets_gap: string;
  allowed: boolean;
  reason?: string | null;
}

export interface Recipe {
  title: string;
  description: string;
  prep_minutes?: number | null;
}

// One easy, low-effort/cheap/in-season swap — a broader supplementary
// list alongside the single deliberate Next Cart pick below (see
// backend services/easy_swaps.py).
export interface EasySwap {
  item: string;
  targets_gap: string;
  cost: "low" | "medium" | "high";
  rationale: string;
}

// "Use what you already have" — a pantry item that already targets an
// open gap, shown ALONGSIDE (never instead of) the purchase pick below
// so the user can choose either. `urgent` when expiring soon or already
// past its estimated shelf life (see backend services/shelf_life.py).
export interface PantryMatch {
  item: string;
  targets_gap: string;
  days_until_expiry: number | null;
  urgent: boolean;
  message: string;
}

// --- Progress Tracking (integration briefing addendum) -------------------

export interface DimensionDelta {
  dimension: string;
  before: number | null;
  after: number | null;
  change: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  is_improvement: boolean | null;
}

export type ProgressTrend = "improving" | "stable" | "declining" | "insufficient_data";

export interface ProgressReport {
  has_history: boolean;
  receipts_compared: number;
  deltas: DimensionDelta[];
  // Bedarf-vs-Ist analog of `deltas` (iron/protein/calcium daily intake
  // this week vs. the week before) — independent of receipt count,
  // since it's built from confirmed pantry consumption, not receipts.
  absolute_deltas: DimensionDelta[];
  trend: ProgressTrend;
  addressed_gap_improved: boolean | null;
  message: string;
  disclaimer: string;
}

export interface NextCartRecommendation {
  recommendation_id: string;
  user_id: string;
  status: RecommendationStatus;
  action_type: ActionType;
  item?: string | null;
  targets_gap?: string | null;
  gap_status?: string | null;
  message: string;
  reasoning: string[];
  confidence: ConfidenceLevel;
  evaluated_candidates: EvaluatedCandidate[];
  recipes: Recipe[];
  // "Cook with what you have" — recipes buildable from the current
  // pantry that also target an open absolute gap. [] when there's no
  // open absolute gap or nothing in the pantry matches it.
  pantry_recipes: Recipe[];
  // Broader "easy things to add" list across every flagged gap, favoring
  // low effort/cost and seasonal availability — see services/easy_swaps.py.
  easy_swaps: EasySwap[];
  // Warm, conversational phrasing of the health score/gaps/recommendation
  // /easy swaps/progress above — an LLM only rephrases these already-
  // computed facts, never adds new ones (see backend services/nutri_coach.py).
  coach_message: string;
  // Shown alongside the purchase recommendation above (Option A), not
  // instead of it — null when nothing in the pantry matches any open gap.
  pantry_match: PantryMatch | null;
  progress?: ProgressReport | null;
}

// --- Epic 8: Feedback ----------------------------------------------------

export type FeedbackResponseValue = "yes" | "no" | "maybe";

export interface FeedbackCreate {
  recommendation_id: string;
  response: FeedbackResponseValue;
  comment?: string | null;
}

export interface Feedback extends FeedbackCreate {
  id: string;
  user_id: string;
}

export interface ApiErrorBody {
  detail?: string;
}

// --- Epic 10: Eaten / consumption feedback (A/B) -------------------------

export type ConsumptionVariant = "A" | "B";

export interface PriorReceiptItem {
  item_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  waste_fraction: number;
}

export interface PriorReceipt {
  receipt_id: string;
  store: string | null;
  purchase_date: string | null;
  uploaded_at: string | null;
  items: PriorReceiptItem[];
}

export interface ConsumptionContext {
  user_id: string;
  // Sticky A/B assignment (R-EATEN): A = prompted at next upload,
  // B = a card on the dashboard.
  variant: ConsumptionVariant;
  // null when the user has no prior receipt (variant A shows nothing).
  prior_receipt: PriorReceipt | null;
}

export interface ConsumptionFeedbackPayload {
  receipt_id: string;
  // Per-item waste (BR-I3 "named items reduced individually")...
  items?: { item_id: string; waste_fraction: number }[];
  // ...or one uniform fraction across the receipt ("else uniform").
  waste_fraction?: number;
}

export interface ConsumptionFeedbackResult {
  user_id: string;
  receipt_id: string;
  items_updated: number;
  // Freshly recomputed status-quo daily intake (per nutrient).
  daily_intake: Record<string, number>;
}
