---
phase: 22-oauth-scope-expansion-token-storage
verified: 2026-03-06T17:00:00Z
status: gaps_found
score: 13/15 must-haves verified
gaps:
  - truth: "Badge disappears after user completes Google consent flow"
    status: failed
    reason: "google-token-status cookie is set with httpOnly: true in both middleware and auth callback, but GoogleTokenBadge reads via document.cookie which cannot access httpOnly cookies. Badge will always show regardless of token status."
    artifacts:
      - path: "apps/web/src/components/google-token-badge.tsx"
        issue: "Reads document.cookie but cookie is httpOnly — will never see 'valid' value"
      - path: "apps/web/src/middleware.ts"
        issue: "Sets google-token-status with httpOnly: true (lines 106, 114)"
      - path: "apps/web/src/app/auth/callback/route.ts"
        issue: "Sets google-token-status with httpOnly: true (line 44)"
    missing:
      - "Either remove httpOnly from google-token-status cookie (it contains no sensitive data — just 'valid' or 'missing'), OR change GoogleTokenBadge to read status via a server component prop or API call instead of document.cookie"
  - truth: "Users without a stored Google token see a subtle warning badge on their avatar (only them)"
    status: partial
    reason: "Badge renders correctly but shows for ALL users because httpOnly prevents client-side cookie read. The badge never sees 'valid' status."
    artifacts:
      - path: "apps/web/src/components/google-token-badge.tsx"
        issue: "Always shows badge because httpOnly cookie is invisible to document.cookie"
    missing:
      - "Same fix as above — remove httpOnly or change badge read mechanism"
---

# Phase 22: OAuth Scope Expansion & Token Storage Verification Report

**Phase Goal:** Capture Google OAuth tokens with expanded scopes during login and store encrypted refresh tokens per user.
**Verified:** 2026-03-06T17:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

**Plan 01 — Agent-side token encryption and storage infrastructure:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent service can encrypt a refresh token and decrypt it back to the original value | VERIFIED | `token-encryption.ts` implements AES-256-GCM with randomized IV; 7 unit tests cover roundtrip, tamper detection, key validation |
| 2 | Agent service has a POST /tokens endpoint that accepts userId, email, refreshToken and returns success | VERIFIED | Route registered in `mastra/index.ts` lines 1254-1301 with Zod validation, encryption, and upsert |
| 3 | UserGoogleToken model stores encrypted token with IV, authTag, and tracking fields | VERIFIED | Model in `schema.prisma` lines 252-267 with all fields; migration SQL at `20260306131204_add_user_google_token/migration.sql` |
| 4 | Re-login for same user upserts (updates) the existing token record | VERIFIED | `prisma.userGoogleToken.upsert` with `where: { userId }` in POST handler (line 1269) |
| 5 | Encryption uses only Node.js crypto (no new npm dependencies) | VERIFIED | Only imports from `crypto` module: `createCipheriv`, `createDecipheriv`, `randomBytes` |

**Plan 02 — Web-side OAuth scope expansion and token capture:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Login requests Drive, Slides, Docs scopes plus offline access | VERIFIED | `login/page.tsx` line 54: full scope URLs (`drive.file`, `presentations`, `documents`); line 58: `access_type: "offline"` |
| 7 | Consent screen appears when user has no stored token (prompt: consent) | VERIFIED | Line 59: `prompt: needsConsent ? "consent" : "select_account"` with `needsConsent` from `?reconsent=1` param |
| 8 | Returning users with existing tokens see account picker (prompt: select_account) | VERIFIED | Same conditional — when `reconsent` param absent, defaults to `select_account` |
| 9 | Auth callback captures provider_refresh_token and stores it via agent POST /tokens | VERIFIED | `callback/route.ts` line 12: destructures `{ data }` from `exchangeCodeForSession`; line 30: extracts `data.session?.provider_refresh_token`; lines 33-36: calls `storeGoogleToken()` |
| 10 | Middleware signs out users without a stored token and redirects to login with reconsent param | VERIFIED | `middleware.ts` lines 60-140: full cookie-cached token check with signOut + redirect to `/login?reconsent=1` |
| 11 | Login page shows re-consent message when redirected from middleware | VERIFIED | `login/page.tsx` lines 82-86: conditional blue message when `needsConsent` is true |
| 12 | If token storage fails during callback, user is logged in but sees a toast warning | VERIFIED | `callback/route.ts` lines 49-54: catch block redirects with `?token_error=1`; `login/page.tsx` lines 43-46: Sonner toast on `token_error` param |

