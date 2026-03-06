---
phase: 24-token-pool-refresh-lifecycle
plan: 01
subsystem: auth
tags: [google-auth, token-pool, oauth2, prisma, actionrequired, background-jobs]

# Dependency graph
requires:
  - phase: 22-encrypted-token-storage
    provides: UserGoogleToken model, encryptToken/decryptToken helpers
  - phase: 23-user-delegated-api-clients
    provides: GoogleAuthOptions pattern, getDriveClient/getSlidesClient dual-mode
provides:
  - getPooledGoogleAuth() function for background job auth with pool iteration
  - ActionRequired Prisma model with migration for tracking user actions
  - ActionRequired CRUD API routes (GET /actions, GET /actions/count, PATCH /actions/:id/resolve)
  - Token rotation capture via OAuth2Client tokens event listener
  - Pool health monitoring (console warning at < 3 valid tokens)
  - Auto-resolve of reauth_needed actions on re-login
affects: [24-02, token-pool-monitoring, admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [pooled-auth-iteration, fire-and-forget-db-updates, action-required-pattern]

key-files:
  created:
    - apps/agent/prisma/migrations/20260306170000_add_action_required/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/lib/google-auth.ts
    - apps/agent/src/lib/slide-extractor.ts
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/agent/src/ingestion/ingestion-queue.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Used manual migration + resolve --applied for drift recovery (0_init modified)"
  - "getPooledGoogleAuth iterates ALL valid tokens, no cap (per locked decision)"
  - "Pool health check counts after successful hit AND after exhaustion"
  - "ActionRequired uses findFirst pattern (no unique constraint on resourceId+actionType)"

patterns-established:
  - "Pooled auth pattern: getPooledGoogleAuth() tries all user tokens before SA fallback"
  - "ActionRequired pattern: background jobs create action items, user actions auto-resolve them"
  - "Fire-and-forget DB updates: lastUsedAt, token rotation, reauth actions use .catch(() => {})"

requirements-completed: [POOL-01, POOL-02, POOL-03, POOL-04, POOL-05, LIFE-01, LIFE-02, LIFE-03]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 24 Plan 01: Token Pool & ActionRequired Summary

**Pooled user token auth for background jobs with ActionRequired model for tracking manual user actions**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T17:36:39Z
- **Completed:** 2026-03-06T17:43:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- getPooledGoogleAuth() iterates all valid user refresh tokens (ordered by lastUsedAt DESC) before falling back to service account
- ActionRequired Prisma model with indexes on resolved, userId, actionType
- Background staleness polling and ingestion queue both use pooled auth
- SA permission errors (403/404) create share_with_sa ActionRequired records
- Token rotation from Google captured via OAuth2Client 'tokens' event
- Pool health warning logged when < 3 valid tokens remain
- CRUD API routes for ActionRequired management
- POST /tokens auto-resolves reauth_needed actions on re-login

## Task Commits

Each task was committed atomically:

1. **Task 1: ActionRequired model, getPooledGoogleAuth, and token rotation** - `58a9c51` (feat)
2. **Task 2: Wire background jobs to pooled auth and add ActionRequired CRUD routes** - `43f96dd` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added ActionRequired model
- `apps/agent/prisma/migrations/20260306170000_add_action_required/migration.sql` - ActionRequired table migration
- `apps/agent/src/lib/google-auth.ts` - Added getPooledGoogleAuth(), PooledAuthResult interface
- `apps/agent/src/lib/slide-extractor.ts` - Added optional GoogleAuthOptions parameter
- `apps/agent/src/ingestion/ingest-template.ts` - Added optional GoogleAuthOptions parameter
- `apps/agent/src/ingestion/ingestion-queue.ts` - Wired pooled auth before ingestTemplate calls
- `apps/agent/src/mastra/index.ts` - Wired pooled auth to staleness polling, added ActionRequired CRUD routes, auto-resolve on token store

## Decisions Made
- Used manual migration + resolve --applied for drift recovery (0_init migration was modified, per CLAUDE.md never reset)
- getPooledGoogleAuth iterates ALL valid tokens with no cap (per locked decision from research)
- Pool health check runs after successful hit and after exhaustion to catch degradation early
- ActionRequired uses findFirst + create pattern since no unique constraint on compound fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration drift recovery for 0_init**
- **Found during:** Task 1 (ActionRequired model)
- **Issue:** `prisma migrate dev` refused to run because 0_init migration was modified after application
- **Fix:** Created migration SQL manually, applied via `prisma db execute`, marked as applied with `prisma migrate resolve --applied`
- **Files modified:** apps/agent/prisma/migrations/20260306170000_add_action_required/migration.sql
- **Verification:** `prisma validate` passes, `prisma generate` succeeds
- **Committed in:** 58a9c51 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration drift was a known recurring issue. Manual migration + resolve approach follows CLAUDE.md discipline. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in mastra/index.ts (workflow resume, ZodError.errors) and touch-4-workflow.ts -- these are not related to this plan's changes and were verified unchanged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pooled auth system complete and wired to all background jobs
- ActionRequired CRUD routes available for web dashboard integration
- Ready for Plan 02 (if exists) to add monitoring, dashboards, or further lifecycle features

---
*Phase: 24-token-pool-refresh-lifecycle*
*Completed: 2026-03-06*
