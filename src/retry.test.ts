import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'groq-sdk';
import { describe, expect, it, vi } from 'vitest';
import { InvalidAIResponse, shouldRetry, withOneRetry } from './retry.js';

// The same error objects the Groq SDK throws for an HTTP status (no network involved)
const httpError = (status: number, code = 'x') =>
  APIError.generate(status, { error: { message: 'example', code } }, 'example', new Headers());

describe('shouldRetry: temporary problems get one more try', () => {
  it.each([
    ['rate limit', httpError(429), 'rate limited (429)'],
    ['server error', httpError(500), 'server error (500)'],
    ['bad gateway', httpError(502), 'server error (502)'],
    ['service unavailable', httpError(503), 'server error (503)'],
    ['network error', new APIConnectionError({ message: 'socket hang up' }), 'network error'],
    ['timeout', new APIConnectionTimeoutError(), 'network error'],
    ['broken JSON', new InvalidAIResponse('the AI answer was not valid JSON'), 'the AI answer was not valid JSON'],
    ['wrong shape', new InvalidAIResponse('the AI answer did not match the expected shape'), 'the AI answer did not match the expected shape'],
  ])('retries on %s', (_name, err, reason) => {
    expect(shouldRetry(err)).toEqual({ retry: true, reason });
  });
});

describe('shouldRetry: mistakes in our request fail straight away', () => {
  it.each([
    ['bad request (400)', httpError(400)],
    ['bad API key (401)', httpError(401, 'invalid_api_key')],
    ['permission denied (403)', httpError(403)],
    ['model_not_found (404)', httpError(404, 'model_not_found')],
    ['unprocessable (422)', httpError(422)],
    ['a request we cancelled', new APIUserAbortError()],
    ['an unexpected error', new Error('something else')],
    ['a non-error value', 'oops'],
  ])('does not retry on %s', (_name, err) => {
    expect(shouldRetry(err)).toEqual({ retry: false });
  });
});

describe('withOneRetry', () => {
  const noWait = vi.fn(async () => {});

  it('returns the first answer when it works, without waiting', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(withOneRetry(fn, { delayMs: 2000, sleep: noWait })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits 2 seconds and tries again after a temporary failure', async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce('ok');
    await expect(withOneRetry(fn, { delayMs: 2000, sleep, onRetry })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(onRetry).toHaveBeenCalledWith('rate limited (429)');
  });

  it('retries only once: a second failure is thrown', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(503));
    await expect(withOneRetry(fn, { delayMs: 2000, sleep: noWait })).rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a bad API key', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(httpError(401));
    await expect(withOneRetry(fn, { delayMs: 2000, sleep: noWait, onRetry })).rejects.toMatchObject({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
