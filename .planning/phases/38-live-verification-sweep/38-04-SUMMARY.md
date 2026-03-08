---
phase: 38-live-verification-sweep
plan: "04"
subsystem: api
tags: [touch-4, chat, proxy, mastra, regression, vercel, railway]
requires:
  - phase: 38-02
    provides: Truthful production evidence showing the artifact-scoped chat 404 at the proxy-to-agent hop.
  - phase: 36-backend-engine-api-routes
    provides: The approved artifact-qualified `:touchType` deck-structure route family.
provides:
  - Restored web-to-agent parity for artifact-qualified Touch 4 settings chat.
  - Regression coverage that locks the proxy target and agent route registration to one deployed path contract.
  - A shipped root-cause and resolution note for the prior production 404.
affects: [38-05, 39, v1.6 verification closure]
tech-stack:
  added: []
  patterns:
    - Keep Mastra custom deck-structure routes root-mounted and mirror that exact path in the web proxy.
    - Protect artifact-qualified chat parity with both runtime proxy assertions and source-contract route checks.
key-files:
  created:
    - .planning/phases/38-live-verification-sweep/38-04-SUMMARY.md
  modified:
    - apps/web/src/app/api/deck-structures/chat/route.ts
    - apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts
    - .planning/phases/38-live-verification-sweep/38-BACKEND-EVIDENCE.md
key-decisions:
  - "Treat the production 404 as proxy-path drift: chat must call the same root-mounted `/deck-structures/:touchType/chat` family already used by the rest of the web agent client."
  - "Guard future drift with paired regression coverage in both the web proxy suite and the agent route-contract suite instead of introducing a second artifact endpoint family."
patterns-established:
  - "Proxy parity pattern: artifactType stays in URLSearchParams while the upstream chat path matches the root-mounted Mastra custom route exactly."
  - "Route drift pattern: source assertions fail if web or agent code reintroduces an `/api`-prefixed artifact chat path."
requirements-completed: []
duration: 4 min
completed: 2026-03-08
---

# Phase 38 Plan 04: Chat Route Parity Summary

**Touch 4 artifact chat now targets the root-mounted Mastra route used in production, with regression tests and evidence notes locking the fix to one artifact-qualified path contract.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T01:49:00Z
- **Completed:** 2026-03-08T01:53:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added failing regression coverage that exposes `/api` drift in the web proxy target and protects the agent chat route registration contract.
- Fixed the settings-chat proxy to call the root-mounted Mastra custom route while preserving `artifactType` query threading through `URLSearchParams`.
- Appended the production 404 root cause and shipped resolution to `.planning/phases/38-live-verification-sweep/38-BACKEND-EVIDENCE.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing regression coverage for the production chat-route blocker** - `1cd7a7f` (test)
2. **Task 2: Restore production parity for artifact-scoped settings chat** - `f80f45d` (fix)

**Plan metadata:** pending final `docs(38-04)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/web/src/app/api/deck-structures/chat/route.ts` - Removes the incorrect `/api` prefix from the upstream agent chat URL.
- `apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts` - Fails if artifact-qualified proxy requests drift away from the deployed root-mounted chat path.
- `apps/agent/src/mastra/index.ts` - Documents that custom Mastra API routes are mounted at the service root.
- `apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts` - Locks the agent-side route contract against `/api`-prefixed drift.
- `.planning/phases/38-live-verification-sweep/38-BACKEND-EVIDENCE.md` - Records the shipped root cause and resolution for the production 404.
- `.planning/phases/38-live-verification-sweep/38-04-SUMMARY.md` - Summarizes the plan outcome, commits, and readiness state.

## Decisions Made
- Kept the approved `:touchType` route family and `artifactType` query contract unchanged; only the upstream proxy target changed to match the deployed root-mounted Mastra route.
- Used regression tests plus an evidence-note update to codify the fix instead of adding a new endpoint family or moving artifact scope into the request body.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The shell verification recipe in the plan referenced `rg`, but `rg` is not installed in this environment; evidence verification used the filesystem `Grep` tool instead.
- Workflow examples still referenced `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`, but this repo uses `.claude/get-shit-done/bin/gsd-tools.cjs`; execution continued with the repo-local script.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `38-05` can now re-run production chat evidence against the corrected upstream path and close the failing settings-tab verification trail if the deployed service is refreshed with this fix.
- Phase 39 can stay focused on type and UI hardening because the concrete production chat-path drift now has a shipped code fix and regression guardrails.

## Self-Check: PASSED
- Verified `.planning/phases/38-live-verification-sweep/38-04-SUMMARY.md` exists.
- Verified task commits `1cd7a7f` and `f80f45d` exist in git history.
