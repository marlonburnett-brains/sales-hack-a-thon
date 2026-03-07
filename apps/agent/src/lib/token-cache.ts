import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { decryptToken, encryptToken } from "./token-encryption";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// In-memory token cache for user Google access tokens
// ────────────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes (Google tokens last 60min)
const MAX_CACHE_SIZE = 100;

const cache = new Map<string, CachedToken>();

// Per-userId promise dedup to prevent concurrent refresh races
const inflightRefreshes = new Map<string, Promise<string | null>>();

/**
 * Sweep expired entries when cache exceeds MAX_CACHE_SIZE.
 * Called on each cache access to keep memory bounded.
 */
function sweepExpiredIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

/**
 * Get a valid Google access token for a user.
 *
 * 1. Check in-memory cache (50min TTL)
 * 2. If expired/missing, look up encrypted refresh token from DB
 * 3. Exchange refresh token for new access token via Google OAuth
 * 4. Cache the result and update lastUsedAt in DB
 *
 * Returns null if no valid token exists or refresh fails.
 */
export async function getAccessTokenForUser(
  userId: string
): Promise<string | null> {
  sweepExpiredIfNeeded();

  // Check cache first
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  // Dedup concurrent refresh requests for the same user
  const inflight = inflightRefreshes.get(userId);
  if (inflight) {
    return inflight;
  }

  const refreshPromise = doRefresh(userId);
  inflightRefreshes.set(userId, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    inflightRefreshes.delete(userId);
  }
}

async function doRefresh(userId: string): Promise<string | null> {
  try {
    const record = await prisma.userGoogleToken.findUnique({
      where: { userId, isValid: true },
    });

    if (!record) {
      return null;
    }

    // Decrypt the stored refresh token
    const decryptedRefresh = decryptToken(
      record.encryptedRefresh,
      record.iv,
      record.authTag
    );

    // Exchange refresh token for access token
    const oauth2Client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: decryptedRefresh });

    // Capture token rotation — Google may issue a new refresh token
    oauth2Client.on("tokens", (newTokens) => {
      if (newTokens.refresh_token) {
        const { encrypted, iv, authTag } = encryptToken(newTokens.refresh_token);
        prisma.userGoogleToken
          .update({
            where: { userId },
            data: { encryptedRefresh: encrypted, iv, authTag },
          })
          .then(() => console.log(`[token-cache] Rotated refresh token for ${userId}`))
          .catch((err) => console.error(`[token-cache] Failed to save rotated token:`, err));
      }
    });

    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      // No token returned but no error thrown — unusual but not definitive.
      // Log a warning but don't invalidate; next request will retry.
      console.warn(`[token-cache] No access token returned for ${userId} (no error thrown)`);
      return null;
    }

    // Cache the new access token
    cache.set(userId, {
      accessToken,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    // Update lastUsedAt in DB (fire and forget)
    prisma.userGoogleToken
      .update({
        where: { userId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Non-critical -- log and continue
      });

    return accessToken;
  } catch (err) {
    console.error(
      `[token-cache] Failed to refresh token for user ${userId}:`,
      err
    );

    // Only permanently invalidate on definitive errors (token revoked/expired).
    // Transient network errors should NOT burn the token.
    const isDefinitive = isDefinitiveTokenError(err);

    if (isDefinitive) {
      console.warn(`[token-cache] Definitive error for ${userId} — marking token invalid`);
      await prisma.userGoogleToken
        .update({
          where: { userId },
          data: { isValid: false, revokedAt: new Date() },
        })
        .catch(() => {});

      // Create reauth_needed ActionRequired record
      try {
        const existing = await prisma.actionRequired.findFirst({
          where: { userId, actionType: 'reauth_needed', resolved: false },
        });
        if (!existing) {
          const tokenRecord = await prisma.userGoogleToken.findUnique({
            where: { userId },
            select: { email: true },
          });
          await prisma.actionRequired.create({
            data: {
              userId,
              actionType: 'reauth_needed',
              title: `Re-authentication needed for ${tokenRecord?.email ?? 'your account'}`,
              description: 'Your Google token has expired or been revoked. Please log out and log back in to re-authorize Google access.',
            },
          });
        }
      } catch {
        // Non-critical
      }
    } else {
      console.warn(`[token-cache] Transient error for ${userId} — keeping token valid for retry`);
    }

    cache.delete(userId);
    return null;
  }
}

/**
 * Determine if a token refresh error is definitive (token truly revoked/expired)
 * vs transient (network timeout, server error, etc.).
 * Only definitive errors should permanently invalidate the stored refresh token.
 */
function isDefinitiveTokenError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const definitivePatterns = [
    'invalid_grant',
    'Token has been expired or revoked',
    'Token has been revoked',
    'invalid_client',
    'unauthorized_client',
    'access_denied',
  ];
  return definitivePatterns.some((pattern) => message.includes(pattern));
}
