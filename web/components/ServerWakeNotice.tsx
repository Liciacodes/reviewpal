"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { onSlowRequests } from "@/lib/api";

// On Render's free plan the API sleeps when nobody uses it, and the first request can take up
// to a minute. Instead of a silent wait, say what's happening (see onSlowRequests in lib/api.ts).
export function ServerWakeNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequests(setSlow), []);

  if (!slow) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg"
    >
      <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-accent motion-reduce:animate-none" />
      <span>
        Waking up the server…
        <span className="block text-xs text-muted">This can take up to a minute on the free plan.</span>
      </span>
    </div>
  );
}
