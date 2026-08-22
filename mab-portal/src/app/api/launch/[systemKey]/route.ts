import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { signSsoToken } from "@/lib/jwt";

export const runtime = "nodejs";

/**
 * Launch a system for the signed-in portal user. Mints a 60-second SSO token the
 * target system's /sso endpoint verifies (by shared secret) to open its own
 * session for the matching email. If the system has no ssoPath it is a plain
 * deep link.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ systemKey: string }> }) {
  // Emit RELATIVE Location headers, not new URL(..., req.url): behind nginx the
  // request Host is the internal one (e.g. localhost:3005), so an absolute
  // redirect would point the browser at an unreachable host. A relative Location
  // is resolved against the real address-bar origin (portal.mucs.online).
  const redirect = (path: string) =>
    new NextResponse(null, { status: 307, headers: { Location: path } });

  const session = await getSession();
  if (!session) return redirect("/login");

  const { systemKey } = await ctx.params;
  const system = await prisma.system.findFirst({
    where: { key: systemKey, isActive: true },
    select: { id: true, key: true, baseUrl: true, ssoPath: true },
  });
  if (!system) return redirect("/");

  // The user's grant for this system carries the role + visible sections that
  // travel to the system in the SSO token. Super-admins have no grant row (they
  // see everything) → send the admin role.
  const grant = await prisma.userSystemAccess.findFirst({
    where: { userId: session.sub, systemId: system.id },
    select: { id: true, role: true, features: true },
  });
  if (!session.admin && !grant) return redirect("/");
  const role = session.admin ? "ADMIN" : grant?.role ?? null;
  const features = session.admin ? [] : grant?.features ?? [];

  const nextPath = sanitizeNext(req.nextUrl.searchParams.get("next"));
  // Same-origin proxied prefix so the system renders inside the portal (iframe).
  const mount = `/apps/${system.key}`;

  // No SSO endpoint → plain same-origin deep link.
  if (!system.ssoPath) {
    return redirect(`${mount}${nextPath}`);
  }

  // Hand off through the proxied /sso path; the token carries the target page.
  const token = await signSsoToken({
    email: session.email,
    name: session.name,
    systemKey: system.key,
    next: nextPath,
    role,
    features,
  });
  return redirect(`${mount}${system.ssoPath}?token=${encodeURIComponent(token)}`);
}

/** Only allow same-site relative paths as the post-login target. */
function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
