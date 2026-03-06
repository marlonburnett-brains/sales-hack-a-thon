# Phase 22: OAuth Scope Expansion & Token Storage - Research

**Researched:** 2026-03-06
**Domain:** Google OAuth scopes, Supabase Auth token capture, AES-256-GCM encryption, Prisma model design
**Confidence:** HIGH

## Summary

Phase 22 modifies the existing Supabase Google OAuth login flow to request expanded Google API scopes (Drive, Slides, Docs) plus offline access, captures the `provider_refresh_token` in the auth callback, encrypts it with AES-256-GCM, and stores it in a new `UserGoogleToken` Prisma model via a new agent API endpoint. It also adds middleware-level re-consent detection and a graceful degradation UX when tokens are missing.

The existing codebase provides clean integration points: `signInWithOAuth` in `login/page.tsx` accepts `scopes` and `queryParams` options; `exchangeCodeForSession` in the auth callback returns `session.provider_refresh_token`; `api-client.ts` has a reusable `fetchJSON` pattern for the new `storeGoogleToken()` function; and `mastra/index.ts` uses `registerApiRoute` for new endpoints. No new npm dependencies are needed -- Node.js `crypto` handles encryption and `googleapis` already includes `OAuth2Client`.

**Primary recommendation:** Implement in two plans: (1) agent-side model + encryption + API endpoint, (2) web-side scope expansion + callback token capture + middleware re-consent check + UX badges.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Force re-login on next visit for existing users who don't have a stored token
- Detection: middleware checks if user has a `UserGoogleToken` record in DB; if not, sign out and redirect to login
- Login page shows message: "We've upgraded Drive access. Please sign in again to continue."
- Scopes configured in code via `signInWithOAuth` options, not in Supabase Dashboard
- Use standard read scopes: `drive.file`, `presentations`, `documents` (future-proofs for v2 write operations)
- Consent prompt: conditional -- force `prompt: 'consent'` only when user has no stored token; use `prompt: 'select_account'` for returning users with existing tokens
- Google Cloud Console OAuth consent screen scope configuration is a manual deploy step (documented in deploy checklist, not automated)
- New `POST /tokens` route on agent service
- Uses existing `AGENT_API_KEY` Bearer auth (consistent with all web->agent calls)
- Refresh token sent raw over HTTPS; agent encrypts with `GOOGLE_TOKEN_ENCRYPTION_KEY` before storing
- Auth callback awaits confirmation from agent before redirecting user
- If Google doesn't return a refresh token, allow login but flag user for re-consent on next visit
- Subtle badge/icon in nav/profile area when user is operating without a Google token (service account fallback)
- If agent token storage call fails during callback: show toast warning after redirect using Sonner
- Dedicated "Connect Google" button in profile/settings area for users to manually retry consent/token setup

### Claude's Discretion
- Re-consent check frequency (every page load vs. once per session vs. cached)
- Agent token storage response format
- Exact wording and placement of the "Limited Drive access" badge
- "Connect Google" button placement and design in profile/settings area
- Toast notification exact copy

