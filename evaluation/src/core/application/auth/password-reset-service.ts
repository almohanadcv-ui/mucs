import { prisma } from "@/infrastructure/db/prisma";
import { getServerEnv } from "@/lib/env";
import { sha256, randomToken } from "@/infrastructure/security/crypto";
import { hashPassword } from "@/infrastructure/security/password";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AuditAction } from "@/core/domain/enums";
import { AppError } from "@/core/application/errors";
import { sendEmail } from "@/infrastructure/email/mailer";
import { passwordResetEmail } from "@/infrastructure/email/templates";
import type { RequestMeta } from "./dto";

/** Long enough to read the email, short enough that a leaked link goes stale. */
const TTL_MS = 30 * 60 * 1000;
/** New-account invites: the recipient may not check email immediately. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issue a one-time set-password token for a user and return the full link. Any
 * earlier pending token is retired so only the newest works. Shared by the
 * forgot-password flow and by account invites.
 */
export async function issueSetPasswordUrl(
  userId: string,
  meta?: RequestMeta,
  ttlMs = TTL_MS,
): Promise<string> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const raw = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + ttlMs),
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  });
  return `${getServerEnv().APP_URL.replace(/\/$/, "")}/reset-password?token=${raw}`;
}

/**
 * Start a "forgot password" flow: if the email matches an active account, email
 * a one-time reset link. Returns nothing regardless — the caller must not reveal
 * whether the address exists (user enumeration).
 */
export async function requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
      isActive: true,
      tenant: { deletedAt: null, isActive: true },
    },
    select: { id: true, name: true, email: true },
  });
  if (!user) return;

  const link = await issueSetPasswordUrl(user.id, meta);
  const mail = passwordResetEmail(link, user.name);
  try {
    await sendEmail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (err) {
    // Don't surface send failures to the caller (would leak that the email
    // exists); the user can simply request another link.
    console.error("[auth] password reset email failed:", err);
  }
}

/**
 * Complete a reset: validate the link, set the new password, and invalidate
 * every existing session so a thief who triggered the reset is logged out too.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const invalid = () =>
    new AppError("INVALID_CREDENTIALS", "الرابط غير صالح أو منتهي الصلاحية");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
  });
  if (!record || record.consumedAt || record.expiresAt < new Date()) throw invalid();

  const passwordHash = await hashPassword(newPassword);

  // Consume-then-apply in one transaction so a token can't be used twice, and a
  // partial failure never leaves a live token beside a changed password.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    // Revoke all refresh tokens: a password reset should end existing sessions.
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAudit({
    actorId: record.userId,
    action: AuditAction.UPDATE,
    entity: "User",
    entityId: record.userId,
    after: { passwordReset: true },
  });
}
