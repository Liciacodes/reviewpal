import type { ReactNode } from "react";

// One big monospace heading per page, with an optional line of description
export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

// Small uppercase label above a section
export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-mono text-xs font-medium uppercase tracking-widest text-muted">
      {children}
    </h2>
  );
}
