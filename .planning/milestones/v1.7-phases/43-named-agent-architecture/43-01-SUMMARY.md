---
phase: 43-named-agent-architecture
plan: 01
subsystem: api
tags: [agents, prompts, prisma, mastra, seed-data]
requires: []
provides:
  - shared named-agent catalog ids, labels, families, and source-site metadata
  - Prisma AgentConfig and AgentConfigVersion models with immutable published prompt history
  - seed helpers that publish version-1 baseline and role prompts for the full agent roster
affects: [phase-44-agent-management-ui, phase-45-persistent-ai-chat-bar, phase-46-touch-pages-hitl-workflow]
tech-stack:
  added: []
  patterns: [shared agent catalog contract, layered baseline-plus-role prompts, published-version seed defaults]
key-files:
  created: [packages/schemas/agent-catalog.ts, apps/agent/src/lib/agent-catalog-defaults.ts, apps/agent/prisma/migrations/20260308164200_agent_config_foundation/migration.sql]
  modified: [packages/schemas/index.ts, apps/agent/prisma/schema.prisma, apps/agent/prisma/seed.ts, apps/agent/src/lib/__tests__/agent-catalog.test.ts, apps/agent/src/lib/__tests__/agent-catalog-defaults.test.ts]
key-decisions:
  - "The shared named-agent roster includes all prompt-bearing workflow, ingestion, deck-intelligence, extraction, and validation responsibilities as first-class agents."
  - "Each seeded agent version stores baselinePrompt and rolePrompt separately, plus a compiledPrompt snapshot and publishedVersion pointer for deterministic runtime resolution."
  - "Because prisma migrate dev was blocked by existing drift in the shared dev database, this plan used a focused forward-only SQL migration instead of any reset flow."
patterns-established:
  - "Catalog-first prompt governance: downstream runtime and UI work import the shared roster instead of rediscovering prompt sites."
  - "Published prompt foundation: AgentConfig is the stable identity row and AgentConfigVersion is the immutable history row."
requirements-completed: [AGENT-01, AGENT-02]
duration: 6 min
completed: 2026-03-08
---

# Phase 43 Plan 01: Named Agent Architecture Summary

**Shared named-agent catalog with Prisma-backed prompt version history and seeded published defaults for the full Lumenalta roster**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T19:39:26Z
- **Completed:** 2026-03-08T19:45:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Published a shared `AGENT_CATALOG` contract with 18 stable named agents covering seller-facing flows, shared helpers, background jobs, and validation scripts.
- Added `AgentConfig` and `AgentConfigVersion` Prisma models so published prompts have immutable version history and a stable config identity.
- Seeded version-1 prompt defaults from a shared Lumenalta baseline plus role-specific prompts, with tests proving idempotent behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Publish the shared agent catalog contract** - `7af2b94` (feat)
2. **Task 2: Add versioned prompt models, migration, and published seed defaults** - `87fad3d` (feat)

## Files Created/Modified
- `packages/schemas/agent-catalog.ts` - shared catalog ids, names, families, scope, and source-site metadata
- `packages/schemas/index.ts` - exports the catalog contract to workspace consumers
- `apps/agent/src/lib/__tests__/agent-catalog.test.ts` - locks roster coverage, split deck-intelligence roles, and shared selector behavior
- `apps/agent/prisma/schema.prisma` - adds `AgentConfig` and `AgentConfigVersion`
- `apps/agent/prisma/migrations/20260308164200_agent_config_foundation/migration.sql` - forward-only SQL for the prompt foundation tables
- `apps/agent/src/lib/agent-catalog-defaults.ts` - builds baseline and role prompt defaults and seeds published version-1 rows
- `apps/agent/src/lib/__tests__/agent-catalog-defaults.test.ts` - verifies prompt layers, schema contracts, and idempotent seeding
- `apps/agent/prisma/seed.ts` - seeds the full named-agent roster before demo data

## Decisions Made
- Used one responsibility-first roster that includes background jobs and validation prompts, not just seller-facing workflows.
- Stored `baselinePrompt`, `rolePrompt`, and `compiledPrompt` on immutable version rows so future runtime caching can pin published versions cleanly.
- Kept migration scope limited to `AgentConfig` and `AgentConfigVersion` even though the database already has unrelated drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced blocked Prisma migration generation with focused forward-only SQL**
- **Found during:** Task 2
- **Issue:** `prisma migrate dev --create-only` was blocked by existing drift in the shared dev database and suggested a reset, which is forbidden in this repo.
- **Fix:** Added the `AgentConfig`/`AgentConfigVersion` migration SQL manually, keeping the change forward-only and scoped to the new prompt models.
- **Files modified:** `apps/agent/prisma/migrations/20260308164200_agent_config_foundation/migration.sql`
- **Verification:** `pnpm --filter agent exec prisma validate`
- **Committed in:** `87fad3d`

**2. [Rule 3 - Blocking] Adjusted negative catalog assertions to satisfy TypeScript literal narrowing**
- **Found during:** Task 2
- **Issue:** The new `AgentId` union made the negative duplicate-id checks in `apps/agent/src/lib/__tests__/agent-catalog.test.ts` fail typecheck.
- **Fix:** Compared the ids as strings so the guard stays explicit without weakening the catalog type surface.
- **Files modified:** `apps/agent/src/lib/__tests__/agent-catalog.test.ts`
- **Verification:** `pnpm --filter agent exec tsc --noEmit`
- **Committed in:** `87fad3d`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to keep the plan forward-only and compile-clean. No scope creep.

## Issues Encountered
- Existing Prisma migration drift in the shared dev database still exists outside this plan's scope; this plan avoided destructive reset flows and kept the new migration isolated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The shared roster, schema contract, and published seed defaults are ready for Phase 43-02 runtime prompt resolution and caching.
- Phase 44 can now build against product-readable agent names and immutable version semantics.

## Self-Check: PASSED
- Verified files exist: `packages/schemas/agent-catalog.ts`, `apps/agent/src/lib/agent-catalog-defaults.ts`, `apps/agent/prisma/migrations/20260308164200_agent_config_foundation/migration.sql`, `apps/agent/prisma/schema.prisma`
- Verified commits exist: `7af2b94`, `87fad3d`

---
*Phase: 43-named-agent-architecture*
*Completed: 2026-03-08*
