import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { decryptToken } from "./token-encryption";
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

    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      // Refresh failed with no token returned -- mark as invalid
      await prisma.userGoogleToken.update({
        where: { userId },
        data: { isValid: false, revokedAt: new Date() },
      });
      cache.delete(userId);
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
    // Refresh token exchange failed (revoked, expired, etc.)
    console.error(
      `[token-cache] Failed to refresh token for user ${userId}:`,
      err
    );

    // Mark token as invalid
    await prisma.userGoogleToken
      .update({
        where: { userId },
        data: { isValid: false, revokedAt: new Date() },
      })
      .catch(() => {
        // DB update failed too -- nothing we can do
      });

    cache.delete(userId);
    return null;
  }
}
