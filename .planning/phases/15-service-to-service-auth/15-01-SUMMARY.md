---
phase: 15-service-to-service-auth
plan: 01
subsystem: auth
tags: [api-key, mastra, simpleauth, hono, middleware, service-auth]

# Dependency graph
requires:
  - phase: 14-database-migration
    provides: PostgreSQL database and Mastra server with custom API routes
provides:
  - SimpleAuth middleware on agent server rejecting unauthorized requests with 401
  - /health public endpoint for monitoring
  - X-API-Key header injection on all web-to-agent requests
  - AGENT_API_KEY env validation in both apps via @t3-oss/env
affects: [16-google-oauth-login-wall, 17-deployment]

# Tech tracking
tech-stack:
  added: [SimpleAuth from @mastra/core/server]
  patterns: [shared-api-key service auth, public-path allowlist, env-first config]

key-files:
  created: []
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/env.ts
    - apps/agent/.env.example
    - apps/web/src/env.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/.env.example

key-decisions:
  - "SimpleAuth with X-API-Key header (not Authorization Bearer) to avoid collision with future user auth"
  - "Dev mode keeps /api/* routes public for Mastra playground/docs accessibility"
  - "/health endpoint public with requiresAuth: false for uptime monitoring"

patterns-established:
  - "Service auth: shared AGENT_API_KEY validated via @t3-oss/env Zod schemas in both apps"
  - "Public path allowlist: SimpleAuth public array with string + RegExp entries"
  - "Header injection: X-API-Key added in fetchJSON (before spread) and uploadTouch1Override (explicit headers)"

requirements-completed: [AUTH-06, AUTH-07]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 15 Plan 01: Service-to-Service Auth Summary

**Shared API key auth between web and agent using Mastra SimpleAuth middleware with X-API-Key header**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T03:28:54Z
- **Completed:** 2026-03-05T03:32:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Agent server rejects all requests without valid X-API-Key header with 401
- /health endpoint responds 200 without any API key for monitoring
- Web app sends X-API-Key header on every outbound agent request (fetchJSON + uploadTouch1Override)
- AGENT_API_KEY validated via Zod schemas in both apps with .env.example documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent-side auth middleware and health check** - `ecc7b90` (feat)
2. **Task 2: Web-side header injection and env setup** - `9df3d69` (feat)

**Plan metadata:** `d02e270` (docs: complete plan)

## Files Created/Modified
- `apps/agent/src/mastra/index.ts` - Added SimpleAuth middleware config, /health route, auth in server config
- `apps/agent/src/env.ts` - Added AGENT_API_KEY to server schema
- `apps/agent/.env.example` - Added AGENT_API_KEY placeholder
- `apps/web/src/env.ts` - Added AGENT_API_KEY to server schema and runtimeEnv
- `apps/web/src/lib/api-client.ts` - Added X-API-Key header to fetchJSON and uploadTouch1Override
- `apps/web/.env.example` - Added AGENT_API_KEY placeholder

## Decisions Made
- Used X-API-Key header (not Authorization Bearer) to avoid collision with future Google OAuth user auth (Phase 16)
- Dev mode keeps /api/* routes public so Mastra playground and docs remain accessible without a key during development
- /health endpoint is public with requiresAuth: false for uptime monitoring in production

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
Users must add `AGENT_API_KEY=dev-api-key-change-me` to:
- `apps/agent/.env` (if not already present)
- `apps/web/.env.local` (if not already present)

Both .env files are gitignored. The .env.example files document the required variable.

## Next Phase Readiness
- Service-to-service auth is in place; all agent endpoints are protected
- Ready for Phase 16 (Google OAuth Login Wall) which adds user-level authentication
- The X-API-Key header was intentionally chosen to not conflict with future Authorization Bearer tokens

## Self-Check: PASSED

All 6 modified files verified on disk. Both task commits (ecc7b90, 9df3d69) verified in git log.

---
*Phase: 15-service-to-service-auth*
*Completed: 2026-03-05*
