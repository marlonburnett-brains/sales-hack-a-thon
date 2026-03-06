/**
 * AtlusAI Token CRUD Helpers
 *
 * Provides encrypted token storage/retrieval for AtlusAI credentials.
 * Uses the same AES-256-GCM encryption as Google token storage.
 *
 * NOTE: No pool rotation logic here — that belongs in Plan 27-02.
 */

import { prisma } from "./db";
import { encryptToken, decryptToken } from "./token-encryption";
import { ACTION_TYPES } from "@lumenalta/schemas";

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