**Plan 03 — UI Token Nudge:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 13 | Users without a stored Google token see a subtle warning badge on their avatar | PARTIAL | Badge component exists and renders amber dot, but shows for ALL users due to httpOnly cookie bug (see gaps) |
| 14 | Users can click Connect Google in the user dropdown menu to trigger OAuth consent | VERIFIED | `user-nav.tsx` lines 52-73: `Connect Google` DropdownMenuItem with `signInWithOAuth`, `prompt: "consent"`, full scope URLs |
| 15 | Badge disappears after user completes Google consent flow | FAILED | Cookie is set with `httpOnly: true` but badge reads `document.cookie` which cannot access httpOnly cookies. Badge never sees "valid" status. |

**Score:** 13/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/src/lib/token-encryption.ts` | AES-256-GCM encrypt/decrypt functions | VERIFIED | 44 lines, exports `encryptToken`, `decryptToken`, `getEncryptionKey` |
| `apps/agent/src/lib/__tests__/token-encryption.test.ts` | Unit tests (min 30 lines) | VERIFIED | 97 lines, 7 test cases |
| `apps/agent/prisma/schema.prisma` | UserGoogleToken model | VERIFIED | Model with userId unique, encrypted fields, tracking fields |
| `apps/agent/prisma/migrations/20260306131204_add_user_google_token/migration.sql` | Migration SQL | VERIFIED | CREATE TABLE + 3 indexes |
| `apps/agent/src/env.ts` | GOOGLE_TOKEN_ENCRYPTION_KEY env var | VERIFIED | Optional z.string().length(64) |
| `apps/agent/src/mastra/index.ts` | POST /tokens and GET /tokens/check routes | VERIFIED | Both routes with proper validation, encryption, upsert |
| `apps/web/src/lib/api-client.ts` | storeGoogleToken, checkGoogleToken | VERIFIED | Both exported, use fetchJSON pattern |
| `apps/web/src/app/auth/callback/route.ts` | Token capture from exchangeCodeForSession | VERIFIED | Extracts data.session.provider_refresh_token, stores via agent |
| `apps/web/src/app/login/page.tsx` | Expanded scopes, conditional prompt, re-consent UX | VERIFIED | Full scope URLs, offline access, conditional prompt, toast |
| `apps/web/src/middleware.ts` | Re-consent check with cookie cache | VERIFIED | Cookie cache with 1h TTL, graceful degradation |
| `apps/web/src/components/google-token-badge.tsx` | Badge reading cookie | PARTIAL | Reads document.cookie but cookie is httpOnly |
| `apps/web/src/components/user-nav.tsx` | Connect Google menu item + badge overlay | VERIFIED | Badge overlay on avatar, Connect Google with full OAuth |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mastra/index.ts` | `token-encryption.ts` | `import encryptToken` | WIRED | Line 15: `import { encryptToken } from "../lib/token-encryption"` |
| `mastra/index.ts` | `prisma.userGoogleToken` | upsert in POST handler | WIRED | Line 1269: `prisma.userGoogleToken.upsert(...)` |
| `env.ts` | `GOOGLE_TOKEN_ENCRYPTION_KEY` | zod validation | WIRED | Line 53: `GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().length(64).optional()` |
| `callback/route.ts` | `api-client.ts` | storeGoogleToken call | WIRED | Line 3: import; Line 33: `await storeGoogleToken(...)` |
| `middleware.ts` | agent /tokens/check | fetch call | WIRED | Lines 85-95: direct fetch with timeout and auth |
| `login/page.tsx` | signInWithOAuth | scopes and queryParams | WIRED | Lines 51-62: full OAuth config with scopes, offline, conditional prompt |
| `google-token-badge.tsx` | google-token-status cookie | document.cookie read | BROKEN | Cookie is httpOnly — client JS cannot read it |
| `user-nav.tsx` | signInWithOAuth | Connect Google menu item | WIRED | Lines 56-68: full OAuth config with consent prompt |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TOKS-01 | 22-01 | UserGoogleToken Prisma model per Supabase user ID | SATISFIED | Model in schema.prisma with userId unique constraint |
| TOKS-02 | 22-01 | AES-256-GCM encryption with GOOGLE_TOKEN_ENCRYPTION_KEY | SATISFIED | token-encryption.ts uses aes-256-gcm with dedicated env key |
| TOKS-03 | 22-01 | Encryption uses Node.js crypto only | SATISFIED | Only crypto module imports, no new dependencies |
| TOKS-04 | 22-01 | Auth callback stores encrypted token via agent API | SATISFIED | callback/route.ts calls storeGoogleToken after extracting refresh token |
| TOKS-05 | 22-01 | Tracks lastUsedAt, isValid, revokedAt | SATISFIED | All three fields present in UserGoogleToken model |
| OAUTH-01 | 22-02 | Login requests Drive, Slides, Docs scopes | SATISFIED | Full scope URLs in login page signInWithOAuth options |
| OAUTH-02 | 22-02 | Login requests offline access | SATISFIED | access_type: "offline" in queryParams |
| OAUTH-03 | 22-02, 22-03 | Consent screen appears on login | SATISFIED | Conditional prompt based on reconsent param; Connect Google always uses consent |
| OAUTH-04 | 22-02, 22-03 | Auth callback captures provider_refresh_token | SATISFIED | Extracts from exchangeCodeForSession data.session (not getSession) |

