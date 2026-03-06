# Phase 24: Token Pool & Refresh Lifecycle - Research

**Researched:** 2026-03-06
**Domain:** Google OAuth2 token pool management, refresh token lifecycle, Action Required UI
**Confidence:** HIGH

## Summary

Phase 24 builds a token pool system for background jobs that currently use the service account. The existing `token-cache.ts` already handles single-user refresh token exchange with in-memory caching, dedup, and auto-invalidation -- the pool system extends this to iterate through ALL valid tokens ordered by `lastUsedAt DESC`, falling back to the service account when the pool is exhausted. Refresh token lifecycle management requires listening to Google's `tokens` event on `OAuth2Client` to capture rotated refresh tokens, plus handling upsert on re-login.

The Action Required UI introduces a new `ActionRequired` Prisma model and a full-page web app screen with sidebar badge, following the existing sidebar nav pattern (static `navItems` array in `sidebar.tsx`).

**Primary recommendation:** Extend `token-cache.ts` into the pool system (`getPooledGoogleAuth()`), add `tokens` event listener for refresh token rotation, create `ActionRequired` model with forward-only migration, and add Action Required page following existing sidebar patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Try ALL valid tokens (not capped at 5) ordered by `lastUsedAt` DESC before falling back to service account
- Service account fallback is silent unless SA itself hits a permission error
- On SA permission error: create an ActionRequired record for the affected resource
- Lazy notification: users are only bothered when fallback actually fails
- Staleness polling AND ingestion queue both switch to pooled auth
- Strategy: pool first, service account fallback (gradual transition)
- `getPooledGoogleAuth()` function returns an authenticated client from the pool
- Console log warning when valid token pool drops below 3 tokens (raised from 2)
- Low-pool alert is server-side logging only (not surfaced in Action Required UI)
- Immediate update when Google returns a new refresh_token -- encrypt and upsert
- No audit trail of previous tokens (upsert replaces)
- Re-login upserts existing token record (userId unique constraint)
- New sidebar menu item "Action Required" with badge showing count of pending actions
- Full screen listing all pending manual actions with type, description, and resolution guidance
- Action types: `reauth_needed`, `share_with_sa`, `drive_access`
- Actions dismissed when resolved
- New `ActionRequired` model in Prisma schema

### Claude's Discretion
- `getPooledGoogleAuth()` function signature and internal caching strategy
- Action Required page layout and component design
- Badge implementation (sidebar dot/count)
- How to detect action resolution (polling vs event-driven)
- Ingestion queue integration approach (where to inject pooled auth)
- Rate limiting between token attempts in the pool

### Deferred Ideas (OUT OF SCOPE)
- Token management admin UI (pool health dashboard, manual revocation) -- v2
- Email/Slack notification when pool drops below threshold -- v2
- Write scope expansion for Drive output to user folders -- v2
- Automatic scope upgrade detection -- explicitly out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POOL-01 | Background jobs draw from pool ordered by `lastUsedAt` DESC | Pool query pattern using existing `[isValid, lastUsedAt]` index; `getPooledGoogleAuth()` function |
| POOL-02 | Try ALL valid tokens with automatic fallback on failure (CONTEXT overrides "5" to "all") | Iterate tokens, catch per-token errors, mark invalid, continue to next |
| POOL-03 | Failed tokens marked `isValid: false` with `revokedAt` | Existing pattern in `token-cache.ts` lines 105-108 and 138-144 |
| POOL-04 | Successful usage updates `lastUsedAt` | Existing pattern in `token-cache.ts` lines 120-127 (fire-and-forget) |
| POOL-05 | Warning logged when valid pool < 3 tokens (CONTEXT raised from 2) | Count query after pool operation, console.warn |
| LIFE-01 | Token rotation: new refresh_token from Google updates stored token | OAuth2Client `tokens` event listener pattern |
| LIFE-02 | Token refresh uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars | Already in `env.ts` (lines 57-58), already used in `token-cache.ts` (lines 94-97) |
| LIFE-03 | Re-login updates existing token (upsert on userId) | Already implemented in mastra/index.ts token store route; verify upsert behavior |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-auth-library | (existing) | OAuth2Client for token refresh, `tokens` event | Already in project, Google's official Node.js auth |
| googleapis | (existing) | Drive/Slides/Docs API clients | Already in project |
| @prisma/client | 6.19.x | DB access for token pool queries, ActionRequired model | Already in project, stay on 6.19.x per blockers |
| lucide-react | (existing) | Icons for Action Required sidebar item and page | Already used in sidebar.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (existing) | Toast notifications on web side | Not needed for this phase (server-side logging only for pool alerts) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process pool iteration | Job queue (BullMQ, etc.) | Over-engineered for ~20 users; in-process is fine |
| Polling for action resolution | WebSocket/SSE | Polling is simpler and consistent with existing patterns |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/lib/
  google-auth.ts        # Add getPooledGoogleAuth()
  token-cache.ts        # Extend with pool iteration + tokens event listener
  token-encryption.ts   # Unchanged (already has encrypt/decrypt)

