import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInCard, SignInFromUrl } from "./SignInCard";

export const metadata: Metadata = { title: "Sign in" };

// Outside the (dashboard) group, so there is no sidebar here.
// The URL's ?next and ?error are read in the browser, inside <Suspense> (Cache Components).
export default function SignInPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Suspense fallback={<SignInCard next="/" error={null} />}>
        <SignInFromUrl />
      </Suspense>
    </main>
  );
}
