import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/infrastructure/auth/cookies";
import { signAccessToken } from "@/infrastructure/security/jwt";
import { sha256, randomToken } from "@/infrastructure/security/crypto";
import { getServerEnv } from "@/lib/env";
import { durationToSeconds } from "@/lib/duration";

export const runtime = "nodejs";

// Base path when this instance is embedded in the portal (e.g. "/apps/evaluation").
const BASE = process.env.NEXT_BASE_PATH || "";

/**
 * SSO handoff from the MAB portal. Verifies a short-lived token signed with the
 * shared PORTAL_SSO_SECRET, then opens this app's own session for the matching
 * email. Purely additive — the standalone login flow is untouched, and this
 * route does nothing unless PORTAL_SSO_SECRET is configured.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const secret = process.env.PORTAL_SSO_SECRET;
  const redirect = (path: string) =>
    new NextResponse(null, { status: 307, headers: { Location: `${BASE}${path}` } });

  if (!token || !secret) return redirect("/login");

  let email = "";
  let next = "/dashboard";
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "mab-portal",
      audience: "evaluation",
    });
    email = String(payload.email ?? "").trim().toLowerCase();
    if (typeof payload.next === "string" && payload.next.startsWith("/")) next = payload.next;
  } catch {
    return redirect("/login?sso=invalid");
  }
  if (!email) return redirect("/login");

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true, tenant: { deletedAt: null, isActive: true } },
    select: { id: true, tenantId: true, role: true, name: true },
  });
  if (!user) return redirect("/login?sso=nouser");

  const env = getServerEnv();
  const accessMaxAge = durationToSeconds(env.JWT_ACCESS_TTL);
  const refreshMaxAge = durationToSeconds(env.JWT_REFRESH_TTL);

  const accessToken = await signAccessToken({
    sub: user.id,
    tid: user.tenantId,
    role: user.role,
    name: user.name,
  });
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      family: randomUUID(),
      expiresAt: new Date(Date.now() + refreshMaxAge * 1000),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    },
  });

  const res = redirect(next);
  const opts = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...opts, maxAge: accessMaxAge });
  res.cookies.set(REFRESH_COOKIE, refreshToken, { ...opts, maxAge: refreshMaxAge });
  return res;
}
