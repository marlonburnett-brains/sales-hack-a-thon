---
status: awaiting_human_verify
trigger: "User seeing 'Re-authentication needed' too frequently. Google OAuth refresh tokens not working properly."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T02:00:00Z
---

## Current Focus

hypothesis: TWO root causes -- (1) getVerifiedUserId() is broken (sync call to async function + missing supabaseUrl arg), so the agent never gets userId from JWT, meaning user requests never trigger agent-side refresh after the first ~1h when Supabase provider_token becomes null. (2) The google-token-status cookie (maxAge 1h) expiry triggers middleware check which finds token invalid -> shows reauth banner.
test: Fix getVerifiedUserId to properly await the async JWT verification and pass supabaseUrl. This enables agent-side token refresh for user requests.
expecting: After fix, user requests will properly extract userId from JWT and use agent-side token refresh, keeping access alive indefinitely.
next_action: Apply the fix to getVerifiedUserId, revert wrong DEPLOY.md changes, and verify.

## Symptoms

expected: Once a user connects their Google account via OAuth, the refresh token should keep the session alive indefinitely. The "Re-authentication needed" banner should rarely appear.
actual: The "Re-authentication needed for marlon.burnett@lumenalta.com" action item keeps appearing within ~1 hour, stating "Your Google token has expired or been revoked."
errors: "Your Google token has expired or been revoked."
reproduction: Use the app normally; after ~1 hour the re-auth banner appears requiring reconnection
started: Recurring issue, happening repeatedly

## Eliminated

- hypothesis: Token storage is broken (refresh token not persisted)
  evidence: POST /tokens upserts correctly with encrypted refresh token, isValid=true; callback route captures provider_refresh_token correctly
  timestamp: 2026-03-09T00:20:00Z

- hypothesis: Middleware is signing user out (previous bug)
  evidence: Previous debug session (google-reauth-loop.md) already fixed this. Middleware now only sets informational cookie, never signs out.
  timestamp: 2026-03-09T00:30:00Z

- hypothesis: Re-auth action items not being resolved on reconnect
  evidence: POST /tokens handler at line 2163 auto-resolves reauth_needed actions via updateMany. Flow is correct.
  timestamp: 2026-03-09T00:35:00Z

- hypothesis: Login page missing access_type:offline or prompt:consent
  evidence: Both login page and "Connect Google" buttons correctly use access_type:"offline" and prompt:"consent"
  timestamp: 2026-03-09T00:40:00Z

- hypothesis: Google OAuth consent screen in "Testing" mode (7-day expiry)
  evidence: User confirmed tokens expire within ~1 hour, not 7 days. The 1h timing matches Google access token lifetime + cache TTL, not refresh token expiry policy.
  timestamp: 2026-03-09T01:30:00Z

## Evidence

- timestamp: 2026-03-09T00:15:00Z
  checked: apps/agent/src/lib/token-cache.ts - isDefinitiveTokenError()
  found: Catches "invalid_grant" as definitive error, marks token isValid=false, creates reauth_needed action item
  implication: The invalidation logic handles errors correctly

- timestamp: 2026-03-09T00:20:00Z
  checked: apps/agent/src/mastra/index.ts lines 2128-2200 (POST /tokens)
  found: Properly upserts with isValid=true, clears revokedAt, auto-resolves reauth_needed actions
  implication: Token storage and reconnection flow works correctly

- timestamp: 2026-03-09T01:30:00Z
  checked: User report
  found: Tokens expire within ~1 hour, not 7 days
  implication: Not a consent screen Testing mode issue. 1h matches Google access token lifetime.

- timestamp: 2026-03-09T01:45:00Z
  checked: apps/agent/src/lib/request-auth.ts lines 60-66 (getVerifiedUserId)
  found: CRITICAL BUG -- getVerifiedUserId() calls verifySupabaseJwt(token) without awaiting the async function AND without passing the required supabaseUrl parameter. The function signature is `async function verifySupabaseJwt(token, supabaseUrl): Promise<JwtPayload | null>` but it's called as `verifySupabaseJwt(token)` synchronously. Result: payload is a Promise object, payload?.sub is undefined, getVerifiedUserId ALWAYS returns undefined.
  implication: extractGoogleAuth() never gets a verifiedUserId, so it can never fall through to Priority 2 (agent-side refresh via getAccessTokenForUser). After the first ~1h when Supabase provider_token becomes null, user requests silently fall to service account instead of using the stored refresh token.

- timestamp: 2026-03-09T01:50:00Z
  checked: apps/web/src/lib/supabase/google-token.ts + fetchWithGoogleAuth in api-client.ts
  found: getGoogleAccessToken() returns session.provider_token which becomes null after ~1h (Supabase doesn't persist provider tokens across session refreshes). fetchWithGoogleAuth only sends X-Google-Access-Token if non-null. After ~1h, no Google token header is sent.
  implication: After ~1h, requests rely entirely on agent-side userId-based refresh. But getVerifiedUserId is broken, so userId is never available -> no refresh -> falls to SA.

- timestamp: 2026-03-09T01:55:00Z
  checked: Background staleness polling (index.ts lines 445-528)
  found: Polls every 5min using getPooledGoogleAuth() which calls getAccessTokenForUser() for ALL valid tokens. This IS the only code path that exercises the refresh logic. If refresh fails here (e.g., first refresh attempt after login fails), token gets marked invalid + reauth action created.
  implication: The reauth action is being triggered by staleness polling, not by user requests. But the broken getVerifiedUserId means user requests after 1h would use SA fallback regardless.

## Resolution

root_cause: |
  getVerifiedUserId() in request-auth.ts is fundamentally broken:
  1. It calls verifySupabaseJwt(token) without the required `supabaseUrl` parameter
  2. It doesn't await the async function -- returns a Promise instead of JwtPayload
  3. Result: ALWAYS returns undefined

  This means extractGoogleAuth() never has a verified userId, so after the first ~1h when
  Supabase's provider_token becomes null, user requests cannot trigger agent-side token
  refresh. They silently fall back to service account.

  Meanwhile, background staleness polling IS the only path exercising the stored refresh token.
  When the first refresh attempt in polling fails (potentially due to timing, or the very first
  refresh after a deploy), the token gets marked invalid and the reauth action item is created.

  The google-token-status cookie (maxAge: 3600 = 1h) expiry triggers the middleware check,
  which finds isValid: false and shows the banner -- hence the ~1h timing.

fix: |
  1. Fix getVerifiedUserId() to be async, await verifySupabaseJwt, and pass env.SUPABASE_URL
  2. Update all callers to await getVerifiedUserId()
  3. Revert DEPLOY.md changes from wrong hypothesis

verification: |
  - request-auth tests pass (5/5)
  - TypeScript compiles (no new errors from changes)
  - DEPLOY.md reverted to original
  - Awaiting user verification: deploy and confirm tokens persist beyond 1h

files_changed:
  - apps/agent/src/lib/request-auth.ts (fix getVerifiedUserId: async + await + supabaseUrl param)
  - apps/agent/src/mastra/index.ts (6 call sites: await getVerifiedUserId(c, env.SUPABASE_URL))
  - apps/agent/src/lib/token-cache.ts (improved error logging + action item description)
