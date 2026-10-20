"use client";

import { FileCode, MessageSquare } from "lucide-react";
import { Fragment, useMemo } from "react";
import { parsePatch, type DiffRow } from "@/lib/diff";
import type { ReviewComment, ReviewFile } from "@/lib/types";
import { CommentCard, type FeedbackProps } from "./CommentCard";

// Lets each CommentCard get its own feedback state from the parent page
export type FeedbackFor = (comment: ReviewComment) => FeedbackProps;

const ROW_STYLE: Record<DiffRow["kind"], { row: string; marker: string; sign: string; sr?: string }> = {
  add: { row: "bg-emerald-500/10", marker: "text-emerald-400", sign: "+", sr: "Added: " },
  del: { row: "bg-red-500/10", marker: "text-red-400", sign: "−", sr: "Removed: " },
  context: { row: "", marker: "text-muted", sign: " " },
  hunk: { row: "bg-white/[0.03] text-muted", marker: "text-muted", sign: " " },
  meta: { row: "text-muted italic", marker: "text-muted", sign: " " },
};

function DiffLine({ row }: { row: DiffRow }) {
  const style = ROW_STYLE[row.kind];
  return (
    <div className={`flex ${style.row}`}>
      {/* Gutter: line number in the new file */}
      <span aria-hidden className="w-12 shrink-0 select-none border-r border-line/60 pr-3 text-right text-muted tabular-nums">
        {row.newLine ?? ""}
      </span>
      <span aria-hidden className={`w-6 shrink-0 select-none text-center ${style.marker}`}>{style.sign}</span>
      <code className="min-w-0 flex-1 whitespace-pre-wrap pr-4 [overflow-wrap:anywhere]">
        {style.sr && <span className="sr-only">{style.sr}</span>}
        {row.text || " "}
      </code>
    </div>
  );
}

export function FileDiff({ file, comments, feedbackFor }: { file: ReviewFile; comments: ReviewComment[]; feedbackFor: FeedbackFor }) {
  const rows = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch]);

  // Group comments by line, and find the ones whose line isn't shown in the diff
  const { byLine, unplaced } = useMemo(() => {
    const visible = new Set(rows.map((r) => r.newLine).filter((n) => n !== null));
    const byLine = new Map<number, ReviewComment[]>();
    const unplaced: ReviewComment[] = [];
    for (const c of comments) {
      if (visible.has(c.line)) byLine.set(c.line, [...(byLine.get(c.line) ?? []), c]);
      else unplaced.push(c);
    }
    return { byLine, unplaced };
  }, [rows, comments]);

  const renderComments = (list: ReviewComment[]) =>
    list.map((c) => <CommentCard key={c.id} comment={c} {...feedbackFor(c)} />);

  return (
    <section aria-label={file.filename} className="overflow-hidden rounded-lg border border-line bg-canvas">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-3">
        <FileCode aria-hidden className="size-4 shrink-0 text-muted" />
        <h3 className="min-w-0 flex-1 font-mono text-sm text-fg [overflow-wrap:anywhere]">{file.filename}</h3>
        <span className="font-mono text-xs text-muted">{file.status}</span>
        {comments.length > 0 && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-accent">
            <MessageSquare aria-hidden className="size-3.5" />
            {comments.length}
            <span className="sr-only">{comments.length === 1 ? "comment" : "comments"}</span>
          </span>
        )}
      </header>

      {file.patch ? (
        <div className="py-1 font-mono text-[13px] leading-6">
          {rows.map((row, i) => {
            // Comments attach to the added/context line with that new-file number.
            // A deleted line has no new number, so nothing attaches to it.
            const attached = row.newLine !== null ? byLine.get(row.newLine) : undefined;
            return (
              <Fragment key={i}>
                <DiffLine row={row} />
                {attached && (
                  <div className="space-y-3 border-y border-line/60 bg-canvas px-3 py-3 sm:pl-[4.5rem] sm:pr-6">
                    {renderComments(attached)}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-muted">No diff to show. The file may be binary or too large.</p>
      )}

      {unplaced.length > 0 && (
        <div className="space-y-3 border-t border-line px-3 py-4 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Other comments on this file</p>
          {renderComments(unplaced)}
        </div>
      )}
    </section>
  );
}
