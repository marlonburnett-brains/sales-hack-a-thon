# Phase 23: User-Delegated API Clients & Token Passthrough - Research

**Researched:** 2026-03-06
**Domain:** Google API OAuth2 user-delegated auth, Hono header passthrough, Next.js Server Actions
**Confidence:** HIGH

## Summary

Phase 23 modifies the existing Google API client factories (`getSlidesClient`, `getDriveClient`, `getDocsClient`) to accept optional user credentials and creates the web-to-agent token passthrough pipeline. The architecture has three layers: (1) web-side `getGoogleAccessToken()` + `fetchWithGoogleAuth()` helpers that attach `X-Google-Access-Token` and `X-User-Id` headers, (2) agent-side `extractGoogleAuth()` helper that reads these headers from Hono context, and (3) dual-mode factory functions that use `OAuth2Client` with user tokens or fall back to existing `GoogleAuth` service account.

A critical finding is that Supabase does NOT persist `provider_token` (Google access token) in session cookies -- it is only available at the moment of `exchangeCodeForSession`. This means for most requests the agent must use the stored refresh token to obtain a fresh access token. The priority chain becomes: `X-Google-Access-Token` (rare, only if session still fresh from login) -> `X-User-Id` (primary path -- agent decrypts stored refresh token and exchanges for access token) -> service account fallback. The `googleapis` library's `OAuth2Client.setCredentials({ refresh_token })` handles automatic token acquisition.

**Primary recommendation:** Build the agent-side refresh-to-access-token path as the primary mechanism, with direct access token passthrough as an optimization. Cache refreshed access tokens in a simple Map with ~50min TTL to avoid repeated Google token exchanges.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Primary: Access token from Supabase session (`provider_token`) sent as `X-Google-Access-Token` header
- Backup: When no access token in session, web sends `X-User-Id` header; agent retrieves stored refresh token, exchanges for access token
- Agent caches refreshed access tokens in memory with ~50min TTL (Google access tokens last 1h)
- Priority chain: `X-Google-Access-Token` header (use directly) -> `X-User-Id` header (agent-side refresh) -> service account fallback
- Web sends both headers when available; agent tries in priority order
- Graceful failure: when user's Google token fails (403, revoked, insufficient scopes), show toast with two actions: "Reconnect Google" and "Run in background"
- Browser-side retry queue: failed operations stored in React state; automatically retried when user reconnects Google
- New `getGoogleAccessToken()` helper in `lib/supabase/` -- calls `getSession()`, returns `{ accessToken, userId }`
- New `fetchWithGoogleAuth<T>()` wrapper in `api-client.ts` -- calls `getGoogleAccessToken()` + `fetchJSON()` with Google headers attached
- Google token headers sent only on Google-triggering requests (template ops, workflows, slides) -- not on CRUD operations
- Agent-side: shared `extractGoogleAuth(c)` helper reads both headers from Hono context
- Factory functions accept optional `{ accessToken?, userId?, mode? }` parameter
- With user credentials: use `OAuth2Client` with the access token or refreshed token
- Without: fall back to existing service account behavior (backward compatible, all 14+ existing callers unchanged)
- All interactive requests get user token passthrough

### Claude's Discretion
- Exact factory function signature design (mode parameter vs separate functions)
- In-memory cache implementation details (Map structure, cleanup strategy)
- Browser retry queue implementation (React state vs sessionStorage)
- Toast notification exact copy and timing
- Which specific agent routes need `extractGoogleAuth()` wired up
- "Run in background" endpoint design (Phase 23 uses service account; Phase 24 upgrades)

