import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256, safeEqual, randomToken } from "@/lib/crypto";
import { signSession } from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const { email, code } = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const clean = String(email ?? "").trim().toLowerCase();
  const digits = String(code ?? "").trim();

  const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

  if (!clean || !/^\d{6}$/.test(digits)) return fail("أدخل البريد والرمز المكوّن من ٦ أرقام.");

  const user = await prisma.portalUser.findFirst({
    where: { email: clean, isActive: true, deletedAt: null },
    select: { id: true, email: true, name: true, isSuperAdmin: true, canManageContent: true },
  });
  if (!user) return fail("رمز غير صحيح أو منتهي.", 401);

  const challenge = await prisma.loginChallenge.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return fail("لا يوجد رمز فعّال. اطلب رمزًا جديدًا.");
  if (challenge.expiresAt < new Date()) return fail("انتهت صلاحية الرمز. اطلب رمزًا جديدًا.");
  if (challenge.attempts >= MAX_ATTEMPTS) return fail("محاولات كثيرة. اطلب رمزًا جديدًا.", 429);

  if (!safeEqual(sha256(digits), challenge.codeHash)) {
    await prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return fail("رمز غير صحيح.", 401);
  }

  // Success — consume the code, open a session, record a refresh token.
  const raw = randomToken(32);
  await prisma.$transaction([
    prisma.loginChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
    prisma.portalUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(raw),
        family: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: req.headers.get("user-agent"),
      },
    }),
  ]);

  const jwt = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    admin: user.isSuperAdmin,
    content: user.canManageContent,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