No orphaned requirements found. All 9 requirement IDs from ROADMAP are claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | No TODO/FIXME/placeholder patterns found | - | - |

No anti-patterns detected in any phase 22 files.

### Human Verification Required

### 1. End-to-end OAuth consent flow

**Test:** Sign in with Google, approve consent for Drive/Slides/Docs scopes, verify token stored in database.
**Expected:** Consent screen shows requested scopes, redirect succeeds, UserGoogleToken record created with encrypted data.
**Why human:** Requires live Google OAuth interaction, browser-based consent approval.

### 2. Returning user sees account picker (not consent)

**Test:** Sign out then sign in again (without deleting token record).
**Expected:** Google shows account picker (select_account), not consent screen.
**Why human:** Requires live OAuth to verify Google's prompt behavior.

### 3. Re-consent flow after token deletion

**Test:** Delete UserGoogleToken from database, clear google-token-status cookie, navigate to any page.
**Expected:** Middleware signs out user, redirects to /login?reconsent=1 with "We've upgraded Drive access" message.
**Why human:** Requires database manipulation and browser interaction.

### 4. Token storage failure toast

**Test:** Stop agent service, then complete OAuth consent.
**Expected:** User is logged in but sees Sonner toast "Drive access setup incomplete."
**Why human:** Requires service outage simulation and visual toast verification.

### Gaps Summary

One functional bug found affecting Plan 03's GoogleTokenBadge component:

The `google-token-status` cookie is set with `httpOnly: true` in both `middleware.ts` (lines 106, 114) and `auth/callback/route.ts` (line 44). However, `GoogleTokenBadge` attempts to read this cookie via `document.cookie` (line 17 of google-token-badge.tsx). HttpOnly cookies are by definition inaccessible from client-side JavaScript. This means:

1. The badge **always shows** for every user (including those with valid tokens), because `getCookieValue("google-token-status")` always returns `null`.
2. The badge **never disappears** after successful consent, because the "valid" cookie value is invisible to the client.

**Fix:** Either remove `httpOnly` from the `google-token-status` cookie (it contains no sensitive data -- just "valid" or "missing" strings, not tokens) in all three locations, OR refactor the badge to receive token status as a prop from a server component.

The core phase goal -- "Capture Google OAuth tokens with expanded scopes during login and store encrypted refresh tokens per user" -- is fully achieved. The gap is limited to the UI indicator (Plan 03), which is a supplementary feature.

---

_Verified: 2026-03-06T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
