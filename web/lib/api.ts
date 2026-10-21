import type { Feedback, Me, ReviewComment, ReviewDetail, ReviewSummary, Stats } from "./types";

// The browser only talks to the dashboard's own domain. next.config.ts forwards /api, /auth and
// /health to the API server, so the sign-in cookies are first-party and no CORS is needed.

// An error with the HTTP status, so pages can tell "not found" apart from "server down"
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// The API sets this readable cookie at sign-in; changes must echo it in the X-CSRF-Token header
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)rp_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// Not signed in (or the session expired): go to the sign-in page, then come back here
export function goToSignIn() {
  const next = window.location.pathname + window.location.search;
  // A full page load on purpose: it drops everything the signed-out user had loaded.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/sign-in?next=${encodeURIComponent(next)}`);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET") headers.set("X-CSRF-Token", csrfToken());

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (err) {
    if (init.signal?.aborted) throw err;
    // fetch only throws when the server can't be reached at all
    throw new ApiError("Can't reach the dashboard server. Check your connection.", 0);
  }

  if (res.status === 401) {
    goToSignIn();
    throw new ApiError("Your session has ended. Redirecting to sign in…", 401);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // The dashboard answers 500 with an HTML page when the API itself is down
    const fallback = res.status >= 500 ? "Can't reach the API. Is the server running?" : `Request failed (${res.status})`;
    throw new ApiError(body?.error ?? fallback, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function getMe(signal?: AbortSignal) {
  return request<Me>("/api/me", { signal });
}

export function getReviews(signal?: AbortSignal) {
  return request<ReviewSummary[]>("/api/reviews", { signal });
}

export function getReview(id: string, signal?: AbortSignal) {
  return request<ReviewDetail>(`/api/reviews/${encodeURIComponent(id)}`, { signal });
}

export function getStats(signal?: AbortSignal) {
  return request<Stats>("/api/stats", { signal });
}

export function setFeedback(commentId: string, feedback: Feedback) {
  return request<ReviewComment>(`/api/comments/${encodeURIComponent(commentId)}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
}

// Is the API up? /health is public, so this works signed in or not
export async function checkHealth(signal?: AbortSignal): Promise<true> {
  const res = await fetch("/health", { signal }).catch((err) => {
    if (signal?.aborted) throw err;
    throw new ApiError("Can't reach the dashboard server.", 0);
  });
  if (!res.ok) throw new ApiError("The API server is not responding.", res.status);
  return true;
}

export async function signOut() {
  await request<void>("/auth/logout", { method: "POST" });
  // Full page load, as in goToSignIn
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/sign-in");
}
