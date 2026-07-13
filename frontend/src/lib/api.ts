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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const SESSION_KEY = "nutriwise.sessionId";
const SESSION_HEADER = "X-Session-Id";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// --- Session (Story 8.3) -------------------------------------------------
//
// No auth exists, so the "session" is just an opaque ID this browser
// holds and sends back on every request. The backend mints one on the
// first call that doesn't have it yet and returns it in the response
// body; every response is checked for that field so callers never have
// to think about sessions at all.

function getStoredSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

// Demo account picker (AccountPickerStep.tsx): switches which fixed
// session_id every subsequent request is tagged with, so picking
// "Jennifer" vs. "Stuart" resolves to that identity's own data instead
// of whatever this browser last used. Every other read in this module
// re-reads localStorage per call (see sessionHeaders() below), so this
// takes effect immediately, no reload needed.
export function setSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_KEY, sessionId);
}

function sessionHeaders(): Record<string, string> {
  const id = getStoredSessionId();
  return id ? { [SESSION_HEADER]: id } : {};
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
  const body = await res.json();
  if (body && typeof body === "object" && typeof body.session_id === "string") {
    localStorage.setItem(SESSION_KEY, body.session_id);
  }
  return body as T;
}

// --- Epic 1: Receipts -------------------------------------------------

export function uploadReceiptFile(file: File, profileId?: string): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (profileId) formData.append("user_id", profileId);
  return fetch(`${API_BASE}/receipts`, {
    method: "POST",
    headers: sessionHeaders(),
    body: formData,
  }).then((res) => handle<UploadReceiptResponse>(res));
}

export function uploadReceiptText(text: string, profileId?: string): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append("text", text);
  if (profileId) formData.append("user_id", profileId);
  return fetch(`${API_BASE}/receipts`, {
    method: "POST",
    headers: sessionHeaders(),
    body: formData,
  }).then((res) => handle<UploadReceiptResponse>(res));
}

export function listReceipts(): Promise<{ session_id: string; receipts: ReceiptRow[] }> {
  return fetch(`${API_BASE}/receipts`, { headers: sessionHeaders() }).then((res) =>
    handle<{ session_id: string; receipts: ReceiptRow[] }>(res),
  );
}

export function getReceipt(receiptId: string): Promise<ReceiptDetailResponse> {
  return fetch(`${API_BASE}/receipts/${receiptId}`).then((res) => handle<ReceiptDetailResponse>(res));
}

export function updateReceiptItem(
  receiptId: string,
  itemId: string,
  updates: ReceiptItemUpdate,
): Promise<{ receipt_id: string; item_id: string; updated: ReceiptItemUpdate }> {
  return fetch(`${API_BASE}/receipts/${receiptId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  }).then((res) =>
    handle<{ receipt_id: string; item_id: string; updated: ReceiptItemUpdate }>(res),
  );
}

export function deleteReceipt(receiptId: string): Promise<{ receipt_id: string; deleted: boolean }> {
  // Bug fix: this never sent the session header, so the backend's
  // session-ownership check (added to close a cross-session-delete gap)
  // saw a fresh random session on every call and always returned 403 —
  // "Delete my data" was completely broken until this was added.
  return fetch(`${API_BASE}/receipts/${receiptId}`, {
    method: "DELETE",
    headers: sessionHeaders(),
  }).then((res) => handle<{ receipt_id: string; deleted: boolean }>(res));
}

// --- Epic 3: Profile ----------------------------------------------------

export function createProfile(profile: ProfileCreate): Promise<Profile> {
  return fetch(`${API_BASE}/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(profile),
  }).then((res) => handle<Profile>(res));
}

export function getProfile(profileId: string): Promise<Profile> {
  return fetch(`${API_BASE}/profile/${profileId}`, { headers: sessionHeaders() }).then((res) =>
    handle<Profile>(res),
  );
}

