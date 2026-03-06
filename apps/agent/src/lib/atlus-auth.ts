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
