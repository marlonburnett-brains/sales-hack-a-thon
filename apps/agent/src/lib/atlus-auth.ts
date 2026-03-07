/**
 * AtlusAI Token CRUD Helpers + Pool Rotation
 *
 * Provides encrypted token storage/retrieval for AtlusAI credentials.
 * Uses the same AES-256-GCM encryption as Google token storage.
 * Pool rotation iterates valid tokens for background processes,
 * falling back to ATLUS_API_TOKEN env var when the pool is exhausted.
 */

import { prisma } from "./db";
import { encryptToken, decryptToken } from "./token-encryption";
import { ACTION_TYPES } from "@lumenalta/schemas";

// ────────────────────────────────────────────────────────────
// Pool rotation types
// ────────────────────────────────────────────────────────────

export interface PooledAtlusAuthResult {
  token: string;
  refreshToken?: string;
  source: "pool" | "env";
  userId?: string;
  clientId?: string;
}

/**
 * Parse a stored AtlusAI token value.
 * OAuth tokens are stored as JSON: {"access_token":"...","refresh_token":"..."}
 * Legacy/env tokens are plain strings.
 */
function parseStoredToken(raw: string): {
  accessToken: string;
  refreshToken?: string;
} {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.access_token === "string") {
      return {
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token ?? undefined,
      };
    }
  } catch {
    // Not JSON — treat as plain token string (legacy or env fallback)
  }
  return { accessToken: raw };
}

/**
 * Upsert an AtlusAI token for a user.
 * Encrypts the raw token before storing, using AES-256-GCM via token-encryption.ts.
 *
 * @param userId  - Supabase Auth user ID
 * @param email   - User email (for logging/debugging)
 * @param rawToken - Plaintext AtlusAI token to encrypt and store
 */