### Deferred Ideas (OUT OF SCOPE)
- Token pool with ordered fallback and health alerting -- Phase 24
- Background job token selection logic -- Phase 24
- Token management admin UI -- v2 requirement TMUI-01/02
- Write scope expansion for Drive output to user folders -- v2 requirement WRIT-01/02
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAPI-01 | `getSlidesClient()`, `getDriveClient()`, `getDocsClient()` accept optional `accessToken` parameter | OAuth2Client pattern with `setCredentials` -- see Architecture Patterns |
| GAPI-02 | When `accessToken` provided, use `OAuth2Client` with user's token instead of service account | `new OAuth2Client()` + `setCredentials({ access_token })` or `setCredentials({ refresh_token })` |
| GAPI-03 | When no `accessToken` provided, fall back to existing service account behavior | Default path unchanged -- optional parameter pattern |
| GAPI-04 | All existing callers (14+ files) continue working with no changes | Optional parameter with default `undefined` preserves existing call sites |
| PASS-01 | `fetchJSON` accepts optional Google access token, sends as `X-Google-Access-Token` header | New `fetchWithGoogleAuth()` wrapper alongside existing `fetchJSON` |
| PASS-02 | Agent routes extract `X-Google-Access-Token` header and pass to factories | `extractGoogleAuth(c)` helper reads `c.req.header()` |
| PASS-03 | Server Actions retrieve user's Google token from Supabase session | `getGoogleAccessToken()` helper using `getSession()` for `provider_token` + `getUser()` for userId |
| PASS-04 | Template ingestion, staleness checks, slide operations use user's Google token when available | Routes wired with `extractGoogleAuth()` -> factory parameter |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | ^144.0.0 | Google Slides/Drive/Docs API clients | Already installed; provides `OAuth2Client` for user-delegated auth |
| google-auth-library | ^9.15.1 | OAuth2Client class for token management | Already installed as googleapis dependency; handles refresh automatically |
| @supabase/ssr | (installed) | Server-side session access for `provider_token` | Already used in `apps/web/src/lib/supabase/server.ts` |
| sonner | ^2.0.7 | Toast notifications for auth failure UX | Already installed on web side |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (built-in) | Node.js | Token decryption (AES-256-GCM) | Agent-side refresh token retrieval from DB |
| zod | (installed) | Header validation in `extractGoogleAuth` | Optional but consistent with existing patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory Map cache | Redis/external cache | Overkill for ~20 users; Map is sufficient; restarts just trigger re-refresh |
| `fetchWithGoogleAuth` wrapper | Modifying `fetchJSON` signature | Separate function keeps non-Google calls clean and is the locked decision |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/lib/
├── google-auth.ts          # MODIFY: add OAuth2Client user-delegated path
├── token-encryption.ts     # EXISTING: decryptToken() for refresh token retrieval
├── request-auth.ts         # NEW: extractGoogleAuth(c) helper
└── token-cache.ts          # NEW: in-memory access token cache with TTL

apps/web/src/lib/
├── api-client.ts           # MODIFY: add fetchWithGoogleAuth() wrapper
├── supabase/
│   ├── server.ts           # EXISTING: createClient()
│   └── google-token.ts     # NEW: getGoogleAccessToken() helper
└── actions/
    ├── template-actions.ts # MODIFY: use fetchWithGoogleAuth for Google ops
    ├── slide-actions.ts    # MODIFY: use fetchWithGoogleAuth for Google ops
    └── touch-actions.ts    # MODIFY: use fetchWithGoogleAuth for Google ops
```

### Pattern 1: Dual-Mode Google API Factory
**What:** Factory functions accept optional auth options; create `OAuth2Client` for user tokens or use existing `GoogleAuth` for service account.
**When to use:** Every Google API call site.
**Example:**
```typescript
// apps/agent/src/lib/google-auth.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../env';
import { getAccessTokenForUser } from './token-cache';

interface GoogleAuthOptions {
  accessToken?: string;
  userId?: string;
}

function getUserAuth(options: GoogleAuthOptions): OAuth2Client | null {
  if (options.accessToken) {
    const client = new OAuth2Client();
    client.setCredentials({ access_token: options.accessToken });
    return client;
  }
  // userId path handled by caller via getAccessTokenForUser()
  return null;
}

function getServiceAccountAuth() {
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });
}

export function getSlidesClient(options?: GoogleAuthOptions) {
  const auth = options ? getUserAuth(options) : null;
  return google.slides({ version: 'v1', auth: auth ?? getServiceAccountAuth() });
}
// Same pattern for getDriveClient, getDocsClient
```

### Pattern 2: Agent-Side Token Resolution
**What:** `extractGoogleAuth(c)` reads headers, resolves userId to access token via cache/refresh, returns options for factory.
**When to use:** Every agent route handler that calls Google APIs.
**Example:**
```typescript
// apps/agent/src/lib/request-auth.ts
import type { Context } from 'hono';
import { getAccessTokenForUser } from './token-cache';

