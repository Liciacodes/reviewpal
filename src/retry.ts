// When to try the AI step again, and a helper that retries once.
// Pure (no network, no env): the sleep function can be swapped out in tests.
import { APIConnectionError, APIError, APIUserAbortError } from 'groq-sdk';

// The AI answered, but not with what we asked for (broken JSON, or wrong shape)
export class InvalidAIResponse extends Error {}

export type RetryDecision = { retry: true; reason: string } | { retry: false };

// Temporary problems are worth one more try; mistakes in our request are not.
// The reason is a short label for the logs: never the error message (it could echo request details).
export function shouldRetry(err: unknown): RetryDecision {
  if (err instanceof InvalidAIResponse) return { retry: true, reason: err.message };
  if (err instanceof APIUserAbortError) return { retry: false }; // we cancelled it on purpose
  if (err instanceof APIConnectionError) return { retry: true, reason: 'network error' }; // includes timeouts
  if (err instanceof APIError && typeof err.status === 'number') {
    if (err.status === 429) return { retry: true, reason: 'rate limited (429)' };
    if (err.status >= 500) return { retry: true, reason: `server error (${err.status})` };
  }
  // 400 bad request, 401 bad API key, 404 model_not_found, and anything unexpected: fail now
  return { retry: false };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Runs `fn`; if it fails with a retryable error, waits `delayMs` and runs it ONE more time.
export async function withOneRetry<T>(
  fn: () => Promise<T>,
  options: { delayMs: number; onRetry?: (reason: string) => void; sleep?: (ms: number) => Promise<void> }
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const decision = shouldRetry(err);
    if (!decision.retry) throw err;
    options.onRetry?.(decision.reason);
    await (options.sleep ?? wait)(options.delayMs);
    return fn(); // a second failure is thrown as-is
  }
}
