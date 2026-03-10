---
status: awaiting_human_verify
trigger: "Google OAuth tokens are being marked as expired/revoked far too early (2-10 minutes instead of ~1 hour)"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T23:50:00Z
---

## Current Focus

hypothesis: CONFIRMED - firstFailureAt not cleared on re-auth + single-failure invalidation after cooldown
test: Applied fix (resetTokenState export + consecutive failure guard), all tests pass
expecting: Tokens survive re-authentication and are not prematurely invalidated after ingestion errors
next_action: User verification in dev environment

## Symptoms

expected: Google OAuth tokens should remain valid for ~1 hour with automatic refresh via refresh tokens
actual: User forced to re-authenticate every 2-10 minutes. UI shows "Your Google token has expired or been revoked"
errors: "Re-authentication needed for marlon.burnett@lumenalta.com - Your Google token has expired or been revoked"
reproduction: Normal app usage - happens consistently after 2-10 min
started: Currently happening, ongoing

## Eliminated

- hypothesis: Token storage is broken (prior investigation confirmed upsert works correctly)
  evidence: POST /tokens upserts correctly with encrypted refresh token, isValid=true
  timestamp: 2026-03-10T22:00:00Z

- hypothesis: Middleware signing user out (prior investigation fixed this)
  evidence: Middleware only sets informational cookie, never signs out
  timestamp: 2026-03-10T22:00:00Z

- hypothesis: Multiple code paths invalidating Google tokens
  evidence: Only token-cache.ts doRefresh catch block creates reauth_needed records. No other file marks userGoogleToken.isValid=false for Google tokens. Confirmed by exhaustive search of all prisma.userGoogleToken.update, prisma.actionRequired.create, and reauth_needed references across entire codebase.
  timestamp: 2026-03-10T22:10:00Z (re-confirmed 2026-03-10T23:30:00Z with widened search)

- hypothesis: Google API call errors (from Slides/Drive usage) triggering invalidation
  evidence: Generation code (route-strategy, multi-source-assembler, etc.) does NOT have any token invalidation logic. Errors from API calls don't propagate to token-cache.
  timestamp: 2026-03-10T22:15:00Z

- hypothesis: Web app or middleware invalidating tokens
  evidence: No code in apps/web writes to userGoogleToken or creates reauth_needed actions. Middleware only reads cookie, never writes to DB.
  timestamp: 2026-03-10T23:30:00Z

- hypothesis: Supabase webhooks or DB triggers invalidating tokens
  evidence: No webhooks, no Prisma middleware, no DB triggers found.
  timestamp: 2026-03-10T23:30:00Z

- hypothesis: Ingestion error code directly invalidates tokens
  evidence: ingest-template.ts catch blocks only set template.ingestionStatus="failed". No token invalidation. ingestion-queue.ts catch block only logs. The INDIRECT path is: ingestion calls getPooledGoogleAuth() which calls doRefresh() — if refresh fails with definitive error, cooldown starts.
  timestamp: 2026-03-10T23:35:00Z

## Evidence

- timestamp: 2026-03-10T22:05:00Z
  checked: apps/agent/src/lib/token-cache.ts - isDefinitiveTokenError()
  found: Function includes overly broad patterns - 'access_denied' and 'invalid_client'/'unauthorized_client' were treated as definitive token errors. 'access_denied' can appear in non-token contexts. 'invalid_client' indicates a deployment config problem (wrong GOOGLE_CLIENT_ID/SECRET), NOT a user token issue.
  implication: Config errors and non-auth errors could permanently burn user tokens

- timestamp: 2026-03-10T22:10:00Z
  checked: Mastra dev hot-reload behavior
  found: mastra dev uses hot-reload that restarts the server process on file changes. Each restart clears the in-memory token cache (Map). The first request after restart triggers doRefresh(), and if it fails with any "definitive" error, the token is immediately and permanently invalidated.
  implication: Frequent restarts + aggressive invalidation = tokens burned within minutes

- timestamp: 2026-03-10T22:15:00Z
  checked: Background polling triggers (startStalenessPolling)
  found: Staleness polling runs 60s after startup, calls getPooledGoogleAuth() -> getAccessTokenForUser() -> doRefresh(). This is the FIRST thing to exercise the refresh token after a server restart. If it fails, the token is immediately invalidated.
  implication: Each hot-reload restart triggers a refresh attempt within 60s. If the refresh token exchange fails (e.g., Google client credentials mismatch, Testing mode, or transient error), token is burned.

- timestamp: 2026-03-10T22:20:00Z
  checked: Token invalidation - no retry/cooldown protection
  found: doRefresh immediately marks tokens invalid on FIRST definitive error. No retry, no cooldown, no grace period. A single transient Google-side error or post-restart timing issue burns the token permanently.
  implication: Single-failure invalidation is too aggressive for a dev environment with hot-reload

- timestamp: 2026-03-10T22:25:00Z
  checked: Prior debug session (google-reauth-token-expiry.md)
  found: Previous investigation fixed getVerifiedUserId() async/await bug. That fix is in place. But the issue persists with a SHORTER timeframe (2-10 min vs 1 hour), indicating a different/additional root cause.
  implication: Multiple overlapping issues contributed to the problem

