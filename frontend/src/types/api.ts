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
  | "lose_weight"
  | "gain_muscle"
  | "eat_healthier"
  | "more_energy"
  | "maintain_weight";

export type AgeRange = "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type DietaryPattern = "omnivore" | "vegetarian" | "vegan" | "pescatarian";

export interface ProfileCreate {
  goal: Goal;
  age_range: AgeRange;
  activity_level: ActivityLevel;
  dietary_pattern: DietaryPattern;
  exclusions: string[];
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

export interface NextCartRecommendation {
  status: RecommendationStatus;
  action_type: ActionType;
  item?: string | null;
  targets_gap?: string | null;
  gap_status?: string | null;
  message: string;
  reasoning: string[];
  confidence: ConfidenceLevel;
  evaluated_candidates: EvaluatedCandidate[];
}

export interface ApiErrorBody {
  detail?: string;
}
