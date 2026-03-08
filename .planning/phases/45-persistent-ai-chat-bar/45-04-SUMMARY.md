---
phase: 45-persistent-ai-chat-bar
plan: 04
subsystem: database
tags: [prisma, postgres, vitest, deal-chat, persistence]
requires:
  - phase: 45-01
    provides: shared deal-chat schemas and governed assistant identity
provides:
  - durable Prisma storage for one deal-scoped chat thread and full message history
  - generic deal context source persistence for notes or transcripts with nullable touch binding
  - confirmation-aware touch inference and transcript review heuristics with regression coverage
affects: [45-02, 45-03, 45-05, 46]
tech-stack:
  added: []
  patterns:
    - forward-only manual Prisma migrations when shared-db drift blocks create-only generation
    - separate prompt summary compaction from seller-visible message history
key-files:
  created:
    - apps/agent/prisma/migrations/20260308223000_persistent_ai_chat_bar/migration.sql
    - apps/agent/src/deal-chat/persistence.ts
    - apps/agent/src/deal-chat/bindings.ts
    - apps/agent/src/deal-chat/__tests__/persistence.test.ts
    - apps/agent/src/deal-chat/__tests__/bindings.test.ts
  modified:
    - apps/agent/prisma/schema.prisma
key-decisions:
  - "Used a forward-only manual SQL migration because prisma migrate dev --create-only was blocked by shared-db drift and reset flows are forbidden."
  - "Deal chat keeps full persisted message history while prompt compaction lives separately on DealChatThread.promptSummary."
patterns-established:
  - "One deal maps to one DealChatThread with route-stamped DealChatMessage rows for every turn."
  - "Overview and Briefing saves can stay touch-null until seller confirmation resolves ambiguous bindings."
requirements-completed: [CHAT-02, CHAT-03]
duration: 8 min
completed: 2026-03-08
---

# Phase 45 Plan 04: Persistent Storage Summary

**Prisma-backed deal chat thread storage with generic note/transcript sources and confirmation-aware touch binding heuristics**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T22:55:31Z
- **Completed:** 2026-03-08T23:03:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `DealChatThread`, `DealChatMessage`, and `DealContextSource` models plus a committed forward-only migration.
- Implemented helper functions for one-thread-per-deal creation, message persistence, prompt-summary updates, and generic context-source save/confirm flows.
- Added deterministic binding heuristics and regression tests for route-first inference, overview/briefing ambiguity, and messy transcript review.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the forward-only Prisma models and migration for persistent deal chat** - `7be8ee8` (feat)
2. **Task 2: Implement persistence helpers and confirmation-aware binding heuristics** - `797d141` (test), `df9e1b2` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - adds deal chat tables and relations on `Deal` and `InteractionRecord`
- `apps/agent/prisma/migrations/20260308223000_persistent_ai_chat_bar/migration.sql` - forward-only SQL for persistent chat storage
- `apps/agent/src/deal-chat/persistence.ts` - thread, message, prompt-summary, and source save/confirm helpers
- `apps/agent/src/deal-chat/bindings.ts` - touch inference and review-before-save heuristics
- `apps/agent/src/deal-chat/__tests__/persistence.test.ts` - persistence regression coverage
- `apps/agent/src/deal-chat/__tests__/bindings.test.ts` - binding heuristic regression coverage

## Decisions Made
- Used a manual SQL migration after `prisma migrate dev --create-only` reported shared-db drift and attempted a forbidden reset.
- Kept prompt compaction on the thread row so seller-visible history stays intact instead of trimming saved messages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched migration generation to a manual forward-only SQL file**
- **Found during:** Task 1 (Add the forward-only Prisma models and migration for persistent deal chat)
- **Issue:** `pnpm --filter agent exec prisma migrate dev --name persistent_ai_chat_bar --create-only` was blocked by existing shared-db drift and Prisma proposed a reset.
- **Fix:** Wrote `apps/agent/prisma/migrations/20260308223000_persistent_ai_chat_bar/migration.sql` manually and kept the schema change forward-only.
- **Files modified:** `apps/agent/prisma/migrations/20260308223000_persistent_ai_chat_bar/migration.sql`
- **Verification:** `pnpm --filter agent exec prisma validate`
- **Committed in:** `7be8ee8`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation stayed within plan scope and preserved the repo's migration discipline.

## Issues Encountered
- The workflow's `$HOME/.claude/.../gsd-tools.cjs` path was unavailable in this environment, so execution bookkeeping used the repo-local `.opencode/get-shit-done/bin/gsd-tools.cjs` instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 45 runtime and UI plans can now persist one durable deal chat thread and save generic notes/transcripts without fake touch artifacts.
- Phase 46 can reuse confirmed `DealContextSource` rows instead of overloading the Touch 4 `Transcript` model.

## Self-Check: PASSED

---
*Phase: 45-persistent-ai-chat-bar*
*Completed: 2026-03-08*
