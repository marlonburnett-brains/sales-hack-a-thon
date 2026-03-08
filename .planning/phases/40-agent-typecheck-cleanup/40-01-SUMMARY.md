---
phase: 40-agent-typecheck-cleanup
plan: "01"
subsystem: api
tags: [agent, mastra, zod4, typescript, schemas]
requires:
  - phase: 39-artifact-contract-hardening
    provides: typed Touch 4 artifact contracts across shared schemas, web, and agent seams
provides:
  - Extensionless shared schema exports that satisfy the current agent TypeScript baseline
  - Touch 4 resume handlers aligned to the async Mastra 1.8 createRun and resume API
  - Regression coverage for the updated Mastra resume and Zod 4 source contracts
affects: [40-02, 40-03, agent, typescript, mastra]
tech-stack:
  added: []
  patterns:
    - Use extensionless local imports in `packages/schemas` so shared barrels compile under the repo TypeScript config
    - Treat `workflow.createRun()` as async and resume suspended steps with `step` plus `resumeData`
key-files:
  created:
    - .planning/phases/40-agent-typecheck-cleanup/40-01-SUMMARY.md
  modified:
    - packages/schemas/index.ts
    - packages/schemas/llm/slide-metadata.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/mastra/__tests__/template-classify-route.test.ts
    - apps/agent/src/mastra/__tests__/workflow-resume-contract.test.ts
key-decisions:
  - "Keep the shared schema public surface unchanged and fix the local import specifiers instead of loosening compiler settings."
  - "Protect the Mastra resume API drift with source-contract tests that assert async createRun plus step-based resume calls."
patterns-established:
  - "Touched Zod 4 handlers should use `z.record(z.string(), valueSchema)` and report validation failures through `err.issues`."
  - "Touch 4 approval routes should narrow request state first, then reuse a local `exampleTouchTypes` array for safe validation and updates."
requirements-completed: []
duration: 5 min
completed: 2026-03-08
---

# Phase 40 Plan 01: Agent Typecheck Cleanup Summary

**Shared schema barrel imports, Touch 4 Mastra resume handlers, and touched Zod 4 validation paths now compile against the current agent dependency surface.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T17:52:02Z
- **Completed:** 2026-03-08T17:55:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Removed `.ts` local import specifiers from the shared schema barrel and touched LLM schema module without changing the package API.
- Updated Touch 4 approval routes to await `createRun()`, resume with `step`, and use Zod 4-compatible record and error handling semantics.
- Added source-contract regression coverage proving the resume API drift is fixed while existing classify and token-store route invariants still hold.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove shared schema import-extension drift** - `9c07809` (fix)
2. **Task 2: Align Mastra resume handlers and Zod 4 route/workflow usage** - `0c4983e` (test), `c2d7b75` (feat)

**Plan metadata:** pending final `docs(40-01)` metadata commit at summary creation time.

## Files Created/Modified
- `packages/schemas/index.ts` - switches shared barrel exports to compiler-safe extensionless local paths
- `packages/schemas/llm/slide-metadata.ts` - aligns touched schema imports to the same extensionless rule
- `apps/agent/src/mastra/index.ts` - updates Touch 4 resume handlers, touched route parsing, and Zod 4 error semantics
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - replaces legacy record shorthand with the explicit Zod 4 record signature
- `apps/agent/src/mastra/__tests__/template-classify-route.test.ts` - preserves existing Touch 4 classify invariants after the type cleanup
- `apps/agent/src/mastra/__tests__/workflow-resume-contract.test.ts` - locks the current Mastra resume and Zod 4 source contract into regression coverage

## Decisions Made
- Kept the shared `@lumenalta/schemas` exports intact and fixed only the local import specifiers required by the current TypeScript rule.
- Added source-level regression assertions for the Mastra resume contract instead of relying on compile output alone.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm --filter agent exec tsc --noEmit` still fails in the pre-existing MCP seam and stale Atlus search test files; the touched schema and Mastra/Zod files are now clean and ready for `40-02-PLAN.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for `40-02-PLAN.md`, which can focus on the remaining MCP seam and stale Vitest mock failures without revisiting the cleaned schema and Mastra/Zod drift.
- Focused verification now isolates the remaining agent baseline errors to `src/lib/mcp-client.ts` and `src/lib/__tests__/atlusai-search.test.ts`.

## Self-Check: PASSED
- Verified `.planning/phases/40-agent-typecheck-cleanup/40-01-SUMMARY.md` exists.
- Verified commits `9c07809`, `0c4983e`, and `c2d7b75` exist in git history.

---
*Phase: 40-agent-typecheck-cleanup*
*Completed: 2026-03-08*
