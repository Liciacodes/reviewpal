"use client";

import { ChevronDown, FileCode, MessageSquare } from "lucide-react";
import { Fragment, useId, useMemo, useState } from "react";
import { parsePatch, type DiffRow } from "@/lib/diff";
import type { ReviewComment, ReviewFile } from "@/lib/types";
import { CommentCard, type FeedbackProps } from "./CommentCard";

// Lets each CommentCard get its own feedback state from the parent page
export type FeedbackFor = (comment: ReviewComment) => FeedbackProps;

const ROW_STYLE: Record<DiffRow["kind"], { row: string; marker: string; sign: string; sr?: string }> = {
  add: { row: "bg-emerald-500/10", marker: "text-emerald-400", sign: "+", sr: "Added: " },
  del: { row: "bg-red-500/10", marker: "text-red-400", sign: "−", sr: "Removed: " },
  context: { row: "", marker: "text-muted", sign: " " },
  hunk: { row: "bg-white/[0.02] text-xs text-muted/50", marker: "text-muted", sign: " " },
  meta: { row: "text-muted italic", marker: "text-muted", sign: " " },
};

// How far a wrapped line's continuation sits from the left: the line's own indent plus 2.
// Tabs count as 4 (we set tab-size: 4 below).
function hangingIndent(text: string): number {
  const indent = /^[ \t]*/.exec(text)![0];
  return [...indent].reduce((n, ch) => n + (ch === "\t" ? 4 : 1), 0) + 2;
}

// `flagged`: this line has comments, but they are hidden right now
function DiffLine({ row, flagged = false }: { row: DiffRow; flagged?: boolean }) {
  const style = ROW_STYLE[row.kind];
  const hang = hangingIndent(row.text);
  return (
    <div className={`flex ${style.row}`} title={row.raw}>
      {/* Gutter: line number in the new file, with a dot when its comments are hidden */}
      <span aria-hidden className="relative w-9 shrink-0 select-none border-r border-line/60 pr-2 text-right text-muted tabular-nums sm:w-12 sm:pr-3">
        {flagged && <span className="absolute top-3 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-accent sm:left-2" />}
        {row.newLine ?? ""}
      </span>
      <span aria-hidden className={`w-5 shrink-0 select-none text-center sm:w-6 ${style.marker}`}>{style.sign}</span>
      {/* Hanging indent: wrapped parts of a long line start further right than the line itself */}
      <code
        className="min-w-0 flex-1 whitespace-pre-wrap pr-3 [overflow-wrap:anywhere] [tab-size:4] sm:pr-4"
        style={{ paddingLeft: `${hang}ch`, textIndent: `-${hang}ch` }}
      >
        {style.sr && <span className="sr-only">{style.sr}</span>}
        {row.text || " "}
        {flagged && <span className="sr-only"> (has hidden comments)</span>}
      </code>
    </div>
  );
}

export function FileDiff({ file, comments, feedbackFor }: { file: ReviewFile; comments: ReviewComment[]; feedbackFor: FeedbackFor }) {
  const [showComments, setShowComments] = useState(true);
  const commentsId = useId(); // ties the toggle button to the comment blocks it controls
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
        <h3 className="min-w-0 flex-[1_1_10rem] font-mono text-sm text-fg [overflow-wrap:anywhere]">{file.filename}</h3>
        <span className="font-mono text-xs text-muted">{file.status}</span>
        {comments.length > 0 && (
          <button
            type="button"
            aria-expanded={showComments}
            aria-controls={commentsId}
            onClick={() => setShowComments((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 font-mono text-xs text-accent transition-colors duration-150 hover:border-muted"
          >
            <MessageSquare aria-hidden className="size-3.5" />
            {showComments ? "Hide" : "Show"} {comments.length} {comments.length === 1 ? "comment" : "comments"}
            <ChevronDown
              aria-hidden
              className={`size-3.5 transition-transform duration-150 motion-reduce:transition-none ${showComments ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </header>

      {file.patch ? (
        <div id={commentsId} className="py-1 font-mono text-[13px] leading-6">
          {rows.map((row, i) => {
            // Comments attach to the added/context line with that new-file number.
            // A deleted line has no new number, so nothing attaches to it.
            const attached = row.newLine !== null ? byLine.get(row.newLine) : undefined;
            return (
              <Fragment key={i}>
                <DiffLine row={row} flagged={!!attached && !showComments} />
                {attached && showComments && (
                  <div className="space-y-3 border-y border-line/60 bg-canvas px-2 py-3 sm:pl-[4.5rem] sm:pr-6">
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

      {unplaced.length > 0 && showComments && (
        <div className="space-y-3 border-t border-line px-2 py-4 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Other comments on this file</p>
          {renderComments(unplaced)}
        </div>
      )}
    </section>
  );
}
