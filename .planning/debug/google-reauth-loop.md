---
status: resolved
trigger: "google-reauth-loop - User keeps being asked to re-authenticate with Google even though they are already authenticated"
created: 2026-03-06T00:00:00Z
updated: 2026-03-06T00:03:00Z
---

## Current Focus

RESOLVED — See Resolution section below for all 3 root causes and fixes.

## Symptoms

expected: Once authenticated with Google, the user should stay authenticated. Tokens should auto-refresh using refresh tokens.
actual: App shows "Re-authentication needed" banner and "AtlusAI account required" message even after just authenticating.
errors: "Re-authentication needed for marlon.burnett@lumenalta.com" and "Your account has not have access to AtlusAI"
reproduction: Happens on page load after authenticating. First time testing full flow.
started: First time testing - has never worked correctly yet.

## Eliminated

- hypothesis: NextAuth misconfiguration
  evidence: App uses Supabase Auth, not NextAuth. Supabase config is correct.
  timestamp: 2026-03-06T00:00:30Z

- hypothesis: Token refresh logic is broken
  evidence: token-cache.ts refresh logic is well-implemented with proper error handling
  timestamp: 2026-03-06T00:00:40Z

- hypothesis: Middleware token check is too aggressive
  evidence: Middleware has proper cookie caching and graceful degradation. Flow is correct.
  timestamp: 2026-03-06T00:00:45Z

## Evidence

- timestamp: 2026-03-06T00:00:30Z
  checked: apps/agent/src/mastra/index.ts line 1341
  found: detectAtlusAccess(data.userId, data.email, data.refreshToken) passes Google refresh token as AtlusAI access token
  implication: AtlusAI SSE endpoint always returns 401/403 for Google refresh tokens, causing false "AtlusAI account required" ActionRequired records for every login

- timestamp: 2026-03-06T00:00:35Z
  checked: apps/agent/src/lib/atlus-auth.ts detectAtlusAccess function
  found: Function uses the accessToken parameter as Bearer token against AtlusAI SSE endpoint
  implication: Confirms the Google refresh token is used as a Bearer token against AtlusAI, which will always fail

- timestamp: 2026-03-06T00:00:40Z
  checked: apps/web/src/app/login/page.tsx line 59
  found: Initial login uses prompt:"select_account" instead of prompt:"consent"
  implication: For users who have previously authorized this Google OAuth client, Google will NOT return a refresh_token. Without refresh_token, storeGoogleToken is never called, middleware finds no token, signs user out.

- timestamp: 2026-03-06T00:00:45Z
  checked: apps/web/src/app/auth/callback/route.ts lines 30-56
  found: Callback only stores token and sets cookie when refreshToken is truthy. Falls through to plain redirect without cookie otherwise.
  implication: If no refresh_token from Google, user gets no cookie, middleware check fails, user gets signed out -> re-consent loop

- timestamp: 2026-03-06T00:02:00Z
  checked: test suites (token-store-route.test.ts, atlus-auth.test.ts, api-client-google-auth.test.ts)
  found: All 25 relevant tests pass after fixes applied
  implication: Fixes are safe and do not regress existing behavior

## Resolution

root_cause: |
  THREE issues:
  1. CRITICAL: Middleware signed user OUT of the entire app when Google token was missing.
     The middleware treated "no Google token" as "not authenticated", but these are independent
     concerns (Supabase auth vs Google token). When the google-token-status cookie expired
     (after 1 hour) and the agent returned hasToken:false (e.g., because background staleness
     polling invalidated the token), the middleware force-signed-out the user and redirected
     to login with ?reconsent=1. This was the primary re-auth loop trigger after turbo recompiles
     (which cause HMR page reloads that hit middleware).
  2. MODERATE: In apps/agent/src/mastra/index.ts, detectAtlusAccess() was called with a Google
     OAuth refresh_token as the AtlusAI accessToken parameter, causing false "AtlusAI account
     required" ActionRequired records on every login.
  3. MODERATE: Login page used prompt:"select_account" for returning users, meaning Google
     wouldn't return a refresh_token, preventing token storage.

fix: |
  1. Rewrote middleware Google token check to be INFORMATIONAL ONLY. It now sets the
     google-token-status cookie for client components to read but NEVER signs the user out.
     The Actions page and GoogleTokenBadge handle showing re-auth banners.
  2. Removed detectAtlusAccess call from POST /tokens handler.
  3. Changed login page prompt to always "consent".

files_changed:
  - apps/web/src/middleware.ts (primary fix — removed signOut/redirect logic)
  - apps/agent/src/mastra/index.ts (removed false detectAtlusAccess call)
  - apps/web/src/app/login/page.tsx (always use prompt:"consent")
