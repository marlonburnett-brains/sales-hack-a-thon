import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";

// Generate a valid 64-hex-char test key (32 bytes)
const TEST_KEY = randomBytes(32).toString("hex");

describe("token-encryption", () => {
  const originalEnv = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    }
  });

  it("encryptToken returns non-empty base64 strings for encrypted, iv, authTag", async () => {
    const { encryptToken } = await import("../token-encryption");
    const result = encryptToken("test-refresh-token");

    expect(result.encrypted).toBeTruthy();
    expect(result.iv).toBeTruthy();
    expect(result.authTag).toBeTruthy();

    // All should be valid base64
    expect(() => Buffer.from(result.encrypted, "base64")).not.toThrow();
    expect(() => Buffer.from(result.iv, "base64")).not.toThrow();
    expect(() => Buffer.from(result.authTag, "base64")).not.toThrow();
  });

  it("decryptToken roundtrips back to original plaintext", async () => {
    const { encryptToken, decryptToken } = await import("../token-encryption");
    const plaintext = "test-refresh-token";
    const { encrypted, iv, authTag } = encryptToken(plaintext);
    const result = decryptToken(encrypted, iv, authTag);

    expect(result).toBe(plaintext);
  });

  it("encryptToken produces different iv and encrypted output on each call", async () => {
    const { encryptToken } = await import("../token-encryption");
    const a = encryptToken("same-token");
    const b = encryptToken("same-token");

    expect(a.iv).not.toBe(b.iv);
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it("getEncryptionKey throws if GOOGLE_TOKEN_ENCRYPTION_KEY is not set", async () => {
    const { getEncryptionKey } = await import("../token-encryption");
    const saved = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

    expect(() => getEncryptionKey()).toThrow("GOOGLE_TOKEN_ENCRYPTION_KEY not set");

    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = saved;
  });

  it("getEncryptionKey throws if key is not exactly 64 hex chars", async () => {
    const { getEncryptionKey } = await import("../token-encryption");
    const saved = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "too-short";

    expect(() => getEncryptionKey()).toThrow("GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex chars");

    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = saved;
  });

  it("tampered authTag causes decryptToken to throw", async () => {
    const { encryptToken, decryptToken } = await import("../token-encryption");
    const { encrypted, iv, authTag } = encryptToken("secret-token");

    // Tamper with authTag
    const tampered = Buffer.from(authTag, "base64");
    tampered[0] ^= 0xff;
    const tamperedTag = tampered.toString("base64");

    expect(() => decryptToken(encrypted, iv, tamperedTag)).toThrow();
  });

  it("tampered encrypted data causes decryptToken to throw", async () => {
    const { encryptToken, decryptToken } = await import("../token-encryption");
    const { encrypted, iv, authTag } = encryptToken("secret-token");

    // Tamper with encrypted data
    const tampered = Buffer.from(encrypted, "base64");
    tampered[0] ^= 0xff;
    const tamperedEncrypted = tampered.toString("base64");

    expect(() => decryptToken(tamperedEncrypted, iv, authTag)).toThrow();
  });
});
