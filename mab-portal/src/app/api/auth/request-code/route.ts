import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256, sixDigitCode } from "@/lib/crypto";
import { sendLoginCode } from "@/lib/email";

export const runtime = "nodejs";

const CODE_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const clean = String(email ?? "").trim().toLowerCase();
  // Always answer the same so the response can't be used to probe emails.
  if (clean) {
    const user = await prisma.portalUser.findFirst({
      where: { email: clean, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true },
    });
    if (user) {
      const code = sixDigitCode();
      await prisma.$transaction([
        prisma.loginChallenge.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        prisma.loginChallenge.create({
          data: {
            userId: user.id,
            codeHash: sha256(code),
            expiresAt: new Date(Date.now() + CODE_TTL_MS),
            ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            userAgent: req.headers.get("user-agent"),
          },
        }),
      ]);
      try {
        await sendLoginCode(user.email, user.name, code);
      } catch (err) {
        console.error("[portal] login code email failed:", err);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
