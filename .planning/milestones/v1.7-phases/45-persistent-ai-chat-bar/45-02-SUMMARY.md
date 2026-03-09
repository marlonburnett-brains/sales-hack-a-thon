---
phase: 45-persistent-ai-chat-bar
plan: "02"
subsystem: api
tags: [agent, deal-chat, mastra, vitest, routes, governance]
requires:
  - phase: 45-persistent-ai-chat-bar
    provides: deal chat contracts plus durable thread, source, and binding persistence from 45-01 and 45-04
provides:
  - Governed deal-chat orchestration that grounds answers in deal, interaction, source, and route context
  - Dedicated `/deals/:dealId/chat` history, streaming, and binding-confirmation routes on the agent
  - Direct assistant and route regression coverage for grounded answers, knowledge matches, and refine-before-save flows
affects: [45-03, 45-05, agent, deal-chat, web]
tech-stack:
  added: []
  patterns:
    - Named `deal-chat-assistant` governance for every prompt-bearing deal chat turn
    - Stream assistant text first, then append one final `---DEAL_CHAT_META---` JSON payload with route metadata
    - Keep note and transcript persistence explicit through the 45-04 helpers and confirm bindings through a dedicated route
key-files:
  created:
    - apps/agent/src/deal-chat/context.ts
    - apps/agent/src/deal-chat/assistant.ts
    - apps/agent/src/deal-chat/__tests__/assistant.test.ts
    - apps/agent/src/mastra/__tests__/deal-chat-routes.test.ts
    - .planning/phases/45-persistent-ai-chat-bar/45-02-SUMMARY.md
  modified:
    - apps/agent/src/mastra/index.ts
    - packages/schemas/deal-chat.ts
    - packages/schemas/index.ts
    - apps/agent/src/lib/__tests__/agent-callsite-coverage.test.ts
key-decisions:
  - "Kept one governed `deal-chat-assistant` orchestration entrypoint that loads explicit deal grounding, while route handlers stay thin and persist only messages plus confirmed bindings."
  - "Returned structured answer metadata and prompt-version data with each streamed turn so the downstream web proxy can mirror one verified contract instead of inferring side effects from free text."
patterns-established:
  - "Deal chat route handlers should append persisted user and assistant messages around one orchestration call and stream a final meta delimiter payload."
  - "Transcript or note-like turns should surface refine-before-save and binding-confirmation metadata before any durable source save path runs."
requirements-completed: [CHAT-02, CHAT-03, CHAT-04, CHAT-05]
duration: 10 min
completed: 2026-03-08
---

# Phase 45 Plan 02: Deal chat orchestrator, agent routes, and regression coverage Summary

**Governed deal-chat orchestration now answers from persisted deal context, returns structured knowledge matches and refine-before-save metadata, and exposes dedicated agent routes with direct regression coverage.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-08T23:07:00Z
- **Completed:** 2026-03-08T23:17:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `loadDealChatContext()` and `runDealChatTurn()` so deal chat can ground answers in deal metadata, interaction history, saved sources, route context, and prompt summary while staying under the named-agent seam.
- Registered `GET /deals/:dealId/chat`, `POST /deals/:dealId/chat`, and `POST /deals/:dealId/chat/bindings` so history bootstrap, streamed replies, and confirmation-aware source saves all flow through the agent app.
- Added focused assistant and route tests proving grounded answer shape, structured knowledge matches, refine-before-save behavior, final meta payload streaming, and persistence-helper usage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the named-agent deal-chat orchestrator and register agent routes** - `a122a5c` (test), `2e0954c` (feat)
2. **Task 2: Add route-level regression coverage for `/deals/:dealId/chat` and `/deals/:dealId/chat/bindings`** - `3a8c684` (test)