export interface GoogleAuthResult {
  accessToken?: string;
  userId?: string;
}

export async function extractGoogleAuth(c: Context): Promise<GoogleAuthResult> {
  const accessToken = c.req.header('X-Google-Access-Token');
  const userId = c.req.header('X-User-Id');

  if (accessToken) {
    return { accessToken, userId: userId ?? undefined };
  }

  if (userId) {
    // Try to get/refresh access token from stored refresh token
    const resolved = await getAccessTokenForUser(userId);
    if (resolved) {
      return { accessToken: resolved, userId };
    }
  }

  // Fall back to service account (return empty = factory uses service account)
  return {};
}
```

### Pattern 3: In-Memory Token Cache with TTL
**What:** Simple Map storing refreshed access tokens with 50-minute TTL.
**When to use:** Agent-side, for the userId -> access token resolution path.
**Example:**
```typescript
// apps/agent/src/lib/token-cache.ts
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';
import { decryptToken } from './token-encryption';

const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes (Google tokens last 60min)

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, CachedToken>();

export async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  // Fetch encrypted refresh token from DB
  const prisma = new PrismaClient(); // or shared instance
  const tokenRecord = await prisma.userGoogleToken.findUnique({
    where: { userId, isValid: true },
  });
  if (!tokenRecord) return null;

  const refreshToken = decryptToken(
    tokenRecord.encryptedRefresh,
    tokenRecord.iv,
    tokenRecord.authTag,
  );

  // Exchange refresh token for access token
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: refreshToken });

  const { token } = await client.getAccessToken();
  if (!token) return null;

  cache.set(userId, {
    accessToken: token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  // Update lastUsedAt
  await prisma.userGoogleToken.update({
    where: { userId },
    data: { lastUsedAt: new Date() },
  });

  return token;
}
```

### Pattern 4: Web-Side Token Passthrough
**What:** `getGoogleAccessToken()` extracts tokens from Supabase session; `fetchWithGoogleAuth()` wraps `fetchJSON` with Google headers.
**When to use:** All Server Actions that trigger Google API operations.
**Example:**
```typescript
// apps/web/src/lib/supabase/google-token.ts
import { createClient } from './server';

export async function getGoogleAccessToken(): Promise<{
  accessToken: string | null;
  userId: string | null;
}> {
  const supabase = await createClient();

  // getSession may have provider_token if session is fresh from login
  const { data: { session } } = await supabase.auth.getSession();
  // getUser for reliable userId
  const { data: { user } } = await supabase.auth.getUser();

  return {
    accessToken: session?.provider_token ?? null,
    userId: user?.id ?? null,
  };
}
```

```typescript
// In apps/web/src/lib/api-client.ts
export async function fetchWithGoogleAuth<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { getGoogleAccessToken } = await import('@/lib/supabase/google-token');
  const { accessToken, userId } = await getGoogleAccessToken();

  const googleHeaders: Record<string, string> = {};
  if (accessToken) googleHeaders['X-Google-Access-Token'] = accessToken;
  if (userId) googleHeaders['X-User-Id'] = userId;

  return fetchJSON<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...googleHeaders,
    },
  });
}
```

### Anti-Patterns to Avoid
- **Modifying existing `fetchJSON` signature:** Keep `fetchJSON` as-is for CRUD operations. Use `fetchWithGoogleAuth` for Google operations only.
- **Passing refresh tokens to the web side:** Refresh tokens must stay agent-side only. Web sends access token (if available) + userId.
- **Creating OAuth2Client per request without caching:** Each refresh exchange hits Google's token endpoint. Cache access tokens.
- **Relying solely on `provider_token`:** Supabase does NOT persist this in session cookies after the initial login. The userId -> refresh path is the primary mechanism for most requests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token refresh | Manual HTTP calls to Google token endpoint | `OAuth2Client.setCredentials({ refresh_token })` + `getAccessToken()` | Handles expiry detection, retry, error codes |
| Token encryption/decryption | New crypto module | Existing `token-encryption.ts` (`decryptToken()`) | Already battle-tested in Phase 22 |
| Toast with action buttons | Custom notification component | Sonner's `toast()` with action parameter | Already installed and used elsewhere |
| Session token extraction | Cookie parsing | `supabase.auth.getSession()` for provider_token | Supabase handles JWT decode and cookie management |

**Key insight:** The `googleapis` library's `OAuth2Client` handles token refresh automatically once `setCredentials` is called with a refresh token. Don't build manual refresh logic.

## Common Pitfalls

### Pitfall 1: provider_token Not Available After Initial Login
**What goes wrong:** `getSession().provider_token` returns null for most requests because Supabase doesn't persist Google's access token in session cookies.
**Why it happens:** Supabase only surfaces `provider_token` at the moment of `exchangeCodeForSession`. Subsequent `getSession()` calls return the Supabase JWT, not the Google access token.
**How to avoid:** Always send `X-User-Id` alongside `X-Google-Access-Token`. The agent-side refresh path is the primary mechanism. Treat `provider_token` as an optimization, not the primary path.
**Warning signs:** Token passthrough works right after login but fails on subsequent page loads.

### Pitfall 2: CORS allowHeaders Missing New Headers
**What goes wrong:** Browser preflight requests fail because `X-Google-Access-Token` and `X-User-Id` are not in the CORS `allowHeaders` list.
**Why it happens:** Current CORS config only allows `Content-Type`, `Authorization`, `X-API-Key`, `x-mastra-client-type`.
**How to avoid:** Add `X-Google-Access-Token` and `X-User-Id` to the `allowHeaders` array in `mastra/index.ts` CORS config.
**Warning signs:** Requests work from Server Actions (no CORS) but fail from client-side fetches.

### Pitfall 3: OAuth2Client Constructor Requires Client ID/Secret for Refresh
**What goes wrong:** `OAuth2Client.getAccessToken()` fails silently or throws when refresh token is set but no client ID/secret provided.
**Why it happens:** Google's token endpoint requires the OAuth client credentials to exchange a refresh token.
**How to avoid:** Pass `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the `OAuth2Client` constructor when using the refresh path. Add these to `env.ts` validation.
**Warning signs:** Direct access token works but refresh-based path fails with 401.

