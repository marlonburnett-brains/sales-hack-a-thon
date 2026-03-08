---
phase: 43-named-agent-architecture
plan: 05
subsystem: api
tags: [mastra, named-agents, deck-intelligence, guardrails, vitest]
requires:
  - phase: 43-named-agent-architecture
    provides: "Named agent runtime, internal/background adoption, and deck-intelligence role boundaries from 43-02 through 43-04"
provides:
  - "Deck-structure inference now resolves through the named deck-structure analyst agent"
  - "Deck-structure chat refinement now resolves through the separate named refinement assistant while preserving streaming and direct-structure updates"
  - "A repo-level guardrail fails if prompt-bearing business logic bypasses the named-agent seam"
affects: [phase-44-agent-management-ui, phase-45-persistent-ai-chat-bar, phase-46-touch-pages-hitl, phase-43-governance]
tech-stack:
  added: []
  patterns: ["provider-backed named-agent helpers for deck intelligence", "repo-level prompt callsite coverage inventory", "separate deck analyst and refinement roles"]
key-files:
  created:
    - apps/agent/src/deck-intelligence/__tests__/named-agent-adoption.test.ts
    - apps/agent/src/lib/__tests__/agent-callsite-coverage.test.ts
  modified:
    - apps/agent/src/lib/agent-executor.ts
    - apps/agent/src/deck-intelligence/infer-deck-structure.ts
    - apps/agent/src/deck-intelligence/chat-refinement.ts
    - apps/agent/src/deck-intelligence/__tests__/chat-refinement.test.ts
    - apps/agent/src/deck-intelligence/__tests__/infer-deck-structure.test.ts
key-decisions:
  - "Deck intelligence keeps two first-class named agents: one for inference and one for chat refinement, rather than collapsing them into a generalist role."
  - "Repo governance now relies on an explicit inventory of prompt-bearing business files so future direct provider prompt calls fail fast in CI."
patterns-established:
  - "Deck-intelligence callsites can keep their prompt assembly and persistence logic locally while delegating prompt authority to named-agent helpers."
  - "Repo-wide callsite coverage tests may allow only low-level provider plumbing while requiring business logic to reference catalog-backed agent ids."
requirements-completed: [AGENT-01, AGENT-02]
duration: 22 min
completed: 2026-03-08
---

# Phase 43 Plan 05: Deck-intelligence migration and final repo-level coverage guardrails Summary

**Deck-structure inference and chat refinement now run as separate named agents, and a repo-level coverage suite blocks future business-logic prompt bypasses.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-08T20:29:30Z
- **Completed:** 2026-03-08T20:51:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Migrated deck-structure inference onto the named `deck-structure-analyst` role without changing its schema-driven output contract.
- Migrated deck-structure chat refinement onto the separate `deck-structure-refinement-assistant` role while preserving streamed responses, structured refinement, and re-inference fallback.
- Added a durable repo-level guardrail that inventories all prompt-bearing business files and fails when they bypass the named-agent seam.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate deck-intelligence prompt sites as separate named agents** - `b4feeee` (feat)
2. **Task 2: Add the final repo-level named-agent coverage guardrail** - `bffb078` (test)

## Files Created/Modified
- `apps/agent/src/lib/agent-executor.ts` - Added provider-backed named-agent helpers so deck intelligence can resolve catalog prompts while keeping direct Gemini features like streaming.
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` - Routed inference through `deck-structure-analyst` with the existing deck structure schema.
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - Routed conversational refinement, structure updates, and summarization through `deck-structure-refinement-assistant`.
- `apps/agent/src/deck-intelligence/__tests__/named-agent-adoption.test.ts` - Added focused adoption coverage for the two deck-intelligence callsites.
- `apps/agent/src/deck-intelligence/__tests__/chat-refinement.test.ts` - Updated refinement tests to mock the named-agent seam instead of direct provider usage.
- `apps/agent/src/deck-intelligence/__tests__/infer-deck-structure.test.ts` - Updated inference tests to assert the named analyst path.
- `apps/agent/src/lib/__tests__/agent-callsite-coverage.test.ts` - Added repo-wide prompt-bearing business callsite coverage and direct-provider bypass detection.

## Decisions Made
- Kept deck-structure inference and deck-structure refinement as separate named roles to preserve the locked responsibility boundary from phase context.
- Used an explicit prompt-bearing business file inventory for the final guardrail so low-level execution plumbing can stay exempt while workflow/helper/business logic remains governed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The environment did not expose `gsd-tools.cjs` under `$HOME/.claude`, so the repo-local `.claude/get-shit-done/bin/gsd-tools.cjs` path was used for workflow state updates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 43 now has all planned migrations complete and can be treated as the authoritative named-agent foundation for the management UI and persistent chat phases.
- Future business-logic prompt drift should now surface through the repo-level guardrail before the catalog can silently diverge.


## Self-Check: PASSED