apps/agent/src/mastra/
  index.ts              # Update staleness polling + ingestion to use pooled auth
                        # Add ActionRequired CRUD API routes

apps/agent/prisma/
  schema.prisma         # Add ActionRequired model
  migrations/           # New migration for ActionRequired

apps/web/src/
  app/(authenticated)/actions/
    page.tsx            # Action Required page
  components/
    sidebar.tsx         # Add Action Required nav item with badge
  lib/
    api-client.ts       # Add fetchActionRequired helpers (if needed)
```

### Pattern 1: Pool Iteration with Ordered Fallback
**What:** Query all valid tokens ordered by `lastUsedAt DESC`, iterate through each attempting a Google API call, mark failures, update successes, fall back to service account if all fail.
**When to use:** All background jobs (staleness polling, ingestion queue) that need Google API access without a request context.
**Example:**
```typescript
// In google-auth.ts
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';
import { decryptToken, encryptToken } from './token-encryption';
import { env } from '../env';

const prisma = new PrismaClient();

interface PooledAuthResult {
  auth: OAuth2Client | GoogleAuth;
  source: 'pool' | 'service_account';
  userId?: string;
}

export async function getPooledGoogleAuth(): Promise<PooledAuthResult> {
  // 1. Query all valid tokens ordered by lastUsedAt DESC
  const tokens = await prisma.userGoogleToken.findMany({
    where: { isValid: true },
    orderBy: { lastUsedAt: 'desc' },
  });

  // 2. Try each token
  for (const token of tokens) {
    try {
      const refreshToken = decryptToken(token.encryptedRefresh, token.iv, token.authTag);
      const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
      client.setCredentials({ refresh_token: refreshToken });

      // Listen for token rotation
      client.on('tokens', async (newTokens) => {
        if (newTokens.refresh_token) {
          // Google issued a new refresh token -- upsert immediately
          const encrypted = encryptToken(newTokens.refresh_token);
          await prisma.userGoogleToken.update({
            where: { userId: token.userId },
            data: {
              encryptedRefresh: encrypted.encrypted,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
            },
          });
        }
      });

      // Force a token refresh to validate
      const { token: accessToken } = await client.getAccessToken();
      if (!accessToken) throw new Error('No access token returned');

      // Success -- update lastUsedAt
      prisma.userGoogleToken.update({
        where: { userId: token.userId },
        data: { lastUsedAt: new Date() },
      }).catch(() => {}); // fire and forget

      return { auth: client, source: 'pool', userId: token.userId };
    } catch {
      // Mark token as invalid
      await prisma.userGoogleToken.update({
        where: { userId: token.userId },
        data: { isValid: false, revokedAt: new Date() },
      }).catch(() => {});
      continue;
    }
  }

  // 3. Check pool health
  const validCount = await prisma.userGoogleToken.count({ where: { isValid: true } });
  if (validCount < 3) {
    console.warn(`[token-pool] WARNING: Only ${validCount} valid token(s) remaining in pool`);
  }

  // 4. Fall back to service account (silent)
  return { auth: getGoogleAuth(), source: 'service_account' };
}
```

### Pattern 2: ActionRequired Model and CRUD
**What:** A Prisma model tracking pending user actions with type, description, resource reference, and resolution status.
**When to use:** When a background job encounters a failure that requires manual user intervention (re-auth, sharing, Drive access).
**Example:**
```typescript
// ActionRequired model
model ActionRequired {
  id          String   @id @default(cuid())
  userId      String?  // null for org-wide actions (e.g., share with SA)
  actionType  String   // "reauth_needed" | "share_with_sa" | "drive_access"
  title       String   // Human-readable title
  description String   // Detailed guidance for resolution
  resourceId  String?  // Template ID, file ID, etc.
  resourceName String? // Human-readable resource name
  resolved    Boolean  @default(false)
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([resolved])
  @@index([userId])
  @@index([actionType])
}
```

### Pattern 3: Background Job Auth Injection
**What:** Replace `getDriveClient()` calls in staleness polling and ingestion with pooled auth.
**When to use:** Every background Google API call.
**Example:**
```typescript
// Before (staleness polling, line 46):
const drive = getDriveClient();

// After:
const { auth, source } = await getPooledGoogleAuth();
const drive = google.drive({ version: 'v3', auth });
console.log(`[staleness] Using ${source} auth`);
```

### Pattern 4: Sidebar Badge
**What:** Add Action Required item to sidebar with pending count badge.
**When to use:** Sidebar navigation.
**Example:**
```typescript
// sidebar.tsx -- add to navItems:
{ href: "/actions", label: "Action Required", icon: AlertTriangle }

