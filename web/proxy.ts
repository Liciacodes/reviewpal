import { NextResponse, type NextRequest } from "next/server";

// A quick check before a page loads: no session cookie → go straight to /sign-in.
// It only checks that the cookie EXISTS. The API does the real check on every request,
// and the dashboard also sends you to /sign-in when the API answers 401 (expired session).
export function proxy(request: NextRequest) {
  if (request.cookies.has("rp_session")) return NextResponse.next();

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
