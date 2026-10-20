"use client";

import type { ReactNode } from "react";
import { getStats } from "@/lib/api";
import type { SeverityCounts } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { presentSeverities, SEVERITY, severityWord } from "./badges";
import { ErrorState, LoadingRegion, Skeleton } from "./states";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <dt className="font-mono text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-accent">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

// "2 bugs · 3 styles", each in its severity colour. Zero counts are left out.
function SeverityLine({ counts }: { counts: SeverityCounts }) {
  return (
    <span className="font-mono">
      {presentSeverities(counts).map((key, i) => (
        <span key={key}>
          {i > 0 && <span aria-hidden> · </span>}
          <span className={SEVERITY[key].text}>
            {counts[key]} {severityWord(key, counts[key])}
          </span>
        </span>
      ))}
    </span>
  );
}

export function StatCardsSkeleton() {
  return (
    <LoadingRegion label="Loading stats">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-surface px-5 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-7 w-16" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function StatCards() {
  const { data, error, loading, retry } = useApi("stats", getStats);

  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  if (loading || !data) return <StatCardsSkeleton />;

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Reviews" value={data.totalReviews.toLocaleString("en")} />
      <StatCard
        label="Comments"
        value={data.totalComments.toLocaleString("en")}
        hint={data.counts && data.totalComments > 0 ? <SeverityLine counts={data.counts} /> : undefined}
      />
      <StatCard
        label="Useful"
        value={data.usefulPercent === null ? "—" : `${data.usefulPercent}%`}
        hint={data.usefulPercent === null ? "No comments rated yet" : "of rated comments"}
      />
    </dl>
  );
}
