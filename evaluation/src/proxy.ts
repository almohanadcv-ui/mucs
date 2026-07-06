import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/infrastructure/security/jwt";
import { ACCESS_COOKIE } from "@/infrastructure/auth/cookies";

/**
 * Edge proxy (formerly "middleware"): gate the authenticated app shell. Checks the
 * short-lived access token; when it's expired the client calls /api/auth/refresh.
 * Fine-grained permission checks happen in server components / API handlers.
 */
const PUBLIC_PATHS = ["/", "/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const token = req.cookies.get(ACCESS_COOKIE)?.value;

  let authenticated = false;
  if (token) {
    try {
      await verifyAccessToken(token);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  // Signed-in users shouldn't sit on the login page.
  if (authenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Protect everything that isn't public.
  if (!authenticated && !isPublic) {
    // Allow the refresh endpoint through so the client can renew silently.
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on app routes but skip static assets and auth API (handled per-route).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
