---
phase: 39-artifact-contract-hardening
plan: "01"
subsystem: api
tags: [artifact-type, schemas, web, settings, chat, vitest]
requires:
  - phase: 38-live-verification-sweep
    provides: production-safe artifact-qualified chat path parity and regression coverage
provides:
  - Shared `ArtifactType` typing across web deck-structure DTOs and action signatures
  - Typed settings chat props and proxy parsing for artifact-qualified Touch 4 chat requests
  - Regression coverage for nullable artifact transport and proxy validation parity
affects: [39-02, 39-03, settings, deck-structures, chat]
tech-stack:
  added: []
  patterns:
    - Import `ArtifactType` from `@lumenalta/schemas` for artifact-qualified web boundaries
    - Keep Touch 1-3 artifact-free by using nullable or omitted artifact values instead of placeholders
key-files:
  created:
    - .planning/phases/39-artifact-contract-hardening/39-01-SUMMARY.md
  modified:
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/actions/deck-structure-actions.ts
    - apps/web/src/lib/__tests__/api-client.deck-structures.test.ts
    - apps/web/src/components/settings/chat-bar.tsx
    - apps/web/src/components/settings/__tests__/touch-type-detail-view.test.tsx
    - apps/web/src/app/api/deck-structures/chat/route.ts
    - apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts
key-decisions:
  - "Use `ArtifactType | null` for shared web deck-structure seams so Touch 1-3 callers remain artifact-free without broad string typing."
  - "Model the web chat proxy body with a typed Zod schema so compile-time and runtime artifact validation stay aligned."
patterns-established:
  - "Web deck-structure helpers accept only shared schema artifact values where artifact-qualified data crosses the boundary."
  - "Settings chat and proxy parsing share one artifact contract while preserving the existing `:touchType` plus query-param transport."
requirements-completed: [CLSF-01, CLSF-02, DECK-05]
duration: 4 min
completed: 2026-03-08
---

# Phase 39 Plan 01: Artifact Contract Hardening Summary

**Web deck-structure helpers, settings chat, and the web proxy now share the canonical `ArtifactType` contract while keeping Touch 1-3 calls artifact-free.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T17:08:00Z
- **Completed:** 2026-03-08T17:12:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Tightened `apps/web/src/lib/api-client.ts` and `apps/web/src/lib/actions/deck-structure-actions.ts` to use `ArtifactType | null` for artifact-qualified deck structure seams.
- Updated `apps/web/src/components/settings/chat-bar.tsx` and `apps/web/src/app/api/deck-structures/chat/route.ts` so typed settings chat and proxy validation agree on the shared artifact vocabulary.
- Added focused regression coverage proving Touch 4 keeps forwarding the chosen artifact while Touch 1-3 requests stay artifact-free.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten deck-structure helper DTOs to the shared ArtifactType contract** - `66a5420` (test), `9dab793` (feat)
2. **Task 2: Harden settings chat and proxy boundaries to the same typed artifact contract** - `fd71ceb` (test), `cc1556f` (feat)

**Plan metadata:** pending final `docs(39-01)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/web/src/lib/api-client.ts` - narrows deck-structure DTOs and helper signatures to the shared artifact contract
- `apps/web/src/lib/actions/deck-structure-actions.ts` - preserves nullable artifact threading through server actions
- `apps/web/src/lib/__tests__/api-client.deck-structures.test.ts` - locks nullable artifact typing and URLSearchParams behavior
- `apps/web/src/components/settings/chat-bar.tsx` - types settings chat artifact props with `ArtifactType`
- `apps/web/src/components/settings/__tests__/touch-type-detail-view.test.tsx` - verifies typed Touch 4 chat payload boundaries
- `apps/web/src/app/api/deck-structures/chat/route.ts` - parses proxy requests through a typed artifact-aware schema
- `apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts` - protects non-Touch-4 omission and proxy schema parity

## Decisions Made
- Used `ArtifactType | null` at shared web helper boundaries so Touch 1-3 callers still omit artifacts naturally.
- Added a typed request alias plus `z.ZodType` schema in the proxy route instead of relying on inferred runtime validation alone.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Workflow examples referenced `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`, but this workspace uses repo-local helpers under `.claude/` or `.opencode/`; execution continued with the repo-local path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for `39-02-PLAN.md`, which can now tighten the agent-side artifact seams against the same shared contract.
- Web deck-structure helpers and chat boundaries now provide regression-backed typed expectations for downstream hardening work.

## Self-Check: PASSED
- Verified `.planning/phases/39-artifact-contract-hardening/39-01-SUMMARY.md` exists.
- Verified task commits `66a5420`, `9dab793`, `fd71ceb`, and `cc1556f` exist in git history.

---
*Phase: 39-artifact-contract-hardening*
*Completed: 2026-03-08*
