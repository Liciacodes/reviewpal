"use client";

import { Eye, LoaderCircle, LogIn, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Sidebar";
import { PRIMARY, SECONDARY } from "@/lib/button-styles";

// The only messages the server sends (src/auth/routes.ts). Anything else in ?error is shown
// as a generic message, so a crafted link can't put its own text on this page.
const KNOWN_ERRORS = new Set([
  "Sign-in is not set up on the server yet.",
  "Sign-in was cancelled.",
  "Sign-in expired. Please try again.",
  "Could not sign in with GitHub. Please try again.",
  "The demo isn't available right now.",
]);

// After this long without leaving the page, the API is probably waking up (Render free plan)
const WAKING_AFTER_MS = 3000;

export function SignInFromUrl({ publicSignIn }: { publicSignIn: boolean }) {
  const params = useSearchParams();
  const error = params.get("error");
  return (
    <SignInCard
      next={params.get("next") ?? "/"}
      error={error === null ? null : KNOWN_ERRORS.has(error) ? error : "Sign-in failed. Please try again."}
      publicSignIn={publicSignIn}
    />
  );
}

// publicSignIn: GitHub sign-in is the main button (PUBLIC_SIGNIN=true). Otherwise the demo is.
export function SignInCard({ next, error, publicSignIn }: { next: string; error: string | null; publicSignIn: boolean }) {
  const githubHref = `/auth/login?next=${encodeURIComponent(next)}`;
  const [leaving, setLeaving] = useState<"github" | "demo" | null>(null);
  const [waking, setWaking] = useState(false);

  // Start waking the API now, so it's likely awake by the time a button is clicked.
  // /health is public and cheap; the answer doesn't matter.
  useEffect(() => {
    fetch("/health", { cache: "no-store" }).catch(() => {});
  }, []);

  // Coming back with the Back button can restore this page frozen as it was: reset it
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLeaving(null);
        setWaking(false);
      }
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // A button was clicked: if we're still here after a few seconds, explain the wait
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setWaking(true), WAKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

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

      {/* Plain links, not fetch: the browser must actually go to GitHub (or into the demo).
          The server checks `next` too (safeNext), so it can't send you to another site. */}
      {publicSignIn ? (
        // Open sign-in: GitHub is the main action, the demo sits next to it
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={githubHref} onClick={() => setLeaving("github")} className={`flex-1 ${PRIMARY}`}>
            <LogIn aria-hidden className="size-4" />
            {leaving === "github" ? "Opening GitHub…" : "Sign in with GitHub"}
          </a>
          <a href="/auth/demo" onClick={() => setLeaving("demo")} className={`flex-1 ${SECONDARY}`}>
            <Eye aria-hidden className="size-4 text-muted" />
            {leaving === "demo" ? "Opening demo…" : "View demo"}
          </a>
        </div>
      ) : (
        // Beta: the GitHub App is private, so sign-in only works for invited accounts (others get
        // a 404 from GitHub). The demo is the main way in.
        <div className="mt-8 flex flex-col gap-3">
          <a href="/auth/demo" onClick={() => setLeaving("demo")} className={PRIMARY}>
            <Eye aria-hidden className="size-4" />
            {leaving === "demo" ? "Opening demo…" : "View demo"}
          </a>
          <a href={githubHref} onClick={() => setLeaving("github")} className={SECONDARY}>
            <LogIn aria-hidden className="size-4 text-muted" />
            {leaving === "github" ? "Opening GitHub…" : "Sign in with GitHub"}
          </a>
          <p className="text-xs text-muted">Sign-in is limited to invited accounts during the beta.</p>
        </div>
      )}

      {waking && (
        <p role="status" className="mt-4 flex items-start gap-2 text-sm text-muted">
          <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-accent motion-reduce:animate-none" />
          <span>
            Waking up the server… This can take up to a minute on the free plan.
          </span>
        </p>
      )}

      <p className="mt-4 text-xs text-muted">
        {publicSignIn
          ? "You'll only see repositories where ReviewPal is installed and you have access. The demo shows a sample repository, read-only."
          : "The demo shows real AI reviews of a sample repository, read-only. No account needed."}
      </p>
    </div>
  );
}
