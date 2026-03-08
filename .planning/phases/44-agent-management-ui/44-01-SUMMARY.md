---
phase: 44-agent-management-ui
plan: 01
subsystem: api, ui
tags: [agent-config, crud, accordion, settings, versioning, draft-publish]

# Dependency graph
requires:
  - phase: 43-named-agent-architecture
    provides: AgentConfig/AgentConfigVersion Prisma models, compileAgentInstructions, invalidateAgentPromptCache, AGENT_CATALOG
provides:
  - Agent config CRUD API routes (9 endpoints) on agent service
  - Typed api-client functions for all agent config operations
  - Server actions for agent config CRUD
  - Settings sidebar Agents nav item
  - Agent list page at /settings/agents with family-grouped accordion
affects: [44-02, 44-03, 44-04, 44-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [agent-config API route pattern, family-grouped accordion list]

key-files:
  created:
    - apps/web/src/lib/actions/agent-config-actions.ts
    - apps/web/src/app/(authenticated)/settings/agents/page.tsx
    - apps/web/src/components/settings/agent-list.tsx
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/app/(authenticated)/settings/layout.tsx

key-decisions:
  - "Used 'any' type annotation on Prisma agentConfig query results due to pre-existing Prisma client type drift (models added via forward-only SQL)"
  - "Family order in agent list follows logical workflow sequence: pre-call -> touch-1 -> deck-selection -> touch-4 -> deck-intelligence -> ingestion -> knowledge-extraction -> validation"

patterns-established:
  - "Agent config CRUD: registerApiRoute pattern with z.object validation for POST bodies"
  - "Draft detection: latest version with isPublished===false indicates hasDraft"

requirements-completed: [MGMT-01, MGMT-04]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 44 Plan 01: Agent Config API and List Page Summary

**Agent config CRUD API (9 routes) with family-grouped agent list page showing draft badges and version numbers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T21:40:43Z
- **Completed:** 2026-03-08T21:46:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 9 agent config API routes registered: list, get, versions, draft, publish, discard, rollback, baseline draft, baseline publish
- Complete web data layer with typed api-client functions and thin server action wrappers
- Agent list page with 8 family accordion groups, version badges, amber Draft indicators, and Shared Baseline card

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent config CRUD routes on agent service** - `917c89a` (feat)
2. **Task 2: Web data layer and agent list page** - `2cc14d8` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/index.ts` - Added 9 agent-config CRUD API routes with z.object validation
- `apps/web/src/lib/api-client.ts` - Added typed fetch functions and interfaces for agent config API
- `apps/web/src/lib/actions/agent-config-actions.ts` - Server actions wrapping api-client functions
- `apps/web/src/app/(authenticated)/settings/layout.tsx` - Added Agents nav item with Bot icon
- `apps/web/src/app/(authenticated)/settings/agents/page.tsx` - Server component page fetching agent configs
- `apps/web/src/components/settings/agent-list.tsx` - Client component with family accordion, version badges, draft indicators

## Decisions Made
- Used `any` type annotations for Prisma agentConfig queries due to pre-existing type drift (forward-only SQL migrations without Prisma client regeneration)
- Family display order follows logical workflow sequence rather than alphabetical
- Shared Baseline section rendered as a Card outside the accordion for visual prominence

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing Prisma client type drift means `prisma.agentConfig` is not recognized by TypeScript, but works at runtime. Used `any` cast to avoid blocking.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API layer ready for agent detail page (plan 02) to use getAgentConfig and version endpoints
- Settings sidebar navigation ready for agents sub-routes
- All server actions available for detail page, prompt editor, and version history components

---
*Phase: 44-agent-management-ui*
*Completed: 2026-03-08*
