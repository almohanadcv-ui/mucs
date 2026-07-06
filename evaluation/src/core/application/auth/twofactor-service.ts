import QRCode from "qrcode";
import { prisma } from "@/infrastructure/db/prisma";
import {
  generateTotpSecret,
  totpKeyUri,
  verifyTotp,
} from "@/infrastructure/security/totp";
import { encrypt, decrypt, sha256, randomToken } from "@/infrastructure/security/crypto";
import { verifyPassword } from "@/infrastructure/security/password";
import { AppError } from "@/core/application/errors";
import type { SessionUser } from "@/infrastructure/auth/session";

/**
 * Begin 2FA enrollment: generate a secret, store it ENCRYPTED (but leave 2FA
 * disabled until the user confirms a valid code), and return provisioning data.
 */
export async function beginTwoFactorSetup(user: SessionUser) {
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, twoFactorEnabled: true },
  });
  if (account.twoFactorEnabled) {
    throw new AppError("CONFLICT", "المصادقة الثنائية مفعّلة بالفعل");
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecretEnc: encrypt(secret) },
  });

  const otpauth = totpKeyUri(account.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
  return { secret, otpauth, qrDataUrl };
}

/** Confirm enrollment with a valid TOTP; returns one-time recovery codes. */
export async function enableTwoFactor(user: SessionUser, token: string) {
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { twoFactorSecretEnc: true, twoFactorEnabled: true },
  });
  if (account.twoFactorEnabled) {
    throw new AppError("CONFLICT", "المصادقة الثنائية مفعّلة بالفعل");
  }
  if (!account.twoFactorSecretEnc) {
    throw AppError.validation("ابدأ الإعداد أولاً");
  }
  const secret = decrypt(account.twoFactorSecretEnc);
  if (!verifyTotp(token, secret)) {
    throw AppError.validation("رمز التحقق غير صحيح");
  }

  // Generate 8 recovery codes; store only their hashes (encrypted at rest).
  const codes = Array.from({ length: 8 }, () => randomToken(6).slice(0, 10));
  const hashed = codes.map((c) => sha256(c));
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorRecoveryCodes: encrypt(JSON.stringify(hashed)),
    },
  });
  return { recoveryCodes: codes };
}

export async function disableTwoFactor(user: SessionUser, password: string) {
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(account.passwordHash, password))) {
    throw AppError.validation("كلمة المرور غير صحيحة");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecretEnc: null,
      twoFactorRecoveryCodes: null,
    },
  });
  return { disabled: true };
}
