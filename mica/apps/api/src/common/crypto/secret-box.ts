import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Logger } from "@nestjs/common";

/**
 * Reversible encryption for secrets that must be replayed to a third party —
 * an SMTP password has to be handed to the mail server, so it cannot be
 * hashed the way a user password is.
 *
 * The stored form is prefixed and versioned (`enc:v1:...`) for two reasons:
 * a value written before encryption existed is recognisable as plaintext and
 * still readable, and the scheme can change later without guessing at what an
 * old row contains.
 *
 * Without `SETTINGS_ENCRYPTION_KEY` the value is stored as before, in the
 * clear. That is deliberate: silently refusing to save the admin's SMTP
 * settings would be a worse failure than the one this guards against, and the
 * warning says exactly what to set.
 */
const PREFIX = "enc:v1:";
const logger = new Logger("SecretBox");

function key(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) return null;
  // Hashed to exactly 32 bytes so any sufficiently long passphrase works.
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const k = key();
  if (!k) {
    logger.warn(
      "SETTINGS_ENCRYPTION_KEY is not set — storing the secret in plain text. " +
        "Set a value of at least 32 characters to encrypt it at rest.",
    );
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored || !isEncrypted(stored)) return stored; // written before encryption
  const k = key();
  if (!k) {
    // The key was removed after the value was written. Returning the ciphertext
    // would hand SMTP a garbage password and produce a confusing auth error, so
    // this fails loudly instead.
    throw new Error(
      "An encrypted setting was found but SETTINGS_ENCRYPTION_KEY is not set. " +
        "Restore the key that encrypted it.",
    );
  }
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
