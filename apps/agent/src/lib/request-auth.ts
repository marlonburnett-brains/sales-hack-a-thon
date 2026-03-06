import { getAccessTokenForUser } from "./token-cache";

// ────────────────────────────────────────────────────────────
// Google auth extraction from Hono request headers
// ────────────────────────────────────────────────────────────

export interface GoogleAuthResult {
  accessToken?: string;
  userId?: string;
}

/** Minimal interface for Hono-like request context */
interface RequestContext {
  req: {
    header(name: string): string | undefined;
  };
}

/**
 * Extract Google auth info from request headers.
 *
 * Priority chain (per locked decision):
 * 1. X-Google-Access-Token present -> use directly
 * 2. X-User-Id present (no access token) -> agent-side refresh from stored token
 * 3. Neither present -> empty result (service account fallback)
 */
export async function extractGoogleAuth(
  c: RequestContext
): Promise<GoogleAuthResult> {
  const accessToken = c.req.header("X-Google-Access-Token");
  const userId = c.req.header("X-User-Id");

  // Priority 1: Direct access token from web app session
  if (accessToken) {
    return { accessToken, userId: userId ?? undefined };
  }

  // Priority 2: User ID only -- attempt agent-side refresh
  if (userId) {
    const resolved = await getAccessTokenForUser(userId);
    if (resolved) {
      return { accessToken: resolved, userId };
    }
    // Refresh failed or no stored token -- fall through to service account
    return { userId };
  }

  // Priority 3: No Google auth headers -- service account fallback
  return {};
}
