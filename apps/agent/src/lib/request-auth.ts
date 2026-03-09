import { getAccessTokenForUser } from "./token-cache";
import { verifySupabaseJwt } from "./supabase-jwt-auth";

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
 * 2. verifiedUserId from JWT (or fallback X-User-Id) -> agent-side refresh from stored token
 * 3. Neither present -> empty result (service account fallback)
 */
export async function extractGoogleAuth(
  c: RequestContext,
  verifiedUserId?: string,
): Promise<GoogleAuthResult> {
  const accessToken = c.req.header("X-Google-Access-Token");
  // Prefer verified userId from JWT over spoofable X-User-Id header
  const userId = verifiedUserId ?? c.req.header("X-User-Id");

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
    console.warn(`[request-auth] No access token resolved for userId=${userId} — falling back to SA`);
    return { userId };
  }

  // Priority 3: No Google auth headers -- service account fallback
  return {};
}

/**
 * Extract the verified user ID from the JWT in the Authorization header.
 * Use this to pass to extractGoogleAuth as the verifiedUserId parameter.
 *
 * @param c - Request context with headers
 * @param supabaseUrl - Supabase project URL for JWKS verification
 *
 * NOTE: This is async because JWT verification requires JWKS fetching.
 * All callers must await the result.
 */
export async function getVerifiedUserId(
  c: RequestContext,
  supabaseUrl: string,
): Promise<string | undefined> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  const token = authHeader.slice(7);
  const payload = await verifySupabaseJwt(token, supabaseUrl);
  return payload?.sub;
}
