// Mirrors backend Pydantic models. Kept as plain interfaces (not zod)
// since this is an internal testing UI, not a public-facing app.

export interface ParsedReceiptItem {
  name: string;
  original_text?: string | null;
  quantity: number;
  unit?: string | null;
  category: string;
  uncertain: boolean;
}

export interface ParsedReceipt {
  store: string;
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
}

export interface ReceiptDetailResponse {
  receipt: ReceiptRow;
  items: ReceiptItemRow[];
}

export interface ReceiptItemUpdate {
  normalized_name?: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

// --- Epic 3: Profile -------------------------------------------------

export type Goal =
  | "build_muscle"
  | "more_energy"
  | "lose_weight_gradually"
  | "eat_balanced"
  | "better_focus"
  | "better_sleep";

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
}

export interface Profile extends ProfileCreate {
  profile_id: string;
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

export interface NutritionSnapshot {
  receipts_analyzed: number;
  items_analyzed: number;
  profile: NutritionProfile;
  dimensions: DimensionSnapshot[];
  gaps: Gap[];
  confidence: ConfidenceLevel;
  disclaimer: string;
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
  trend: ProgressTrend;
  addressed_gap_improved: boolean | null;
  message: string;
  disclaimer: string;
}

export interface NextCartRecommendation {
  recommendation_id: string;
  session_id: string;
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
  session_id: string;
}

export interface ApiErrorBody {
  detail?: string;
}
