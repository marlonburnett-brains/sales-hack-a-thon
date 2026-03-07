---
phase: 35-schema-constants-foundation
plan: 02
subsystem: database
tags: [prisma, postgresql, deck-structure, artifact-type, mastra]

# Dependency graph
requires:
  - phase: 34-deck-intelligence
    provides: Generic per-touch deck structures, cron inference, chat refinement, and deck structure API routes
provides:
  - Nullable `artifactType` columns on `Template` and `DeckStructure`
  - Forward-only migration SQL with Touch 4 cleanup, partial null-row uniqueness, and DB checks
  - Legacy runtime guards that keep null-artifact deck structure paths working without recreating generic Touch 4 rows
affects: [36-backend-engine-api-routes, 37-frontend-ui, deck-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns: [manual-prisma-migration-hardening, legacy-null-artifact-compatibility]

key-files:
  created:
    - apps/agent/prisma/migrations/20260307173917_add_artifact_type_foundation/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/deck-intelligence/infer-deck-structure.ts
    - apps/agent/src/deck-intelligence/auto-infer-cron.ts
    - apps/agent/src/deck-intelligence/chat-refinement.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Keep artifactType as nullable string fields and enforce allowed values with raw SQL CHECK constraints instead of Prisma enums"
  - "Preserve legacy non-Touch-4 deck structures through artifactType=null reads/writes while returning empty placeholders for generic touch_4 runtime paths"
  - "Handle migration drift with a manual forward-only migration after prisma migrate dev --create-only was blocked"

patterns-established:
  - "Legacy deck structures: findFirst/update-by-id for touchType + artifactType null because Prisma compound unique selectors cannot address null values"
  - "Phase bridge: exclude generic touch_4 inference/chat routes until artifact-aware backend work lands in Phase 36"

requirements-completed: [SCHM-01, SCHM-02]

# Metrics
duration: 6 min
completed: 2026-03-07
---

# Phase 35 Plan 02: Schema Migration & Runtime Guardrails Summary

**Nullable artifactType schema support with hardened PostgreSQL migration rules and legacy null-artifact runtime guards that stop generic Touch 4 deck structure recreation.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T20:38:30Z
- **Completed:** 2026-03-07T20:44:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added nullable `artifactType` fields to `Template` and `DeckStructure`, plus composite schema identity for deck structures.
- Created a forward-only migration that deletes legacy generic `touch_4` rows, preserves one non-Touch-4 null-artifact row per touch type, and adds DB-level artifact validation.
- Updated deck-intelligence cron, inference, chat refinement, and API routes to stay on `artifactType = null` compatibility paths and return placeholders for generic Touch 4 requests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add nullable artifactType fields and hardened migration SQL** - `e23c5fa` (feat)
2. **Task 2: Preserve current deck-intelligence runtime without recreating generic Touch 4 data** - `58608e2` (fix)

**Plan metadata:** Created in the final docs commit for this plan.

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Adds nullable artifactType columns and composite deck structure uniqueness.
- `apps/agent/prisma/migrations/20260307173917_add_artifact_type_foundation/migration.sql` - Applies forward-only cleanup, uniqueness hardening, and DB checks.
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` - Guards generic Touch 4 inference and persists legacy null-artifact rows without nullable compound upserts.
- `apps/agent/src/deck-intelligence/auto-infer-cron.ts` - Skips generic Touch 4 and reads legacy rows via `artifactType = null`.
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - Returns a safe placeholder for generic Touch 4 chat and keeps legacy updates keyed to null-artifact rows.
- `apps/agent/src/mastra/index.ts` - Keeps list/detail/infer deck structure endpoints stable for null-artifact legacy rows and blocks generic Touch 4 recreation.

## Decisions Made
- Kept `artifactType` as string-backed nullable columns and enforced allowed values in SQL checks to match the repo's shared-constants pattern.
- Removed the generic persisted `touch_4` deck structure and served placeholder responses until artifact-aware backend work arrives in Phase 36.
- Switched legacy runtime persistence from `findUnique`/`upsert` to `findFirst` plus update/create because Prisma nullable compound unique selectors cannot target `NULL` values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced blocked create-only migration generation with manual forward-only SQL**
- **Found during:** Task 1 (Add nullable artifactType fields and hardened migration SQL)
- **Issue:** `pnpm exec prisma migrate dev --name add_artifact_type_foundation --create-only` stopped on existing migration drift (`0_init` and missing `SlideElement` history), so Prisma would not emit a new migration file.
- **Fix:** Kept the schema change, created the migration directory manually, and wrote idempotent SQL that matches the plan's cleanup and hardening rules without resetting the database.
- **Files modified:** `apps/agent/prisma/migrations/20260307173917_add_artifact_type_foundation/migration.sql`
- **Verification:** `pnpm exec prisma validate` passed; migration SQL contains Touch 4 cleanup, partial unique index, and artifact check constraints.
- **Committed in:** `e23c5fa` (part of task commit)

**2. [Rule 3 - Blocking] Reworked legacy deck structure persistence around nullable compound keys**
- **Found during:** Task 2 (Preserve current deck-intelligence runtime without recreating generic Touch 4 data)
- **Issue:** After Prisma Client regeneration, nullable compound uniqueness on `(touchType, artifactType)` could not be addressed with `findUnique`/`upsert` using `artifactType: null`.
- **Fix:** Replaced those runtime paths with `findFirst` plus update-by-id/create semantics for legacy rows while keeping generic Touch 4 blocked behind placeholders.
- **Files modified:** `apps/agent/src/deck-intelligence/infer-deck-structure.ts`, `apps/agent/src/deck-intelligence/auto-infer-cron.ts`, `apps/agent/src/deck-intelligence/chat-refinement.ts`, `apps/agent/src/mastra/index.ts`
- **Verification:** No deck-intelligence file errors remained in `pnpm exec tsc --noEmit --pretty false`; grep confirmed `artifactType: null`, `touchType_artifactType`, and `tt !== "touch_4"` guard patterns are present.
- **Committed in:** `58608e2` (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to land the schema safely in the existing repo state and keep the legacy runtime working between Phases 35 and 36.

## Issues Encountered
- Full `pnpm exec tsc --noEmit --pretty false` still fails because of pre-existing unrelated TypeScript issues in `apps/agent/src/mastra/index.ts`, `apps/agent/src/lib/mcp-client.ts`, related tests, and `packages/schemas/*`; logged in `.planning/milestones/v1.6-phases/35-schema-constants-foundation/deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 36 can thread artifact-aware inference and API behavior onto a schema that already supports artifact-typed Touch 4 structures.
- Current v1.5 deck-intelligence behavior remains stable for non-Touch-4 rows and no longer recreates forbidden generic Touch 4 data.

---
*Phase: 35-schema-constants-foundation*
*Completed: 2026-03-07*

## Self-Check: PASSED