### Deferred Ideas (OUT OF SCOPE)
- Token management admin UI (valid count, per-user status, manual revocation) -- v2 requirement TMUI-01/02
- Write scope expansion for Drive output to user folders -- v2 requirement WRIT-01/02
- Automatic scope upgrade detection (detecting when scopes change and prompting re-consent) -- explicitly out of scope per REQUIREMENTS.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OAUTH-01 | Google login requests Drive, Slides, Docs scopes | Supabase `signInWithOAuth` `scopes` option; full scope URLs documented below |
| OAUTH-02 | Login requests offline access for refresh token | `queryParams: { access_type: "offline" }` in signInWithOAuth options |
| OAUTH-03 | Login forces consent screen for refresh token | Conditional `prompt: "consent"` vs `prompt: "select_account"` per CONTEXT.md decision |
| OAUTH-04 | Auth callback captures `provider_refresh_token` | `exchangeCodeForSession` returns session with `provider_refresh_token` field |
| TOKS-01 | New `UserGoogleToken` Prisma model | Model design with userId, encrypted fields, tracking columns documented |
| TOKS-02 | AES-256-GCM encryption with `GOOGLE_TOKEN_ENCRYPTION_KEY` | Node.js `crypto` encrypt/decrypt pattern with IV + authTag documented |
| TOKS-03 | Encryption uses Node.js `crypto` only | Zero new dependencies; `createCipheriv`/`createDecipheriv` pattern verified |
| TOKS-04 | Callback stores encrypted token via agent API | New `POST /tokens` agent route + `storeGoogleToken()` in api-client.ts |
| TOKS-05 | Tokens track `lastUsedAt`, `isValid`, `revokedAt` | Model includes all tracking fields; index on `[isValid, lastUsedAt]` for pool queries |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in | AES-256-GCM encrypt/decrypt | No dependency needed; standard for symmetric encryption |
| `@supabase/ssr` | 0.x (installed) | Server-side Supabase client | Already used in callback route and middleware |
| `@supabase/supabase-js` | 2.98.0 (installed) | Browser Supabase client | Already used in login page |
| `prisma` | 6.19.x (installed) | Database migrations and ORM | Project standard; stay on 6.19.x per STATE.md |
| `sonner` | (installed) | Toast notifications | Already installed per CONTEXT.md |
| `zod` | (installed) | Request validation on agent | Already used in all agent routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | (installed) | Icons for badges/buttons | "Limited access" badge icon, "Connect Google" button icon |
| `@/components/ui/button` | (installed) | shadcn Button component | "Connect Google" button |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AES-256-GCM via `crypto` | `libsodium` / `@noble/ciphers` | External dep; `crypto` is sufficient and project-mandated |
| Storing IV+authTag separately | Single concatenated blob | Separate columns are clearer, debuggable, and match existing research |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/
├── prisma/
│   └── schema.prisma           # Add UserGoogleToken model
├── src/
│   ├── lib/
│   │   └── token-encryption.ts  # NEW: AES-256-GCM encrypt/decrypt
│   ├── mastra/
│   │   └── index.ts             # Add POST /tokens route
│   └── env.ts                   # Add GOOGLE_TOKEN_ENCRYPTION_KEY

apps/web/
├── src/
│   ├── app/
│   │   ├── login/page.tsx       # Add scopes + offline access + conditional prompt
│   │   └── auth/callback/route.ts  # Capture token, store via agent
│   ├── lib/
│   │   └── api-client.ts        # Add storeGoogleToken()
│   └── middleware.ts            # Add re-consent check
```

### Pattern 1: Token Encryption Module
**What:** Standalone encrypt/decrypt functions with no side effects
**When to use:** Every time a refresh token is stored or retrieved
**Example:**
```typescript
// apps/agent/src/lib/token-encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

export function getEncryptionKey(): Buffer {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY not set');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return buf;
}

