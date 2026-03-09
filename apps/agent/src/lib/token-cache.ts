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
    console.log(`[token-cache] doRefresh START for userId=${userId}`);

    const record = await prisma.userGoogleToken.findUnique({
      where: { userId, isValid: true },
    });

    if (!record) {
      console.log(`[token-cache] No valid token record in DB for userId=${userId}`);
      return null;
    }

    console.log(`[token-cache] Found token record for userId=${userId}, email=${record.email}, lastUsedAt=${record.lastUsedAt?.toISOString()}`);

    // Decrypt the stored refresh token
    let decryptedRefresh: string;
    try {
      decryptedRefresh = decryptToken(
        record.encryptedRefresh,
        record.iv,
        record.authTag
      );
      console.log(`[token-cache] Decryption OK for userId=${userId}, refresh token length=${decryptedRefresh.length}`);
    } catch (decryptErr) {
      console.error(`[token-cache] DECRYPTION FAILED for userId=${userId}:`, decryptErr instanceof Error ? decryptErr.message : String(decryptErr));
      throw decryptErr;
    }

    // Exchange refresh token for access token
    const oauth2Client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: decryptedRefresh });

    // Capture token rotation — Google may issue a new refresh token
    oauth2Client.on("tokens", (newTokens) => {
      if (newTokens.refresh_token) {
        console.log(`[token-cache] Google rotated refresh token for userId=${userId}`);
        const { encrypted, iv, authTag } = encryptToken(newTokens.refresh_token);
        prisma.userGoogleToken
          .update({
            where: { userId },
            data: { encryptedRefresh: encrypted, iv, authTag },
          })
          .then(() => console.log(`[token-cache] Saved rotated refresh token for ${userId}`))
          .catch((err) => console.error(`[token-cache] Failed to save rotated token:`, err));
      }
    });

    console.log(`[token-cache] Calling Google OAuth2 getAccessToken for userId=${userId}...`);
    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      console.warn(`[token-cache] No access token returned for ${userId} (no error thrown). HTTP status: ${tokenResponse.res?.status}`);
      return null;
    }

    console.log(`[token-cache] doRefresh SUCCESS for userId=${userId}`);

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
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : 'n/a';
    const errorStatus = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 'n/a';
    console.error(
      `[token-cache] doRefresh FAILED for userId=${userId}: "${errorMessage}" code=${errorCode} status=${errorStatus}`
    );

    // Only permanently invalidate on definitive errors (token revoked/expired).
    // Transient network errors should NOT burn the token.
    const isDefinitive = isDefinitiveTokenError(err);

    if (isDefinitive) {
      console.warn(
        `[token-cache] Definitive error for ${userId} — marking token invalid. ` +
        `Error: "${errorMessage}"`
      );
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
              description: 'Your Google token has expired or been revoked. Click "Connect Google" to re-authorize access.',
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
