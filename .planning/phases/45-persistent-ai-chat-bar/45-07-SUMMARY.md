---
phase: 45-persistent-ai-chat-bar
plan: 07
subsystem: api
tags: [deal-chat, auth, x-api-key, mastra, vitest]
requires:
  - phase: 45-05
    provides: "Typed web proxy and shared server-side deal-chat client seam"
  - phase: 45-06
    provides: "Transcript upload flow on the shared deal-chat route family"
provides:
  - "Deal-chat route proxies authenticate with X-API-Key for bootstrap, streaming, and binding saves"
  - "Shared server-side agent client uses X-API-Key across deal-chat helpers and covered shared fetch paths"
  - "Regression suites fail if Authorization returns on the touched deal-chat bridge"
affects: [phase-45-verification, deal-chat-bridge, agent-service-auth]
tech-stack:
  added: []
  patterns: ["Protected web-to-agent requests use X-API-Key to match Mastra SimpleAuth", "Deal-chat proxy and server-side client tests assert passthrough Google and user headers while rejecting Authorization"]
key-files:
  created: [.planning/phases/45-persistent-ai-chat-bar/45-07-SUMMARY.md]
  modified: [apps/web/src/app/api/deals/[dealId]/chat/route.ts, apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts, apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts, apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts, apps/web/src/lib/api-client.ts, apps/web/src/lib/__tests__/api-client.deal-chat.test.ts, apps/web/src/lib/__tests__/api-client-actions.test.ts, apps/web/src/lib/__tests__/slide-api-client.test.ts]
key-decisions:
  - "Switched the deal-chat web bridge and shared server-side agent client to X-API-Key only so protected Mastra routes match the declared SimpleAuth contract end to end."
  - "Kept the fix in shared fetchAgent coverage instead of a deal-chat-only override so future server-side agent calls cannot silently drift back to bearer auth."
patterns-established:
  - "Protected agent fetch helpers should assert X-API-Key and explicitly reject Authorization in focused regression tests."
  - "Shared helper tests that touch Google-auth flows should mock token retrieval before importing api-client utilities."
requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]
duration: 2 min
completed: 2026-03-09
---

# Phase 45 Plan 07: X-API-Key Chat Bridge Summary

**Deal-chat bootstrap, streaming turns, and binding confirmations now use the protected agent runtime's X-API-Key contract across both route proxies and shared server-side helpers.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T00:32:03Z
- **Completed:** 2026-03-09T00:35:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Switched the deal-chat proxy routes to send `X-API-Key` while preserving `X-Google-Access-Token` and `X-User-Id` passthrough headers.
- Updated the shared `fetchAgent()` seam so deal-chat bootstrap, streamed sends, and binding confirmations follow the same SimpleAuth contract server-side.
- Hardened focused regressions so touched route and api-client paths fail if `Authorization` bearer auth comes back.

## Task Commits

Each task was committed atomically:

1. **Task 1: Align the deal-chat web proxy routes with the agent runtime header contract** - `8ca799e` (test)
2. **Task 1: Align the deal-chat web proxy routes with the agent runtime header contract** - `38a61e3` (feat)
3. **Task 2: Align the shared server-side api-client seam and auth regressions** - `5838f0c` (test)
4. **Task 2: Align the shared server-side api-client seam and auth regressions** - `52061bb` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/app/api/deals/[dealId]/chat/route.ts` - sends `X-API-Key` on bootstrap and streamed chat proxy requests.
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts` - sends `X-API-Key` on binding confirmation and correction saves.
- `apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts` - locks proxy auth headers to `X-API-Key` and rejects `Authorization`.
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts` - covers binding proxy auth header regression.
- `apps/web/src/lib/api-client.ts` - switches shared protected agent fetches to `X-API-Key`.
- `apps/web/src/lib/__tests__/api-client.deal-chat.test.ts` - covers server-side deal-chat bootstrap, send, and binding auth headers.
- `apps/web/src/lib/__tests__/api-client-actions.test.ts` - aligns shared helper auth assertions with `X-API-Key`.
- `apps/web/src/lib/__tests__/slide-api-client.test.ts` - aligns shared helper auth assertions and stabilizes Google-auth setup for shared helper coverage.

## Decisions Made
- Used `X-API-Key` exclusively for the touched deal-chat bridge because the protected Mastra runtime explicitly declares `headers: ["X-API-Key"]` and does not accept bearer auth.
- Applied the auth change in shared `fetchAgent()` rather than adding a special-case deal-chat override so the common server-only seam stays consistent anywhere it reaches the protected agent runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stabilized shared slide helper auth coverage**
- **Found during:** Task 2 (Align the shared server-side api-client seam and auth regressions)
- **Issue:** `slide-api-client.test.ts` exercises `fetchWithGoogleAuth()`, but it lacked a Google token mock and module reset, causing request-scope failures before the updated auth assertions could run.
- **Fix:** Mocked `@/lib/supabase/google-token` and reset modules in the slide api-client test setup.
- **Files modified:** `apps/web/src/lib/__tests__/slide-api-client.test.ts`
- **Verification:** `pnpm --filter web exec vitest run "src/lib/__tests__/api-client.deal-chat.test.ts" "src/lib/__tests__/api-client-actions.test.ts" "src/lib/__tests__/slide-api-client.test.ts"`
- **Committed in:** `52061bb` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The test harness fix was required to verify the shared auth seam after the helper change. No scope creep.

## Issues Encountered
- The configured `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` path was missing in this environment, so plan metadata updates used the repo-local `./.claude/get-shit-done/bin/gsd-tools.cjs` helper instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 45 now has all 7 plans completed and the final protected-auth gap is closed.
- Ready for roadmap/state reconciliation and any final milestone verification sweep.

## Self-Check: PASSED
- Verified summary file exists on disk.
- Verified all task commits exist in `git log`.

---
*Phase: 45-persistent-ai-chat-bar*
*Completed: 2026-03-09*
