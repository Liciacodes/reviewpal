import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInCard, SignInFromUrl } from "./SignInCard";

export const metadata: Metadata = { title: "Sign in" };

// PUBLIC_SIGNIN=true makes "Sign in with GitHub" the main button again. Default (unset/false):
// the GitHub App is private, so visitors are steered to the demo and sign-in is for invited accounts.
// Read on the server when the page is built: changing it on Vercel needs a redeploy.
const publicSignIn = process.env.PUBLIC_SIGNIN === "true";

// Outside the (dashboard) group, so there is no sidebar here.
// The URL's ?next and ?error are read in the browser, inside <Suspense> (Cache Components).
export default function SignInPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Suspense fallback={<SignInCard next="/" error={null} publicSignIn={publicSignIn} />}>
        <SignInFromUrl publicSignIn={publicSignIn} />
      </Suspense>
    </main>
  );
}
