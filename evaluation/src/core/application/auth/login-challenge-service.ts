import { randomInt } from "node:crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { sha256 } from "@/infrastructure/security/crypto";

/**
 * Email sign-in code (the "verification code" step), ported from MICA's
 * LoginChallengeService. After the password is verified a six-digit code is
 * emailed; entering it finishes the login. Only a hash of the code is stored.
 */

/** Long enough to fetch an email, short enough that a leaked code goes stale. */
const TTL_MS = 10 * 60 * 1000;

/**
 * Six digits is a million combinations. That is only safe because guessing is
 * capped: five tries and the challenge is dead, forcing a fresh sign-in.
 */
const MAX_ATTEMPTS = 5;

export class LoginChallengeError extends Error {}

const invalid = () =>
  new LoginChallengeError("رمز التحقق غير صحيح أو منتهي الصلاحية");

/**
 * Issue a code, returning the challenge id and the plaintext for the email.
 *
 * Any earlier pending challenge for the user is retired first: two live codes
 * would mean an old email still works after the user, suspecting something,
 * asked for a new one.
 */
export async function issueLoginChallenge(
  userId: string,
  context: { rememberMe?: boolean; ip?: string | null; userAgent?: string | null },
): Promise<{ challengeId: string; code: string }> {
  await prisma.loginChallenge.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  // randomInt draws from the CSPRNG; Math.random would be predictable enough to
  // matter for something guarding a session.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const challenge = await prisma.loginChallenge.create({
    data: {
      userId,
      codeHash: sha256(code),
      rememberMe: context.rememberMe ?? false,
      expiresAt: new Date(Date.now() + TTL_MS),
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { challengeId: challenge.id, code };
}

/**
 * Verify and consume a code, returning who it belongs to.
 *
 * Every failure raises the same message. Distinguishing "no such challenge"
 * from "wrong code" would tell an attacker which half to keep working on.
 */
export async function verifyLoginChallenge(
  challengeId: string,
  code: string,
): Promise<{ userId: string; rememberMe: boolean }> {
  const challenge = await prisma.loginChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) throw invalid();

  if (challenge.attempts >= MAX_ATTEMPTS) {
    // Burn it rather than leave a nearly-exhausted challenge lying around.
    await prisma.loginChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
    throw invalid();
  }

  if (sha256(code) !== challenge.codeHash) {
    await prisma.loginChallenge.update({
      where: { id: challengeId },
      data: { attempts: { increment: 1 } },
    });
    throw invalid();
  }

  // Conditional on still being unconsumed: two requests arriving together must
  // not both mint a session from one code.
  const { count } = await prisma.loginChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count === 0) throw invalid();

  return { userId: challenge.userId, rememberMe: challenge.rememberMe };
}
