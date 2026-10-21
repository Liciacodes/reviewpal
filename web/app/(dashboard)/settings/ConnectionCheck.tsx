"use client";

import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { checkHealth } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@/components/states";

// Calls /health through the dashboard, the same way every API request travels
export function ConnectionCheck() {
  const { error, loading, retry } = useApi("connection", checkHealth);

  return (
    <dl className="divide-y divide-line rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-1 p-6 sm:flex-row sm:items-center sm:justify-between">
        <dt className="font-mono text-xs uppercase tracking-widest text-muted">API</dt>
        <dd className="font-mono text-sm text-fg [overflow-wrap:anywhere]">Forwarded by the dashboard</dd>
      </div>

      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <dt className="font-mono text-xs uppercase tracking-widest text-muted">Status</dt>
        <dd className="flex items-center gap-3" role="status">
          {loading ? (
            <>
              <span className="sr-only">Checking connection</span>
              <Skeleton className="h-5 w-28" />
            </>
          ) : error ? (
            <span className="inline-flex items-center gap-2 text-sm text-red-400">
              <CircleX aria-hidden className="size-4" />
              Not reachable
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-emerald-400">
              <CircleCheck aria-hidden className="size-4" />
              Connected
            </span>
          )}
          <button
            type="button"
            onClick={retry}
            aria-label="Check connection again"
            title="Check again"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-line hover:text-fg"
          >
            <RefreshCw aria-hidden className="size-4" />
          </button>
        </dd>
      </div>

      <div className="p-6 text-sm text-muted">
        The browser only talks to this dashboard, which forwards <code className="font-mono text-fg">/api</code> and{" "}
        <code className="font-mono text-fg">/auth</code> to the API server. To point it at another server, set{" "}
        <code className="font-mono text-fg">API_ORIGIN</code> in <code className="font-mono text-fg">web/.env.local</code>{" "}
        and restart the dashboard.
      </div>
    </dl>
  );
}
