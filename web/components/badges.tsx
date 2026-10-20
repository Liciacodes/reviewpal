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

// Compact "2 bug · 1 risk · 0 style" counts. Zero counts are dimmed but still readable.
export function SeverityCounts({ counts }: { counts: Counts }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs" aria-label="Comments by severity">
      {(Object.keys(SEVERITY) as Severity[]).map((key) => (
        <li key={key} className={counts[key] > 0 ? SEVERITY[key].text : "text-muted"}>
          <span className="tabular-nums">{counts[key]}</span> {SEVERITY[key].label.toLowerCase()}
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
