import { RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

// A grey placeholder block shaped like the content that is loading
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={`rounded-md bg-line/70 motion-safe:animate-pulse ${className}`} />;
}

// Wraps skeletons so screen readers hear "Loading" once instead of nothing
export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line px-6 py-16 text-center">
      <div className="mb-4 rounded-lg border border-line bg-surface p-3">
        <Icon aria-hidden className="size-5 text-muted" />
      </div>
      <p className="font-mono text-sm font-medium text-fg">{title}</p>
      {children && <div className="mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border border-red-400/30 bg-red-400/5 p-6 sm:flex-row sm:items-center">
      <TriangleAlert aria-hidden className="size-5 shrink-0 text-red-400" />
      <div className="flex-1">
        <p className="font-mono text-sm font-medium text-fg">Something went wrong</p>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-muted"
        >
          <RefreshCw aria-hidden className="size-4" />
          Retry
        </button>
      )}
    </div>
  );
}
