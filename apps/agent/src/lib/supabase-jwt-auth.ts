import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// ────────────────────────────────────────────────────────────
// Supabase JWT verification using JWKS (asymmetric)
//
// Fetches the public signing keys from Supabase's JWKS endpoint
// and verifies tokens with the correct algorithm automatically.
// Supports both ECC P-256 (ES256) and legacy HS256 keys.
// The JWKS is cached internally by jose with automatic refresh.
// ────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string; // Supabase user ID
  email?: string;
  role?: string;
  exp: number;
  iat?: number;
  aud?: string;
  iss?: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(supabaseUrl: string) {
  if (!jwks) {
    const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
    jwks = createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

/**
 * Verify a Supabase JWT using the project's JWKS endpoint.
 *
 * @param token - The raw JWT string (without "Bearer " prefix)
 * @param supabaseUrl - The Supabase project URL (e.g. https://xxx.supabase.co)
 * @returns Decoded payload if valid, null if invalid/expired/malformed.
 *          Never throws.
 */
export async function verifySupabaseJwt(
  token: string | undefined,
  supabaseUrl: string,
): Promise<JwtPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWKS(supabaseUrl), {
      // Supabase sets issuer to: https://<ref>.supabase.co/auth/v1
      issuer: `${supabaseUrl}/auth/v1`,
    });

    if (!payload.sub) return null;

    return {
      sub: payload.sub,
      email: payload.email as string | undefined,
      role: payload.role as string | undefined,
      exp: payload.exp ?? 0,
      iat: payload.iat,
      aud: payload.aud as string | undefined,
      iss: payload.iss,
    };
  } catch {
    return null;
  }
}