export async function upsertAtlusToken(
  userId: string,
  email: string,
  rawToken: string,
): Promise<void> {
  const { encrypted, iv, authTag } = encryptToken(rawToken);

  await prisma.userAtlusToken.upsert({
    where: { userId },
    create: {
      userId,
      email,
      encryptedToken: encrypted,
      iv,
      authTag,
    },
    update: {
      encryptedToken: encrypted,
      iv,
      authTag,
      email,
      isValid: true,
      revokedAt: null,
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Decrypt an AtlusAI token record's encrypted fields.
 * Thin wrapper around decryptToken for readability at call sites.
 */
export function decryptAtlusToken(token: {
  encryptedToken: string;
  iv: string;
  authTag: string;
}): string {
  return decryptToken(token.encryptedToken, token.iv, token.authTag);
}

/**
 * Upsert an ActionRequired record with dedup and re-surface semantics.
 *
 * - Dedup: Only one unresolved record per userId + actionType at a time (TIER-05)
 * - Re-surface: If a matching record exists, un-silence it, bump updatedAt,
 *   and refresh title/description in case wording has changed
 *
 * @param userId     - Supabase Auth user ID
 * @param actionType - One of ACTION_TYPES values
 * @param title      - Human-readable action title
 * @param description - Guidance text explaining what the user needs to do
 */
export async function upsertActionRequired(
  userId: string,
  actionType: string,
  title: string,
  description: string,
): Promise<void> {
  const existing = await prisma.actionRequired.findFirst({
    where: { userId, actionType, resolved: false },
  });

  if (existing) {
    // Re-surface: un-silence, bump timestamp, update wording
    await prisma.actionRequired.update({
      where: { id: existing.id },
      data: { updatedAt: new Date(), silenced: false, title, description },
    });
  } else {
    await prisma.actionRequired.create({
      data: { userId, actionType, title, description },
    });
  }
}

/**
 * Resolve all unresolved ActionRequired records of a given type for a user.
 *
 * Used for auto-resolve: when the system detects the underlying issue is fixed,
 * affected items disappear immediately from the user's action list.
 *
 * @param userId     - Supabase Auth user ID
 * @param actionType - The action type to resolve
 */
export async function resolveActionsByType(
  userId: string,
  actionType: string,
): Promise<void> {
  await prisma.actionRequired.updateMany({
    where: { userId, actionType, resolved: false },
    data: { resolved: true, resolvedAt: new Date() },
  });
}

// ────────────────────────────────────────────────────────────
// 3-Tier AtlusAI Access Detection
// ────────────────────────────────────────────────────────────

const ATLUS_SSE_ENDPOINT = "https://knowledge-base-api.lumenalta.com/sse";
const ATLUS_PROBE_TIMEOUT = 5_000; // 5 seconds

/**
 * 3-tier AtlusAI access detection cascade.
 *
 * Tier 1: Auth probe -- can the token authenticate with AtlusAI SSE endpoint?
 * Tier 2: Project probe -- does the authenticated user have project access?
 * Tier 3: Full access -- store the token for pooled use.
 *
 * Each tier creates/resolves ActionRequired records as appropriate.
 * Resolving a lower tier automatically checks higher tiers (cascading).
 *
 * @param userId      - Supabase Auth user ID
 * @param email       - User email for action descriptions
 * @param accessToken - AtlusAI OAuth access token (or Google token for legacy callers)
 * @returns The detected access level
 */
export async function detectAtlusAccess(
  userId: string,
  email: string,
  accessToken: string,
): Promise<"full_access" | "no_account" | "no_project"> {
  // -- Tier 1: Auth probe --
  let authOk = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ATLUS_PROBE_TIMEOUT);
    const res = await fetch(ATLUS_SSE_ENDPOINT, {
      headers: { Authorization: "Bearer " + accessToken },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    authOk = res.status !== 401 && res.status !== 403;
  } catch {
    // Network error or timeout -- treat as auth failure for safety
    authOk = false;
  }

  if (!authOk) {
    await upsertActionRequired(
      userId,
      ACTION_TYPES.ATLUS_ACCOUNT_REQUIRED,
      "AtlusAI account required",
      "Your account does not have access to AtlusAI. Click 'Connect to AtlusAI' to authenticate, or contact your administrator for access.",
    );
    return "no_account";
  }

  // Auth succeeded -- auto-resolve any existing account-required action
  await resolveActionsByType(userId, ACTION_TYPES.ATLUS_ACCOUNT_REQUIRED);

  // -- Tier 2: Project probe --
  let projectOk = false;
  try {
    const atlusProjectId = process.env.ATLUS_PROJECT_ID;
    if (!atlusProjectId) {
      // No project configured -- skip project check, treat as ok
      projectOk = true;
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ATLUS_PROBE_TIMEOUT);
      const res = await fetch(
        `https://knowledge-base-api.lumenalta.com/projects/${atlusProjectId}/tools`,
        {
          headers: { Authorization: "Bearer " + accessToken },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);
      projectOk = res.status !== 403 && res.ok;
    }
  } catch {
    projectOk = false;
  }

  if (!projectOk) {
    await upsertActionRequired(
      userId,
      ACTION_TYPES.ATLUS_PROJECT_REQUIRED,
      "AtlusAI project access required",
      "Your AtlusAI account does not have access to the configured project. Contact your administrator to request project access.",
    );
    return "no_project";
  }

  // Project access succeeded -- auto-resolve any existing project-required action
  await resolveActionsByType(userId, ACTION_TYPES.ATLUS_PROJECT_REQUIRED);

  // -- Tier 3: Full access --
  await upsertAtlusToken(userId, email, accessToken);
  return "full_access";
}

// ────────────────────────────────────────────────────────────
// OAuth Token Refresh
// ────────────────────────────────────────────────────────────

const ATLUS_TOKEN_ENDPOINT =
  "https://knowledge-base-api.lumenalta.com/auth/token";
const ATLUS_REGISTER_ENDPOINT =
  "https://knowledge-base-api.lumenalta.com/auth/register";

/** Cached dynamic client_id from agent-side registration */
let cachedRegistrationClientId: string | null = null;

/**
 * Refresh an AtlusAI OAuth access token using a refresh_token grant.
 *
 * @param refreshToken - The refresh token from the stored OAuth credential
 * @param clientId     - Dynamic client_id obtained via registerAtlusClient()
 * @returns New token pair on success, null on failure
 */
export async function refreshAtlusToken(
  refreshToken: string,
  clientId: string,
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const res = await fetch(ATLUS_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
    };
    return data;
  } catch {
    return null;
  }
}

/**
 * Re-encrypt and update a user's AtlusAI token in the database after
 * a successful token refresh.
 *
 * @param userId       - Supabase Auth user ID
 * @param newTokenJson - Stringified JSON `{ access_token, refresh_token }`
 */
export async function updateAtlusTokenInDb(
  userId: string,
  newTokenJson: string,
): Promise<void> {
  const { encrypted, iv, authTag } = encryptToken(newTokenJson);
  await prisma.userAtlusToken.update({
    where: { userId },
    data: {
      encryptedToken: encrypted,
      iv,
      authTag,
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Persist the OAuth client_id for a user's AtlusAI token record.
 * Called after successful dynamic client registration so that subsequent
 * restarts can reuse the client_id without re-registering.
 *
 * @param userId   - Supabase Auth user ID
 * @param clientId - Dynamic client_id from registerAtlusClient()
 */
export async function persistAtlusClientId(
  userId: string,
  clientId: string,
): Promise<void> {
  await prisma.userAtlusToken.update({
    where: { userId },
    data: { clientId },
  });
}

/**
 * Perform agent-side dynamic client registration with AtlusAI.
 * Required to obtain a client_id for refresh_token grants (Pitfall 5).
 * Result is cached -- only registers once per process lifetime.
 *
 * @returns `{ client_id }` on success, null on failure
 */
export async function registerAtlusClient(): Promise<{
  client_id: string;
} | null> {
  if (cachedRegistrationClientId) {
    return { client_id: cachedRegistrationClientId };
  }

  try {
    const res = await fetch(ATLUS_REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://localhost"],
        token_endpoint_auth_method: "none",
        grant_types: ["refresh_token"],
        response_types: ["code"],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { client_id: string };
    cachedRegistrationClientId = data.client_id;
    return data;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Token Pool — iterates user tokens before falling back to
// ATLUS_API_TOKEN env var for background jobs
// ────────────────────────────────────────────────────────────

/**
 * Get an AtlusAI token from the pool of stored user tokens.
 * Iterates ALL valid tokens ordered by lastUsedAt DESC.
 * Falls back to ATLUS_API_TOKEN env var when the pool is exhausted.
 *
 * Side effects:
 * - On success: updates lastUsedAt (fire-and-forget)
 * - On failure: marks token isValid=false with revokedAt (fire-and-forget)
 * - Pool health: warns when < 3 valid tokens remain
 *
 * NOTE: Does NOT create ActionRequired on failure — that is Plan 27-03's job.
 */
export async function getPooledAtlusAuth(): Promise<PooledAtlusAuthResult | null> {
  const tokens = await prisma.userAtlusToken.findMany({
    where: { isValid: true },
    orderBy: { lastUsedAt: "desc" },
  });

  for (const token of tokens) {
    try {
      const decrypted = decryptToken(token.encryptedToken, token.iv, token.authTag);
      const { accessToken, refreshToken } = parseStoredToken(decrypted);

      // POOL-04: Update lastUsedAt on success (fire-and-forget)
      prisma.userAtlusToken
        .update({
          where: { id: token.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      // POOL-05: Check pool health after successful hit
      const validCount = await prisma.userAtlusToken.count({
        where: { isValid: true },
      });
      if (validCount < 3) {
        console.warn(
          `[atlus-pool] WARNING: Only ${validCount} valid token(s) remaining`,
        );
      }

      return { token: accessToken, refreshToken, source: "pool", userId: token.userId, clientId: token.clientId ?? undefined };
    } catch {
      // POOL-03: Mark token invalid on failure (fire-and-forget)
      prisma.userAtlusToken
        .update({
          where: { id: token.id },
          data: { isValid: false, revokedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  // POOL-05: Check pool health when all tokens exhausted
  if (tokens.length > 0) {
    const validCount = await prisma.userAtlusToken.count({
      where: { isValid: true },
    });
    if (validCount < 3) {
      console.warn(
        `[atlus-pool] WARNING: Only ${validCount} valid token(s) remaining`,
      );
    }
  }

  // Fall back to ATLUS_API_TOKEN env var
  const envToken = process.env.ATLUS_API_TOKEN;
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  return null;
}
