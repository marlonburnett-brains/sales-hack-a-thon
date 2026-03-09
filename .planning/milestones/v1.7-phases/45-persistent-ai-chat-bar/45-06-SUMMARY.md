---
phase: 45-persistent-ai-chat-bar
plan: 06
subsystem: ui
tags: [deal-chat, transcript-upload, nextjs, mastra, vitest]
requires:
  - phase: 45-persistent-ai-chat-bar
    provides: upload-capable agent deal-chat routes plus persistent dock UI from 45-02, 45-03, and 45-05
provides:
  - Structured transcript upload payloads on the shared deal-chat send contract
  - Upload-aware web and agent chat routes that preserve the existing streamed meta contract
  - Persistent deal chat composer upload controls with inline file state and error feedback
affects: [45-persistent-ai-chat-bar, deal-chat, web, agent]
tech-stack:
  added: []
  patterns:
    - Keep transcript uploads on the existing JSON chat route by reading files client-side into normalized text
    - Treat uploaded transcript content as the same confirmation-first and refine-before-save flow used for pasted transcript text
key-files:
  created:
    - .planning/phases/45-persistent-ai-chat-bar/45-06-SUMMARY.md
  modified:
    - packages/schemas/deal-chat.ts
    - packages/schemas/index.ts
    - apps/agent/src/deal-chat/assistant.ts
    - apps/agent/src/deal-chat/__tests__/assistant.test.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/mastra/__tests__/deal-chat-routes.test.ts
    - apps/web/src/app/api/deals/[dealId]/chat/route.ts
    - apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts
    - apps/web/src/components/deals/deal-chat-thread.tsx
    - apps/web/src/components/deals/__tests__/deal-chat-thread.test.tsx
key-decisions:
  - "Kept transcript uploads on the existing `/api/deals/[dealId]/chat` JSON route by sending browser-read text instead of adding a multipart upload endpoint."
  - "Allowed upload-only sends in the shared contract so sellers can attach a transcript without typed instructions and still enter the confirmation-first save flow."
  - "Rendered upload state inline in the persistent composer with replace/remove controls so the dock-first layout stays compact across deal pages."
patterns-established:
  - "Uploaded transcript turns should persist as intelligible user messages while the assistant evaluates the normalized file text for binding and cleanup guidance."
  - "Unsupported transcript files should surface explicit toast feedback instead of failing silently in the composer."
requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]
duration: 6 min
completed: 2026-03-09
---

# Phase 45 Plan 06: Transcript upload gap closure Summary

**Persistent deal chat now accepts uploaded transcript files through the existing JSON route, keeps inline file controls in the dock composer, and routes uploads through the same confirmation-first transcript save flow as pasted text.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T00:07:05Z
- **Completed:** 2026-03-09T00:12:56Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Extended the shared deal-chat request contract so transcript uploads can travel with filename, MIME type, and normalized text on the existing send path.
- Updated the web proxy and Mastra deal-chat route to forward uploaded transcript payloads unchanged and keep the final `---DEAL_CHAT_META---` stream contract intact.
- Taught the assistant to treat uploaded transcript content as transcript-save input, including touch confirmation and messy-text refine-before-save guidance.
- Added persistent composer upload controls for selecting, replacing, clearing, and sending transcript files with optional typed instructions.
- Added focused regression coverage across assistant, agent route, web proxy, and composer UI upload behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the shared deal-chat contract and route chain for uploaded transcript turns** - `75606f1` (test), `4824510` (feat)
2. **Task 2: Add transcript upload affordances to the persistent chat composer** - `d169014` (test), `cde7ced` (feat)

**Plan metadata:** pending final `docs(45-06)` metadata commit at summary creation time.

## Files Created/Modified
- `packages/schemas/deal-chat.ts` - Adds the transcript upload schema and allows upload-only chat sends.
- `packages/schemas/index.ts` - Re-exports the upload schema and type for app consumers.
- `apps/agent/src/deal-chat/assistant.ts` - Uses uploaded transcript text for binding inference and refine-before-save logic while preserving knowledge-query behavior.
- `apps/agent/src/deal-chat/__tests__/assistant.test.ts` - Covers uploaded transcript confirmation and messy-upload guidance.
- `apps/agent/src/mastra/index.ts` - Forwards transcript upload payloads into the governed deal-chat runtime and stores intelligible user turn content.
- `apps/agent/src/mastra/__tests__/deal-chat-routes.test.ts` - Verifies upload payload forwarding without changing stream metadata behavior.
- `apps/web/src/app/api/deals/[dealId]/chat/route.ts` - Accepts upload-aware JSON payloads and proxies them to the agent route.
- `apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts` - Verifies upload payload passthrough on the web proxy.
- `apps/web/src/components/deals/deal-chat-thread.tsx` - Adds transcript selection, inline file state, client-side text reading, and upload-aware send behavior.
- `apps/web/src/components/deals/__tests__/deal-chat-thread.test.tsx` - Covers upload controls, payload submission, and unsupported-file feedback.

## Decisions Made
- Kept transcript upload support inside the existing typed deal-chat route family instead of creating a second upload-only namespace.
- Let the shared send schema accept either a message, a transcript upload, or both so the composer can support optional instructions alongside a file.
- Rejected unsupported transcript files in the composer with explicit Sonner feedback so sellers are not left with silent no-op file picks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The documented `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` path was unavailable in this environment, so execution bookkeeping used the repo-local `.claude/get-shit-done/bin/gsd-tools.cjs` path instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 45 now closes the transcript upload gap from verification, so sellers can paste or upload transcript content from any persistent deal chat surface.
- The existing manual verification sweep can re-run the chat flow to confirm `CHAT-03` now passes alongside the already-shipped history and knowledge-query behaviors.

## Self-Check: PASSED
- Verified `.planning/phases/45-persistent-ai-chat-bar/45-06-SUMMARY.md` exists.
- Verified commits `75606f1`, `4824510`, `d169014`, and `cde7ced` exist in git history.

---
*Phase: 45-persistent-ai-chat-bar*
*Completed: 2026-03-09*
