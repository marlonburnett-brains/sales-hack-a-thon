import { google } from 'googleapis'
import { env } from '../env'

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

export function getSlidesClient() {
  return google.slides({ version: 'v1', auth: getGoogleAuth() })
}

export function getDriveClient() {
  // Use Drive API v3 — NOT v2 (some Google examples show v2 but use v3 for new code)
  return google.drive({ version: 'v3', auth: getGoogleAuth() })
}

export function getDocsClient() {
  return google.docs({ version: 'v1', auth: getGoogleAuth() })
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
