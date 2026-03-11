import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────

vi.mock("../../env", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
  },
}));

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
  mockDecryptToken.mockReturnValue("decrypted-refresh");
});

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// getAccessTokenForUser
// ────────────────────────────────────────────────────────────

describe("getAccessTokenForUser", () => {
  it("returns cached token on second call (no DB query)", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: "access-token-1" });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");

    const first = await getAccessTokenForUser("user-123");
    expect(first).toBe("access-token-1");
    expect(mockFindUnique).toHaveBeenCalledTimes(1);

    const second = await getAccessTokenForUser("user-123");
    expect(second).toBe("access-token-1");
    expect(mockFindUnique).toHaveBeenCalledTimes(1); // Still 1
  });

  it("refreshes from DB on cache miss", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: "fresh-access-token" });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");
    const result = await getAccessTokenForUser("user-123");

    expect(result).toBe("fresh-access-token");
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-123", isValid: true } })
    );
    expect(mockSetCredentials).toHaveBeenCalledWith({
      refresh_token: "decrypted-refresh",
    });
  });

  it("returns null when no stored token in DB", async () => {
    mockFindUnique.mockResolvedValue(null);

    const { getAccessTokenForUser } = await import("../token-cache");
    expect(await getAccessTokenForUser("user-123")).toBeNull();
  });

  it("does NOT invalidate on first definitive error", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked"));
    mockUpdate.mockResolvedValue({});

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    expect(await getAccessTokenForUser("user-123")).toBeNull();

    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();
  });

  it("negative-caches after failure — second call returns null without hitting Google", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked"));
    mockUpdate.mockResolvedValue({});

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");

    // First call: hits Google, fails
    await getAccessTokenForUser("user-123");
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);

    // Second call: negative cache, returns null immediately
    await getAccessTokenForUser("user-123");
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1); // Still 1
  });

  it("does not treat invalid_client as definitive (config error)", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockRejectedValue(new Error("invalid_client: The OAuth client was not found"));
    mockUpdate.mockResolvedValue({});

    vi.spyOn(console, "error").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    expect(await getAccessTokenForUser("user-123")).toBeNull();

    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();
  });

  it("returns null when getAccessToken returns no token (does not invalidate)", async () => {
    mockFindUnique.mockResolvedValue(makeRecord());
    mockGetAccessToken.mockResolvedValue({ token: null });
    mockUpdate.mockResolvedValue({});

    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getAccessTokenForUser } = await import("../token-cache");
    expect(await getAccessTokenForUser("user-123")).toBeNull();

    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();
  });

  it("deduplicates concurrent refresh requests", async () => {
    mockFindUnique.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeRecord()), 50))
    );
    mockGetAccessToken.mockResolvedValue({ token: "deduped-token" });
    mockUpdate.mockResolvedValue({});

    const { getAccessTokenForUser } = await import("../token-cache");

    const [result1, result2] = await Promise.all([
      getAccessTokenForUser("user-123"),
      getAccessTokenForUser("user-123"),
    ]);

    expect(result1).toBe("deduped-token");
    expect(result2).toBe("deduped-token");
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────
// resetTokenState
// ────────────────────────────────────────────────────────────

describe("resetTokenState", () => {
  it("clears cache so next call does a fresh refresh", async () => {
    mockFindUnique.mockResolvedValue(makeRecord({ userId: "user-reset" }));
    mockGetAccessToken.mockResolvedValue({ token: "first-token" });
    mockUpdate.mockResolvedValue({});

    vi.spyOn(console, "log").mockImplementation(() => {});

    const { getAccessTokenForUser, resetTokenState } = await import("../token-cache");

    expect(await getAccessTokenForUser("user-reset")).toBe("first-token");
    expect(mockFindUnique).toHaveBeenCalledTimes(1);

    resetTokenState("user-reset");
    mockGetAccessToken.mockResolvedValue({ token: "second-token" });

    expect(await getAccessTokenForUser("user-reset")).toBe("second-token");
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it("clears negative cache so re-auth can refresh immediately", async () => {
    mockFindUnique.mockResolvedValue(makeRecord({ userId: "user-neg" }));
    mockGetAccessToken.mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked"));
    mockUpdate.mockResolvedValue({});

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { getAccessTokenForUser, resetTokenState } = await import("../token-cache");

    // Fail once → negative cache active
    await getAccessTokenForUser("user-neg");
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);

    // Would normally be negative-cached, but reset clears it
    resetTokenState("user-neg");
    mockGetAccessToken.mockResolvedValue({ token: "fresh-token" });

    const result = await getAccessTokenForUser("user-neg");
    expect(result).toBe("fresh-token");
    expect(mockGetAccessToken).toHaveBeenCalledTimes(2); // Actually tried again

    // No invalidation happened
    const invalidateCall = mockUpdate.mock.calls.find(
      (call) => call[0]?.data?.isValid === false
    );
    expect(invalidateCall).toBeUndefined();
  });
});
