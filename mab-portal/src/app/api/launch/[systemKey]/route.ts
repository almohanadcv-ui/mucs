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
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { systemKey } = await ctx.params;
  const system = await prisma.system.findFirst({
    where: { key: systemKey, isActive: true },
    select: { id: true, key: true, baseUrl: true, ssoPath: true },
  });
  if (!system) return NextResponse.redirect(new URL("/", req.url));

  // Only allow systems the user may actually see.
  if (!session.admin) {
    const allowed = await prisma.userSystemAccess.findFirst({
      where: { userId: session.sub, systemId: system.id },
      select: { id: true },
    });
    if (!allowed) return NextResponse.redirect(new URL("/", req.url));
  }

  const nextPath = sanitizeNext(req.nextUrl.searchParams.get("next"));
  const base = system.baseUrl.replace(/\/$/, "");

  // No SSO endpoint configured → plain deep link.
  if (!system.ssoPath) {
    return NextResponse.redirect(`${base}${nextPath}`);
  }

  const token = await signSsoToken({
    email: session.email,
    name: session.name,
    systemKey: system.key,
    next: nextPath,
  });
  const url = `${base}${system.ssoPath}?token=${encodeURIComponent(token)}`;
  return NextResponse.redirect(url);
}

/** Only allow same-site relative paths as the post-login target. */
function sanitizeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
