import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
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
