---
phase: 23-user-delegated-api-clients-token-passthrough
plan: 01
subsystem: auth
tags: [google-oauth, oauth2client, token-cache, dual-mode-factory, cors, hono]
requirements_completed: [GAPI-01, GAPI-02, GAPI-03, GAPI-04, PASS-02]

# Dependency graph
requires:
  - phase: 22-oauth-scope-expansion-token-storage
    provides: "UserGoogleToken model with encrypted refresh tokens, token-encryption.ts"
provides:
  - "Dual-mode Google API factory functions (user token or service account)"
  - "In-memory token cache with 50min TTL and refresh-to-access-token exchange"
  - "extractGoogleAuth() request header extraction helper"
  - "CORS support for X-Google-Access-Token and X-User-Id headers"
affects: [23-02, 24-background-token-pool, 25-integration-verification]

# Tech tracking
tech-stack:
  added: [google-auth-library/OAuth2Client]
  patterns: [dual-mode-factory, request-header-auth-extraction, in-memory-token-cache]

key-files:
  created:
    - apps/agent/src/lib/token-cache.ts
    - apps/agent/src/lib/request-auth.ts
  modified:
    - apps/agent/src/lib/google-auth.ts
    - apps/agent/src/env.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Used minimal RequestContext interface instead of importing hono directly (avoids pnpm resolution issues)"
  - "Background staleness polling left on service account (no request context available)"
  - "Workflow start routes unchanged per plan (Phase 24 scope)"

patterns-established:
  - "Dual-mode factory: optional GoogleAuthOptions parameter defaults to service account"
  - "extractGoogleAuth(c) priority chain: access token -> userId refresh -> service account"
  - "Per-userId promise dedup prevents concurrent refresh races in token cache"

requirements-completed: [GAPI-01, GAPI-02, GAPI-03, GAPI-04, PASS-02]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 23 Plan 01: User-Delegated API Clients & Token Passthrough Summary

**Dual-mode Google API factories with OAuth2Client user delegation, in-memory token cache with refresh dedup, and request-auth header extraction wired into all interactive route handlers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T16:59:06Z
- **Completed:** 2026-03-06T17:04:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- getSlidesClient(), getDriveClient(), getDocsClient() now accept optional GoogleAuthOptions for user-delegated auth
- All 14+ existing callers continue working with zero changes (backward compatible optional parameter)
- Token cache exchanges encrypted refresh tokens for access tokens with 50min TTL and concurrent refresh dedup
- 4 interactive route handlers wired with extractGoogleAuth for token passthrough
- CORS updated to allow X-Google-Access-Token and X-User-Id custom headers

## Task Commits

Each task was committed atomically:

1. **Task 1: Env vars, token cache, request-auth helper, and dual-mode factories** - `78ac03a` (feat)
2. **Task 2: CORS headers and agent route wiring with extractGoogleAuth** - `a88e0e7` (feat)

## Files Created/Modified
- `apps/agent/src/env.ts` - Added GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required env vars
- `apps/agent/src/lib/token-cache.ts` - In-memory token cache with TTL, refresh exchange, promise dedup, and cache sweep
- `apps/agent/src/lib/request-auth.ts` - extractGoogleAuth() with priority chain for header extraction
- `apps/agent/src/lib/google-auth.ts` - Dual-mode factories accepting optional GoogleAuthOptions
- `apps/agent/src/mastra/index.ts` - CORS headers + extractGoogleAuth wired into 4 route handlers

## Decisions Made
- Used a minimal `RequestContext` interface in request-auth.ts instead of importing `hono` directly -- the hono package is nested in pnpm under @mastra/core and not directly resolvable
- Background staleness polling function (startStalenessPolling) left on service account since it runs without a request context
- Workflow start routes unchanged per plan instructions (Phase 24 will add token pool support)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed hono import resolution for request-auth.ts**
- **Found during:** Task 1
- **Issue:** `import type { Context } from "hono"` failed -- hono is a transitive dependency via @mastra/core, not directly installable
- **Fix:** Replaced with a minimal `RequestContext` interface matching the subset of Hono Context needed (just `req.header()`)
- **Files modified:** apps/agent/src/lib/request-auth.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 78ac03a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- interface-based approach is more portable and avoids coupling to Hono internals.

## Issues Encountered
None beyond the hono import resolution handled above.

## User Setup Required

The following environment variables must be added to the agent's `.env`:
- `GOOGLE_CLIENT_ID` - From Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs
- `GOOGLE_CLIENT_SECRET` - From same location, Client secret field

## Next Phase Readiness
- Agent-side dual-mode factories and token passthrough complete
- Ready for Plan 02: web-side fetchWithGoogleAuth wrapper and server action integration
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars needed on agent before token refresh will work

---
*Phase: 23-user-delegated-api-clients-token-passthrough*
*Completed: 2026-03-06*
