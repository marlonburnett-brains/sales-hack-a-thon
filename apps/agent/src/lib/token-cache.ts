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

// Track first failure timestamp per user. A token is only permanently
// invalidated if definitive errors persist for longer than this window.
// This prevents hot-reload (server restart) from immediately burning tokens
// on the first refresh attempt — the second attempt after the cooldown
// window will invalidate if the token is truly expired/revoked.
const firstFailureAt = new Map<string, number>();
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Track consecutive definitive failures per user. Require multiple failures
// AFTER the cooldown window before invalidating, to protect against transient
// Google errors that happen to match definitive patterns.
const consecutiveFailures = new Map<string, number>();
const REQUIRED_CONSECUTIVE_FAILURES = 3;

/**
 * Reset all in-memory state for a user's token.
 *
 * MUST be called when a new refresh token is stored (POST /tokens)
 * to prevent stale failure tracking from prematurely invalidating
 * the freshly stored token.
 *
 * Without this, the following bug occurs:
 * 1. doRefresh fails at T=0 -> firstFailureAt set
 * 2. User re-authenticates at T=3min -> new token stored in DB
 * 3. firstFailureAt is NOT cleared (it's in-memory, POST /tokens doesn't know about it)
 * 4. At T=5min, doRefresh is called -> fails for any reason -> cooldown check:
 *    5min - 0min >= 5min -> TOKEN INVALIDATED immediately, despite being freshly stored
 *
 * This function breaks that chain by clearing all failure state.
 */
export function resetTokenState(userId: string): void {
  cache.delete(userId);
  firstFailureAt.delete(userId);
  consecutiveFailures.delete(userId);
  console.log(`[token-cache] Reset all in-memory state for userId=${userId} (new token stored)`);
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

    // Reset ALL failure tracking on success
    firstFailureAt.delete(userId);
    consecutiveFailures.delete(userId);

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

    // Classify the error
    const errorClass = classifyTokenError(err);

    if (errorClass === 'config') {
      // Configuration error — never invalidate, just log loudly
      console.error(
        `[token-cache] CLIENT CONFIGURATION ERROR for userId=${userId}: "${errorMessage}". ` +
        `Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET match the Supabase Google provider config. ` +
        `NOT invalidating user token — this is a server-side configuration issue.`
      );
    } else if (errorClass === 'definitive') {
      // Definitive token error — use cooldown + consecutive failure guard
      const now = Date.now();
      const existingFirst = firstFailureAt.get(userId);
      const failures = (consecutiveFailures.get(userId) ?? 0) + 1;
      consecutiveFailures.set(userId, failures);

      if (!existingFirst) {
        // First failure — record timestamp, don't invalidate yet
        firstFailureAt.set(userId, now);
        console.warn(
          `[token-cache] Definitive error for ${userId} — first occurrence (failure #${failures}), ` +
          `will invalidate after ${FAILURE_COOLDOWN_MS / 1000}s AND ${REQUIRED_CONSECUTIVE_FAILURES} consecutive failures. ` +
          `Error: "${errorMessage}"`
        );
      } else if (now - existingFirst < FAILURE_COOLDOWN_MS) {
        // Within cooldown window — keep token valid
        console.warn(
          `[token-cache] Definitive error for ${userId} — within cooldown window ` +
          `(${Math.round((now - existingFirst) / 1000)}s / ${FAILURE_COOLDOWN_MS / 1000}s), ` +
          `failure #${failures}/${REQUIRED_CONSECUTIVE_FAILURES}, ` +
          `keeping token valid. Error: "${errorMessage}"`
        );
      } else if (failures < REQUIRED_CONSECUTIVE_FAILURES) {
        // Past cooldown but not enough consecutive failures
        console.warn(
          `[token-cache] Definitive error for ${userId} — past cooldown but only ${failures}/${REQUIRED_CONSECUTIVE_FAILURES} ` +
          `consecutive failures, keeping token valid. Error: "${errorMessage}"`
        );
      } else {
        // Past cooldown AND enough consecutive failures — token is truly bad
        console.warn(
          `[token-cache] Definitive error for ${userId} — persisted for ${Math.round((now - existingFirst) / 1000)}s ` +
          `with ${failures} consecutive failures, marking token invalid. Error: "${errorMessage}"`
        );
        firstFailureAt.delete(userId);
        consecutiveFailures.delete(userId);
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
      }
    } else {
      // Transient error — never invalidate
      console.warn(`[token-cache] Transient error for ${userId} — keeping token valid for retry. Error: "${errorMessage}"`);
    }

    cache.delete(userId);
    return null;
  }
}

/**
 * Classify a token refresh error into one of three categories:
 * - 'config': Server configuration problem (wrong client ID/secret). NEVER invalidate.
 * - 'definitive': The refresh token itself is expired/revoked. Invalidate after safeguards.
 * - 'transient': Network error, timeout, server error. NEVER invalidate.
 *
 * IMPORTANT: 'invalid_grant' can mean EITHER:
 * (a) The refresh token was truly revoked/expired (user-facing issue)
 * (b) The refresh token was issued by a different OAuth client than GOOGLE_CLIENT_ID
 *     (server configuration issue — same symptom as invalid_client but different error code)
 *
 * We treat invalid_grant as definitive but require multiple consecutive failures
 * plus a cooldown window before invalidating, which protects against case (b)
 * because the admin/developer will see the repeated error logs and fix the config.
 */
function classifyTokenError(err: unknown): 'config' | 'definitive' | 'transient' {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  // Configuration errors — wrong client ID/secret. This is a deployment problem,
  // NOT the user's fault. Don't burn their token.
  if (lower.includes('invalid_client') || lower.includes('unauthorized_client')) {
    return 'config';
  }

  // Definitive token errors — the refresh token itself is truly expired/revoked
  // (or possibly a client ID mismatch, which also returns invalid_grant).
  const definitivePatterns = [
    'invalid_grant',
    'token has been expired or revoked',
    'token has been revoked',
  ];
  if (definitivePatterns.some((pattern) => lower.includes(pattern))) {
    return 'definitive';
  }

  // Everything else is transient
  return 'transient';
}
