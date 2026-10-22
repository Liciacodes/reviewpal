import { NextResponse, type NextRequest } from "next/server";

// A quick check before a page loads: no session or demo cookie → go straight to /sign-in.
// It only checks that a cookie EXISTS. The API does the real check on every request (and limits
// demo visitors to DEMO_REPO, read-only); the dashboard also sends you to /sign-in on a 401.
export function proxy(request: NextRequest) {
  if (request.cookies.has("rp_session") || request.cookies.has("rp_demo")) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = url.pathname + url.search;
  url.pathname = "/sign-in";
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Every page except: the sign-in page, what the API handles (/api, /auth, /health),
    // Next.js internals and static files
    "/((?!sign-in|api|auth|health|_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)",
  ],
};