**Plan metadata:** pending final `docs(45-02)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/agent/src/deal-chat/context.ts` - Loads deal grounding payloads including deal metadata, interactions, recent sources, message history, and prompt summary.
- `apps/agent/src/deal-chat/assistant.ts` - Orchestrates governed turns, knowledge retrieval, locked answer formatting, and refine-before-save or confirmation metadata.
- `apps/agent/src/deal-chat/__tests__/assistant.test.ts` - Covers grounded answer style, knowledge-match shaping, messy transcript review, and named-agent governance.
- `apps/agent/src/mastra/index.ts` - Registers deal chat history, streaming, and binding routes and persists thread messages around orchestration.
- `apps/agent/src/mastra/__tests__/deal-chat-routes.test.ts` - Exercises the three deal-chat endpoints directly and verifies helper usage plus streamed meta output.
- `packages/schemas/deal-chat.ts` - Extends the shared final-meta contract with prompt-version metadata required by the streamed route payload.
- `packages/schemas/index.ts` - Re-exports the updated deal-chat prompt-version schema and type surface.
- `apps/agent/src/lib/__tests__/agent-callsite-coverage.test.ts` - Locks `src/deal-chat/assistant.ts` into the repo-wide named-agent coverage inventory.

## Decisions Made
- Kept answer shaping deterministic in the deal-chat orchestrator while delegating prompt authority and versioning to the named `deal-chat-assistant` runtime.
- Routed transcript or note saves through `/deals/:dealId/chat/bindings` so `POST /deals/:dealId/chat` can stay side-effect-aware without silently persisting uncertain content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added prompt-version metadata to the shared deal-chat meta contract**
- **Found during:** Task 1 (Build the named-agent deal-chat orchestrator and register agent routes)
- **Issue:** The existing `dealChatMetaSchema` did not include the prompt-version data that the plan required the streamed `---DEAL_CHAT_META---` payload to expose.
- **Fix:** Extended `packages/schemas/deal-chat.ts` and `packages/schemas/index.ts` with a prompt-version schema/type and returned it from `runDealChatTurn()`.
- **Files modified:** `packages/schemas/deal-chat.ts`, `packages/schemas/index.ts`, `apps/agent/src/deal-chat/assistant.ts`
- **Verification:** `pnpm --filter agent exec vitest run "src/deal-chat/__tests__/assistant.test.ts" "src/mastra/__tests__/deal-chat-routes.test.ts" "src/lib/__tests__/agent-callsite-coverage.test.ts"`
- **Committed in:** `2e0954c`

**2. [Rule 2 - Missing Critical] Extended repo governance coverage to include the new deal-chat business logic path**
- **Found during:** Task 1 (Build the named-agent deal-chat orchestrator and register agent routes)
- **Issue:** The repo-wide named-agent coverage suite did not scan `src/deal-chat`, so a new prompt-bearing assistant file could have bypassed governance undetected.
- **Fix:** Added `src/deal-chat/assistant.ts` to the prompt-bearing inventory and included `src/deal-chat` in the business-root scan.
- **Files modified:** `apps/agent/src/lib/__tests__/agent-callsite-coverage.test.ts`
- **Verification:** `pnpm --filter agent exec vitest run "src/deal-chat/__tests__/assistant.test.ts" "src/lib/__tests__/agent-callsite-coverage.test.ts"`
- **Committed in:** `a122a5c`

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both fixes were required to keep the new deal-chat runtime aligned with the shared contract and the repo-wide named-agent guardrails. No scope creep beyond correctness and governance.

## Issues Encountered
- The documented `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` path was not available in this environment, so execution bookkeeping used the repo-local `.claude/get-shit-done/bin/gsd-tools.cjs` path instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for `45-05-PLAN.md`, which can mirror these verified agent routes through the typed web proxy and server actions.
- Ready for `45-03-PLAN.md`, which can mount the persistent dock and side-panel UI against one stable streamed meta contract.

## Self-Check: PASSED
- Verified `.planning/phases/45-persistent-ai-chat-bar/45-02-SUMMARY.md` exists.
- Verified commits `a122a5c`, `2e0954c`, and `3a8c684` exist in git history.

---
*Phase: 45-persistent-ai-chat-bar*
*Completed: 2026-03-08*
