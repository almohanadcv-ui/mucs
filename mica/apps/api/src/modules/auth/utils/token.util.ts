import { createHash, randomBytes } from "node:crypto";

/** High-entropy opaque refresh token (not a JWT — revocation is a DB row, not a blacklist). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 is sufficient here: the input is already a 256-bit random value, not a low-entropy secret. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
