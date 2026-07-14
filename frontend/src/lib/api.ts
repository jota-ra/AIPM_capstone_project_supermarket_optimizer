import type {
  ApiErrorBody,
  ConsumptionLogResponse,
  Feedback,
  FeedbackCreate,
  NextCartRecommendation,
  NutritionSnapshot,
  PantryItem,
  PantryResponse,
  Profile,
  ProfileCreate,
  ReceiptDetailResponse,
  ReceiptItemUpdate,
  ReceiptRow,
  UploadReceiptResponse,
} from "@/types/api";
import { supabase } from "@/lib/supabase";

// Strip any trailing slash(es): every call below builds URLs as
// `${API_BASE}/path`, so a base like "http://localhost:8000/" (a common
// .env slip) would otherwise produce "http://localhost:8000//path", which
// Starlette does not match against "/path" → a bare 404 "Not Found".
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// --- Auth (E1) -----------------------------------------------------------
//
// Every request carries the signed-in user's Supabase access token as
// `Authorization: Bearer <jwt>`. The backend verifies it and scopes all
// data by the user id (see backend/app/services/auth.py). This replaced
// the old anonymous `X-Session-Id` model entirely — there is no
// unauthenticated request path anymore; the app gates on a session before
// any of these are called (see App.tsx).

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonHeaders(): Promise<Record<string, string>> {
  return { "Content-Type": "application/json", ...(await authHeader()) };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body: ApiErrorBody = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

// --- Receipts ------------------------------------------------------------

export async function uploadReceiptFile(file: File): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append("file", file);
  // Note: no user_id in the body — the backend derives it from the token.
  const res = await fetch(`${API_BASE}/receipts`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  return handle<UploadReceiptResponse>(res);
}

export async function uploadReceiptText(text: string): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append("text", text);
  const res = await fetch(`${API_BASE}/receipts`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  return handle<UploadReceiptResponse>(res);
}

// E3-S5: map a failed upload to a localized message key based on the typed
// HTTP status the backend now returns (429 rate-limited / 503 unavailable /
// 422 invalid image), falling back to the generic upload-failed copy.
export function receiptErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return "upload.errRateLimited";
    if (e.status === 503) return "upload.errUnavailable";
    if (e.status === 422) return "upload.errInvalid";
  }
  return "upload.uploadFailed";
}

export interface MultiUploadResult {
  file: string;
  ok: boolean;
  response?: UploadReceiptResponse;
  errorKey?: string;
}

// E3-S1: "each uploaded file is one receipt". Uploads run sequentially so
// each file becomes its own independent receipt and one failure never sinks
// the rest — the caller gets a per-file result to report.
export async function uploadReceiptFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<MultiUploadResult[]> {
  const results: MultiUploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const response = await uploadReceiptFile(files[i]);
      results.push({ file: files[i].name, ok: true, response });
    } catch (e) {
      results.push({ file: files[i].name, ok: false, errorKey: receiptErrorKey(e) });
    }
    onProgress?.(i + 1, files.length);
  }
  return results;
}

export async function listReceipts(): Promise<{ user_id: string; receipts: ReceiptRow[] }> {
  const res = await fetch(`${API_BASE}/receipts`, { headers: await authHeader() });
  return handle<{ user_id: string; receipts: ReceiptRow[] }>(res);
}

export async function getReceipt(receiptId: string): Promise<ReceiptDetailResponse> {
  const res = await fetch(`${API_BASE}/receipts/${receiptId}`, { headers: await authHeader() });
  return handle<ReceiptDetailResponse>(res);
}

export async function updateReceiptItem(
  receiptId: string,
  itemId: string,
  updates: ReceiptItemUpdate,
): Promise<{ receipt_id: string; item_id: string; updated: ReceiptItemUpdate }> {
  const res = await fetch(`${API_BASE}/receipts/${receiptId}/items/${itemId}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(updates),
  });
  return handle<{ receipt_id: string; item_id: string; updated: ReceiptItemUpdate }>(res);
}

export async function deleteReceipt(receiptId: string): Promise<{ receipt_id: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/receipts/${receiptId}`, {
    method: "DELETE",
    headers: await authHeader(),
  });
  return handle<{ receipt_id: string; deleted: boolean }>(res);
}