- timestamp: 2026-03-10T23:30:00Z
  checked: Exhaustive search of ALL code paths that write actionRequired records or set isValid=false
  found: Only token-cache.ts creates reauth_needed records and sets userGoogleToken.isValid=false. No other file does this. atlus-auth.ts and mcp-client.ts only write to userAtlusToken (different table). mastra/index.ts creates share_with_sa actions (different type). No web-side code writes to these tables.
  implication: Previous elimination was correct — token-cache.ts is the sole source of premature invalidation.

- timestamp: 2026-03-10T23:35:00Z
  checked: firstFailureAt map lifecycle across re-authentication
  found: CRITICAL BUG — when POST /tokens stores a new refresh token, it sets isValid=true in DB and resolves reauth_needed actions, BUT it does NOT clear the in-memory firstFailureAt map in token-cache.ts. If a previous doRefresh failure set firstFailureAt at T=0, and the user re-authenticates at T=3min, firstFailureAt still points to T=0. At T=5min when doRefresh runs again, the cooldown check (5min - 0min >= 5min) passes, and the FRESHLY STORED token is immediately invalidated.
  implication: This explains why the 5-minute cooldown fix was insufficient — re-authentication doesn't reset the failure clock.

- timestamp: 2026-03-10T23:40:00Z
  checked: Interaction between ingestion errors and token invalidation
  found: Ingestion queue calls getPooledGoogleAuth() for each template. If doRefresh fails (e.g., invalid_grant), firstFailureAt is set. Multiple templates in the queue process sequentially, each calling getPooledGoogleAuth(). If ingestion takes > 5 minutes (common with 50+ slides), the second call's cooldown check passes and the token is invalidated. This is the "after ingestion error" pattern the user described.
  implication: Long ingestion runs + persistent refresh failures = token invalidated mid-run.

- timestamp: 2026-03-10T23:45:00Z
  checked: Single failure causing invalidation after cooldown
  found: The cooldown only required ONE failure after the window elapsed. A single transient Google error that happens to match 'invalid_grant' pattern would invalidate the token. No consecutive failure requirement existed.
  implication: Added consecutive failure requirement (3 failures) on top of cooldown for defense in depth.

## Resolution

root_cause: |
  The previous fix (cooldown + narrowed error patterns) was insufficient because of
  two additional issues discovered through widened investigation:

  **Issue 1: firstFailureAt not cleared on re-authentication (PRIMARY)**
  When POST /tokens stores a new refresh token, it correctly sets isValid=true and
  resolves reauth_needed actions. But it does NOT clear the in-memory firstFailureAt
  map in token-cache.ts. This means:
  - T=0: doRefresh fails -> firstFailureAt[userId] = T0
  - T=3min: User re-authenticates -> new token in DB, reauth resolved
  - BUT firstFailureAt[userId] still = T0 (not cleared!)
  - T=5min: doRefresh called again -> cooldown check: 5min >= 5min -> INVALIDATES the FRESH token
  This explains why re-authentication "doesn't stick" — the failure clock was never reset.

  **Issue 2: Single failure after cooldown window was sufficient for invalidation**
  The original cooldown only checked whether the time window had elapsed, but required
  only ONE failure after the window to invalidate. A single transient Google error
  that happens to contain 'invalid_grant' would trigger invalidation.

  **Connection to "after ingestion errors" pattern:**
  Ingestion queue calls getPooledGoogleAuth() for each template. If refresh fails
  (sets firstFailureAt), and the ingestion run takes > 5 minutes (common with 50+ slides),
  the next template's getPooledGoogleAuth() call triggers doRefresh again. The cooldown
  has elapsed, so the token is immediately invalidated mid-run. The user sees the
  reauth_needed banner appear "after an error in the ingestion process."

fix: |
  Three changes across two files:

  1. **resetTokenState() exported from token-cache.ts** (NEW):
     Clears in-memory cache, firstFailureAt, and consecutiveFailures for a userId.
     Called from POST /tokens route when new refresh token is stored, breaking the
     stale-cooldown-timer bug.

  2. **Consecutive failure guard** (NEW):
     Require 3 consecutive definitive failures AFTER the cooldown window before
     invalidating. A single transient error no longer triggers invalidation.
     `consecutiveFailures` map tracks count, reset on success and on resetTokenState().

  3. **classifyTokenError() replaces isDefinitiveTokenError()** (REFINED):
     Three-way classification: 'config' (never invalidate), 'definitive' (guarded),
     'transient' (never invalidate). Better logging for each category. Uses case-
     insensitive matching for definitive patterns.

  4. **POST /tokens calls resetTokenState()** (NEW in mastra/index.ts):
     After upserting the new refresh token and before re-queuing failed templates,
     resetTokenState(userId) is called to clear all in-memory failure tracking.

verification: |
  - token-cache tests: 9/9 pass (7 original + 2 new for resetTokenState)
  - request-auth tests: 5/5 pass
  - token-store-route tests: 4/4 pass
  - TypeScript compilation: no new errors from changes
  - Awaiting user verification in dev environment

files_changed:
  - apps/agent/src/lib/token-cache.ts (resetTokenState, consecutive failure guard, classifyTokenError)
  - apps/agent/src/lib/__tests__/token-cache.test.ts (2 new tests for resetTokenState)
  - apps/agent/src/mastra/index.ts (import resetTokenState, call in POST /tokens handler)
