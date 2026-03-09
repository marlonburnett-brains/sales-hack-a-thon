---
phase: 43-named-agent-architecture
plan: 04
subsystem: api
tags: [mastra, named-agents, ingestion, validation, atlusai, zod]
requires:
  - phase: 43-named-agent-architecture
    provides: "Named agent runtime, versioned prompt resolver, and workflow/helper execution seam from 43-02 and 43-03"
provides:
  - "AtlusAI extraction now resolves through the named knowledge-result-extractor agent"
  - "Background ingestion classification, description, auto-classification, and taxonomy jobs now use named-agent governance"
  - "Schema validation script now runs through the schema-validation-auditor agent with regression coverage"
affects: [phase-44-agent-management-ui, phase-45-persistent-ai-chat-bar, phase-46-touch-pages-hitl, phase-43-05-final-guardrails]
tech-stack:
  added: []
  patterns: ["executeRuntimeNamedAgent for background jobs", "shared llm schemas for internal agents", "callsite adoption regression coverage"]
key-files:
  created:
    - apps/agent/src/lib/__tests__/agent-callsite-adoption.test.ts
    - packages/schemas/llm/slide-description.ts
    - packages/schemas/llm/template-auto-classification.ts
    - packages/schemas/llm/solution-pillar-taxonomy.ts
  modified:
    - apps/agent/src/lib/agent-executor.ts
    - apps/agent/src/lib/atlusai-search.ts
    - apps/agent/src/ingestion/classify-metadata.ts
    - apps/agent/src/ingestion/describe-slide.ts
    - apps/agent/src/ingestion/auto-classify-templates.ts
    - apps/agent/src/ingestion/pilot-ingestion.ts
    - apps/agent/src/validation/validate-schemas.ts
    - packages/schemas/agent-catalog.ts
    - packages/schemas/index.ts
    - apps/agent/src/lib/__tests__/agent-catalog.test.ts
key-decisions:
  - "Internal/background jobs use the same runtime named-agent executor as seller-facing flows rather than keeping a separate prompt path."
  - "Background structured outputs now rely on shared schema package definitions so internal prompt contracts stay versioned and reusable."
patterns-established:
  - "Non-workflow jobs can call executeRuntimeNamedAgent with JSON response options and keep their existing parse/contract behavior."
  - "Internal adoption coverage lives in one focused regression test that guards extraction, ingestion, and validation callsites against inline prompt authority."
requirements-completed: [AGENT-01, AGENT-02]
duration: 12 min
completed: 2026-03-08
---

# Phase 43 Plan 04: Extraction, ingestion, and validation migration for internal/background jobs Summary

**Background extraction, ingestion, taxonomy, and validation prompt execution now runs through named agents with shared structured-output contracts and regression coverage.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-08T20:05:57Z
- **Completed:** 2026-03-08T20:17:57Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Moved AtlusAI knowledge-result extraction and the main ingestion prompt jobs onto the shared named-agent executor.
- Added shared schema definitions for slide descriptions, template auto-classification, and solution-pillar taxonomy so internal agent outputs remain structured and reusable.
- Migrated the validation script to the schema-validation-auditor agent and extended regression coverage across the adopted internal/background callsites.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate extraction and ingestion prompt sites to named agents** - `dad9e39`, `5fe3514` (test, feat)
2. **Task 2: Migrate the validation script onto the named-agent layer** - `0c68417` (feat)

_Note: Task 1 followed a RED → GREEN flow._

## Files Created/Modified
- `apps/agent/src/lib/agent-executor.ts` - Added runtime resolver reuse and JSON response helpers for background jobs.
- `apps/agent/src/lib/atlusai-search.ts` - Routed adaptive Atlus extraction through `knowledge-result-extractor` while keeping cached template semantics.
- `apps/agent/src/ingestion/classify-metadata.ts` - Routed slide metadata classification through `slide-metadata-classifier` with the existing contract preserved.
- `apps/agent/src/ingestion/describe-slide.ts` - Routed slide description generation through `slide-description-writer`.
- `apps/agent/src/ingestion/auto-classify-templates.ts` - Routed template/example auto-classification through `template-classification-analyst`.
- `apps/agent/src/ingestion/pilot-ingestion.ts` - Routed solution-pillar taxonomy extraction through the new `solution-pillar-taxonomist` agent.
- `apps/agent/src/validation/validate-schemas.ts` - Routed live schema round-trip validation through `schema-validation-auditor`.
- `apps/agent/src/lib/__tests__/agent-callsite-adoption.test.ts` - Added regression guardrails for adopted internal/background callsites.
- `packages/schemas/agent-catalog.ts` - Added the shared taxonomy extraction agent to the catalog.
- `packages/schemas/index.ts` - Exported internal-background LLM schemas through the shared barrel.
- `packages/schemas/llm/slide-description.ts` - Canonical schema for slide description output.
- `packages/schemas/llm/template-auto-classification.ts` - Canonical schema for template/example classification output.
- `packages/schemas/llm/solution-pillar-taxonomy.ts` - Canonical schema for solution-pillar roster extraction.

## Decisions Made
- Internal/background prompt execution now uses the same named-agent seam as seller-facing flows so prompt authority stays centralized.
- Shared schema definitions were added for internal jobs instead of leaving those contracts embedded in individual ingestion files.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The environment did not expose `gsd-tools.cjs` under `$HOME/.claude`, so execution used the repo-local `.claude/get-shit-done/bin/gsd-tools.cjs` path instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Internal/background prompt-bearing jobs now sit under the named-agent catalog alongside seller-facing flows.
- Phase 43-05 can focus on deck-intelligence migration and final repo-wide guardrails without revisiting ingestion or validation exceptions.

## Self-Check: PASSED
