import { decryptSecret, encryptSecret, isEncrypted } from "./secret-box";

const KEY = "a".repeat(48);

describe("secret-box", () => {
  const original = process.env.SETTINGS_ENCRYPTION_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = original;
  });

  describe("with a key configured", () => {
    beforeEach(() => {
      process.env.SETTINGS_ENCRYPTION_KEY = KEY;
    });

    it("round-trips a secret", () => {
      const enc = encryptSecret("hunter2");
      expect(enc).not.toContain("hunter2");
      expect(decryptSecret(enc)).toBe("hunter2");
    });

    it("produces a different ciphertext each time", () => {
      // A fresh IV per call: identical passwords must not be identifiable by
      // comparing stored values.
      expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
    });

    it("reads a value written before encryption existed", () => {
      expect(decryptSecret("legacy-plaintext")).toBe("legacy-plaintext");
    });

    it("rejects a tampered ciphertext rather than returning garbage", () => {
      const enc = encryptSecret("hunter2");
      const tampered = enc.slice(0, -4) + "AAAA";
      expect(() => decryptSecret(tampered)).toThrow();
    });

    it("leaves an empty secret alone", () => {
      expect(encryptSecret("")).toBe("");
      expect(decryptSecret("")).toBe("");
    });
  });

  describe("without a key configured", () => {
    beforeEach(() => {
      delete process.env.SETTINGS_ENCRYPTION_KEY;
    });

    it("stores in the clear rather than failing the save", () => {
      expect(encryptSecret("hunter2")).toBe("hunter2");
      expect(isEncrypted("hunter2")).toBe(false);
    });

    it("refuses to guess at an encrypted value whose key has gone missing", () => {
      process.env.SETTINGS_ENCRYPTION_KEY = KEY;
      const enc = encryptSecret("hunter2");
      delete process.env.SETTINGS_ENCRYPTION_KEY;

      // Returning the ciphertext would hand SMTP a garbage password and
      // surface as a confusing auth error instead of a missing-key error.
      expect(() => decryptSecret(enc)).toThrow(/SETTINGS_ENCRYPTION_KEY/);
    });
  });

  it("rejects a key that is too short to be worth anything", () => {
    process.env.SETTINGS_ENCRYPTION_KEY = "short";
    expect(encryptSecret("hunter2")).toBe("hunter2");
  });
});
