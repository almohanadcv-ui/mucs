import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getServerEnv } from "@/lib/env";

/**
 * Symmetric encryption at rest (AES-256-GCM) for secrets such as 2FA seeds.
 * Key is derived deterministically from ENCRYPTION_KEY via SHA-256 so any
 * sufficiently long secret works regardless of encoding.
 */
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce size
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  return createHash("sha256").update(getServerEnv().ENCRYPTION_KEY).digest();
}

/** Encrypt UTF-8 plaintext → compact "iv.tag.ciphertext" (base64url). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypt a value produced by {@link encrypt}. Throws on tamper. */
export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext");
  }
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64url"),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** SHA-256 hex digest — used for opaque token lookup keys (not passwords). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** URL-safe random token. */
export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}
