---
phase: 23-user-delegated-api-clients-token-passthrough
plan: 02
subsystem: auth
tags: [google-oauth, supabase, token-passthrough, server-actions, next.js]
requirements_completed: [PASS-01, PASS-03, PASS-04]

# Dependency graph
requires:
  - phase: 23-01
    provides: "Agent-side extractGoogleAuth + dual-mode Google API factories"
provides:
  - "getGoogleAccessToken helper for Supabase session token extraction"
  - "fetchWithGoogleAuth wrapper that attaches X-Google-Access-Token and X-User-Id headers"
  - "9 Google-triggering API functions wired through fetchWithGoogleAuth"
affects: [24-workflow-google-passthrough]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fetchWithGoogleAuth wrapper for selective Google header injection"]

key-files:
  created:
    - apps/web/src/lib/supabase/google-token.ts
  modified:
    - apps/web/src/lib/api-client.ts

key-decisions:
  - "Server Actions need no changes -- api-client.ts internals handle passthrough transparently"
  - "Only Google-triggering functions use fetchWithGoogleAuth; CRUD operations stay on fetchJSON"

patterns-established:
  - "fetchWithGoogleAuth: use for any API call that triggers Google API on agent side"
  - "getGoogleAccessToken: single extraction point for Supabase session Google credentials"

requirements-completed: [PASS-01, PASS-03, PASS-04]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 23 Plan 02: Web-Side Token Passthrough Summary

**fetchWithGoogleAuth wrapper extracting Supabase Google tokens and injecting X-Google-Access-Token/X-User-Id headers on 9 Google-triggering API functions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T17:06:29Z
- **Completed:** 2026-03-06T17:09:02Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created google-token.ts: extracts provider_token and userId from Supabase session
- Added fetchWithGoogleAuth to api-client.ts alongside existing fetchJSON
- Switched 9 Google-triggering functions (createTemplate, checkTemplateStaleness, triggerIngestion, getSlideThumbnails, 5 workflow starts) to fetchWithGoogleAuth
- Verified Server Actions need zero changes -- api-client internals handle passthrough transparently
- Full passthrough chain verified: Server Action -> api-client (fetchWithGoogleAuth) -> getGoogleAccessToken -> headers -> agent extractGoogleAuth

## Task Commits

Each task was committed atomically:

1. **Task 1: Google token helper and fetchWithGoogleAuth wrapper** - `43c01af` (feat)
2. **Task 2: Server Action wiring verification** - No commit needed (verification-only, no file changes)

## Files Created/Modified
- `apps/web/src/lib/supabase/google-token.ts` - Extracts Google access token and user ID from Supabase session
- `apps/web/src/lib/api-client.ts` - Added fetchWithGoogleAuth wrapper + switched 9 functions from fetchJSON

## Decisions Made
- Server Actions (template-actions.ts, slide-actions.ts, touch-actions.ts) need no modifications since they call api-client.ts exports which now internally use fetchWithGoogleAuth
- Only Google-triggering functions switched to fetchWithGoogleAuth; all CRUD operations (companies, deals, briefs, asset reviews, workflow status/resume, listSlides, etc.) remain on plain fetchJSON

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in test files (template-card.test.tsx, template-table.test.tsx) and agent mastra/index.ts -- all unrelated to our changes, not addressed per scope boundary rules

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- End-to-end token passthrough pipeline complete: browser session -> Server Action -> api-client (fetchWithGoogleAuth) -> Google headers -> agent (extractGoogleAuth) -> dual-mode factory
- Phase 24 can wire workflow start routes to use request context for Google auth

---
*Phase: 23-user-delegated-api-clients-token-passthrough*
*Completed: 2026-03-06*

## Self-Check: PASSED