// Badge: fetch count from agent API, display as red dot or count
// Use useEffect + polling (consistent with existing patterns)
```

### Anti-Patterns to Avoid
- **Pre-validating tokens before use:** Don't call `getAccessToken()` just to validate, then make another API call. Instead, try the actual API call and catch failures. However, for pool iteration, a lightweight validation (getAccessToken) is acceptable since we need to pick a working token before handing it to callers.
- **Capping pool attempts at 5:** CONTEXT explicitly says try ALL valid tokens. Do not limit.
- **Notifying users proactively:** Lazy notification philosophy -- only create ActionRequired when something actually fails.
- **Resetting the database:** Per CLAUDE.md, NEVER use `prisma db push` or `prisma migrate reset`. Use `prisma migrate dev --name <name>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token refresh | Manual HTTP POST to token endpoint | `OAuth2Client.getAccessToken()` | Handles refresh, caching, error codes |
| Token rotation detection | Polling Google token info endpoint | `OAuth2Client.on('tokens', ...)` event | Built-in, fires automatically |
| Encryption | Custom crypto | Existing `token-encryption.ts` | AES-256-GCM already implemented |
| Migration | `prisma db push` | `prisma migrate dev --name` | CLAUDE.md mandate |

**Key insight:** The `google-auth-library` OAuth2Client already handles refresh token exchange and emits a `tokens` event when new credentials arrive. The pool system is just iteration + error handling around this existing machinery.

## Common Pitfalls

### Pitfall 1: Race Conditions in Pool Iteration
**What goes wrong:** Two concurrent background jobs both iterate the pool, both mark the same token invalid.
**Why it happens:** Staleness polling and ingestion queue run independently.
**How to avoid:** The ingestion queue is already sequential. Staleness polling iterates templates sequentially. Even if both run concurrently, marking a token invalid twice is idempotent (same result). No mutex needed.
**Warning signs:** Excessive "token invalid" log messages.

### Pitfall 2: Token Rotation Event Not Firing
**What goes wrong:** OAuth2Client `tokens` event only fires on certain conditions.
**Why it happens:** Google only issues new refresh tokens when `prompt: consent` is used or when the token is about to expire. The `tokens` event fires during `getAccessToken()` but a new `refresh_token` field is rare.
**How to avoid:** The `tokens` event listener is a safety net. The primary rotation path is re-login (LIFE-03). Don't rely solely on the event.
**Warning signs:** Token in DB doesn't match what Google has issued.

### Pitfall 3: Service Account Fallback Masking Pool Problems
**What goes wrong:** All tokens fail, service account works, nobody notices.
**Why it happens:** Silent fallback by design.
**How to avoid:** The pool health warning (< 3 valid tokens) catches this. Log the fallback source on each use so debugging is possible.
**Warning signs:** Consistent `source: 'service_account'` in background job logs.

### Pitfall 4: Ingestion Queue Auth Propagation
**What goes wrong:** `getPooledGoogleAuth()` is called once but the ingestion pipeline internally creates new Google API clients via `getSlidesClient()` and `getDriveClient()` in multiple files (`slide-extractor.ts`, `ingest-template.ts`, etc.).
**Why it happens:** The ingestion pipeline has its own internal Google API client creation scattered across files.
**How to avoid:** `getPooledGoogleAuth()` should return an `accessToken` that can be passed to existing `getSlidesClient({ accessToken })` and `getDriveClient({ accessToken })` -- this uses the existing `GoogleAuthOptions` pattern from Phase 23. No need to change every file; just pass the token through.
**Warning signs:** Ingestion still using service account despite pool being available.

### Pitfall 5: Prisma Migration Drift
**What goes wrong:** Using `prisma db push` instead of migrations.
**Why it happens:** Developer habit.
**How to avoid:** CLAUDE.md explicitly forbids `prisma db push`. Always use `prisma migrate dev --name add-action-required`.
**Warning signs:** Missing migration files in `prisma/migrations/`.

## Code Examples

### Token Pool Query (Leveraging Existing Index)
```typescript
// The [isValid, lastUsedAt] index on UserGoogleToken is perfect for this query
const tokens = await prisma.userGoogleToken.findMany({
  where: { isValid: true },
  orderBy: { lastUsedAt: 'desc' },
});
```

### OAuth2Client Token Rotation Listener
```typescript
// Source: https://github.com/googleapis/google-auth-library-nodejs
const client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET
);
client.setCredentials({ refresh_token: decryptedRefreshToken });

// Listen for rotated tokens
client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    // New refresh token issued -- store it
    const encrypted = encryptToken(tokens.refresh_token);
    prisma.userGoogleToken.update({
      where: { userId },
      data: {
        encryptedRefresh: encrypted.encrypted,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
    }).catch((err) => {
      console.error('[token-pool] Failed to store rotated refresh token:', err);
    });
  }
});
```

