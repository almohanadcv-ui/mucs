import * as OTPAuth from "otpauth";
import { getServerEnv } from "@/lib/env";

/**
 * TOTP (RFC 6238) for two-factor authentication via otpauth.
 * Secrets are generated here and stored ENCRYPTED at rest (see crypto.ts);
 * only the decrypted base32 secret is passed to verify().
 */
function buildTotp(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: getServerEnv().APP_NAME,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** Generate a new base32 secret to enroll a user. */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** otpauth:// URI for QR-code enrollment. */
export function totpKeyUri(email: string, secret: string): string {
  return buildTotp(email, secret).toString();
}

/** Verify a 6-digit token against the secret (±1 step drift tolerance). */
export function verifyTotp(token: string, secret: string): boolean {
  try {
    const delta = buildTotp("user", secret).validate({ token, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}