export function encryptToken(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptToken(encrypted: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Pattern 2: Agent API Route (POST /tokens)
**What:** New route that receives raw refresh token, encrypts, and upserts into DB
**When to use:** Called from web auth callback after successful consent
**Example:**
```typescript
// In apps/agent/src/mastra/index.ts
registerApiRoute("/tokens", {
  method: "POST",
  handler: async (c) => {
    const body = await c.req.json();
    const data = z.object({
      userId: z.string().min(1),
      email: z.string().email(),
      refreshToken: z.string().min(1),
    }).parse(body);

    const { encrypted, iv, authTag } = encryptToken(data.refreshToken);

    const token = await prisma.userGoogleToken.upsert({
      where: { userId: data.userId },
      update: {
        encryptedRefresh: encrypted,
        iv,
        authTag,
        email: data.email,
        isValid: true,
        revokedAt: null,
        lastUsedAt: new Date(),
      },
      create: {
        userId: data.userId,
        email: data.email,
        encryptedRefresh: encrypted,
        iv,
        authTag,
      },
    });

    return c.json({ success: true, tokenId: token.id });
  },
}),
```

### Pattern 3: Auth Callback Token Capture
**What:** After `exchangeCodeForSession`, extract `provider_refresh_token` and store via agent API
**When to use:** In the auth callback route, after successful code exchange
**Example:**
```typescript
// In apps/web/src/app/auth/callback/route.ts
const { data, error } = await supabase.auth.exchangeCodeForSession(code);

if (!error && data.session) {
  const { user } = data.session;

  // Domain enforcement
  if (user?.email && !user.email.endsWith("@lumenalta.com")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=domain", origin));
  }

  // Capture refresh token if present
  const refreshToken = data.session.provider_refresh_token;
  if (refreshToken && user?.id && user?.email) {
    try {
      await storeGoogleToken({
        userId: user.id,
        email: user.email,
        refreshToken,
      });
    } catch (err) {
      // Set cookie/search param to trigger toast after redirect
      console.error("[auth] Failed to store Google token:", err);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

### Pattern 4: Middleware Re-consent Check
**What:** Check if authenticated user has a stored token; if not, sign out and redirect to login
**When to use:** On every request in middleware (with caching strategy)
**Example (session-cached approach):**
```typescript
// Recommended: check once per session, store result in a cookie
// The middleware checks a short-lived cookie "has-google-token"
// If missing, call agent API to check, then set cookie with 1h TTL
// If user has no token, sign out and redirect with ?error=reconsent
```

### Anti-Patterns to Avoid
- **Storing access tokens instead of refresh tokens:** Access tokens expire in ~1 hour; only refresh tokens persist.
- **Calling agent API on every middleware request:** Use a session cookie cache to avoid hammering the agent service.
- **Using `getSession()` for provider tokens:** Supabase only includes `provider_token`/`provider_refresh_token` immediately after OAuth login, not on subsequent session refreshes. Capture them in the callback, not later.
- **Forgetting the `authTag` in GCM:** AES-256-GCM requires storing and verifying the authentication tag; without it, decryption silently produces garbage or throws.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Symmetric encryption | Custom XOR/AES-ECB scheme | `crypto.createCipheriv('aes-256-gcm')` | GCM provides authenticated encryption; ECB is insecure for tokens |
| IV generation | Deterministic/counter-based IV | `crypto.randomBytes(16)` | Reusing IVs with GCM completely breaks security |
| Key derivation | Embedding key in code | Environment variable `GOOGLE_TOKEN_ENCRYPTION_KEY` | Keys must be configurable and not committed to source |
| OAuth scope strings | Guessing scope URLs | Google OAuth 2.0 scope reference (documented below) | Wrong scope strings fail silently at consent |
| Toast notifications | Custom notification system | Sonner (already installed) | Project standard, already configured |

**Key insight:** AES-256-GCM has exact requirements (32-byte key, 16-byte IV, authTag verification) that are easy to get wrong. The encrypt/decrypt module should be tested in isolation before integration.

## Common Pitfalls

### Pitfall 1: `provider_refresh_token` is null
**What goes wrong:** Google does not return a refresh token on re-login if the user previously consented with the same scopes.
**Why it happens:** Google only issues refresh tokens on initial consent or when `prompt: "consent"` forces re-consent.
**How to avoid:** Use conditional prompt: `prompt: "consent"` for users without stored tokens, `prompt: "select_account"` for returning users. The CONTEXT.md decision already handles this.
**Warning signs:** `data.session.provider_refresh_token` is `null` or `undefined` in the callback.

### Pitfall 2: Supabase `exchangeCodeForSession` vs `getSession`
**What goes wrong:** Trying to read `provider_refresh_token` from `getSession()` returns null.
**Why it happens:** Supabase only includes provider tokens in the session immediately after OAuth login (in `exchangeCodeForSession` response). On subsequent `getSession()` calls, provider tokens are stripped after Supabase's own token refresh.
**How to avoid:** Capture `provider_refresh_token` from the `exchangeCodeForSession` return value in the callback, not from `getSession()` later.
**Warning signs:** Token capture works on first login but fails on subsequent page loads.

### Pitfall 3: GCM Auth Tag Not Stored
**What goes wrong:** Decryption fails with "Unsupported state or unable to authenticate data" error.
**Why it happens:** Forgetting to call `cipher.getAuthTag()` and store it, or not calling `decipher.setAuthTag()` before decryption.
**How to avoid:** Always store three values: `encrypted`, `iv`, `authTag`. Always set the auth tag before calling `decipher.update()`.
**Warning signs:** Encryption succeeds but decryption always throws.

### Pitfall 4: Middleware Performance with Agent API Calls
**What goes wrong:** Every page load makes an HTTP request to the agent to check if the user has a stored token, causing latency spikes.
**Why it happens:** Naive implementation checks the agent on every middleware invocation.
**How to avoid:** Cache the token-existence check in a short-lived cookie (e.g., `has-google-token=1` with 1-hour expiry). Only call the agent API when the cookie is missing. Alternatively, check once per session on the first authenticated request.
**Warning signs:** Agent API logs show thousands of `/tokens/check` requests per minute.

### Pitfall 5: Encryption Key Format
**What goes wrong:** `createCipheriv` throws "Invalid key length" error.
**Why it happens:** Key is not exactly 32 bytes. Common mistake: using a 32-character ASCII string instead of a 64-character hex string (which decodes to 32 bytes).
**How to avoid:** Document that `GOOGLE_TOKEN_ENCRYPTION_KEY` must be a 64-character hex string. Generate with `openssl rand -hex 32`. Validate key length at startup.
**Warning signs:** Application crashes on first token storage attempt.

### Pitfall 6: Prisma Migration Discipline
**What goes wrong:** Using `prisma db push` or `prisma migrate reset` violates project rules.
**Why it happens:** Developer habit or impatience with migration workflow.
**How to avoid:** Per CLAUDE.md: ALWAYS use `prisma migrate dev --name <descriptive-name>`. Use `--create-only` to inspect SQL before applying. Never reset.
**Warning signs:** Missing migration files in commit, or dev.db state doesn't match migration history.

### Pitfall 7: Google Scope URL Format
**What goes wrong:** Consent screen doesn't show the expected permissions.
**Why it happens:** Using short scope names (e.g., `drive.file`) instead of full URLs in the `scopes` option.
**How to avoid:** Use full scope URLs in `signInWithOAuth` scopes option. Short names may work in `googleapis` library but Supabase OAuth passes them directly to Google's OAuth endpoint which expects full URLs.
**Warning signs:** Users consent but API calls return 403 "insufficient permissions".

## Code Examples

### Google OAuth Scope URLs (Verified)
```typescript
// Full scope URLs for signInWithOAuth scopes option
// Source: Google OAuth 2.0 Scopes reference
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",        // Per-file access to Drive files created/opened by app
  "https://www.googleapis.com/auth/presentations",      // Read/write Google Slides
  "https://www.googleapis.com/auth/documents",          // Read/write Google Docs
].join(" ");

// Note: These are NOT readonly scopes -- per CONTEXT.md decision,
// using standard read scopes to future-proof for v2 write operations.
// drive.file is narrower than full drive scope (only files the app creates/opens).
```

### Supabase signInWithOAuth with Expanded Scopes
```typescript
// Source: Supabase Auth docs + existing login/page.tsx pattern
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    scopes: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/documents",
    redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    queryParams: {
      hd: "lumenalta.com",
      access_type: "offline",
      prompt: needsConsent ? "consent" : "select_account",
    },
  },
});
```

### exchangeCodeForSession Token Extraction
```typescript
// Source: @supabase/auth-js types (Session interface)
// session.provider_token: string | null        -- Google access token
// session.provider_refresh_token: string | null -- Google refresh token (only after consent)
const { data, error } = await supabase.auth.exchangeCodeForSession(code);
if (data.session) {
  const refreshToken = data.session.provider_refresh_token; // may be null
  const accessToken = data.session.provider_token;          // short-lived
}
```

### Generating Encryption Key
```bash
# Generate a 32-byte (256-bit) hex key for GOOGLE_TOKEN_ENCRYPTION_KEY
openssl rand -hex 32
# Example output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

