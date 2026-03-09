import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks — must be hoisted before module-under-test import
// ────────────────────────────────────────────────────────────

// 1. Mock "server-only" to a no-op (it throws in non-Next.js envs)
vi.mock("server-only", () => ({}));

// 2. Mock env
vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://localhost:4111",
  },
}));

// 3. Mock Supabase access token
vi.mock("@/lib/supabase/get-access-token", () => ({
  getSupabaseAccessToken: vi.fn().mockResolvedValue("test-supabase-jwt"),
}));

// 4. Mock getGoogleAccessToken
const mockGetGoogleAccessToken = vi.fn();
vi.mock("@/lib/supabase/google-token", () => ({
  getGoogleAccessToken: mockGetGoogleAccessToken,
}));

// 4. Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Default: fetch returns a successful JSON response
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: "ok" }),
  });
});

// ────────────────────────────────────────────────────────────
// PASS-01: fetchWithGoogleAuth sends X-Google-Access-Token
//          and X-User-Id headers on Google-triggering requests
// ────────────────────────────────────────────────────────────

describe("fetchWithGoogleAuth", () => {
  it("sends X-Google-Access-Token when available (userId derived from JWT)", async () => {
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: "google-tok-abc",
      userId: "user-123",
    });

    const { fetchWithGoogleAuth } = await import("@/lib/api-client");
    await fetchWithGoogleAuth("/templates", { method: "POST" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:4111/templates");
    expect(init.headers["X-Google-Access-Token"]).toBe("google-tok-abc");
    // X-User-Id no longer sent -- agent derives userId from JWT sub claim
    expect(init.headers["X-User-Id"]).toBeUndefined();
  });

  it("sends no Google headers when accessToken is null (agent uses JWT for userId)", async () => {
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: null,
      userId: "user-456",
    });

    const { fetchWithGoogleAuth } = await import("@/lib/api-client");
    await fetchWithGoogleAuth("/templates/t1/check-staleness", {
      method: "POST",
    });

    const [, init] = mockFetch.mock.calls[0];
    // No X-User-Id sent -- agent derives from JWT
    expect(init.headers["X-User-Id"]).toBeUndefined();
    expect(init.headers["X-Google-Access-Token"]).toBeUndefined();
  });

  it("sends no Google headers when both are null (unauthenticated)", async () => {
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: null,
      userId: null,
    });

    const { fetchWithGoogleAuth } = await import("@/lib/api-client");
    await fetchWithGoogleAuth("/templates/t1/ingest", { method: "POST" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBeUndefined();
    expect(init.headers["X-User-Id"]).toBeUndefined();
    // Still sends standard headers
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toContain("Bearer");
  });

  it("preserves caller-provided headers alongside Google headers", async () => {
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: "tok",
      userId: "uid",
    });

    const { fetchWithGoogleAuth } = await import("@/lib/api-client");
    await fetchWithGoogleAuth("/templates", {
      method: "POST",
      headers: { "X-Custom": "value" },
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Custom"]).toBe("value");
    expect(init.headers["X-Google-Access-Token"]).toBe("tok");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});

// ────────────────────────────────────────────────────────────
// PASS-04: Google-triggering functions use fetchWithGoogleAuth,
//          non-Google CRUD functions use fetchJSON (no Google headers)
// ────────────────────────────────────────────────────────────

describe("Google-triggering functions use fetchWithGoogleAuth", () => {
  beforeEach(() => {
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: "goog-tok",
      userId: "user-id",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ template: {}, serviceAccountEmail: null }),
    });
  });

  it("createTemplate sends Google auth headers", async () => {
    const { createTemplate } = await import("@/lib/api-client");
    await createTemplate({
      name: "Test",
      googleSlidesUrl: "https://slides.google.com/...",
      presentationId: "p1",
      touchTypes: ["touch-1"],
    });

    expect(mockGetGoogleAccessToken).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBe("goog-tok");
  });

  it("checkTemplateStaleness sends Google auth headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ isStale: false }),
    });
    const { checkTemplateStaleness } = await import("@/lib/api-client");
    await checkTemplateStaleness("t1");

    expect(mockGetGoogleAccessToken).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBe("goog-tok");
  });

  it("triggerIngestion sends Google auth headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ queued: true }),
    });
    const { triggerIngestion } = await import("@/lib/api-client");
    await triggerIngestion("t1");

    expect(mockGetGoogleAccessToken).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBe("goog-tok");
  });

  it("getSlideThumbnails sends Google auth headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ thumbnails: [] }),
    });
    const { getSlideThumbnails } = await import("@/lib/api-client");
    await getSlideThumbnails("t1");

    expect(mockGetGoogleAccessToken).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBe("goog-tok");
  });

  it("startTouch1Workflow sends Google auth headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ runId: "r1" }),
    });
    const { startTouch1Workflow } = await import("@/lib/api-client");
    await startTouch1Workflow("d1", {
      companyName: "Acme",
      industry: "Tech",
      context: "Test",
    });

    expect(mockGetGoogleAccessToken).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBe("goog-tok");
  });

  it("startPreCallWorkflow sends Google auth headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ runId: "r1" }),
    });
    const { startPreCallWorkflow } = await import("@/lib/api-client");
    await startPreCallWorkflow("d1", {
      companyName: "Acme",
      industry: "Tech",
      buyerRole: "CTO",
      meetingContext: "Discovery",
    });

    expect(mockGetGoogleAccessToken).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBe("goog-tok");
  });
});

describe("Non-Google CRUD functions do NOT send Google headers", () => {
  beforeEach(() => {
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: "should-not-appear",
      userId: "should-not-appear",
    });
  });

  it("createCompany does NOT call getGoogleAccessToken", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: "c1", name: "Acme", industry: "Tech" }),
    });
    const { createCompany } = await import("@/lib/api-client");
    await createCompany({ name: "Acme", industry: "Tech" });

    expect(mockGetGoogleAccessToken).not.toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-Google-Access-Token"]).toBeUndefined();
    expect(init.headers["X-User-Id"]).toBeUndefined();
  });

  it("listDeals does NOT call getGoogleAccessToken", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const { listDeals } = await import("@/lib/api-client");
    await listDeals();

    expect(mockGetGoogleAccessToken).not.toHaveBeenCalled();
  });

  it("listTemplates does NOT send Google headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const { listTemplates } = await import("@/lib/api-client");
    await listTemplates();

    expect(mockGetGoogleAccessToken).not.toHaveBeenCalled();
  });

  it("storeGoogleToken does NOT send Google headers (CRUD, not Google API)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, tokenId: "t1" }),
    });
    const { storeGoogleToken } = await import("@/lib/api-client");
    await storeGoogleToken({
      userId: "u1",
      email: "a@b.com",
      refreshToken: "rt",
    });

    expect(mockGetGoogleAccessToken).not.toHaveBeenCalled();
  });
});
