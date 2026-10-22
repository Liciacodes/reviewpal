"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

type Result<T> = { key: string; data?: T; error?: ApiError };

// Loads data from the API in a client component.
// - `loading` is true only while there is nothing to show yet (first load or after `retry`)
// - `retry()` starts over and shows the loading state; `refresh()` fetches again quietly,
//   keeping the current data on screen (used for auto-refresh while a review is pending)
export function useApi<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [refreshes, setRefreshes] = useState(0);
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

  // Quiet refresh: same requestKey, so the page never drops back to its loading state.
  // A failed refresh keeps the data already shown (the next refresh tries again).
  useEffect(() => {
    if (refreshes === 0) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setResult((r) => (r?.key === requestKey ? { key: requestKey, data } : r)),
      () => {}
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshes]);

  const current = result?.key === requestKey ? result : null;

  // Stable functions, so components can use them in effects (e.g. an auto-refresh timer)
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const refresh = useCallback(() => setRefreshes((n) => n + 1), []);

  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    retry,
    refresh,
  };
}
