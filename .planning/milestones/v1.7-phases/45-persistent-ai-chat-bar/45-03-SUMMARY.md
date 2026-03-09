---
phase: 45-persistent-ai-chat-bar
plan: 03
subsystem: ui
tags: [react, nextjs, vitest, deal-chat, layout]
requires:
  - phase: 45-05
    provides: typed web bootstrap, streaming, and binding helpers for deal chat
provides:
  - persistent dock-first deal chat shell with side-panel mode
  - streamed deal-chat meta rendering with inline confirmation and knowledge cards
  - shared deal-layout mount that preserves chat state across sub-pages
affects: [45-persistent-ai-chat-bar, deal-layout, briefing]
tech-stack:
  added: []
  patterns:
    - layout-mounted persistent client chat with route-derived context
    - delimiter-based streamed meta parsing for inline deal-chat affordances
key-files:
  created:
    - apps/web/src/components/deals/persistent-deal-chat.tsx
    - apps/web/src/components/deals/deal-chat-thread.tsx
    - apps/web/src/components/deals/__tests__/persistent-deal-chat.test.tsx
    - apps/web/src/components/deals/__tests__/deal-chat-thread.test.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/__tests__/layout-chat-persistence.test.tsx
  modified:
    - apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx
key-decisions:
  - "Mounted the assistant once in the shared deal layout and derived live route context client-side with Next navigation hooks."
  - "Kept the default experience as a collapsed dock teaser while exposing a side-panel mode through existing dialog primitives."
  - "Rendered streamed DEAL_CHAT_META payloads inline so confirmations, suggestions, and knowledge matches stay in the same thread."
patterns-established:
  - "Persistent deal chat state lives above child routes; navigation only refreshes route cues and suggestion chips."
  - "Binding confirmations append lightweight chips while keeping the original assistant turn visible for follow-up corrections."
requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]
duration: 9m 50s
completed: 2026-03-08
---

# Phase 45 Plan 03: Persistent AI Chat Bar Summary

**Persistent deal chat now stays mounted across overview, briefing, and touch routes with dock-first presentation, streamed inline metadata, and briefing-page alignment around one shared assistant.**

## Performance

- **Duration:** 9m 50s
- **Started:** 2026-03-08T23:35:52Z
- **Completed:** 2026-03-08T23:45:42Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added a route-aware `PersistentDealChat` shell that starts as a collapsed dock, opens inline, and switches into a side panel.
- Built `DealChatThread` to parse streamed `---DEAL_CHAT_META---` payloads and surface inline suggestion chips, knowledge matches, and save-confirmation controls.
- Mounted the chat in `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` and removed the divergent briefing-page chat panel in favor of shared-assistant guidance.
- Added focused Vitest coverage for dock behavior, streamed meta rendering, inline binding flows, and cross-route persistence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the persistent dock and side-panel chat UI** - `31754e0` (test), `2a60a0b` (feat)
2. **Task 2: Mount the chat in the shared deal layout and align the briefing page** - `839f151` (feat)

## Files Created/Modified
- `apps/web/src/components/deals/persistent-deal-chat.tsx` - Route-aware persistent shell with dock teaser and side-panel mode.
- `apps/web/src/components/deals/deal-chat-thread.tsx` - Thread rendering, streaming parser, composer, and inline binding actions.
- `apps/web/src/components/deals/__tests__/persistent-deal-chat.test.tsx` - Covers greeting boot, teaser mode, and side-panel switching.
- `apps/web/src/components/deals/__tests__/deal-chat-thread.test.tsx` - Covers streamed meta parsing and inline confirmation/refine flows.
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` - Mounts one persistent assistant inside the shared deal shell.
- `apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx` - Reframes briefing around the shared assistant and briefing artifacts.
- `apps/web/src/app/(authenticated)/deals/[dealId]/__tests__/layout-chat-persistence.test.tsx` - Verifies chat state survives navigation while context cues refresh.

## Decisions Made
- Mounted the assistant in the shared deal layout instead of keeping page-local chat roots so the same client state survives navigation.
- Kept the dock teaser visible by default and treated the side-panel as an opt-in mode to match the product decision from planning.
- Preserved the original assistant turn after save confirmation so sellers can still see context and retry alternate binding actions inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tightened the binding state update shape after layout wiring**
- **Found during:** Task 2 (Mount the chat in the shared deal layout and align the briefing page)
- **Issue:** The post-save binding state update in `DealChatThread` needed a nullable-safe shape to satisfy the route-persistence integration work.
- **Fix:** Updated the confirmed-binding state transition to preserve the message metadata contract while appending confirmation chips.
- **Files modified:** `apps/web/src/components/deals/deal-chat-thread.tsx`
- **Verification:** `pnpm --filter web exec vitest run "src/components/deals/__tests__/persistent-deal-chat.test.tsx" "src/components/deals/__tests__/deal-chat-thread.test.tsx" "src/app/(authenticated)/deals/[dealId]/__tests__/layout-chat-persistence.test.tsx"`
- **Committed in:** `839f151` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was a narrow correctness adjustment needed to complete the shared-layout integration. No scope creep.

## Issues Encountered
- `pnpm --filter web exec tsc --noEmit` still fails on pre-existing, out-of-scope test typing issues already tracked in `.planning/phases/45-persistent-ai-chat-bar/deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Deal pages now expose one persistent assistant surface that downstream polish or verification work can exercise across sub-routes.
- The remaining blocker is repo-wide pre-existing `tsc` noise outside this plan's files; targeted deal-chat tests pass.

## Self-Check: PASSED

- Verified `.planning/phases/45-persistent-ai-chat-bar/45-03-SUMMARY.md` exists.
- Verified task commits `31754e0`, `2a60a0b`, and `839f151` exist in git history.
