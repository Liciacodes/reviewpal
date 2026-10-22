"use client";

import { MoreHorizontal, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { rerunReview } from "@/lib/api";
import { ApiError } from "@/lib/api";

// Starts a re-run. `onStarted` refreshes the page, which then shows "pending" and auto-refreshes.
function useRerun(reviewId: string, onStarted: () => void) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    setStarting(true);
    setError(undefined);
    try {
      await rerunReview(reviewId);
      onStarted();
    } catch (err) {
      // 409 explains why (already running, or the PR has newer commits)
      setError(err instanceof ApiError ? err.message : "Couldn't start the re-run. Try again.");
    } finally {
      setStarting(false);
    }
  }

  return { start, starting, error };
}

const buttonClass =
  "inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-muted disabled:opacity-60";

// For a failed review: shown in the "This review failed" box
export function RerunButton({ reviewId, onStarted }: { reviewId: string; onStarted: () => void }) {
  const { start, starting, error } = useRerun(reviewId, onStarted);
  return (
    <div className="mt-3">
      <button type="button" onClick={start} disabled={starting} className={buttonClass}>
        <RotateCcw aria-hidden className="size-4" />
        {starting ? "Starting…" : "Re-run review"}
      </button>
      {error && <p role="status" className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

// For a finished review: a small "⋯" menu next to "View on GitHub"
export function MoreMenu({ reviewId, onStarted }: { reviewId: string; onStarted: () => void }) {
  const [open, setOpen] = useState(false);
  const { start, starting, error } = useRerun(reviewId, () => {
    setOpen(false);
    onStarted();
  });
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  // Close with Escape or a click outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="More actions"
        className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors duration-150 hover:border-muted hover:text-fg"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-fg">Re-run this review?</p>
          <p className="mt-1 text-xs text-muted">
            The AI reviews the same commit again. Its comments, and their ratings, are replaced. If this review is already
            on GitHub, it isn&apos;t posted a second time.
          </p>
          <button type="button" onClick={start} disabled={starting} className={`mt-3 ${buttonClass}`}>
            <RotateCcw aria-hidden className="size-4" />
            {starting ? "Starting…" : "Re-run review"}
          </button>
          {error && <p role="status" className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
