"use client";

import { ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import type { Feedback, ReviewComment } from "@/lib/types";
import { SEVERITY, SeverityBadge } from "../badges";

export type FeedbackProps = {
  feedback: Feedback | null; // what to show (may be the optimistic value)
  error?: string;            // set when saving failed and we rolled back
  onFeedback: (value: Feedback) => void;
};

function FeedbackButton({
  pressed, onClick, icon: Icon, label, pressedClass,
}: { pressed: boolean; onClick: () => void; icon: LucideIcon; label: string; pressedClass: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors duration-150 ${
        pressed ? pressedClass : "border-line text-muted hover:border-muted hover:text-fg"
      }`}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}

// The AI writes code in `backticks`. Splitting on them gives text, code, text, code...
function InlineCode({ text }: { text: string }) {
  return text.split("`").map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="rounded bg-line px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
        {part}
      </code>
    ) : (
      part
    )
  );
}

// An AI comment, attached under the line it talks about
export function CommentCard({ comment, feedback, error, onFeedback }: { comment: ReviewComment } & FeedbackProps) {
  const s = SEVERITY[comment.severity];

  return (
    <article
      aria-label={`${s.label} comment on line ${comment.line}`}
      className={`rounded-md border border-l-2 border-line ${s.border} bg-surface p-4 font-sans`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={comment.severity} />
        <span className="font-mono text-xs text-muted">line {comment.line}</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">
        <InlineCode text={comment.body} />
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-muted">Was this helpful?</span>
        <FeedbackButton
          pressed={feedback === "useful"}
          onClick={() => onFeedback("useful")}
          icon={ThumbsUp}
          label="Useful"
          pressedClass="border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
        />
        <FeedbackButton
          pressed={feedback === "not_useful"}
          onClick={() => onFeedback("not_useful")}
          icon={ThumbsDown}
          label="Not useful"
          pressedClass="border-stone-400/50 bg-stone-400/10 text-fg"
        />
        <span role="status" className="text-xs text-red-400">{error}</span>
      </div>
    </article>
  );
}