### Pitfall 4: Stale Cache After Token Revocation
**What goes wrong:** Cached access token used after user revokes Google access, causing 403 errors.
**Why it happens:** In-memory cache doesn't know about revocation until the Google API call fails.
**How to avoid:** On Google API 403/401 errors, invalidate the cache entry for that userId and retry once without cache. Mark `isValid: false` on the DB record if refresh also fails.
**Warning signs:** User revokes access in Google settings but app continues trying (and failing) with cached token.

### Pitfall 5: api-client.ts is "server-only"
**What goes wrong:** Trying to use `fetchWithGoogleAuth` from client components fails because `api-client.ts` has `import "server-only"` at the top.
**Why it happens:** The file is designed for Server Actions and server components only.
**How to avoid:** Browser-side retry queue must go through Server Actions, not call `api-client.ts` directly. The toast "Reconnect Google" button triggers a redirect (client-side), while "Run in background" calls a Server Action.
**Warning signs:** Build-time import errors about "server-only" module.

### Pitfall 6: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET Not in env.ts
**What goes wrong:** Agent crashes at startup because env validation fails or token refresh fails at runtime.
**Why it happens:** These env vars are needed for Phase 23 but were not added during Phase 22.
**How to avoid:** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `apps/agent/src/env.ts` as required strings. Note from STATE.md: these are already planned as new env vars.
**Warning signs:** Agent startup fails with validation error.

## Code Examples

### Agent Route Handler with Token Passthrough
```typescript
// Pattern for modifying existing routes in mastra/index.ts
registerApiRoute("/templates/:id/check-staleness", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    const googleAuth = await extractGoogleAuth(c);
    // ... existing logic ...
    const drive = getDriveClient(
      googleAuth.accessToken ? { accessToken: googleAuth.accessToken } : undefined
    );
    // rest of handler unchanged
  },
});
```

