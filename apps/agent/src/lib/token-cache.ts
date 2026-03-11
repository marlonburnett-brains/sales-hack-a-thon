import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { decryptToken, encryptToken } from "./token-encryption";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// In-memory token cache for user Google access tokens
//
// Simple model: cache a valid access token for 50 min. When it
// expires, do ONE refresh attempt. If it fails, cache a negative
// result so we don't retry until the next cycle. The token is
// only permanently invalidated after sustained failures over a
// long window (10 min), ensuring transient errors or ingestion
// bursts never prematurely burn a token.
// ────────────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/** How long a successful access token is cached (Google tokens last 60 min). */
const TOKEN_TTL_MS = 50 * 60 * 1000;

/** After a failed refresh, wait this long before trying again. */
const RETRY_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Only permanently invalidate a token if definitive errors persist for
 * longer than this window. This protects against hot-reload bursts,
 * transient Google outages, and client-ID mismatches.
 */
const INVALIDATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const MAX_CACHE_SIZE = 100;

// ── In-memory state ──────────────────────────────────────────

const cache = new Map<string, CachedToken>();

/** Per-user promise dedup to prevent concurrent refresh races. */
const inflightRefreshes = new Map<string, Promise<string | null>>();

/**
 * Negative cache: timestamp of last definitive failure per user.
 * While active, getAccessTokenForUser returns null immediately
 * (caller falls back to service account). This is the key mechanism
 * that prevents the ingestion queue from hammering doRefresh
 * on every template and accumulating failures.
 */
const lastFailedAt = new Map<string, number>();

/**
 * Timestamp of the FIRST definitive failure in the current failure
 * streak. Cleared on success or resetTokenState. Used to decide
 * when a token is truly dead (failure streak > INVALIDATION_WINDOW_MS).
 */
const firstFailureAt = new Map<string, number>();

// ── Public API ───────────────────────────────────────────────

/**
 * Get a valid Google access token for a user.
 *
 * Flow per cycle:
 *   1. Return cached access token if still valid (50 min TTL)
 *   2. If in negative-cache window (recent failure), return null
 *   3. Otherwise, attempt ONE refresh
 *   4. On success → cache for 50 min, clear failure state
 *   5. On failure → negative-cache for 2 min, track failure streak
 *   6. If failure streak exceeds 10 min → permanently invalidate
 */
export async function getAccessTokenForUser(
  userId: string
): Promise<string | null> {
  sweepExpiredIfNeeded();

  // 1. Valid cache hit
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  // 2. Negative cache — recent failure, don't retry yet
  const failTs = lastFailedAt.get(userId);
  if (failTs && Date.now() - failTs < RETRY_INTERVAL_MS) {
    return null;
  }

  // 3. One refresh attempt (dedup concurrent calls)
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

/**
 * Reset all in-memory state for a user's token.
 *
 * MUST be called when a new refresh token is stored (POST /tokens)
 * so that stale failure tracking never carries over to the freshly
 * stored token.
 */
export function resetTokenState(userId: string): void {
  cache.delete(userId);
  lastFailedAt.delete(userId);
  firstFailureAt.delete(userId);
  inflightRefreshes.delete(userId);
  console.log(`[token-cache] Reset all in-memory state for userId=${userId} (new token stored)`);
}

// ── Internals ────────────────────────────────────────────────

function sweepExpiredIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
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

    console.log(`[token-cache] Found token record for userId=${userId}, email=${record.email}`);

    // Decrypt the stored refresh token
    let decryptedRefresh: string;
    try {
      decryptedRefresh = decryptToken(
        record.encryptedRefresh,
        record.iv,
        record.authTag
      );
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

    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      console.warn(`[token-cache] No access token returned for ${userId} (no error thrown)`);
      return null;
    }

    console.log(`[token-cache] doRefresh SUCCESS for userId=${userId}`);

    // ── Success: cache token, clear all failure state ──
    firstFailureAt.delete(userId);
    lastFailedAt.delete(userId);

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
      .catch(() => {});

    return accessToken;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : 'n/a';
    const errorStatus = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 'n/a';
    console.error(
      `[token-cache] doRefresh FAILED for userId=${userId}: "${errorMessage}" code=${errorCode} status=${errorStatus}`
    );

    const errorClass = classifyTokenError(err);

    if (errorClass === 'config') {
      // Wrong client ID/secret — NEVER invalidate, loud log
      console.error(
        `[token-cache] CONFIG ERROR for userId=${userId}: "${errorMessage}". ` +
        `Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. NOT invalidating.`
      );
    } else if (errorClass === 'definitive') {
      // Refresh token is expired/revoked (or looks like it).
      // Set negative cache so we don't retry for RETRY_INTERVAL_MS.
      const now = Date.now();
      lastFailedAt.set(userId, now);

      const streakStart = firstFailureAt.get(userId);
      if (!streakStart) {
        // First failure in this streak
        firstFailureAt.set(userId, now);
        console.warn(
          `[token-cache] Definitive error for ${userId} — first failure, ` +
          `will retry in ${RETRY_INTERVAL_MS / 1000}s. ` +
          `Will only invalidate if failures persist for ${INVALIDATION_WINDOW_MS / 1000}s. ` +
          `Error: "${errorMessage}"`
        );
      } else if (now - streakStart < INVALIDATION_WINDOW_MS) {
        // Streak ongoing but not long enough to invalidate
        console.warn(
          `[token-cache] Definitive error for ${userId} — streak ${Math.round((now - streakStart) / 1000)}s / ` +
          `${INVALIDATION_WINDOW_MS / 1000}s, keeping token valid. Error: "${errorMessage}"`
        );
      } else {
        // Streak exceeded window — token is truly dead
        console.warn(
          `[token-cache] Definitive error for ${userId} — streak ${Math.round((now - streakStart) / 1000)}s ` +
          `exceeds ${INVALIDATION_WINDOW_MS / 1000}s window, marking token INVALID. Error: "${errorMessage}"`
        );
        firstFailureAt.delete(userId);

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
      // Transient (network, timeout, server error) — never invalidate
      // Set negative cache so we don't hammer Google
      lastFailedAt.set(userId, Date.now());
      console.warn(`[token-cache] Transient error for ${userId} — retry in ${RETRY_INTERVAL_MS / 1000}s. Error: "${errorMessage}"`);
    }

    cache.delete(userId);
    return null;
  }
}

/**
 * Classify a token refresh error:
 * - 'config': Wrong client ID/secret. NEVER invalidate.
 * - 'definitive': Refresh token expired/revoked. Invalidate after sustained streak.
 * - 'transient': Network/timeout/server error. NEVER invalidate.
 */
function classifyTokenError(err: unknown): 'config' | 'definitive' | 'transient' {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('invalid_client') || lower.includes('unauthorized_client')) {
    return 'config';
  }

  const definitivePatterns = [
    'invalid_grant',
    'token has been expired or revoked',
    'token has been revoked',
  ];
  if (definitivePatterns.some((pattern) => lower.includes(pattern))) {
    return 'definitive';
  }

  return 'transient';
}
