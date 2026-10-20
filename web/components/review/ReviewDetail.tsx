"use client";

import { ArrowLeft, Clock, ExternalLink, FileCode, GitPullRequest, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { getReview, setFeedback } from "@/lib/api";
import type { Feedback, ReviewComment, ReviewDetail as Review } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { SeverityCounts, StatusBadge } from "../badges";
import { SectionLabel } from "../PageHeader";
import { RelativeTime } from "../RelativeTime";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../states";
import { CommentCard } from "./CommentCard";
import { FileDiff, type FeedbackFor } from "./FileDiff";

export function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, retry } = useApi(`review:${id}`, (signal) => getReview(id, signal));

  if (error?.status === 404) {
    return (
      <>
        <BackLink />
        <EmptyState icon={GitPullRequest} title="Review not found">
          It may have been deleted. <Link href="/reviews" className="text-accent hover:text-amber-300">See all reviews</Link>.
        </EmptyState>
      </>
    );
  }
  if (error) {
    return (
      <>
        <BackLink />
        <ErrorState message={error.message} onRetry={retry} />
      </>
    );
  }
  if (loading || !data) return <ReviewDetailSkeleton />;

  return <ReviewView review={data} onRefresh={retry} />;
}

function BackLink() {
  return (
    <Link
      href="/reviews"
      className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-fg"
    >
      <ArrowLeft aria-hidden className="size-4" />
      All reviews
    </Link>
  );
}

// A copy of the object without one key
function without<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

function ReviewView({ review, onRefresh }: { review: Review; onRefresh: () => void }) {
  // Optimistic feedback: show the click immediately, undo it if the server says no
  const [optimistic, setOptimistic] = useState<Record<string, Feedback>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const feedbackFor: FeedbackFor = (comment) => ({
    feedback: optimistic[comment.id] ?? comment.feedback,
    error: errors[comment.id],
    onFeedback: async (value) => {
      const previous = optimistic[comment.id];
      setOptimistic((o) => ({ ...o, [comment.id]: value }));
      setErrors((e) => without(e, comment.id));
      try {
        await setFeedback(comment.id, value);
      } catch {
        setOptimistic((o) => (previous ? { ...o, [comment.id]: previous } : without(o, comment.id)));
        setErrors((e) => ({ ...e, [comment.id]: "Couldn't save. Try again." }));
      }
    },
  });

  // Comments for files we have go inline; any others are shown at the bottom
  const filenames = new Set(review.files.map((f) => f.filename));
  const general = review.comments.filter((c) => !filenames.has(c.path));
  const commentsFor = (path: string) => review.comments.filter((c) => c.path === path);
  const counts = { bug: 0, risk: 0, style: 0 };
  for (const c of review.comments) counts[c.severity]++;

  return (
    <>
      <BackLink />

      <header className="mb-10">
        <p className="font-mono text-xs text-muted [overflow-wrap:anywhere]">
          {review.repo.owner}/{review.repo.name} · #{review.prNumber} · {review.headSha.slice(0, 7)}
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{review.prTitle}</h1>
          <a
            href={review.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-muted"
          >
            View on GitHub
            <ExternalLink aria-hidden className="size-4 text-muted" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <StatusBadge status={review.status} />
          <span className="font-mono text-xs">
            {review.filesChanged} {review.filesChanged === 1 ? "file" : "files"}
          </span>
          <SeverityCounts counts={counts} />
          <RelativeTime iso={review.createdAt} className="text-xs" />
          <span className="font-mono text-xs">{review.model}</span>
        </div>
      </header>

      {review.status === "failed" && (
        <div role="alert" className="mb-8 flex gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-4">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="font-mono text-sm text-fg">This review failed</p>
            <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{review.errorMessage ?? "No error message was saved."}</p>
          </div>
        </div>
      )}

      {review.status === "pending" && (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4">
          <Clock aria-hidden className="size-4 text-muted" />
          <p className="flex-1 text-sm text-muted">The AI is still reviewing this pull request.</p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-muted"
          >
            <RefreshCw aria-hidden className="size-4" />
            Refresh
          </button>
        </div>
      )}

      <section aria-labelledby="files-heading">
        <div className="mb-4"><SectionLabel id="files-heading">Files changed</SectionLabel></div>
        {review.files.length === 0 ? (
          <EmptyState icon={FileCode} title="No files saved">
            {review.status === "pending" ? "Files appear here once they are fetched." : "This review has no changed files."}
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {review.files.map((file) => (
              <FileDiff key={file.id} file={file} comments={commentsFor(file.filename)} feedbackFor={feedbackFor} />
            ))}
          </div>
        )}
      </section>

      {general.length > 0 && (
        <section aria-labelledby="general-heading" className="mt-12">
          <div className="mb-4"><SectionLabel id="general-heading">General comments</SectionLabel></div>
          <div className="space-y-3">
            {general.map((c: ReviewComment) => (
              <CommentCard key={c.id} comment={c} {...feedbackFor(c)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <LoadingRegion label="Loading review">
      <Skeleton className="mb-8 h-4 w-24" />
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-3 h-8 w-2/3" />
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="mt-10 space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-line">
            <div className="border-b border-line bg-surface px-4 py-3"><Skeleton className="h-4 w-48" /></div>
            <div className="space-y-2 p-4">
              {[80, 65, 90, 50, 70].map((w, j) => (
                <Skeleton key={j} className="h-3.5" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
