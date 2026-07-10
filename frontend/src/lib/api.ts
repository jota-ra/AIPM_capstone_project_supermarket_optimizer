import type {
  ApiErrorBody,
  Feedback,
  FeedbackCreate,
  NextCartRecommendation,
  NutritionSnapshot,
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
