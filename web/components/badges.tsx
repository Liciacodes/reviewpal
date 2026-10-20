import { Bug, CircleCheck, CircleX, Clock, Paintbrush, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReviewStatus, Severity, SeverityCounts as Counts } from "@/lib/types";

// Severity colours are always paired with an icon and a text label, never colour alone
export const SEVERITY: Record<Severity, { label: string; icon: LucideIcon; text: string; border: string; tint: string }> = {
  bug: { label: "Bug", icon: Bug, text: "text-red-400", border: "border-l-red-400", tint: "bg-red-400/10" },
  risk: { label: "Risk", icon: TriangleAlert, text: "text-amber-400", border: "border-l-amber-400", tint: "bg-amber-400/10" },
  style: { label: "Style", icon: Paintbrush, text: "text-sky-400", border: "border-l-sky-400", tint: "bg-sky-400/10" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-xs font-medium ${s.text} ${s.tint}`}>
      <Icon aria-hidden className="size-3.5" />
      {s.label}
    </span>
  );
}

// "bug" or "bugs" for a count: 1 bug, 2 bugs, 0 bugs
export function severityWord(severity: Severity, count: number): string {
  const word = SEVERITY[severity].label.toLowerCase();
  return count === 1 ? word : `${word}s`;
}

// The severities with at least one comment, in display order (bug, risk, style)
export function presentSeverities(counts: Counts): Severity[] {
  return (Object.keys(SEVERITY) as Severity[]).filter((key) => counts[key] > 0);
}

// Compact "2 bugs · 1 risk" counts. Zero counts are left out.
// With no comments at all: "Reviewing…" while pending, nothing if failed (the badge says so), else "No comments".
export function SeverityCounts({ counts, status }: { counts: Counts; status: ReviewStatus }) {
  const present = presentSeverities(counts);
  if (present.length === 0) {
    if (status === "failed") return null;
    return (
      <span className="font-mono text-xs text-muted">{status === "pending" ? "Reviewing…" : "No comments"}</span>
    );
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs" aria-label="Comments by severity">
      {present.map((key) => (
        <li key={key} className={SEVERITY[key].text}>
          <span className="tabular-nums">{counts[key]}</span> {severityWord(key, counts[key])}
        </li>
      ))}
    </ul>
  );
}

const STATUS: Record<ReviewStatus, { label: string; icon: LucideIcon; className: string }> = {
  done: { label: "Done", icon: CircleCheck, className: "text-emerald-400 border-emerald-400/30" },
  pending: { label: "Pending", icon: Clock, className: "text-muted border-line" },
  failed: { label: "Failed", icon: CircleX, className: "text-red-400 border-red-400/30" },
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs ${s.className}`}>
      <Icon aria-hidden className="size-3.5" />
      {s.label}
    </span>
  );
}
