import type { Feedback, ReviewComment, ReviewDetail, ReviewSummary, Stats } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

// An error with the HTTP status, so pages can tell "not found" apart from "server down"
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    // fetch only throws when the server can't be reached at all
    throw new ApiError(`Can't reach the API at ${API_URL}. Is the server running?`, 0);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
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
