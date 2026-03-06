# Research Summary: v1.3 Google API Auth — User-Delegated Credentials

**Project:** Lumenalta Agentic Sales Orchestration
**Milestone:** v1.3
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

The v1.3 milestone replaces the Google service account with user-delegated credentials for all Google API access. The current architecture uses a service account key (`GOOGLE_SERVICE_ACCOUNT_KEY`) in `apps/agent/src/lib/google-auth.ts` to create Drive, Slides, and Docs clients. This works for files directly shared with the service account but fails for org-wide shared files accessible to any @lumenalta.com user (the majority of content templates).

The solution: capture Google OAuth tokens during Supabase login, store encrypted refresh tokens per user, and use those tokens for Google API calls. Interactive requests use the logged-in user's token passed through the web->agent API. Background jobs draw from a pool of stored refresh tokens with ordered fallback.

## Current Architecture (What Exists)

### Google API Auth (agent)
- `apps/agent/src/lib/google-auth.ts` — single file, 4 exports:
  - `getGoogleAuth()` — creates `GoogleAuth` from `GOOGLE_SERVICE_ACCOUNT_KEY` env var
  - `getSlidesClient()`, `getDriveClient()`, `getDocsClient()` — create API clients with service account auth
  - `verifyGoogleAuth()` — lightweight auth verification
- Scopes: `presentations`, `drive`, `documents`
- Used by 14+ files across the agent (workflows, ingestion, lib modules)

### User Auth (web)
- Supabase Auth with Google OAuth provider (`signInWithOAuth({ provider: "google" })`)
- Login page: `apps/web/src/app/login/page.tsx` — no extra scopes requested, no offline access
- Auth callback: `apps/web/src/app/auth/callback/route.ts` — exchanges code for session, enforces @lumenalta.com domain
- Middleware: `apps/web/src/middleware.ts` — refreshes auth token, redirects unauthenticated users

### Web->Agent Communication
- `apps/web/src/lib/api-client.ts` — all requests use `Authorization: Bearer ${env.AGENT_API_KEY}` (service-to-service)
- No user identity or Google token is passed to the agent

### Key Gaps
1. **No Google scopes on user login** — Supabase OAuth login doesn't request Drive/Slides/Docs scopes
2. **No offline access** — no refresh tokens captured or stored
3. **No token passthrough** — web doesn't send user's Google token to agent
4. **No token storage** — no database model for encrypted refresh tokens
5. **No token pool** — no mechanism for background jobs to use stored user tokens

## Approach

### Phase 1: Supabase OAuth Scope Expansion + Token Capture

**Supabase OAuth scopes** are configured in the Supabase Dashboard (Authentication > Providers > Google), NOT in client code. The `signInWithOAuth` call in the login page can pass `scopes` in options to request additional Google OAuth scopes at login time:

```typescript
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    scopes: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/presentations.readonly https://www.googleapis.com/auth/documents.readonly",
    queryParams: {
      access_type: "offline",
      prompt: "consent",  // Force consent screen to get refresh token
      hd: "lumenalta.com",
    },
    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
  },
});
```

**Token capture**: After `exchangeCodeForSession`, Supabase stores the provider token in the session. Access it via:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const providerToken = session?.provider_token;      // Google access token
const providerRefreshToken = session?.provider_refresh_token;  // Google refresh token (only on first consent)
```

**Critical**: `provider_refresh_token` is only returned on the FIRST consent or when `prompt: "consent"` forces re-consent. Store it immediately in the auth callback.

### Phase 2: Encrypted Refresh Token Storage

New Prisma model:
```prisma
model UserGoogleToken {
  id               String    @id @default(cuid())
  userId           String    @unique  // Supabase Auth user ID
  email            String    // User email for pool selection
  encryptedRefresh String    // AES-256-GCM encrypted refresh token
  iv               String    // Initialization vector for decryption
  authTag          String    // GCM auth tag
  lastUsedAt       DateTime  @default(now())
  isValid          Boolean   @default(true)
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([isValid, lastUsedAt])
  @@index([email])
}
```

**Encryption**: Use Node.js built-in `crypto` module with AES-256-GCM. Key derived from a new `GOOGLE_TOKEN_ENCRYPTION_KEY` env var (32-byte hex string). No new dependencies needed.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(env.GOOGLE_TOKEN_ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encryptToken(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return { encrypted, iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

export function decryptToken(encrypted: string, iv: string, authTag: string): string {
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Phase 3: User-Delegated Google API Clients

Modify `google-auth.ts` to support both service account and user token auth:

```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Existing: service account (now fallback)
function getServiceAccountAuth() { /* existing code */ }

