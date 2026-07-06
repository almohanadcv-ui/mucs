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
import { AuditAction } from "@/core/domain/enums";
import { loginSchema, type LoginInput, type RequestMeta } from "./dto";
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

async function issueTokens(
  user: { id: string; tenantId: string; role: AuthenticatedUser["role"]; name: string },
  meta: RequestMeta,
  family?: string,
): Promise<IssuedTokens> {
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
      family: family ?? randomUUID(),
      expiresAt: new Date(Date.now() + refreshMaxAge * 1000),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  return { accessToken, refreshToken, accessMaxAge, refreshMaxAge };
}

export async function login(
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ user: AuthenticatedUser; tokens: IssuedTokens }> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw AppError.validation("بيانات تسجيل الدخول غير صالحة", parsed.error.flatten());
  }
  const input: LoginInput = parsed.data;
  const env = getServerEnv();

  // Resolve tenant (single-tenant default until multi-tenant onboarding ships)
  const tenant = await prisma.tenant.findFirst({
    where: {
      deletedAt: null,
      isActive: true,
      ...(input.tenantSlug ? { slug: input.tenantSlug } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  if (!tenant) throw new AppError("INVALID_CREDENTIALS", "بيانات الدخول غير صحيحة");

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email, deletedAt: null },
  });

  // Uniform failure to avoid user enumeration
  const invalid = () =>
    new AppError("INVALID_CREDENTIALS", "بيانات الدخول غير صحيحة");

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
      "تم قفل الحساب مؤقتاً بسبب محاولات دخول فاشلة. حاول لاحقاً.",
    );
  }

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= env.AUTH_MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60_000)
          : null,
      },
    });
    await writeAudit({
      tenantId: tenant.id,
      actorId: user.id,
      action: AuditAction.LOGIN_FAILED,
      entity: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw invalid();
  }

  // Two-factor challenge
  if (user.twoFactorEnabled) {
    if (!input.totp) {
      throw new AppError("TWO_FACTOR_REQUIRED", "مطلوب رمز التحقق الثنائي");
    }
    const secret = user.twoFactorSecretEnc
      ? decrypt(user.twoFactorSecretEnc)
      : "";
    if (!secret || !verifyTotp(input.totp, secret)) {
      throw new AppError("INVALID_CREDENTIALS", "رمز التحقق غير صحيح");
    }
  }

  // Opportunistic password rehash if parameters were upgraded
  const rehash = needsRehash(user.passwordHash)
    ? await hashPassword(input.password)
    : undefined;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(rehash ? { passwordHash: rehash } : {}),
    },
  });

  const tokens = await issueTokens(
    { id: user.id, tenantId: user.tenantId, role: user.role, name: user.name },
    meta,
  );

  await writeAudit({
    tenantId: tenant.id,
    actorId: user.id,
    action: AuditAction.LOGIN,
    entity: "User",
    entityId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

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
  if (!rawToken) throw AppError.unauthorized("انتهت الجلسة");

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    throw AppError.unauthorized("انتهت الجلسة، الرجاء تسجيل الدخول");
  }

  // Reuse detection: a revoked token was replayed → nuke the family.
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: record.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized("تم اكتشاف إعادة استخدام الجلسة");
  }

  const user = record.user;
  if (!user || user.deletedAt || !user.isActive) {
    throw AppError.unauthorized("الحساب غير متاح");
  }

  // Rotate: revoke current, issue a new token in the same family.
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(
    { id: user.id, tenantId: user.tenantId, role: user.role, name: user.name },
    meta,
    record.family,
  );

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
