---
phase: 45-persistent-ai-chat-bar
plan: 01
subsystem: api
tags: [zod, schemas, agent-catalog, deal-chat, vitest]
requires:
  - phase: 42-deal-detail-layout
    provides: Deal sub-page route model and page labels that the chat route context aligns to
  - phase: 43-named-agent-architecture
    provides: Governed named-agent catalog and seeded prompt defaults extended by this plan
provides:
  - Shared deal-chat request, route-context, binding, and metadata contracts for downstream agent and web plans
  - Governed `deal-chat-assistant` catalog identity with a locked response-style prompt contract
  - Regression coverage that blocks unnamed or per-page deal-chat prompt drift
affects: [phase-45-runtime, phase-45-ui, phase-46-hitl, shared-schemas]
tech-stack:
  added: []
  patterns: [shared zod chat contracts, governed named-agent prompt seeding, catalog-first regression coverage]
key-files:
  created: [packages/schemas/deal-chat.ts]
  modified:
    [packages/schemas/index.ts, packages/schemas/agent-catalog.ts, apps/agent/src/lib/agent-catalog-defaults.ts, apps/agent/src/lib/__tests__/agent-catalog.test.ts, apps/agent/src/lib/__tests__/agent-catalog-defaults.test.ts]
key-decisions:
  - "Phase 45 starts with one shared deal-chat schema surface so later storage, route, and UI work import canonical contracts instead of inventing local payloads."
  - "Deal chat uses one governed `deal-chat-assistant` orchestrator identity rather than separate per-page or transcript-cleanup prompt agents."
patterns-established:
  - "Pattern 1: Stream freeform assistant text separately from a final typed deal-chat metadata payload."
  - "Pattern 2: Encode seller-facing answer style in the named-agent default prompt so runtime behavior stays governed."
requirements-completed: [CHAT-04, CHAT-05]
duration: 1 min
completed: 2026-03-08
---

# Phase 45 Plan 01: Deal Chat Contracts and Agent Identity Summary

**Shared deal-chat Zod contracts with a governed `deal-chat-assistant` prompt baseline for direct answers, knowledge fits, and binding-aware metadata.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-08T22:51:29Z
- **Completed:** 2026-03-08T22:52:14Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- Added `packages/schemas/deal-chat.ts` as the canonical Phase 45 contract surface for route context, send requests, binding state, confirmation chips, and knowledge-match cards.
- Re-exported the new deal-chat schemas from `packages/schemas/index.ts` so agent and web layers can share one typed interface.
- Added the governed `deal-chat-assistant` catalog entry and locked response-style prompt rules in seeded defaults and regression tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Publish the shared deal-chat contracts and named-agent identity** - `5d7f07a` (feat)

**Plan metadata:** Recorded in the follow-up docs commit for summary and planning-state updates.

## Files Created/Modified
- `packages/schemas/deal-chat.ts` - Shared Zod schemas and inferred types for deal-chat requests, route context, bindings, confirmation chips, and final metadata.
- `packages/schemas/index.ts` - Barrel re-export for the Phase 45 deal-chat schema surface.
- `packages/schemas/agent-catalog.ts` - Adds the `deal-chat-assistant` named-agent identity and deal-chat family.
- `apps/agent/src/lib/agent-catalog-defaults.ts` - Seeds the locked deal-chat answer-style prompt rules into published defaults.
- `apps/agent/src/lib/__tests__/agent-catalog.test.ts` - Requires the shared catalog to include the governed deal-chat assistant and forbid per-page chat agents.
- `apps/agent/src/lib/__tests__/agent-catalog-defaults.test.ts` - Verifies the seeded deal-chat prompt includes the locked answer-style contract.

## Decisions Made
- Used one `deal-chat-assistant` orchestrator entry, matching the phase research recommendation to avoid parallel per-page or transcript-cleanup prompt identities.
- Formalized the answer format in seeded prompt defaults so direct answers, supporting bullets, missing-info callouts, knowledge fits, and binding confirmations stay consistent before runtime wiring.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The workflow's default `gsd-tools` path pointed at `$HOME/.claude/...`, but this repository keeps the tool under `.claude/get-shit-done/bin/gsd-tools.cjs`; execution continued with the local path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Downstream Phase 45 plans can now import one canonical deal-chat schema surface for request, route-context, and structured metadata payloads.
- The governed `deal-chat-assistant` identity is in place for agent-route, persistence, and UI plans to reuse without prompt drift.

## Self-Check: PASSED
- Verified `.planning/phases/45-persistent-ai-chat-bar/45-01-SUMMARY.md` exists.
- Verified task commit `5d7f07a` is present in git history.

---
*Phase: 45-persistent-ai-chat-bar*
*Completed: 2026-03-08*