### Server Action with Google Auth
```typescript
// apps/web/src/lib/actions/template-actions.ts
import { fetchWithGoogleAuth } from "@/lib/api-client";

export async function checkStalenessAction(id: string) {
  return fetchWithGoogleAuth<StalenessCheckResult>(
    `/templates/${id}/check-staleness`,
    { method: "POST" }
  );
}
```

### Toast for Auth Failure
```typescript
// In a client component error handler
import { toast } from "sonner";

function handleGoogleAuthError(error: Error, retryFn: () => void) {
  if (error.message.includes("403") || error.message.includes("google_auth_required")) {
    toast.error("Google access expired", {
      description: "Your Google account needs to be reconnected.",
      action: {
        label: "Reconnect Google",
        onClick: () => window.location.href = "/login?prompt=consent",
      },
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service account for all Google API calls | User-delegated tokens with service account fallback | Phase 23 (now) | Users access org-shared files naturally |
| No token passthrough | X-Google-Access-Token + X-User-Id headers | Phase 23 (now) | Agent can act on behalf of user |

**Deprecated/outdated:**
- None relevant -- `googleapis` v144 and `google-auth-library` v9 are current.

## Open Questions

1. **Token refresh race condition**
   - What we know: Multiple concurrent requests for the same userId could trigger multiple refresh calls.
   - What's unclear: Whether this causes issues (Google may handle duplicate refreshes gracefully).
   - Recommendation: Use a simple mutex/promise dedup per userId in the cache layer. If userId is already being refreshed, subsequent callers await the same promise.

2. **Error response format for auth failures**
   - What we know: Web needs to distinguish "Google auth failed" from "general server error" to show the correct toast.
   - What's unclear: Exact error response shape from agent.
   - Recommendation: Return `{ error: "google_auth_required", message: "..." }` with HTTP 401 when user token fails and no fallback available, or proceed with service account and return a warning header.

## Agent Routes Requiring extractGoogleAuth

Based on grep analysis of `getDriveClient()` and `getSlidesClient()` calls in `mastra/index.ts`:

| Route | Method | Google API Used | Operation Type |
|-------|--------|-----------------|----------------|
| `/templates` (create) | POST | `getDriveClient()` | Interactive read (access check) |
| `/templates/:id/check-staleness` | POST | `getDriveClient()` | Interactive read |
| `/templates/:id/thumbnails` | GET | `getSlidesClient()` | Interactive read |
| `/templates/:id/ingest` | POST | (triggers ingestion queue) | Interactive write (indirect) |
| `/touch-1/upload` | POST | `getDriveClient()` | Interactive write |
| Background `pollStaleTemplates` | N/A | `getDriveClient()` | Background read (Phase 24 scope) |

Additionally, workflow routes (touch-1 through touch-4, pre-call) call Google APIs internally via `slide-assembly.ts`, `deck-assembly.ts`, `deck-customizer.ts`, `doc-builder.ts`. These need the token threaded through workflow input data.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/agent/src/lib/google-auth.ts`, `apps/web/src/lib/api-client.ts`, `apps/agent/src/mastra/index.ts` -- current factory patterns and route structure
- Codebase analysis: `apps/agent/src/lib/token-encryption.ts` -- existing decryptToken API
- Codebase analysis: 14+ files calling `getDriveClient/getSlidesClient/getDocsClient` via grep
- [googleapis npm](https://www.npmjs.com/package/googleapis) -- OAuth2Client.setCredentials pattern
- [google-auth-library](https://www.npmjs.com/package/google-auth-library) -- OAuth2Client constructor and refresh behavior

### Secondary (MEDIUM confidence)
- [Supabase Auth sessions docs](https://supabase.com/docs/guides/auth/sessions) -- provider_token not persisted in cookies
- [Supabase Discussion #6723](https://github.com/orgs/supabase/discussions/6723) -- server-side access token limitations
- [Google OAuth2 docs](https://developers.google.com/identity/protocols/oauth2) -- refresh token exchange flow

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, patterns verified against codebase
- Architecture: HIGH -- patterns derived from existing code structure with minimal changes
- Pitfalls: HIGH -- provider_token limitation verified via Supabase docs and codebase callback code

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable libraries, no breaking changes expected)
