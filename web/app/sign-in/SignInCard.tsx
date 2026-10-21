"use client";

import { LogIn, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Sidebar";

// The only messages the server sends (src/auth/routes.ts). Anything else in ?error is shown
// as a generic message, so a crafted link can't put its own text on this page.
const KNOWN_ERRORS = new Set([
  "Sign-in is not set up on the server yet.",
  "Sign-in was cancelled.",
  "Sign-in expired. Please try again.",
  "Could not sign in with GitHub. Please try again.",
]);

export function SignInFromUrl() {
  const params = useSearchParams();
  const error = params.get("error");
  return (
    <SignInCard
      next={params.get("next") ?? "/"}
      error={error === null ? null : KNOWN_ERRORS.has(error) ? error : "Sign-in failed. Please try again."}
    />
  );
}

export function SignInCard({ next, error }: { next: string; error: string | null }) {
  return (
    <div className="w-full max-w-sm">
      <Logo />
      <h1 className="mt-8 font-mono text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
      <p className="mt-2 text-sm text-muted">See AI reviews for the repositories you can access on GitHub.</p>

      {error && (
        <div role="alert" className="mt-6 flex gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-4">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-400" />
          <p className="text-sm text-fg">{error}</p>
        </div>
      )}

      {/* A plain link, not fetch: the browser must actually go to GitHub and back.
          The server checks `next` too (safeNext), so it can't send you to another site. */}
      <a
        href={`/auth/login?next=${encodeURIComponent(next)}`}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors duration-150 hover:bg-amber-300"
      >
        <LogIn aria-hidden className="size-4" />
        Sign in with GitHub
      </a>

      <p className="mt-4 text-xs text-muted">
        You&apos;ll only see repositories where ReviewPal is installed and you have access.
      </p>
    </div>
  );
}