export function updateProfile(profileId: string, updates: Partial<ProfileCreate>): Promise<Profile> {
  return fetch(`${API_BASE}/profile/${profileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(updates),
  }).then((res) => handle<Profile>(res));
}

// Demo account picker: does this (fixed, shared) session_id already have
// a profile? null (not an error) means it hasn't onboarded yet.
export function getProfileBySession(sessionId: string): Promise<Profile | null> {
  return fetch(`${API_BASE}/profile/by-session/${sessionId}`, { headers: sessionHeaders() }).then(
    (res) => (res.status === 404 ? null : handle<Profile>(res)),
  );
}

export function deleteProfile(profileId: string): Promise<{ profile_id: string; deleted: boolean }> {
  // Bug fix: same missing session header as deleteReceipt above.
  return fetch(`${API_BASE}/profile/${profileId}`, {
    method: "DELETE",
    headers: sessionHeaders(),
  }).then((res) => handle<{ profile_id: string; deleted: boolean }>(res));
}

// --- Epic 4: Nutrition snapshot ------------------------------------------

export function getNutritionSnapshot(profileId?: string): Promise<NutritionSnapshot> {
  const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
  return fetch(`${API_BASE}/nutrition/snapshot${query}`, { headers: sessionHeaders() }).then((res) =>
    handle<NutritionSnapshot>(res),
  );
}

// --- Pantry (Lager-Bestand) -----------------------------------------------
//
// Cumulative running stock, not a snapshot: every receipt upload adds to
// it server-side, and it only shrinks via consume/remove below. See
// backend services/pantry.py.

export function getPantry(): Promise<PantryResponse> {
  return fetch(`${API_BASE}/pantry`, { headers: sessionHeaders() }).then((res) =>
    handle<PantryResponse>(res),
  );
}

export function consumePantryItem(
  normalizedName: string,
  quantity: number,
  consumedAt?: string,
): Promise<{ session_id: string; normalized_name: string; consumed: number }> {
  return fetch(`${API_BASE}/pantry/items/${encodeURIComponent(normalizedName)}/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ quantity, consumed_at: consumedAt }),
  }).then((res) =>
    handle<{ session_id: string; normalized_name: string; consumed: number }>(res),
  );
}

// Tages-Log: log food that may or may not be in the pantry, for a given
// day (retroactive logging supported via `consumedAt`). Matches an
// existing pantry item by name if one exists (reduces stock like a
// normal consume); otherwise logs a standalone entry — see backend
// services/pantry.py's log_manual_consumption.
export function logManualConsumption(
  name: string,
  quantity: number,
  consumedAt?: string,
  unit?: string,
  category?: string,
): Promise<{ session_id: string; name: string; logged: number; matched: boolean }> {
  return fetch(`${API_BASE}/pantry/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ name, quantity, unit, category, consumed_at: consumedAt }),
  }).then((res) =>
    handle<{ session_id: string; name: string; logged: number; matched: boolean }>(res),
  );
}

// Correct a pantry item's unit/category after the fact (Epic 12.3) — an
// OCR mis-categorization would otherwise silently skew its shelf-life
// estimate and gram-conversion. `category` must be one of the 8
// canonical categories (see PANTRY_CATEGORIES in PantryStep.tsx).
export function updatePantryItemMetadata(
  normalizedName: string,
  fields: { unit?: string; category?: string },
): Promise<{ session_id: string; normalized_name: string; item: PantryItem }> {
  return fetch(`${API_BASE}/pantry/items/${encodeURIComponent(normalizedName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(fields),
  }).then((res) =>
    handle<{ session_id: string; normalized_name: string; item: PantryItem }>(res),
  );
}

export function getConsumptionLogForDate(date: string): Promise<ConsumptionLogResponse> {
  return fetch(`${API_BASE}/pantry/log?date=${encodeURIComponent(date)}`, {
    headers: sessionHeaders(),
  }).then((res) => handle<ConsumptionLogResponse>(res));
}

export function removePantryItem(
  normalizedName: string,
  quantity: number,
): Promise<{ session_id: string; normalized_name: string; removed: number }> {
  return fetch(`${API_BASE}/pantry/items/${encodeURIComponent(normalizedName)}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ quantity }),
  }).then((res) =>
    handle<{ session_id: string; normalized_name: string; removed: number }>(res),
  );
}

// --- Epic 5: Next Cart ----------------------------------------------------

export function getNextCart(profileId?: string): Promise<NextCartRecommendation> {
  const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
  return fetch(`${API_BASE}/next-cart${query}`, { headers: sessionHeaders() }).then((res) =>
    handle<NextCartRecommendation>(res),
  );
}

// --- Epic 8: Feedback ------------------------------------------------------

export function submitFeedback(feedback: FeedbackCreate): Promise<Feedback> {
  return fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(feedback),
  }).then((res) => handle<Feedback>(res));
}
