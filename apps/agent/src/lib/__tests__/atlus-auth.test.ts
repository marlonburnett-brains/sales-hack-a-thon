import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks — declared before import so vi.mock hoisting works
// ────────────────────────────────────────────────────────────

// 1. Prisma mock
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: class MockPrismaClient {
      userAtlusToken = {
        findMany: mockFindMany,
        update: mockUpdate,
        count: mockCount,
        upsert: mockUpsert,
      };
    },
  };
});

// 2. token-encryption mock
const mockDecryptToken = vi.fn().mockReturnValue("decrypted-atlus-token");
const mockEncryptToken = vi.fn().mockReturnValue({
  encrypted: "enc",
  iv: "iv",
  authTag: "tag",
});

vi.mock("../token-encryption", () => ({
  decryptToken: mockDecryptToken,
  encryptToken: mockEncryptToken,
}));

// ────────────────────────────────────────────────────────────
// Setup / Teardown
// ────────────────────────────────────────────────────────────

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Re-set return values cleared by clearAllMocks
  mockDecryptToken.mockReturnValue("decrypted-atlus-token");
  mockEncryptToken.mockReturnValue({ encrypted: "enc", iv: "iv", authTag: "tag" });

  // Clean env
  process.env = { ...originalEnv };
  delete process.env.ATLUS_API_TOKEN;
});

afterEach(() => {
  process.env = originalEnv;
});

// ────────────────────────────────────────────────────────────
// getPooledAtlusAuth
// ────────────────────────────────────────────────────────────

describe("getPooledAtlusAuth", () => {
  const makeToken = (overrides = {}) => ({
    id: "token-1",
    userId: "user-123",
    email: "user@example.com",
    encryptedToken: "enc-token",
    iv: "enc-iv",
    authTag: "enc-tag",
    isValid: true,
    lastUsedAt: new Date("2026-01-01"),
    revokedAt: null,
    ...overrides,
  });

  it("Test 1: returns token from pool when valid tokens exist (ordered by lastUsedAt desc)", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(5);

    const { getPooledAtlusAuth } = await import("../atlus-auth");
    const result = await getPooledAtlusAuth();

    expect(result).toEqual({
      token: "decrypted-atlus-token",
      source: "pool",
      userId: "user-123",
    });

    // Verify ordered by lastUsedAt desc
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isValid: true },
      orderBy: { lastUsedAt: "desc" },
    });
  });

  it("Test 2: marks token isValid=false with revokedAt when decryption fails, continues to next", async () => {
    const token1 = makeToken({ id: "t1" });
    const token2 = makeToken({ id: "t2", userId: "user-456" });

    mockFindMany.mockResolvedValue([token1, token2]);
    // First token decryption fails, second succeeds
    mockDecryptToken
      .mockImplementationOnce(() => { throw new Error("Decryption failed"); })
      .mockReturnValueOnce("good-token");
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(4);

    const { getPooledAtlusAuth } = await import("../atlus-auth");
    const result = await getPooledAtlusAuth();

    // First token should be marked invalid
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: expect.objectContaining({
          isValid: false,
          revokedAt: expect.any(Date),
        }),
      })
    );

    // Second token should succeed
    expect(result).toEqual({
      token: "good-token",
      source: "pool",
      userId: "user-456",
    });
  });

  it("Test 3: updates lastUsedAt on successful token usage (fire-and-forget)", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    const catchFn = vi.fn();
    mockUpdate.mockReturnValue({ catch: catchFn });
    mockCount.mockResolvedValue(5);

    const { getPooledAtlusAuth } = await import("../atlus-auth");
    await getPooledAtlusAuth();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "token-1" },
        data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      })
    );
  });

  it("Test 4: logs warning when valid token count drops below 3", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFindMany.mockResolvedValue([makeToken()]);
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(2);

    const { getPooledAtlusAuth } = await import("../atlus-auth");
    await getPooledAtlusAuth();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("2 valid token(s) remaining")
    );
    warnSpy.mockRestore();
  });

  it("Test 5: falls back to ATLUS_API_TOKEN env var when pool is exhausted", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockDecryptToken.mockImplementation(() => { throw new Error("Decryption failed"); });
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(0);

    process.env.ATLUS_API_TOKEN = "env-fallback-token";

    const { getPooledAtlusAuth } = await import("../atlus-auth");
    const result = await getPooledAtlusAuth();

    expect(result).toEqual({
      token: "env-fallback-token",
      source: "env",
    });
  });

  it("Test 6: returns null when pool is empty AND no env var set", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const { getPooledAtlusAuth } = await import("../atlus-auth");
    const result = await getPooledAtlusAuth();

    expect(result).toBeNull();
  });

  it("Test 7: returns pool token source as 'pool' and env var source as 'env'", async () => {
    // Pool source
    mockFindMany.mockResolvedValue([makeToken()]);
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(5);

    const mod1 = await import("../atlus-auth");
    const poolResult = await mod1.getPooledAtlusAuth();
    expect(poolResult?.source).toBe("pool");

    // Reset for env test
    vi.clearAllMocks();
    vi.resetModules();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    process.env.ATLUS_API_TOKEN = "env-token";

    const mod2 = await import("../atlus-auth");
    const envResult = await mod2.getPooledAtlusAuth();
    expect(envResult?.source).toBe("env");
  });
});
