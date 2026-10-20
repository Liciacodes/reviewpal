"use client";

import { useEffect, useState } from "react";
import { ApiError } from "./api";

type Result<T> = { key: string; data?: T; error?: ApiError };

// Loads data from the API in a client component.
// - `loading` is true only while there is nothing to show yet (first load or after Retry)
// - when the page becomes visible again, it refetches quietly and keeps showing the old data
export function useApi<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const requestKey = `${key}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setResult({ key: requestKey, data }),
      (err) => {
        if (controller.signal.aborted) return;
        const error = err instanceof ApiError ? err : new ApiError(String(err), 0);
        setResult({ key: requestKey, error });
      }
    );
    return () => controller.abort();
    // `load` is a new function on every render, so we depend on the key instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const current = result?.key === requestKey ? result : null;

  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    retry: () => setAttempt((n) => n + 1),
  };
}
