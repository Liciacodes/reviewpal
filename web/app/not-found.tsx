import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Sidebar";
import { PRIMARY, SECONDARY } from "@/lib/button-styles";
import { ArrowLeft, Eye, LayoutDashboard } from "lucide-react";

export const metadata: Metadata = { title: "Page not found" };

// Shown for any address that doesn't exist (and when a page calls notFound()).
// Outside the (dashboard) group, so there is no sidebar, like /sign-in.
// Unknown review IDs don't come here: /reviews/[id] exists and shows its own "Review not found".
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-10">
          <span className="block font-mono text-7xl font-semibold tracking-tight text-accent sm:text-8xl">404</span>
          <span className="mt-4 block font-mono text-xl font-semibold tracking-tight text-fg">This page doesn&apos;t exist.</span>
        </h1>
        <p className="mt-2 text-sm text-muted">The link may be broken, or the page may have moved.</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {/* Which main button depends on cookies, read on the server inside <Suspense> (Cache Components) */}
          <Suspense fallback={<div aria-hidden className="h-10 flex-1 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />}>
            <MainAction />
          </Suspense>
          <Link href="/sign-in" className={`sm:flex-1 ${SECONDARY}`}>
            <ArrowLeft aria-hidden className="size-4 text-muted" />
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

// Signed in, or visiting the demo: the overview works for them. Anyone else: offer the demo.
// Only checks that a cookie exists (like proxy.ts); the API decides what they can actually see.
async function MainAction() {
  const jar = await cookies();
  if (jar.has("rp_session") || jar.has("rp_demo")) {
    return (
      <Link href="/" className={`sm:flex-1 ${PRIMARY}`}>
        <LayoutDashboard aria-hidden className="size-4" />
        Go to overview
      </Link>
    );
  }
  // A plain link: /auth/demo is handled by the API, not by a Next.js page
  return (
    <a href="/auth/demo" className={`sm:flex-1 ${PRIMARY}`}>
      <Eye aria-hidden className="size-4" />
      View demo
    </a>
  );
}