// New: user-delegated auth from access token
function getUserAuth(accessToken: string): OAuth2Client {
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

// New: user-delegated auth from refresh token
async function getRefreshTokenAuth(refreshToken: string): Promise<OAuth2Client> {
  const oauth2Client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  // Force token refresh to get fresh access token
  await oauth2Client.getAccessToken();
  return oauth2Client;
}

// Updated exports: accept optional user token
export function getSlidesClient(accessToken?: string) {
  const auth = accessToken ? getUserAuth(accessToken) : getServiceAccountAuth();
  return google.slides({ version: 'v1', auth });
}
// Same pattern for getDriveClient, getDocsClient
```

**google-auth-library**: The `OAuth2Client` class is included in the `googleapis` package (transitive dependency via `google-auth-library`). No new installation needed.

**Google Client ID/Secret**: Already configured in Supabase Dashboard for OAuth. Need to add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars to the agent service for refresh token exchanges.

### Phase 4: Web->Agent Token Passthrough

Modify `api-client.ts` to include the user's Google access token:

```typescript
async function fetchJSON<T>(path: string, init?: RequestInit, googleToken?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.AGENT_API_KEY}`,
  };
  if (googleToken) {
    headers["X-Google-Access-Token"] = googleToken;
  }
  // ... rest unchanged
}
```

The web app retrieves the Google token from the Supabase session:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const googleToken = session?.provider_token;
```

Agent routes extract from the header and pass to Google API client factories.

### Phase 5: Background Job Token Pool

For background jobs (staleness polling, scheduled re-ingestion):

```typescript
async function getPooledGoogleAuth(): Promise<OAuth2Client> {
  // Get the most recently active valid token
  const tokens = await prisma.userGoogleToken.findMany({
    where: { isValid: true },
    orderBy: { lastUsedAt: 'desc' },
    take: 5, // Try up to 5 tokens
  });

  for (const token of tokens) {
    try {
      const refreshToken = decryptToken(token.encryptedRefresh, token.iv, token.authTag);
      const auth = await getRefreshTokenAuth(refreshToken);
      // Update lastUsedAt on success
      await prisma.userGoogleToken.update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      });
      return auth;
    } catch (error) {
      // Mark token as invalid if refresh fails
      await prisma.userGoogleToken.update({
        where: { id: token.id },
        data: { isValid: false, revokedAt: new Date() },
      });
    }
  }
  throw new Error('No valid Google tokens in pool');
}
```

**Health alerting**: Log warning when pool drops below 2 valid tokens. Could surface in a future admin UI.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| AES-256-GCM via Node `crypto` | Built-in, no new dependencies. GCM provides authenticated encryption. |
| Refresh tokens over access tokens for storage | Access tokens expire in ~1 hour. Refresh tokens last until revoked. |
| `X-Google-Access-Token` header for passthrough | Keeps service-to-service auth (`Authorization: Bearer`) separate from user Google token. |
| Read-only scopes (`drive.readonly`, `presentations.readonly`, `documents.readonly`) | The system reads templates and content; writes go to service account's shared Drive. Start narrow, expand if needed. |
| `prompt: "consent"` on login | Forces Google consent screen every login to ensure refresh token is returned. Without this, refresh token is only returned on first-ever consent. |
| Pool with ordered fallback | Simple, predictable. Most recently active user's token is most likely valid. |

## Pitfalls

### 1. Supabase Doesn't Persist Provider Tokens Across Sessions
Supabase only includes `provider_token` in the session immediately after OAuth login. On subsequent `getSession()` calls, the provider token may not be present if the session was refreshed via Supabase's own refresh mechanism (which refreshes the Supabase JWT, not the Google token).

**Mitigation**: Capture and store the refresh token in the auth callback (one-time). For interactive requests, if `provider_token` is not in the session, use the stored refresh token to get a fresh access token.

### 2. Refresh Token Rotation
Google may rotate refresh tokens. When a new refresh token is issued during a token refresh, the old one is invalidated. The token pool must handle this by updating the stored token when a new one is received.

**Mitigation**: After every successful token refresh, check if a new refresh token was issued and update the database.

### 3. Scope Consent Changes Require Re-login
Adding new OAuth scopes means existing users must re-login and re-consent. Existing sessions won't have the new scopes.

**Mitigation**: On first deployment, all users will need to log out and log back in. The auth callback should handle gracefully when no refresh token is present (new scopes not yet consented).

### 4. Google Client ID/Secret for Agent Service
The agent needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to exchange refresh tokens for access tokens. These are the same values configured in Supabase but must be added as env vars to the Railway agent service.

### 5. Write Access Scopes
Using `drive.readonly` means the system can't write to user's Drive. If deck generation needs to write to user-accessible folders (not just the service account's shared Drive), scopes need to be `drive` (full) or `drive.file`.

**Current assessment**: All writes currently go to the service account's shared Lumenalta Drive. Read-only scopes for user tokens should suffice for accessing org-shared templates.

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/login/page.tsx` | Add Google OAuth scopes + offline access to `signInWithOAuth` |
| `apps/web/src/app/auth/callback/route.ts` | Capture provider_refresh_token, store encrypted in DB via agent API |
| `apps/web/src/lib/api-client.ts` | Add `X-Google-Access-Token` header support |
| `apps/web/src/lib/supabase/server.ts` | Helper to extract provider_token from session |
| `apps/agent/src/lib/google-auth.ts` | Add user-delegated auth + token pool + refresh token auth |
| `apps/agent/src/lib/token-encryption.ts` | New: AES-256-GCM encrypt/decrypt |
| `apps/agent/prisma/schema.prisma` | New: `UserGoogleToken` model |
| `apps/agent/src/mastra/index.ts` | New: token storage API routes, modify existing routes to accept Google token |
| All agent files using `getSlidesClient()`/`getDriveClient()`/`getDocsClient()` | Pass optional `accessToken` parameter |
| Server Actions that call agent API | Pass Google token from session |

## New Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | agent | 32-byte hex key for AES-256-GCM token encryption |
| `GOOGLE_CLIENT_ID` | agent | Google OAuth client ID (same as Supabase config) for refresh token exchange |
| `GOOGLE_CLIENT_SECRET` | agent | Google OAuth client secret for refresh token exchange |

## Dependencies

**No new npm dependencies required.** Everything needed is already installed:
- `googleapis` — includes `google-auth-library` with `OAuth2Client`
- `crypto` — Node.js built-in for AES-256-GCM encryption

---
*Research completed: 2026-03-06*
*Ready for requirements: yes*
