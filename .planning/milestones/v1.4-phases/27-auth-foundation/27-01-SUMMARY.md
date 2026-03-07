---
phase: 27-auth-foundation
plan: 01
subsystem: database, auth
tags: [prisma, aes-256-gcm, encryption, atlus, action-types]

# Dependency graph
requires:
  - phase: 22-google-token-storage
    provides: "token-encryption.ts AES-256-GCM encrypt/decrypt helpers"
  - phase: 24-action-required
    provides: "ActionRequired model and CRUD endpoints"
provides:
  - "UserAtlusToken model with encrypted token storage"
  - "ActionRequired silenced/seenAt fields for UX tracking"
  - "ACTION_TYPES shared constant with 5 action types"
  - "upsertAtlusToken and decryptAtlusToken CRUD helpers"
  - "Updated ActionRequiredItem interface with silenced/seenAt"
affects: [27-02-pool-rotation, 27-03-tier-detection, 27-04-ux-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AtlusAI token encryption mirrors Google token pattern via token-encryption.ts"]

key-files:
  created:
    - "apps/agent/src/lib/atlus-auth.ts"
    - "apps/agent/prisma/migrations/20260306210000_add_atlus_token_and_action_silence/migration.sql"
  modified:
    - "apps/agent/prisma/schema.prisma"
    - "packages/schemas/constants.ts"
    - "packages/schemas/index.ts"
    - "apps/web/src/lib/api-client.ts"

key-decisions:
  - "Used generic encryptedToken field name (not encryptedRefresh) since AtlusAI auth mechanism is TBD"
  - "Manual migration with resolve --applied due to 0_init checksum drift (never reset per project rules)"

patterns-established:
  - "AtlusAI token storage follows same encrypt/decrypt pattern as UserGoogleToken"

requirements-completed: [ATLS-01, ATLS-02, ATLS-03, ATLS-05, ACTN-03]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 27 Plan 01: Data Models & Shared Constants Summary

**UserAtlusToken model with AES-256-GCM encrypted storage, ActionRequired silence/seen tracking, and shared ACTION_TYPES constant across web and agent**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T20:51:19Z
- **Completed:** 2026-03-06T20:56:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- UserAtlusToken model created with encrypted token storage, indexes on validity and email
- ActionRequired extended with silenced (default false) and seenAt fields for UX tracking
- ACTION_TYPES constant with 5 action types exported from shared @lumenalta/schemas
- atlus-auth.ts CRUD helpers for token upsert and decryption wired to existing encryption module

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration -- UserAtlusToken model and ActionRequired extensions** - `2ac7b30` (feat)
2. **Task 2: AtlusAI token CRUD helpers and ActionRequiredItem type update** - `65f328e` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added UserAtlusToken model, extended ActionRequired with silenced/seenAt
- `apps/agent/prisma/migrations/20260306210000_add_atlus_token_and_action_silence/migration.sql` - Forward-only migration SQL
- `packages/schemas/constants.ts` - Added ACTION_TYPES constant with 5 action types and ActionType type
- `packages/schemas/index.ts` - Re-exported ACTION_TYPES and ActionType from barrel
- `apps/agent/src/lib/atlus-auth.ts` - Token upsert (encrypt + prisma upsert) and decrypt helpers
- `apps/web/src/lib/api-client.ts` - Added silenced and seenAt to ActionRequiredItem interface

## Decisions Made
- Used generic `encryptedToken` field name instead of `encryptedRefresh` since AtlusAI auth mechanism is TBD per CONTEXT.md
- Used manual migration with `prisma migrate resolve --applied` due to 0_init checksum drift -- never reset per project rules (CLAUDE.md)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 0_init migration checksum drift blocked prisma migrate dev**
- **Found during:** Task 1 (Schema migration)
- **Issue:** `prisma migrate dev --create-only` failed because 0_init migration was modified after being applied, Prisma demanded a reset
- **Fix:** Used `prisma migrate diff` to generate correct SQL, manually created migration directory, applied SQL via `prisma db execute`, then marked as applied with `prisma migrate resolve --applied`
- **Files modified:** apps/agent/prisma/migrations/20260306210000_add_atlus_token_and_action_silence/migration.sql
- **Verification:** `prisma validate` passes, `prisma migrate status` shows "up to date"
- **Committed in:** 2ac7b30 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach changed from `migrate dev --create-only` to manual SQL + resolve. Same outcome, follows project rules (never reset).

## Issues Encountered
- Pre-existing TS errors in apps/agent/src/mastra/index.ts (unrelated to this plan's changes) -- ignored per scope boundary rule

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UserAtlusToken model and CRUD helpers ready for Plan 27-02 (pool rotation)
- ActionRequired silenced/seenAt fields ready for Plan 27-04 (UX overhaul)
- ACTION_TYPES constant importable from @lumenalta/schemas for all plans

---
*Phase: 27-auth-foundation*
*Completed: 2026-03-06*
