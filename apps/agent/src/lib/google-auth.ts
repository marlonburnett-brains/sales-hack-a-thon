import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from './db'
import { decryptToken } from './token-encryption'
import { encryptToken } from './token-encryption'
import { env } from '../env'

// ────────────────────────────────────────────────────────────
// Dual-mode Google API client factories
// ────────────────────────────────────────────────────────────

export interface GoogleAuthOptions {
  accessToken?: string;
  userId?: string;
}

function getGoogleAuth() {
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  })
}

/**
 * Create an OAuth2Client with the user's access token.
 * Returns null if no access token is provided.
 */
function getUserAuth(options: GoogleAuthOptions): OAuth2Client | null {
  if (options.accessToken) {
    const client = new OAuth2Client()
    client.setCredentials({ access_token: options.accessToken })
    return client
  }
  return null
}

export function getSlidesClient(options?: GoogleAuthOptions) {
  const auth = options ? getUserAuth(options) ?? getGoogleAuth() : getGoogleAuth()
  return google.slides({ version: 'v1', auth })
}

export function getDriveClient(options?: GoogleAuthOptions) {
  // Use Drive API v3 — NOT v2 (some Google examples show v2 but use v3 for new code)
  const auth = options ? getUserAuth(options) ?? getGoogleAuth() : getGoogleAuth()
  return google.drive({ version: 'v3', auth })
}

export function getDocsClient(options?: GoogleAuthOptions) {
  const auth = options ? getUserAuth(options) ?? getGoogleAuth() : getGoogleAuth()
  return google.docs({ version: 'v1', auth })
}

// Lightweight auth verification — call this to confirm credentials before running the spike
export async function verifyGoogleAuth(): Promise<boolean> {
  try {
    const auth = getGoogleAuth()
    const client = await auth.getClient()
    const token = await client.getAccessToken()
    return !!token.token
  } catch {
    return false
  }
}

// ────────────────────────────────────────────────────────────
// Token Pool — iterates user refresh tokens before falling
// back to service account for background jobs
// ────────────────────────────────────────────────────────────

export interface PooledAuthResult {
  accessToken?: string;
  source: 'pool' | 'service_account';
  userId?: string;
}

/**
 * Get an access token from the pool of stored user refresh tokens.
 * Iterates ALL valid tokens ordered by lastUsedAt DESC.
 * Falls back to service account when the pool is exhausted.
 *
 * Side effects:
 * - On success: updates lastUsedAt (fire-and-forget)
 * - On failure: marks token isValid=false, creates reauth_needed ActionRequired
 * - Token rotation: captures new refresh tokens via OAuth2Client 'tokens' event
 * - Pool health: warns when < 3 valid tokens remain
 */
export async function getPooledGoogleAuth(): Promise<PooledAuthResult> {
  const tokens = await prisma.userGoogleToken.findMany({
    where: { isValid: true },
    orderBy: { lastUsedAt: 'desc' },
  })

  for (const token of tokens) {
    try {
      const refreshToken = decryptToken(token.encryptedRefresh, token.iv, token.authTag)

      const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
      client.setCredentials({ refresh_token: refreshToken })

      // LIFE-01: Capture token rotation from Google
      client.on('tokens', (newTokens) => {
        if (newTokens.refresh_token) {
          const { encrypted, iv, authTag } = encryptToken(newTokens.refresh_token)
          prisma.userGoogleToken.update({
            where: { id: token.id },
            data: { encryptedRefresh: encrypted, iv, authTag },
          }).catch(() => {})
        }
      })

      const tokenResponse = await client.getAccessToken()
      const accessToken = tokenResponse.token

      if (!accessToken) {
        throw new Error('No access token returned')
      }

      // POOL-04: Update lastUsedAt on success (fire-and-forget)
      prisma.userGoogleToken.update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {})

      // POOL-05: Check pool health after successful hit
      const validCount = await prisma.userGoogleToken.count({ where: { isValid: true } })
      if (validCount < 3) {
        console.warn(`[token-pool] WARNING: Only ${validCount} valid token(s) remaining in pool`)
      }

      return { accessToken, source: 'pool', userId: token.userId }
    } catch {
      // POOL-03: Mark token invalid on failure (fire-and-forget)
      prisma.userGoogleToken.update({
        where: { id: token.id },
        data: { isValid: false, revokedAt: new Date() },
      }).catch(() => {})

      // Create reauth_needed ActionRequired record
      try {
        const existing = await prisma.actionRequired.findFirst({
          where: { userId: token.userId, actionType: 'reauth_needed', resolved: false },
        })
        if (!existing) {
          await prisma.actionRequired.create({
            data: {
              userId: token.userId,
              actionType: 'reauth_needed',
              title: `Re-authentication needed for ${token.email}`,
              description: 'Your Google token has expired or been revoked. Please log out and log back in to re-authorize Google access.',
            },
          })
        }
      } catch {
        // Non-critical -- don't break pool iteration
      }
    }
  }

  // POOL-05: Check pool health when all tokens exhausted
  if (tokens.length > 0) {
    const validCount = await prisma.userGoogleToken.count({ where: { isValid: true } })
    if (validCount < 3) {
      console.warn(`[token-pool] WARNING: Only ${validCount} valid token(s) remaining in pool`)
    }
  }

  // Fall back to service account
  return { source: 'service_account' }
}