### Pooled Auth Integration in Staleness Polling
```typescript
// In mastra/index.ts pollStaleTemplates():
async function pollStaleTemplates() {
  // Get pooled auth once per polling cycle (not per template)
  const { auth, source } = await getPooledGoogleAuth();
  console.log(`[staleness] Polling with ${source} auth`);

  const drive = google.drive({ version: 'v3', auth });
  // ... existing template iteration using this drive client
}
```

### Pooled Auth Integration in Ingestion
```typescript
// The ingestion pipeline uses getSlidesClient() and getDriveClient() internally.
// Best approach: get an access token from the pool, then pass it through.
const { auth, source, accessToken } = await getPooledGoogleAuth();

// ingestTemplate already calls getSlidesClient() and getDriveClient()
// internally via slide-extractor.ts. Need to thread the accessToken through.
// Option A: Modify ingestTemplate to accept GoogleAuthOptions
// Option B: Use a context/global for the current background auth
// Recommendation: Option A -- explicit is better than implicit
```

### ActionRequired Creation on SA Failure
```typescript
// When service account fallback also fails on a specific resource:
try {
  const fileRes = await drive.files.get({ fileId, supportsAllDrives: true });
} catch (err: any) {
  if (err?.code === 403 || err?.code === 404) {
    await prisma.actionRequired.create({
      data: {
        actionType: 'share_with_sa',
        title: `Share "${templateName}" with service account`,
        description: `The template "${templateName}" is not accessible. Please share it with ${SA_EMAIL} as a Viewer.`,
        resourceId: templateId,
        resourceName: templateName,
      },
    });
  }
}
```

### Sidebar Nav Item with Badge
```typescript
// sidebar.tsx
import { AlertTriangle } from "lucide-react";

// Add to navItems array:
{ href: "/actions", label: "Action Required", icon: AlertTriangle }

// Badge component (inline in nav rendering):
{label === "Action Required" && pendingCount > 0 && (
  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
    {pendingCount}
  </span>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service account only | User-delegated + SA fallback | Phase 22-23 (this milestone) | Background jobs need pool |
| Single user token cache | Pool iteration across all users | Phase 24 (this phase) | Better coverage for org-shared files |
| No user action tracking | ActionRequired model | Phase 24 (this phase) | Users see what needs fixing |

**Deprecated/outdated:**
- Direct `getDriveClient()` (no auth options) in background jobs -- should now use `getPooledGoogleAuth()` result

## Open Questions

1. **Ingestion pipeline auth threading**
   - What we know: `ingestTemplate()` calls `extractSlidesFromPresentation()` which calls `getSlidesClient()` internally (no auth parameter). Multiple files create their own clients.
   - What's unclear: Best way to thread pooled auth through the entire ingestion pipeline without modifying every file.
   - Recommendation: The simplest approach is to modify `extractSlidesFromPresentation()` and `ingestTemplate()` to accept optional `GoogleAuthOptions`, passing through to `getSlidesClient({ accessToken })`. This leverages the Phase 23 pattern already built into the client factories.

2. **Action Resolution Detection**
   - What we know: Need to dismiss actions when resolved (re-login, share, etc.)
   - What's unclear: How to detect that a user has re-logged in (for `reauth_needed`) or shared a doc (for `share_with_sa`).
   - Recommendation: For `reauth_needed`: the auth callback already stores tokens -- add a step to resolve matching ActionRequired records. For `share_with_sa`: check on next staleness poll and resolve if accessible. For `drive_access`: same as `share_with_sa`.

3. **Pool health check timing**
   - What we know: Log warning when < 3 valid tokens.
   - What's unclear: Check after every pool operation, or on a schedule?
   - Recommendation: Check after any token invalidation (since that's when the count changes). Lightweight -- just a COUNT query.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `token-cache.ts`, `google-auth.ts`, `token-encryption.ts`, `request-auth.ts` -- read directly
- Existing codebase: `mastra/index.ts` staleness polling (line 46), ingestion queue pattern
- Existing codebase: `sidebar.tsx` nav items pattern, `schema.prisma` UserGoogleToken model
- [google-auth-library-nodejs README](https://github.com/googleapis/google-auth-library-nodejs) -- `tokens` event documentation

### Secondary (MEDIUM confidence)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2) -- refresh token behavior
- [OAuth2Client API Reference](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/oauth2client) -- class documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - extends existing patterns (token-cache, GoogleAuthOptions, sidebar nav)
- Pitfalls: HIGH - based on direct code reading, known project patterns
- Action Required UI: MEDIUM - new feature, but follows established sidebar/page patterns

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, project-specific patterns)
