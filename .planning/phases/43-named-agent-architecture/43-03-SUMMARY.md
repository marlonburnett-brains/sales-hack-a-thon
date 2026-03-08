---
phase: 43-named-agent-architecture
plan: 03
subsystem: api
tags: [mastra, named-agents, workflows, prompt-versioning, zod]
requires:
  - phase: 43-named-agent-architecture
    provides: "Prisma-backed prompt resolution, Mastra registry, and named-agent executor seam from 43-02"
provides:
  - "Pre-call and Touch 1/4 workflow prompt steps now execute through named agents"
  - "Touch 1 and Touch 4 persist prompt version ids across suspend/resume boundaries"
  - "Shared slide selection and proposal copy helpers now run through named agent families"
affects: [phase-44-agent-management-ui, phase-45-persistent-ai-chat-bar, phase-46-touch-pages-hitl]
tech-stack:
  added: []
  patterns: ["executeNamedAgent with structured output", "workflow prompt version pinning by version id"]
key-files:
  created: []
  modified:
    - apps/agent/src/lib/agent-executor.ts
    - apps/agent/src/mastra/workflows/pre-call-workflow.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/lib/slide-selection.ts
    - apps/agent/src/lib/proposal-assembly.ts
    - apps/agent/src/lib/__tests__/workflow-agent-coverage.test.ts
    - apps/agent/src/mastra/__tests__/workflow-agent-versioning.test.ts
key-decisions:
  - "Named agent execution now injects the resolved compiled prompt at call time so workflows can pin immutable version ids without changing caller schemas."
  - "Touch 2/3 slide selection stays under one shared deck-slide-selector family, while Touch 4 copy generation stays on the dedicated proposal-copywriter role."
patterns-established:
  - "Workflow suspend boundaries carry an agentVersions object so resumed steps can resolve prompts by pinned version id."
  - "Workflow/helper callsites keep local prompt assembly context but hand prompt authority and structured execution to executeNamedAgent."
requirements-completed: [AGENT-01, AGENT-02]
duration: 10 min
completed: 2026-03-08
---

# Phase 43 Plan 03: Seller-facing workflow and shared-helper migration with version pinning Summary

**Named-agent execution now governs pre-call, Touch 1, Touch 4, shared deck selection, and proposal copy while keeping suspend/resume runs locked to the prompt versions they started with.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-08T20:06:10Z
- **Completed:** 2026-03-08T20:16:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced seller-facing inline prompt execution in pre-call and Touch 1/4 workflow steps with named-agent calls.
- Persisted prompt version ids through Touch 1 and Touch 4 suspend/resume checkpoints so publishes cannot mutate in-flight runs.
- Moved shared Touch 2/3 slide selection and Touch 4 proposal copy helpers onto named agent families without changing their public contracts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route seller-facing workflows through named agents** - `47b2628`, `53becf3` (test, feat)
2. **Task 2: Migrate shared workflow-adjacent helpers to named agent families** - `cceef93` (feat)

_Note: Task 1 followed a RED → GREEN flow._

## Files Created/Modified
- `apps/agent/src/lib/agent-executor.ts` - Added pinned-version resolution for named-agent execution.
- `apps/agent/src/mastra/workflows/pre-call-workflow.ts` - Routed research, hypotheses, and discovery questions through named agents.
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts` - Routed pager generation through the first-contact agent and persisted its version id.
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - Routed Touch 4 prompt steps through named agents and pinned versions across approval boundaries.
- `apps/agent/src/lib/slide-selection.ts` - Moved Touch 2/3 slide selection to the shared deck-slide-selector agent.
- `apps/agent/src/lib/proposal-assembly.ts` - Moved proposal copy generation to the proposal-copywriter agent.
- `apps/agent/src/lib/__tests__/workflow-agent-coverage.test.ts` - Added workflow callsite guardrails against inline prompt authority.
- `apps/agent/src/mastra/__tests__/workflow-agent-versioning.test.ts` - Added version-pinning and helper-family regression coverage.

## Decisions Made
- Named agent execution now overrides per-call instructions with the resolved compiled prompt so pinned version ids can safely drive resumed steps.
- Shared helper families stay shared: Touch 2 and Touch 3 both use `deck-slide-selector`, and Touch 4 copy stays under `proposal-copywriter`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The environment did not expose `gsd-tools.cjs` under `$HOME/.claude`, so execution used the repo-local `.claude/get-shit-done/bin/gsd-tools.cjs` path instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Seller-facing workflows and shared helpers no longer own permanent inline prompt authority.
- Phase 43-04 can continue the same named-agent migration pattern for internal/background jobs and complete repo-wide callsite coverage.

## Self-Check: PASSED
