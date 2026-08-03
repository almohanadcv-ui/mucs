import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { getServerEnv } from "@/lib/env";
import { durationToSeconds } from "@/lib/duration";
import { verifyPassword, needsRehash, hashPassword } from "@/infrastructure/security/password";
import { signAccessToken } from "@/infrastructure/security/jwt";
import { sha256, randomToken } from "@/infrastructure/security/crypto";
import { decrypt } from "@/infrastructure/security/crypto";
import { verifyTotp } from "@/infrastructure/security/totp";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { getT } from "@/i18n/server";
import { AuditAction } from "@/core/domain/enums";
import {
  loginSchema,
  verifyChallengeSchema,
  type LoginInput,
  type RequestMeta,
} from "./dto";
import {
  issueLoginChallenge,
  verifyLoginChallenge,
  LoginChallengeError,
} from "./login-challenge-service";
import { sendEmail } from "@/infrastructure/email/mailer";
import { loginCodeEmail } from "@/infrastructure/email/templates";
import { randomUUID } from "node:crypto";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: import("@/core/domain/enums").Role;
}

/**
 * Mint the token pair and return the (not yet executed) write that persists the
 * refresh token. Keeping the write lazy lets callers batch it with their own
 * writes into a single round trip — the database is remote, so each saved trip
 * is hundreds of milliseconds off the login screen.
 */
async function prepareTokens(
  user: { id: string; tenantId: string; role: AuthenticatedUser["role"]; name: string },
  meta: RequestMeta,
  family?: string,
): Promise<{ tokens: IssuedTokens; persist: Prisma.PrismaPromise<unknown> }> {
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
  const persist = prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      family: family ?? randomUUID(),
      expiresAt: new Date(Date.now() + refreshMaxAge * 1000),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  return {
    tokens: { accessToken, refreshToken, accessMaxAge, refreshMaxAge },
    persist,
  };
}

