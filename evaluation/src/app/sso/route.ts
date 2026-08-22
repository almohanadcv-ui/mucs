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
  // Return an HTML interstitial that navigates client-side rather than a bare
  // 307. A body-less redirect on this extension-less "/sso" path makes some
  // mobile browsers offer to *download* the response ("download SSO?") instead
  // of following it. A real text/html page is always rendered, applies the
  // Set-Cookie headers, then hops to the target.
  const redirect = (path: string) => {
    const url = `${BASE}${path}`;
    const safe = JSON.stringify(url);
    const html =
      `<!doctype html><html lang="ar"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta http-equiv="refresh" content="0;url=${url.replace(/"/g, "%22")}">` +
      `<title>جارٍ الدخول…</title></head><body style="font-family:system-ui;text-align:center;padding:2rem;color:#334155">` +
      `جارٍ تسجيل الدخول…<script>location.replace(${safe})</script></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  };

  if (!token || !secret) return redirect("/login");

  // The evaluation roles the portal may assign (must match prisma enum Role).
  const VALID_ROLES = ["ADMIN", "MANAGEMENT", "HR", "EVALUATOR", "EMPLOYEE"];

  let email = "";
  let ssoName = "";
  let ssoRole: string | null = null;
  let ssoFeatures: string[] = [];
  let next = "/dashboard";
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "mab-portal",
      audience: "evaluation",
    });
    email = String(payload.email ?? "").trim().toLowerCase();
    ssoName = String(payload.name ?? "").trim();
    if (typeof payload.role === "string" && VALID_ROLES.includes(payload.role)) ssoRole = payload.role;
    if (Array.isArray(payload.features)) ssoFeatures = payload.features.filter((f): f is string => typeof f === "string");
    if (typeof payload.next === "string" && payload.next.startsWith("/")) next = payload.next;
  } catch {
    return redirect("/login?sso=invalid");
  }
  if (!email) return redirect("/login");

  let user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true, tenant: { deletedAt: null, isActive: true } },
    select: { id: true, tenantId: true, role: true, name: true },
  });

  // The portal is the authority for a user's role AND granted sections within the
  // system: sync both on each launch so portal changes take effect here.
  if (user) {
    const data: { role?: typeof user.role; portalFeatures?: string[] } = {};
    if (ssoRole && ssoRole !== user.role) data.role = ssoRole as typeof user.role;
    data.portalFeatures = ssoFeatures;
    await prisma.user.update({ where: { id: user.id }, data });
    if (data.role) user = { ...user, role: data.role };
  }

  // Just-in-time provisioning: every portal account is created by IT from the
  // portal, and the portal is the source of truth for who may use a system. So
  // if the SSO'd email has no account here yet, create one rather than bounce to
  // login. New accounts default to the EMPLOYEE role — the least-privilege one,
  // which sees only its own evaluation and messages its manager. A manager / HR
  // is upgraded explicitly. Keeps "any user I add in the portal just works" true
  // without handing everyone the manager view.
  if (!user) {
    const tenant = await prisma.tenant.findFirst({
      where: { deletedAt: null, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!tenant) return redirect("/login?sso=notenant");
    const name = ssoName || email.split("@")[0];
    const created = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name,
        // The role the portal assigned for this system, else least-privilege.
        role: (ssoRole ?? "EMPLOYEE") as "EMPLOYEE",
        portalFeatures: ssoFeatures,
        // Unusable password hash — this account authenticates via portal SSO
        // only; a password login can never match this value.
        passwordHash: `sso-only:${sha256(randomToken(32))}`,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, tenantId: true, role: true, name: true },
    });
    user = created;
  }

  // Link the employee master-record (same email, not yet linked) to this account
  // so /my-evaluation can resolve "my own evaluation" by the user↔employee link.
  // Link exactly ONE record (userId is unique) and only if this user isn't
  // already linked, so a duplicated email can never trip the unique constraint.
  try {
    const alreadyLinked = await prisma.employee.findFirst({
      where: { tenantId: user.tenantId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!alreadyLinked) {
      const match = await prisma.employee.findFirst({
        where: { tenantId: user.tenantId, email: { equals: email, mode: "insensitive" }, userId: null, deletedAt: null },
        select: { id: true },
      });
      if (match) await prisma.employee.update({ where: { id: match.id }, data: { userId: user.id } });
    }
  } catch {
    // Best-effort link — never block sign-in on it.
  }

  // A plain employee has no manager pages — send them straight to their own
  // evaluation, regardless of the portal's requested landing path.
  if (user.role === "EMPLOYEE") next = "/my-evaluation";

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
