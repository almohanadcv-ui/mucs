import { createHash, randomInt } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";

/** Long enough to fetch an email, short enough that a leaked code goes stale. */
const TTL_MS = 10 * 60 * 1000;

/**
 * Six digits is a million combinations. That is only safe because guessing is
 * capped: five tries and the challenge is dead, forcing a fresh sign-in.
 */
const MAX_ATTEMPTS = 5;

export interface ChallengeContext {
  rememberMe: boolean;
  deviceLabel?: string;
}

@Injectable()
export class LoginChallengeService {
  private readonly logger = new Logger(LoginChallengeService.name);

  constructor(private readonly prisma: PrismaService) {}

  private static hash(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /**
   * Issues a code, returning the plaintext for the email and nothing else.
   *
   * Any earlier pending challenge for the user is retired first: leaving two
   * live codes would mean an old email still works after the user, suspecting
   * something, asked for a new one.
   */
  async issue(
    userId: string,
    context: ChallengeContext,
  ): Promise<{ challengeId: string; code: string }> {
    await this.prisma.loginChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // randomInt is drawn from the CSPRNG; Math.random would be predictable
    // enough to matter for something that guards a session.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

    const challenge = await this.prisma.loginChallenge.create({
      data: {
        userId,
        codeHash: LoginChallengeService.hash(code),
        rememberMe: context.rememberMe,
        deviceLabel: context.deviceLabel,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });

    return { challengeId: challenge.id, code };
  }

  /**
   * Verifies and consumes a code, returning who it belongs to.
   *
   * Every failure raises the same message. Distinguishing "no such challenge"
   * from "wrong code" would tell an attacker which half to keep working on.
   */
  async verify(
    challengeId: string,
    code: string,
  ): Promise<{ userId: string; rememberMe: boolean; deviceLabel?: string }> {
    const invalid = () => new UnauthorizedException("رمز التحقق غير صحيح أو منتهي الصلاحية");

    const challenge = await this.prisma.loginChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) throw invalid();

    if (challenge.attempts >= MAX_ATTEMPTS) {
      // Burn it rather than leave a nearly-exhausted challenge lying around.
      await this.prisma.loginChallenge.update({
        where: { id: challengeId },
        data: { consumedAt: new Date() },
      });
      throw invalid();
    }

    if (LoginChallengeService.hash(code) !== challenge.codeHash) {
      await this.prisma.loginChallenge.update({
        where: { id: challengeId },
        data: { attempts: { increment: 1 } },
      });
      throw invalid();
    }

    // Conditional on still being unconsumed: two requests arriving together
    // must not both mint a session from one code.
    const { count } = await this.prisma.loginChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw invalid();

    return {
      userId: challenge.userId,
      rememberMe: challenge.rememberMe,
      deviceLabel: challenge.deviceLabel ?? undefined,
    };
  }
}
