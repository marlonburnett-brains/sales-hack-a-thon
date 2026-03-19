import type { Page } from "@playwright/test";

/**
 * Auth Helper for Tutorial Captures — Fully Mocked
 *
 * Injects synthetic Supabase auth state (cookies + localStorage) so the
 * Next.js middleware considers the browser "authenticated" without ever
 * contacting a real Supabase instance.
 *
 * The companion mock-server.ts serves `/auth/v1/*` endpoints so
 * server-side getUser()/getSession() calls also succeed.
 *
 * NO external credentials are required.
 */

/** Deterministic fake user for tutorials */
const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "tutorial@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Tutorial User" },
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

/**
 * Build a fake (unsigned) JWT that Supabase SSR can decode.
 *
 * Supabase's `getSession()` only base64-decodes the payload — it does NOT
 * verify the signature when reading from cookies. So a structurally valid
 * but unsigned token is sufficient.
 */
function buildFakeJWT(): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: MOCK_USER.id,
    email: MOCK_USER.email,
    aud: "authenticated",
    role: "authenticated",
    iss: "http://localhost:4112/auth/v1",
    iat: now,
    exp: now + 86400, // 24 hours
    session_id: "mock-session-id",
    app_metadata: MOCK_USER.app_metadata,
    user_metadata: MOCK_USER.user_metadata,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64url")
      .replace(/=+$/, "");

  // Header.Payload.FakeSignature
  return `${encode(header)}.${encode(payload)}.mock-signature`;
}

/**
 * Build the session object that Supabase SSR stores in cookies.
 */
function buildFakeSession() {
  const accessToken = buildFakeJWT();
  return {
    access_token: accessToken,
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: MOCK_USER,
  };
}

/**
 * Inject synthetic auth state into the Playwright browser context.
 *
 * Sets:
 * 1. Supabase SSR auth cookies (for middleware getSession/getUser)
 * 2. localStorage entry (for client-side Supabase reads)
 * 3. google-token-status cookie (prevents middleware token check)
 *
 * No network calls. No env vars required.
 */
export async function ensureAuthState(page: Page): Promise<void> {
  const session = buildFakeSession();
  const storageKey = "sb-localhost-auth-token";

  // ── 1. Inject localStorage for client-side Supabase client ──
  await page.addInitScript(
    (args: { key: string; session: unknown }) => {
      localStorage.setItem(args.key, JSON.stringify(args.session));
    },
    { key: storageKey, session }
  );

  // ── 2. Set Supabase SSR auth cookies ──
  // @supabase/ssr stores session as base64 chunks in cookies.
  const sessionJson = JSON.stringify(session);
  const encoded = `base64-${Buffer.from(sessionJson).toString("base64")}`;
  const cookieBase = "sb-localhost-auth-token";
  const maxChunkSize = 3180;

  const cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Lax";
    expires: number;
  }> = [];

  if (encoded.length <= maxChunkSize) {
    cookies.push({
      name: cookieBase,
      value: encoded,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 86400,
    });
  } else {
    const chunks = Math.ceil(encoded.length / maxChunkSize);
    for (let i = 0; i < chunks; i++) {
      cookies.push({
        name: `${cookieBase}.${i}`,
        value: encoded.slice(i * maxChunkSize, (i + 1) * maxChunkSize),
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 86400,
      });
    }
  }

  await page.context().addCookies(cookies);

  // ── 3. Set google-token-status cookie (prevents middleware token check) ──
  await page.context().addCookies([
    {
      name: "google-token-status",
      value: "valid",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);
}

/** Re-export for tests that need the mock user shape */
export { MOCK_USER };
