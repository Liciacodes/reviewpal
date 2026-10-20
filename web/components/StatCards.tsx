"use client";

import { getStats } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { ErrorState, LoadingRegion, Skeleton } from "./states";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-6">
      <dt className="font-mono text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-3 font-mono text-3xl font-semibold tabular-nums text-accent">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <LoadingRegion label="Loading stats">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-16" />
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
      <StatCard label="Comments" value={data.totalComments.toLocaleString("en")} />
      <StatCard
        label="Useful"
        value={data.usefulPercent === null ? "—" : `${data.usefulPercent}%`}
        hint={data.usefulPercent === null ? "No comments rated yet" : "of rated comments"}
      />
    </dl>
  );
}
