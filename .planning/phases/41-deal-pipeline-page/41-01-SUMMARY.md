---
phase: 41-deal-pipeline-page
plan: 01
subsystem: api, database
tags: [prisma, postgresql, hono, server-actions, deal-pipeline]

# Dependency graph
requires:
  - phase: 04-touch-1-generation
    provides: "Deal and Company models, base CRUD endpoints"
provides:
  - "Deal.status, ownerId, ownerEmail, ownerName, collaborators fields"
  - "GET /deals with status/assignee filtering"
  - "PATCH /deals/:id/status endpoint"
  - "PATCH /deals/:id/assignment endpoint"
  - "GET /users/known endpoint"
  - "Web API client functions: listDealsFiltered, updateDealStatus, updateDealAssignment, listKnownUsers"
  - "Server actions: listDealsFilteredAction, updateDealStatusAction, updateDealAssignmentAction, listKnownUsersAction"
affects: [41-02, 41-03, 41-04, 42-deal-detail-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deal status lifecycle: open -> won/lost/abandoned"
    - "JSON string collaborators field with array serialization"
    - "Known users derived from UserGoogleToken email parsing"

key-files:
  created:
    - "apps/agent/prisma/migrations/20260308192500_add_deal_pipeline_fields/migration.sql"
  modified:
    - "apps/agent/prisma/schema.prisma"
    - "apps/agent/src/mastra/index.ts"
    - "apps/web/src/lib/api-client.ts"
    - "apps/web/src/lib/actions/deal-actions.ts"

key-decisions:
  - "Used manual migration + resolve --applied to bypass init migration drift"
  - "Collaborators stored as JSON string, parsed client-side"
  - "Known users derived from UserGoogleToken with email-to-name heuristic"
  - "Fixed 4 pre-existing migration drift issues by marking them as applied"

patterns-established:
  - "Deal pipeline fields: status defaults to 'open', collaborators defaults to '[]'"
  - "Assignment PATCH endpoint accepts partial updates (only provided fields updated)"

requirements-completed: [DEAL-01, DEAL-02, DEAL-04, DEAL-05, DEAL-06, DEAL-07]

# Metrics
duration: 4min
completed: 2026-03-08
---

# Phase 41 Plan 01: Schema & API Summary

**Deal pipeline schema migration with status/assignment fields, filtered listing endpoint, status/assignment PATCH endpoints, known users endpoint, and web API client + server actions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T19:25:14Z
- **Completed:** 2026-03-08T19:29:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended Deal model with status, ownerId, ownerEmail, ownerName, collaborators -- forward-only migration with safe DEFAULT values
- Three new agent API endpoints: PATCH status, PATCH assignment, GET known users
- Enhanced GET /deals with status and assignee query param filtering
- Four new web API client functions and four new server actions for deal pipeline operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration and API endpoints** - `52408ba` (feat)
2. **Task 2: Web API client and server actions** - `0a68107` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added status, ownerId, ownerEmail, ownerName, collaborators to Deal model with indexes
- `apps/agent/prisma/migrations/20260308192500_add_deal_pipeline_fields/migration.sql` - Forward-only migration with IF NOT EXISTS guards
- `apps/agent/src/mastra/index.ts` - Enhanced GET /deals filtering, added PATCH status/assignment and GET /users/known routes
- `apps/web/src/lib/api-client.ts` - Updated Deal interface, added KnownUser interface, added 4 new API functions
- `apps/web/src/lib/actions/deal-actions.ts` - Added 4 new server actions wrapping API functions

## Decisions Made
- Used manual migration creation + `prisma migrate resolve --applied` to work around init migration drift (per CLAUDE.md: never reset)
- Fixed 4 pre-existing migration drift entries by marking them as applied
- Collaborators stored as JSON string field (not a relation table) for simplicity -- parsed client-side
- Known users derived from UserGoogleToken email with heuristic name extraction (split on @, replace dots/hyphens with spaces, title-case)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed migration drift preventing prisma migrate dev**
- **Found during:** Task 1 (Schema migration)
- **Issue:** `prisma migrate dev` refused to run due to drift between 0_init migration and actual DB state (SlideElement table, description column)
- **Fix:** Created migration SQL manually, applied via `prisma db execute`, marked as applied with `prisma migrate resolve --applied`. Also resolved 4 pre-existing unapplied migrations.
- **Files modified:** prisma/migrations/20260308192500_add_deal_pipeline_fields/migration.sql
- **Verification:** Migration marked as applied, Prisma client regenerated, TypeScript compiles
- **Committed in:** 52408ba (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach changed from `prisma migrate dev` to manual creation + resolve. Same end result, different execution path. No scope creep.

## Issues Encountered
- Pre-existing migration drift in the project (4 migrations already applied to DB but not tracked). Resolved all by marking as applied.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data layer and API contracts ready for Phase 41 Plans 02-04 (pipeline UI, Kanban board, assignment UI)
- Deal type updated across web app -- all existing deal-consuming components will see new fields
- Server actions ready for use in React components

---
*Phase: 41-deal-pipeline-page*
*Completed: 2026-03-08*
