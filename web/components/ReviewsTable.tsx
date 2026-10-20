"use client";

import { ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { getReviews } from "@/lib/api";
import type { ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { SeverityCounts, StatusBadge } from "./badges";
import { RelativeTime } from "./RelativeTime";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "./states";

// Loads the reviews and shows the right state: skeleton, error, empty or the list
export function ReviewsList({ limit }: { limit?: number }) {
  const { data, error, loading, retry } = useApi("reviews", getReviews);

  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  if (loading || !data) return <ReviewsTableSkeleton rows={limit ?? 6} />;
  if (data.length === 0) {
    return (
      <EmptyState icon={Inbox} title="No reviews yet">
        Open a PR in a repo where the app is installed.
      </EmptyState>
    );
  }
  return <ReviewsTable reviews={limit ? data.slice(0, limit) : data} />;
}

// The whole row is clickable with a mouse. Keyboard users use the PR title link,
// so we ignore clicks that already landed on a link or button inside the row.
function useRowClick() {
  const router = useRouter();
  return (id: string) => (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    router.push(`/reviews/${id}`);
  };
}

function GitHubLink({ review }: { review: ReviewSummary }) {
  return (
    <a
      href={review.prUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open pull request #${review.prNumber} on GitHub (new tab)`}
      title="Open on GitHub"
      className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-line hover:text-fg"
    >
      <ExternalLink aria-hidden className="size-4" />
    </a>
  );
}

function TitleLink({ review }: { review: ReviewSummary }) {
  return (
    <Link href={`/reviews/${review.id}`} className="font-medium text-fg transition-colors duration-150 hover:text-accent">
      {review.prTitle}
    </Link>
  );
}

function ReviewsTable({ reviews }: { reviews: ReviewSummary[] }) {
  const onRowClick = useRowClick();

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* Wide screens: a real table */}
      <table className="hidden w-full text-left text-sm lg:table">
        <thead>
          <tr className="border-b border-line font-mono text-xs uppercase tracking-widest text-muted">
            <th scope="col" className="px-6 py-3 font-medium">Pull request</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Comments</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Created</th>
            <th scope="col" className="w-14 py-3 pr-4"><span className="sr-only">GitHub</span></th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr
              key={review.id}
              onClick={onRowClick(review.id)}
              className="cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-white/[0.03]"
            >
              <td className="px-6 py-4">
                <div className="font-mono text-xs text-muted">
                  {review.repo} #{review.prNumber}
                </div>
                <div className="mt-1"><TitleLink review={review} /></div>
              </td>
              <td className="px-4 py-4"><StatusBadge status={review.status} /></td>
              <td className="px-4 py-4"><SeverityCounts counts={review.counts} status={review.status} /></td>
              <td className="whitespace-nowrap px-4 py-4 text-right text-muted">
                <RelativeTime iso={review.createdAt} />
              </td>
              <td className="py-4 pr-4 text-right"><GitHubLink review={review} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Small screens: stacked cards */}
      <ul className="divide-y divide-line lg:hidden">
        {reviews.map((review) => (
          <li
            key={review.id}
            onClick={onRowClick(review.id)}
            className="cursor-pointer p-4 transition-colors duration-150 hover:bg-white/[0.03] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-muted">
                  {review.repo} #{review.prNumber} · <RelativeTime iso={review.createdAt} />
                </div>
                <div className="mt-1 text-sm"><TitleLink review={review} /></div>
              </div>
              <GitHubLink review={review} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={review.status} />
              <SeverityCounts counts={review.counts} status={review.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading reviews">
      <div className="divide-y divide-line rounded-lg border border-line bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-4">
            <div className="flex-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-2 h-4 w-3/4 max-w-md" />
            </div>
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="hidden h-3 w-28 lg:block" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