### Prisma UserGoogleToken Model
```prisma
model UserGoogleToken {
  id               String    @id @default(cuid())
  userId           String    @unique  // Supabase Auth user ID
  email            String              // User email for logging/debugging
  encryptedRefresh String              // AES-256-GCM encrypted refresh token
  iv               String              // Base64-encoded initialization vector
  authTag          String              // Base64-encoded GCM authentication tag
  lastUsedAt       DateTime  @default(now())
  isValid          Boolean   @default(true)
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([isValid, lastUsedAt])
  @@index([email])
}
```

### Agent Token Check Route (for middleware)
```typescript
// GET /tokens/check/:userId -- returns { hasToken: boolean }
// Lightweight endpoint for middleware to verify token existence
registerApiRoute("/tokens/check/:userId", {
  method: "GET",
  handler: async (c) => {
    const userId = c.req.param("userId");
    const token = await prisma.userGoogleToken.findUnique({
      where: { userId },
      select: { isValid: true },
    });
    return c.json({ hasToken: !!token?.isValid });
  },
}),
```

### storeGoogleToken in api-client.ts
```typescript
// Follow existing fetchJSON pattern
export async function storeGoogleToken(data: {
  userId: string;
  email: string;
  refreshToken: string;
}): Promise<{ success: boolean; tokenId: string }> {
  return fetchJSON<{ success: boolean; tokenId: string }>("/tokens", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkGoogleToken(
  userId: string
): Promise<{ hasToken: boolean }> {
  return fetchJSON<{ hasToken: boolean }>(`/tokens/check/${userId}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service account for all Google API calls | User-delegated credentials with SA fallback | v1.3 (now) | Unlocks org-wide file access |
| No scopes on user login | Drive/Slides/Docs scopes + offline access | v1.3 (now) | Enables token capture |
| No token storage | AES-256-GCM encrypted per-user refresh tokens | v1.3 (now) | Enables background job token pool |

**Deprecated/outdated:**
- Service account-only access: Remains as fallback but user tokens are preferred path for accessing org-shared files

## Open Questions