export async function login(
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ challengeId: string }> {
  const t = await getT();
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation(t("authErr.invalidInput"), parsed.error.flatten());
  }
  const input: LoginInput = parsed.data;
  const env = getServerEnv();

  // The database is remote (~1 round trip ≈ several hundred ms), so every
  // avoidable round trip is felt directly by the user at the login screen.
  // Tenant + user resolve in a single query via the relation filter instead of
  // two sequential ones.
  const user = await prisma.user.findFirst({
    where: {
      email: input.email,
      deletedAt: null,
      tenant: {
        deletedAt: null,
        isActive: true,
        ...(input.tenantSlug ? { slug: input.tenantSlug } : {}),
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Uniform failure to avoid user enumeration
  const invalid = () =>
    new AppError("INVALID_CREDENTIALS", t("authErr.invalidCredentials"));

  if (!user || !user.isActive) {
    // Perform a dummy verify to equalize timing
    await verifyPassword(
      "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      input.password,
    ).catch(() => false);
    throw invalid();
  }

  // Account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      "ACCOUNT_LOCKED",
      t("authErr.accountLocked"),
    );
  }

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= env.AUTH_MAX_FAILED_ATTEMPTS;
    // Independent rows, so these go concurrently rather than in a transaction:
    // one round trip instead of two, and BEGIN/COMMIT costs a trip of its own.
    // The lockout counter must still land before we answer, or repeated attempts
    // would race it — hence awaited.
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60_000)
            : null,
        },
      }),
      writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entity: "User",
        entityId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    ]);
    throw invalid();
  }

  // Two-factor challenge
  if (user.twoFactorEnabled) {
    if (!input.totp) {
      throw new AppError("TWO_FACTOR_REQUIRED", t("authErr.totpRequired"));
    }
    const secret = user.twoFactorSecretEnc
      ? decrypt(user.twoFactorSecretEnc)
      : "";
    if (!secret || !verifyTotp(input.totp, secret)) {
      throw new AppError("INVALID_CREDENTIALS", t("authErr.totpInvalid"));
    }
  }

  // Password (and TOTP, if enabled) verified. Clear the lockout counter and
  // opportunistically rehash now — the raw password is only available here.
  // No session is minted yet: the account still owes the email code below.
  const rehash = needsRehash(user.passwordHash)
    ? await hashPassword(input.password)
    : undefined;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...(rehash ? { passwordHash: rehash } : {}),
    },
  });

  // Second factor for everyone: email a six-digit code and require it to finish
  // (mirrors MICA). The session is issued only in completeLoginChallenge.
  const { challengeId, code } = await issueLoginChallenge(user.id, {
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const mail = loginCodeEmail(code, user.name);
  try {
    const sent = await sendEmail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
    // In production a code the user can't receive is a dead end, so surface it
    // rather than leave them stuck on the code screen. In dev the code is
    // logged to the server console, so let sign-in proceed.
    if (!sent && env.NODE_ENV === "production") {
      throw new AppError("INTERNAL", t("authErr.codeSendFailed"));
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (env.NODE_ENV === "production") {
      throw new AppError("INTERNAL", t("authErr.codeSendFailed"));
    }
    // Dev/transport hiccup: the code is in the server log, so continue.
    console.error("[auth] login code email failed:", err);
  }

  return { challengeId };
}

/**
 * Finish a login by verifying the emailed code, then mint the session.
 *
 * The lockout counter and rehash were already handled at the password step; all
 * that remains is to confirm the code, record the successful login and issue
 * tokens.
 */
export async function completeLoginChallenge(
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ user: AuthenticatedUser; tokens: IssuedTokens }> {
  const t = await getT();
  const parsed = verifyChallengeSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation(t("authErr.invalidInput"), parsed.error.flatten());
  }

  let userId: string;
  try {
    ({ userId } = await verifyLoginChallenge(parsed.data.challengeId, parsed.data.code));
  } catch (err) {
    if (err instanceof LoginChallengeError) {
      throw new AppError("INVALID_CREDENTIALS", err.message);
    }
    throw err;
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, tenant: { deletedAt: null, isActive: true } },
  });
  if (!user || !user.isActive) {
    throw AppError.unauthorized(t("authErr.accountUnavailable"));
  }

  const { tokens, persist } = await prepareTokens(
    { id: user.id, tenantId: user.tenantId, role: user.role, name: user.name },
    meta,
  );

  // Refresh token, login bookkeeping and audit line touch different rows, so
  // they go concurrently — one round trip instead of three. The refresh token
  // must be committed before we hand it to the browser, so this is awaited.
  await Promise.all([
    persist,
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.LOGIN,
      entity: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    }),
  ]);

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    tokens,
  };
}

/**
 * Rotate a refresh token. Implements reuse detection: if a token that has
 * already been revoked is presented, the entire token family is revoked
 * (defends against stolen-token replay).
 */
export async function refresh(
  rawToken: string | undefined,
  meta: RequestMeta,
): Promise<{ user: AuthenticatedUser; tokens: IssuedTokens }> {
  const t = await getT();
  if (!rawToken) throw AppError.unauthorized(t("authErr.sessionExpired"));

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    throw AppError.unauthorized(t("authErr.sessionExpiredLogin"));
  }

  // Reuse detection: a revoked token was replayed → nuke the family.
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: record.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized(t("authErr.sessionReuse"));
  }

  const user = record.user;
  if (!user || user.deletedAt || !user.isActive) {
    throw AppError.unauthorized(t("authErr.accountUnavailable"));
  }

  // Rotate: revoke current, issue a new token in the same family. Both writes
  // go in one transaction — a round trip saved, and rotation stays atomic so a
  // failure can't leave the family with two live tokens.
  const { tokens, persist } = await prepareTokens(
    { id: user.id, tenantId: user.tenantId, role: user.role, name: user.name },
    meta,
    record.family,
  );
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    persist,
  ]);

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    tokens,
  };
}

export async function logout(
  rawToken: string | undefined,
  meta: RequestMeta,
): Promise<void> {
  if (!rawToken) return;
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
  });
  if (record && !record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: record.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      actorId: record.userId,
      action: AuditAction.LOGOUT,
      entity: "User",
      entityId: record.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
