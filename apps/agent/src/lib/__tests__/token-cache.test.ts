import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks — same env pitfall as google-auth
// ────────────────────────────────────────────────────────────

// 1. Env mock
vi.mock("../../env", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
  },
}));

// 2. @prisma/client mock
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: class MockPrismaClient {
      userGoogleToken = {
        findUnique: mockFindUnique,
        update: mockUpdate,
      };
    },
  };
});

// 3. google-auth-library mock
const mockSetCredentials = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: class MockOAuth2Client {
      setCredentials = mockSetCredentials;
      getAccessToken = mockGetAccessToken;
    },
  };
});

// 4. token-encryption mock
const mockDecryptToken = vi.fn().mockReturnValue("decrypted-refresh");

vi.mock("../token-encryption", () => ({
  decryptToken: mockDecryptToken,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Re-set return values after clearAllMocks
  mockDecryptToken.mockReturnValue("decrypted-refresh");
});

// ────────────────────────────────────────────────────────────
// getAccessTokenForUser
// ────────────────────────────────────────────────────────────

describe("getAccessTokenForUser", () => {
  const makeRecord = (overrides = {}) => ({
    id: "token-1",
    userId: "user-123",
    encryptedRefresh: "enc-refresh",
    iv: "enc-iv",
    authTag: "enc-tag",
    isValid: true,
    ...overrides,
  });

  it("returns cached token on cache hit (no DB query on second call)", async () => {
    // First call: DB lookup + refresh
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: "access-token-1" });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");

    // First call populates cache
    const first = await getAccessTokenForUser("user-123");
    expect(first).toBe("access-token-1");
    expect(mockFindUnique).toHaveBeenCalledTimes(1);

    // Second call should hit cache -- no additional DB query
    const second = await getAccessTokenForUser("user-123");
    expect(second).toBe("access-token-1");
    expect(mockFindUnique).toHaveBeenCalledTimes(1); // Still 1
  });

  it("refreshes from DB on cache miss, returns new access token", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: "fresh-access-token" });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBe("fresh-access-token");
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123", isValid: true },
      })
    );
    expect(mockSetCredentials).toHaveBeenCalledWith({
      refresh_token: "decrypted-refresh",
    });
  });

  it("returns null when no stored token in DB", async () => {
    mockFindUnique.mockResolvedValue(null);

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBeNull();
  });

  it("returns null and marks token invalid when getAccessToken throws", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockRejectedValue(new Error("Token revoked"));
    mockUpdate.mockResolvedValue({});

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123" },
        data: expect.objectContaining({
          isValid: false,
          revokedAt: expect.any(Date),
        }),
      })
    );

    errorSpy.mockRestore();
  });

  it("returns null and marks token invalid when getAccessToken returns no token", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: null });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123" },
        data: expect.objectContaining({
          isValid: false,
        }),
      })
    );
  });

  it("deduplicates concurrent refresh requests for the same userId", async () => {
    // Simulate a slow DB lookup
    mockFindUnique.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(makeRecord()), 50)
        )
    );
    mockGetAccessToken.mockResolvedValue({ token: "deduped-token" });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");

    // Start two concurrent requests for the same user
    const [result1, result2] = await Promise.all([
      getAccessTokenForUser("user-123"),
      getAccessTokenForUser("user-123"),
    ]);

    expect(result1).toBe("deduped-token");
    expect(result2).toBe("deduped-token");
    // DB should only be queried ONCE despite two concurrent calls
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});