1. **Middleware re-consent check caching strategy (Claude's Discretion)**
   - What we know: Checking agent API on every request is too expensive. A cookie cache is the standard approach.
   - Recommendation: Use a session cookie `google-token-status` with value `valid` or `missing`, set on first authenticated request per session. TTL of 1 hour. Middleware reads cookie; if `missing`, signs out and redirects. If cookie absent, makes agent API call to check.

2. **Conditional prompt parameter passing**
   - What we know: The login page is a client component. It needs to know whether the user has a stored token to decide between `prompt: "consent"` and `prompt: "select_account"`.
   - What's unclear: How does the client component know if the user has a stored token? The middleware already signed out users without tokens, so any user reaching the login page after signout could use `prompt: "consent"`. New users or first-time users would also get `prompt: "consent"`.
   - Recommendation: Use a URL search param (e.g., `?reconsent=1`) set by middleware when forcing re-login. Login page checks this param: if present, use `prompt: "consent"`; otherwise use `prompt: "select_account"`. First-time users (no existing session) always get `prompt: "consent"` since they have no token record.

3. **`drive.file` scope behavior with existing files**
   - What we know: `drive.file` only grants access to files the app creates or the user opens with the app. It does NOT grant broad Drive read access to org-shared files.
   - What's unclear: If the goal is to access org-wide templates that were NOT created by the app, `drive.file` may be insufficient. The existing service account uses full `drive` scope.
   - Recommendation: If reading arbitrary org-shared templates is needed, use `drive.readonly` instead of `drive.file`. However, CONTEXT.md explicitly chose `drive.file` for future-proofing writes. The planner should note this tradeoff and verify with the user if `drive.file` covers the access patterns needed. Phase 23-24 may need to revisit this scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (installed in both apps) |
| Config file | `apps/agent/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOKS-02 | AES-256-GCM encrypt then decrypt yields original | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts -x` | No -- Wave 0 |
| TOKS-03 | Only uses crypto built-in (no imports from npm) | unit (static check) | `grep -r "from.*sodium\|from.*noble" apps/agent/src/lib/token-encryption.ts` | N/A -- manual |
| TOKS-05 | Model includes lastUsedAt, isValid, revokedAt | unit (schema check) | `grep -c "lastUsedAt\|isValid\|revokedAt" apps/agent/prisma/schema.prisma` | N/A -- manual |
| TOKS-01 | UserGoogleToken model upserts correctly | integration | manual -- requires DB | No |
| OAUTH-01 | signInWithOAuth includes Drive/Slides/Docs scopes | manual-only | Requires browser interaction with Google OAuth | N/A |
| OAUTH-02 | Login includes access_type: offline | manual-only | Requires browser interaction | N/A |
| OAUTH-04 | Callback captures provider_refresh_token | manual-only | Requires real Google OAuth flow | N/A |
| TOKS-04 | Callback stores token via agent API | integration | manual -- requires both services running | No |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts -x`
- **Per wave merge:** `cd apps/agent && npx vitest run && cd ../web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/lib/__tests__/token-encryption.test.ts` -- covers TOKS-02, TOKS-03 (encrypt/decrypt roundtrip, key validation)
- [ ] No integration test framework for multi-service flows (manual verification required for OAUTH-01 through OAUTH-04, TOKS-04)

## Sources

### Primary (HIGH confidence)
- Supabase Auth JS types (`@supabase/auth-js@2.98.0/dist/module/lib/types.d.ts`) - verified `provider_token` and `provider_refresh_token` on Session interface
- Node.js `crypto` documentation - AES-256-GCM API verified via built-in module
- Existing codebase files (login/page.tsx, callback/route.ts, api-client.ts, mastra/index.ts, google-auth.ts) - verified integration points
- `.planning/research/SUMMARY.md` - pre-existing milestone-level research with verified patterns

### Secondary (MEDIUM confidence)
- Google OAuth 2.0 scope URLs - based on standard Google API scope conventions and existing `google-auth.ts` usage
- Supabase `signInWithOAuth` `scopes` option behavior - based on Supabase SSR documentation patterns

### Tertiary (LOW confidence)
- `drive.file` scope behavior for accessing org-shared files - needs runtime verification that this scope grants access to files shared with the user's organization (it may not -- see Open Questions #3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all libraries already installed and verified in codebase
- Architecture: HIGH - patterns follow existing codebase conventions exactly (registerApiRoute, fetchJSON, Prisma models)
- Pitfalls: HIGH - provider_refresh_token behavior verified via types and documented in existing research; GCM patterns are well-established
- Scope URLs: MEDIUM - `drive.file` vs `drive.readonly` tradeoff flagged in Open Questions

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, no fast-moving dependencies)
