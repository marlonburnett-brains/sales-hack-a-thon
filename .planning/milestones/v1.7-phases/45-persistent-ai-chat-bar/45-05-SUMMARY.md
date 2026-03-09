---
phase: 45-persistent-ai-chat-bar
plan: "05"
subsystem: api
tags: [web, nextjs, deal-chat, server-actions, vitest]
requires:
  - phase: 45-persistent-ai-chat-bar
    provides: verified agent deal-chat routes and streamed meta contract from 45-02 plus persisted source saves from 45-04
provides:
  - Next.js proxy routes for deal chat bootstrap, streaming turns, and binding confirmations
  - Typed web api-client helpers for deal chat bootstrap, streaming, and binding mutations
  - Deal-chat server actions that preserve refine-before-save metadata and revalidate deal pages after saves
affects: [45-03, web, deal-chat, deal-layout]
tech-stack:
  added: []
  patterns:
    - Typed Next.js proxy routes mirror the verified `/deals/:dealId/chat` agent contract without introducing a second web namespace
    - Deal chat server actions revalidate both the base deal route and the current page path after confirmed saves
key-files:
  created:
    - apps/web/src/app/api/deals/[dealId]/chat/route.ts
    - apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts
    - apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts
    - apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts
    - apps/web/src/lib/actions/deal-chat-actions.ts
    - apps/web/src/lib/__tests__/api-client.deal-chat.test.ts
    - .planning/phases/45-persistent-ai-chat-bar/45-05-SUMMARY.md
  modified:
    - apps/web/src/lib/api-client.ts
key-decisions:
  - "Kept the web route family under `/api/deals/[dealId]/chat` and mirrored the verified agent contract instead of inventing a separate chat namespace."
  - "Added a response-capable Google-auth fetch helper so server-only deal chat helpers can load bootstrap JSON and stream turn responses through one typed client seam."
patterns-established:
  - "Deal chat bootstrap and binding mutations should use typed api-client helpers plus server actions, while streamed UI turns can reuse the dedicated Next.js proxy route."
  - "Confirmed note or transcript saves should revalidate both `/deals/[dealId]` and the source route pathname so the persistent chat shell and current page stay aligned."
requirements-completed: [CHAT-02, CHAT-03, CHAT-04, CHAT-05]
duration: 7 min
completed: 2026-03-08
---

# Phase 45 Plan 05: Typed web proxy, api-client helpers, and deal-chat server actions Summary

**Typed web deal-chat routes now mirror the verified agent contract, while server-only helpers and server actions preserve streamed metadata, binding saves, and deal-route revalidation for the upcoming UI plan.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-08T23:24:20Z
- **Completed:** 2026-03-08T23:31:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added typed Next.js proxy routes for `GET /api/deals/[dealId]/chat`, `POST /api/deals/[dealId]/chat`, and `POST /api/deals/[dealId]/chat/bindings` with shared route-context and message validation.
- Extended the web api-client with typed deal-chat bootstrap, streaming, and binding helpers that mirror the verified runtime contract, including `refineBeforeSave` metadata and saved-source payloads.
- Added `apps/web/src/lib/actions/deal-chat-actions.ts` so the deal layout and upcoming persistent chat UI can load bootstrap data and confirm bindings through a server-action seam with route revalidation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the typed Next.js proxy routes for chat streaming and binding confirmation** - `05deeb1` (test), `b4b76b8` (feat)
2. **Task 2: Expose typed api-client helpers and server actions for the deal chat UI** - `d9f93ce` (test), `93772c9` (feat)

**Plan metadata:** pending final `docs(45-05)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/web/src/app/api/deals/[dealId]/chat/route.ts` - proxies deal chat bootstrap and streamed turns to the agent route family with preserved auth headers.
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts` - proxies binding confirmation or correction payloads and returns the saved source metadata.
- `apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts` - covers route-context forwarding, stream passthrough, and refine-before-save metadata preservation.
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts` - covers binding confirmation forwarding and returned save metadata.
- `apps/web/src/lib/api-client.ts` - adds typed deal-chat bootstrap, stream, and binding helpers plus a Google-auth response fetch seam.
- `apps/web/src/lib/actions/deal-chat-actions.ts` - exposes server actions for bootstrap reads and confirmed save mutations with revalidation.
- `apps/web/src/lib/__tests__/api-client.deal-chat.test.ts` - covers typed deal-chat helpers, runtime metadata preservation, and server-action revalidation behavior.

## Decisions Made
- Kept route validation grounded in the shared deal-chat schema package for route context, message payloads, and source payloads instead of drifting into web-only shapes.
- Revalidated both the base deal layout path and the source pathname after confirmed saves so the persistent chat shell and the current page stay in sync.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The documented `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` path was unavailable in this environment, so execution bookkeeping used the repo-local `.claude/get-shit-done/bin/gsd-tools.cjs` path instead.
- `pnpm --filter web exec tsc --noEmit` still reports pre-existing, out-of-scope test fixture type errors outside the deal-chat files touched here. Logged in `.planning/phases/45-persistent-ai-chat-bar/deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `45-03` can now consume typed bootstrap and binding helpers without hand-rolling fetch details or revalidation logic.
- The verified web proxy and server-action seams are ready for the persistent dock and side-panel UI to parse `---DEAL_CHAT_META---` consistently.

## Self-Check: PASSED
- Verified `.planning/phases/45-persistent-ai-chat-bar/45-05-SUMMARY.md` exists.
- Verified commits `05deeb1`, `b4b76b8`, `d9f93ce`, and `93772c9` exist in git history.

---
*Phase: 45-persistent-ai-chat-bar*
*Completed: 2026-03-08*