// --- Profile (E1) --------------------------------------------------------

export async function createProfile(profile: ProfileCreate): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profile`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(profile),
  });
  return handle<Profile>(res);
}

// The authenticated user's own profile, or null if they haven't onboarded
// yet (E1-S6 resume). null (not an error) on 404.
export async function getMyProfile(): Promise<Profile | null> {
  const res = await fetch(`${API_BASE}/profile/me`, { headers: await authHeader() });
  return res.status === 404 ? null : handle<Profile>(res);
}

export async function getProfile(profileId: string): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profile/${profileId}`, { headers: await authHeader() });
  return handle<Profile>(res);
}

export async function updateProfile(profileId: string, updates: Partial<ProfileCreate>): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profile/${profileId}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(updates),
  });
  return handle<Profile>(res);
}

export async function deleteProfile(profileId: string): Promise<{ profile_id: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/profile/${profileId}`, {
    method: "DELETE",
    headers: await authHeader(),
  });
  return handle<{ profile_id: string; deleted: boolean }>(res);
}

// --- Nutrition snapshot --------------------------------------------------

export async function getNutritionSnapshot(profileId?: string): Promise<NutritionSnapshot> {
  const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
  const res = await fetch(`${API_BASE}/nutrition/snapshot${query}`, { headers: await authHeader() });
  return handle<NutritionSnapshot>(res);
}

// --- Pantry (Lager-Bestand) ----------------------------------------------

export async function getPantry(): Promise<PantryResponse> {
  const res = await fetch(`${API_BASE}/pantry`, { headers: await authHeader() });
  return handle<PantryResponse>(res);
}

export async function consumePantryItem(
  normalizedName: string,
  quantity: number,
  consumedAt?: string,
): Promise<{ user_id: string; normalized_name: string; consumed: number }> {
  const res = await fetch(`${API_BASE}/pantry/items/${encodeURIComponent(normalizedName)}/consume`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ quantity, consumed_at: consumedAt }),
  });
  return handle<{ user_id: string; normalized_name: string; consumed: number }>(res);
}

export async function logManualConsumption(
  name: string,
  quantity: number,
  consumedAt?: string,
  unit?: string,
  category?: string,
): Promise<{ user_id: string; name: string; logged: number; matched: boolean }> {
  const res = await fetch(`${API_BASE}/pantry/log`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ name, quantity, unit, category, consumed_at: consumedAt }),
  });
  return handle<{ user_id: string; name: string; logged: number; matched: boolean }>(res);
}

export async function updatePantryItemMetadata(
  normalizedName: string,
  fields: { unit?: string; category?: string },
): Promise<{ user_id: string; normalized_name: string; item: PantryItem }> {
  const res = await fetch(`${API_BASE}/pantry/items/${encodeURIComponent(normalizedName)}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(fields),
  });
  return handle<{ user_id: string; normalized_name: string; item: PantryItem }>(res);
}

export async function getConsumptionLogForDate(date: string): Promise<ConsumptionLogResponse> {
  const res = await fetch(`${API_BASE}/pantry/log?date=${encodeURIComponent(date)}`, {
    headers: await authHeader(),
  });
  return handle<ConsumptionLogResponse>(res);
}

export async function removePantryItem(
  normalizedName: string,
  quantity: number,
): Promise<{ user_id: string; normalized_name: string; removed: number }> {
  const res = await fetch(`${API_BASE}/pantry/items/${encodeURIComponent(normalizedName)}/remove`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ quantity }),
  });
  return handle<{ user_id: string; normalized_name: string; removed: number }>(res);
}

// --- Next Cart -----------------------------------------------------------

export async function getNextCart(profileId?: string): Promise<NextCartRecommendation> {
  const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
  const res = await fetch(`${API_BASE}/next-cart${query}`, { headers: await authHeader() });
  return handle<NextCartRecommendation>(res);
}

// --- Feedback ------------------------------------------------------------

export async function submitFeedback(feedback: FeedbackCreate): Promise<Feedback> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(feedback),
  });
  return handle<Feedback>(res);
}
