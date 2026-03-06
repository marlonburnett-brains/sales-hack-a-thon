---
phase: 22-oauth-scope-expansion-token-storage
plan: 02
subsystem: auth
tags: [google-oauth, supabase, scopes, refresh-token, middleware, cookie-cache, sonner]
requirements_completed: [OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04]

# Dependency graph
requires:
  - phase: 22-01
    provides: "POST /tokens and GET /tokens/check/:userId agent API endpoints"
provides:
  - "OAuth login with expanded Drive/Slides/Docs scopes and offline access"
  - "Auth callback token capture from exchangeCodeForSession and storage via agent API"
  - "storeGoogleToken() and checkGoogleToken() api-client functions"
  - "Middleware re-consent detection with 1h cookie cache"
  - "Login page conditional consent prompt and re-consent UX messaging"
affects: [22-03, 23, 24]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Cookie-cached middleware token check with graceful degradation", "Conditional OAuth prompt based on URL search params"]

key-files:
  created: []
  modified:
    - "apps/web/src/lib/api-client.ts"
    - "apps/web/src/app/auth/callback/route.ts"
    - "apps/web/src/app/login/page.tsx"
    - "apps/web/src/middleware.ts"

key-decisions:
  - "Cookie cache TTL set to 1 hour for google-token-status (balance between reliability and performance)"
  - "3s timeout on middleware agent fetch to avoid blocking page loads"
  - "Auth callback sets google-token-status=valid cookie on successful token storage to avoid immediate re-check"

patterns-established:
  - "Middleware cookie cache pattern: check cookie first, fetch agent API if absent, cache result"
  - "Conditional OAuth prompt: use URL search params to signal re-consent need"

requirements-completed: [OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 22 Plan 02: OAuth Web Flow Summary

**Expanded Google OAuth scopes (Drive/Slides/Docs) with offline access, auth callback refresh token capture and storage, middleware re-consent detection with cookie cache, and conditional consent prompt UX**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T16:16:10Z
- **Completed:** 2026-03-06T16:19:02Z
- **Tasks:** 3 of 4 (Task 4 is human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Login page requests Drive, Slides, Docs full scope URLs with offline access for refresh token capture
- Auth callback extracts provider_refresh_token from exchangeCodeForSession (not getSession) and stores via agent POST /tokens
- Middleware checks google-token-status cookie with 1h TTL, calls agent API when absent, signs out tokenless users with re-consent redirect
- Login page shows conditional consent prompt and re-consent messaging with Sonner toast for token errors

## Task Commits

Each task was committed atomically:

1. **Task 1: api-client token functions + auth callback token capture** - `ccc027c` (feat)
2. **Task 2: Login page scopes + conditional prompt + re-consent messaging** - `2ea701f` (feat)
3. **Task 3: Middleware re-consent detection with cookie cache** - `7235bab` (feat)

## Files Created/Modified
- `apps/web/src/lib/api-client.ts` - Added storeGoogleToken() and checkGoogleToken() functions
- `apps/web/src/app/auth/callback/route.ts` - Token capture from exchangeCodeForSession, storage via agent, cookie set on success, ?token_error=1 on failure
- `apps/web/src/app/login/page.tsx` - Expanded scopes, offline access, conditional prompt, re-consent message, token error toast
- `apps/web/src/middleware.ts` - Re-consent detection with cookie cache, agent API check, graceful degradation

## Decisions Made
- Cookie cache TTL set to 1 hour for google-token-status, balancing reliability (detecting token deletion within an hour) with performance (not hitting agent on every request)
- 3-second timeout on middleware agent fetch via AbortSignal.timeout to avoid blocking page loads if agent is down
- Auth callback sets google-token-status=valid cookie on successful token storage so middleware doesn't immediately re-check the user

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None beyond what Plan 01 already requires (GOOGLE_TOKEN_ENCRYPTION_KEY in agent .env).

## Next Phase Readiness
- Full OAuth scope expansion and token capture pipeline complete
- Awaiting human verification (Task 4 checkpoint) of end-to-end flow
- Plan 03 (badge/profile UX) can proceed after verification
- Phase 23-24 can use stored tokens for Google API calls

---
*Phase: 22-oauth-scope-expansion-token-storage*
*Completed: 2026-03-06*
