"use client";

import { Eye } from "lucide-react";
import { getMe } from "@/lib/api";
import { useApi } from "@/lib/use-api";

// Shown on every page while visiting the read-only demo
export function DemoBanner() {
  const { data: me } = useApi("me", getMe);
  if (!me?.demo) return null;

  return (
    <div role="status" className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
      <Eye aria-hidden className="size-4 shrink-0 text-accent" />
      <p className="flex-1 text-sm text-fg">You&apos;re viewing a demo – sign in to use ReviewPal on your repos.</p>
      {/* A plain link: leaving the demo clears its cookie on the server, then shows Sign in */}
      <a href="/auth/exit-demo" className="text-sm font-medium text-accent transition-colors duration-150 hover:text-amber-300">
        Sign in
      </a>
    </div>
  );
}
