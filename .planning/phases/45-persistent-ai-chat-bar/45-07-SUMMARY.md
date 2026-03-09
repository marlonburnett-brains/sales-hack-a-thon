---
phase: 45-persistent-ai-chat-bar
plan: 07
subsystem: api
tags: [deal-chat, auth, bearer, mastra, vitest]
requires:
  - phase: 45-05
    provides: "Typed web proxy and shared server-side deal-chat client seam"
  - phase: 45-06
    provides: "Transcript upload flow on the shared deal-chat route family"
provides:
  - "Deal-chat route proxies currently authenticate with Authorization bearer tokens for bootstrap, streaming, and binding saves due to a Mastra auth issue"
  - "Shared server-side agent client currently uses Authorization bearer tokens across deal-chat helpers and covered shared fetch paths"
  - "Regression suites now lock in the temporary bearer contract while preserving passthrough Google and user headers"
affects: [phase-45-verification, deal-chat-bridge, agent-service-auth]
tech-stack:
  added: []
  patterns: ["Protected web-to-agent requests currently use Authorization bearer tokens until the Mastra auth issue is resolved", "Deal-chat proxy and server-side client tests assert passthrough Google and user headers while rejecting X-API-Key drift"]
key-files:
  created: [.planning/phases/45-persistent-ai-chat-bar/45-07-SUMMARY.md]
  modified: [apps/web/src/app/api/deals/[dealId]/chat/route.ts, apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts, apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts, apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts, apps/web/src/lib/api-client.ts, apps/web/src/lib/__tests__/api-client.deal-chat.test.ts, apps/web/src/lib/__tests__/api-client-actions.test.ts, apps/web/src/lib/__tests__/slide-api-client.test.ts]
key-decisions:
  - "Mastra currently requires Authorization bearer auth in practice for the deal-chat bridge, so the temporary runtime contract remains bearer even though the earlier gap-closure attempt targeted X-API-Key."
  - "Kept the auth seam shared in fetchAgent so the temporary bearer workaround stays consistent anywhere the web app calls the protected agent runtime."
patterns-established:
  - "Protected agent fetch helpers should currently assert Authorization bearer auth and explicitly reject X-API-Key drift until the Mastra issue is resolved."
  - "Shared helper tests that touch Google-auth flows should mock token retrieval before importing api-client utilities."
requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]
duration: 2 min
completed: 2026-03-09
---

# Phase 45 Plan 07: Deal Chat Auth Bridge Summary

**Deal-chat bootstrap, streaming turns, and binding confirmations currently use `Authorization: Bearer ...` across both route proxies and shared server-side helpers because of an unresolved Mastra auth issue.**

Temporary note: the earlier `X-API-Key` gap-closure implementation was rolled back after live validation showed Mastra still requires bearer auth for this path right now.

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T00:32:03Z
- **Completed:** 2026-03-09T00:35:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Confirmed the deal-chat proxy routes are back on `Authorization: Bearer ...` while preserving `X-Google-Access-Token` and `X-User-Id` passthrough headers.
- Confirmed the shared `fetchAgent()` seam uses the same bearer contract for deal-chat bootstrap, streamed sends, and binding confirmations.
- Updated focused regressions so touched route and api-client paths fail if `X-API-Key` is reintroduced before the Mastra issue is resolved.

## Task Commits

Each task was committed atomically:

1. **Task 1: Align the deal-chat web proxy routes with the agent runtime header contract** - `8ca799e` (test)
2. **Task 1: Align the deal-chat web proxy routes with the agent runtime header contract** - `38a61e3` (feat)
3. **Task 2: Align the shared server-side api-client seam and auth regressions** - `5838f0c` (test)
4. **Task 2: Align the shared server-side api-client seam and auth regressions** - `52061bb` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/app/api/deals/[dealId]/chat/route.ts` - sends bearer auth on bootstrap and streamed chat proxy requests.
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts` - sends bearer auth on binding confirmation and correction saves.
- `apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts` - locks proxy auth headers to bearer auth and rejects `X-API-Key` drift.
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts` - covers binding proxy auth header regression.
- `apps/web/src/lib/api-client.ts` - keeps shared protected agent fetches on bearer auth for the current Mastra workaround.
- `apps/web/src/lib/__tests__/api-client.deal-chat.test.ts` - covers server-side deal-chat bootstrap, send, and binding auth headers.
- `apps/web/src/lib/__tests__/api-client-actions.test.ts` - aligns shared helper auth assertions with bearer auth.
- `apps/web/src/lib/__tests__/slide-api-client.test.ts` - aligns shared helper auth assertions with bearer auth and keeps the Google-auth setup stable.

## Decisions Made
- Kept `Authorization: Bearer ...` for the touched deal-chat bridge because live behavior currently depends on that workaround despite the earlier Mastra header-contract assumption.
- Kept the auth behavior in shared `fetchAgent()` rather than adding a deal-chat-only exception so the workaround stays consistent anywhere the web app reaches the protected agent runtime.

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
- Mastra currently rejects or mishandles the attempted `X-API-Key` path for this flow, so the temporary bearer workaround remains the validated runtime contract.

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
