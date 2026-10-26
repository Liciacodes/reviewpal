import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/Sidebar";

export const metadata: Metadata = { title: "Privacy" };

// A short, plain-language privacy notice. Public: outside the (dashboard) group and not in
// proxy.ts's matcher, so it works without signing in (it's linked from the sign-in page).
// Keep it in step with prisma/schema.prisma and src/installations.ts.
export default function PrivacyPage() {
  return (
    <main id="main" className="px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <Logo />
        <h1 className="mt-10 font-mono text-2xl font-semibold tracking-tight text-fg">Privacy</h1>
        <p className="mt-2 font-mono text-xs text-muted">Last updated: 26 October 2026</p>
        <p className="mt-2 text-sm text-muted">What ReviewPal stores, and when it&apos;s deleted.</p>

        <Section title="What's stored">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>For repositories where ReviewPal is installed: the repository name and, for each reviewed pull request, its number, title, link and commit.</li>
            <li>The diff of the changed files in each reviewed pull request. ReviewPal doesn&apos;t store the rest of your code.</li>
            <li>The AI&apos;s review comments, and your &quot;useful / not useful&quot; ratings.</li>
            <li>When you sign in: your GitHub username, display name and avatar link, plus a GitHub sign-in token (encrypted) so ReviewPal can check which repositories you can see.</li>
            <li>A sign-in cookie for your session, and a count of reviews per day (used for the daily limits).</li>
          </ul>
        </Section>

        <Section title="Who sees it">
          <p>
            Only people who can access the repository on GitHub see its reviews in the dashboard. The changed code is sent to
            an AI provider,{" "}
            <a
              href="https://groq.com/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="text-accent transition-colors duration-150 hover:text-amber-300"
            >
              Groq<span className="sr-only"> (privacy policy, opens in a new tab)</span>
            </a>
            , to write the review. Nothing is sold or used for advertising.
          </p>
        </Section>

        <Section title="When it's deleted">
          <p>
            Uninstall ReviewPal, or remove a repository from it, and that repository&apos;s reviews, diffs and comments are
            deleted. Signing out deletes your session. To delete your sign-in account as well, open an issue at{" "}
            <a
              href="https://github.com/Liciacodes/reviewpal/issues"
              className="text-accent transition-colors duration-150 hover:text-amber-300"
            >
              github.com/Liciacodes/reviewpal
            </a>
            .
          </p>
        </Section>

        <Link
          href="/sign-in"
          className="mt-10 inline-flex items-center gap-2 rounded-md text-sm text-muted transition-colors duration-150 hover:text-fg"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-sm font-semibold text-fg">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
