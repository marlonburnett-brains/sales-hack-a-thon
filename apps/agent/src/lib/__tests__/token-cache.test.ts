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
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("@prisma/client", () => {
  const MockPrismaClient = class {
    userGoogleToken = {
      findUnique: mockFindUnique,
      update: mockUpdate,
    };
    actionRequired = {
      findFirst: mockFindFirst,
      create: mockCreate,
    };
  };
  return {
    default: { PrismaClient: MockPrismaClient },
    PrismaClient: MockPrismaClient,
  };
});

// 3. google-auth-library mock
const mockSetCredentials = vi.fn();
const mockGetAccessToken = vi.fn();
const mockOn = vi.fn();

vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: class MockOAuth2Client {
      setCredentials = mockSetCredentials;
      getAccessToken = mockGetAccessToken;
      on = mockOn;
    },
  };
});

// 4. token-encryption mock
const mockDecryptToken = vi.fn().mockReturnValue("decrypted-refresh");

vi.mock("../token-encryption", () => ({
  decryptToken: mockDecryptToken,
  encryptToken: vi.fn().mockReturnValue({
    encrypted: "enc",
    iv: "iv",
    authTag: "tag",
  }),
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
    email: "test@example.com",
    encryptedRefresh: "enc-refresh",
    iv: "enc-iv",
    authTag: "enc-tag",
    isValid: true,
    lastUsedAt: new Date(),
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

  it("returns null but does NOT immediately mark token invalid on first definitive error (cooldown)", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked"));
    mockUpdate.mockResolvedValue({});

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBeNull();
    // Should NOT have called update with isValid: false on first failure
    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("returns null when getAccessToken returns no token (does not invalidate)", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: null });
    mockUpdate.mockResolvedValue({});

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBeNull();
    // Token should NOT be invalidated for null response (no error thrown)
    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("does not treat invalid_client as definitive (configuration error)", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockRejectedValue(new Error("invalid_client: The OAuth client was not found"));
    mockUpdate.mockResolvedValue({});

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBeNull();
    // Should NOT mark token invalid — this is a config error
    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
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

// ────────────────────────────────────────────────────────────
// resetTokenState
// ────────────────────────────────────────────────────────────

describe("resetTokenState", () => {
  it("clears cached access token so next call triggers fresh refresh", async () => {
    mockFindUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-reset",
      email: "test@example.com",
      encryptedRefresh: "enc",
      iv: "iv",
      authTag: "tag",
      isValid: true,
      lastUsedAt: new Date(),
    });
    mockGetAccessToken.mockResolvedValue({ token: "first-token" });
    mockUpdate.mockResolvedValue({});

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { getAccessTokenForUser, resetTokenState } = await import("../token-cache");

    // First call: populate cache
    const first = await getAccessTokenForUser("user-reset");
    expect(first).toBe("first-token");
    expect(mockFindUnique).toHaveBeenCalledTimes(1);

    // Reset state (simulates new token stored via POST /tokens)
    resetTokenState("user-reset");

    // Change what the mock returns for the fresh refresh
    mockGetAccessToken.mockResolvedValue({ token: "second-token" });

    // Second call: should NOT hit cache, should do fresh refresh
    const second = await getAccessTokenForUser("user-reset");
    expect(second).toBe("second-token");
    expect(mockFindUnique).toHaveBeenCalledTimes(2); // New DB lookup

    logSpy.mockRestore();
  });

  it("clears failure tracking so re-auth gets a fresh cooldown window", async () => {
    mockFindUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-cooldown",
      email: "test@example.com",
      encryptedRefresh: "enc",
      iv: "iv",
      authTag: "tag",
      isValid: true,
      lastUsedAt: new Date(),
    });
    // Simulate definitive error
    mockGetAccessToken.mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked"));
    mockUpdate.mockResolvedValue({});

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { getAccessTokenForUser, resetTokenState } = await import("../token-cache");

    // First failure: sets firstFailureAt
    await getAccessTokenForUser("user-cooldown");

    // Simulate re-authentication (clears failure state)
    resetTokenState("user-cooldown");

    // Now simulate that refresh works with new token
    mockGetAccessToken.mockResolvedValue({ token: "new-good-token" });

    const result = await getAccessTokenForUser("user-cooldown");
    expect(result).toBe("new-good-token");

    // Verify no invalidation happened
    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
