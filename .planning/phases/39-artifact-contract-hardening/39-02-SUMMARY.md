---
phase: 39-artifact-contract-hardening
plan: "02"
subsystem: api
tags: [artifact-type, agent, mastra, deck-structures, chat, vitest]
requires:
  - phase: 39-artifact-contract-hardening
    provides: typed web artifact boundaries for deck structures and settings chat
provides:
  - Shared `ArtifactType | null` typing across agent deck keys, inference, and chat refinement
  - Mastra deck-structure route parsing narrowed to the canonical artifact enum before business logic
  - Regression coverage for artifact-qualified Touch 4 row isolation across inference and chat handlers
affects: [39-03, phase-40-agent-typecheck-cleanup, deck-structures, mastra, chat]
tech-stack:
  added: []
  patterns:
    - Keep `resolveDeckStructureKey()` as the runtime gate while narrowing agent helper signatures to `ArtifactType | null`
    - Parse Mastra deck-structure artifact queries through `z.enum(ARTIFACT_TYPES)` before invoking deck-intelligence helpers
key-files:
  created:
    - .planning/phases/39-artifact-contract-hardening/39-02-SUMMARY.md
  modified:
    - apps/agent/src/deck-intelligence/deck-structure-key.ts
    - apps/agent/src/deck-intelligence/infer-deck-structure.ts
    - apps/agent/src/deck-intelligence/chat-refinement.ts
    - apps/agent/src/deck-intelligence/__tests__/deck-structure-key.test.ts
    - apps/agent/src/deck-intelligence/__tests__/infer-deck-structure.test.ts
    - apps/agent/src/deck-intelligence/__tests__/chat-refinement.test.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts
key-decisions:
  - "Use `ArtifactType | null` for agent-side artifact-qualified seams while leaving touchType as `string` only at untrusted route boundaries."
  - "Share one Mastra query schema for optional artifact parsing so detail, infer, and chat routes narrow to the same contract before calling deck-intelligence helpers."
patterns-established:
  - "Agent deck-structure helpers accept the shared artifact union instead of broad strings once inputs have crossed the route boundary."
  - "Mastra deck-structure routes validate optional artifact query params with the shared enum and then delegate through the resolved deck key."
requirements-completed: [DECK-05]
duration: 8 min
completed: 2026-03-08
---

# Phase 39 Plan 02: Artifact Contract Hardening Summary

**Agent deck keys, inference, chat refinement, and Mastra deck-structure routes now share the canonical `ArtifactType | null` contract without changing Touch 4 artifact row isolation.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T17:08:41Z
- **Completed:** 2026-03-08T17:17:28Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Tightened `deck-structure-key.ts` and `infer-deck-structure.ts` so artifact-qualified agent helpers use `ArtifactType | null` while preserving non-Touch-4 null normalization.
- Narrowed `streamChatRefinement()` and all Mastra deck-structure route query parsing to the shared artifact enum contract before deck-intelligence work begins.
- Added regression coverage proving Touch 4 proposal/faq inference and chat paths stay scoped to the intended artifact-qualified row.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten deck-key and inference helpers to the shared ArtifactType contract** - `646918c` (test), `7fc8f6a` (feat)
2. **Task 2: Align chat refinement and Mastra route parsing to the same typed artifact boundary** - `3ddc665` (test), `b1a7043` (feat)

**Plan metadata:** pending final `docs(39-02)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/agent/src/deck-intelligence/deck-structure-key.ts` - narrows deck key resolution to the shared artifact union after touch-type validation
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` - carries the typed artifact contract through hashing and inference helper seams
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - types chat refinement artifact inputs and normalizes structured section updates safely
- `apps/agent/src/deck-intelligence/__tests__/deck-structure-key.test.ts` - locks non-Touch-4 null normalization and typed deck-key expectations
- `apps/agent/src/deck-intelligence/__tests__/infer-deck-structure.test.ts` - protects artifact-isolated hashing/inference plus typed helper boundaries
- `apps/agent/src/deck-intelligence/__tests__/chat-refinement.test.ts` - asserts typed chat helper seams and existing artifact-scoped persistence behavior
- `apps/agent/src/mastra/index.ts` - parses deck-structure artifact queries through a shared enum schema before resolving keys
- `apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts` - prevents route handlers from drifting back to broad artifact query strings

## Decisions Made
- Kept `resolveDeckStructureKey()` as the single runtime validation gate and tightened only the already-trusted artifact-qualified helper seams around it.
- Reused one local Mastra query schema for optional artifact parsing so detail, infer, and chat handlers cannot diverge on artifact narrowing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced an invalid structured-section type predicate in chat refinement normalization**
- **Found during:** Task 2 (Align chat refinement and Mastra route parsing to the same typed artifact boundary)
- **Issue:** Targeted TypeScript checking surfaced an incompatible type predicate inside `normalizeDeckStructure()` in the same touched chat file, which blocked the contract-tightening pass.
- **Fix:** Switched the section normalization path to map nullable candidates and filter the nulls afterward instead of using the invalid predicate.
- **Files modified:** `apps/agent/src/deck-intelligence/chat-refinement.ts`
- **Verification:** Focused route/chat Vitest suites passed, and targeted `tsc` filtering no longer reported `chat-refinement.ts` errors.
- **Committed in:** `b1a7043`

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** The auto-fix stayed inside the touched chat normalization path and was required to complete the typed artifact hardening safely.

## Issues Encountered

- A full `pnpm --filter agent exec tsc --noEmit --project tsconfig.json` still reports pre-existing out-of-scope baseline failures for the broader agent package; these were logged to `.planning/phases/39-artifact-contract-hardening/deferred-items.md` for Phase 40 follow-up.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for `39-03-PLAN.md`, which can now harden legacy settings view reuse on top of consistent typed web and agent artifact seams.
- Agent deck-intelligence and Mastra routes now provide regression-backed typed expectations for the remaining Touch 4 artifact reuse cleanup.

## Self-Check: PASSED
- Verified `.planning/phases/39-artifact-contract-hardening/39-02-SUMMARY.md` exists.
- Verified commits `646918c`, `7fc8f6a`, `3ddc665`, and `b1a7043` exist in git history.

---
*Phase: 39-artifact-contract-hardening*
*Completed: 2026-03-08*
