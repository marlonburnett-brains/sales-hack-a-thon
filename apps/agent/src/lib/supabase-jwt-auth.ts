import { createHmac } from "node:crypto";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// Supabase JWT verification using HS256 (Node crypto)
//
// Supabase JWTs are signed with HMAC-SHA256 by default.
// This module verifies the signature, checks expiration,
// and extracts user identity from the JWT claims.
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

/**
 * Verify a Supabase JWT from the Authorization header value.
 *
 * @param token - The raw JWT string (without "Bearer " prefix)
 * @returns Decoded payload if valid, null if invalid/expired/malformed.
 *          Never throws.
 */
export function verifySupabaseJwt(token: string | undefined): JwtPayload | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HS256 signature
    const expectedSignature = createHmac("sha256", env.SUPABASE_JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (expectedSignature !== signatureB64) {
      return null;
    }

    // Decode payload
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as JwtPayload;

    // Check expiration
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSeconds) {
      return null;
    }

    // Require sub claim (user ID)
    if (!payload.sub) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
