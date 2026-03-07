---
phase: 36-backend-engine-api-routes
plan: 02
subsystem: api
tags: [mastra, nextjs, vitest, zod, deck-intelligence, streaming]

# Dependency graph
requires:
  - phase: 36-backend-engine-api-routes
    provides: Artifact-aware deck structure keys, inference scoping, and cron isolation from Plan 01
provides:
  - Artifact-aware deck structure list, detail, infer, and chat route handling in the agent
  - Per-artifact Touch 4 chat refinement lookup, persistence, and re-inference isolation
  - Web client helpers and Next.js chat proxy support for optional `artifactType` query threading
affects: [phase-37-frontend-ui, deck-structure-settings, touch-4-chat]

# Tech tracking
tech-stack:
  added: []
  patterns: [artifact-qualified-route-validation, artifact-scoped-chat-refinement, urlsearchparams-query-threading]

key-files:
  created:
    - apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts
    - apps/web/src/lib/__tests__/api-client.deck-structures.test.ts
    - apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts
  modified:
    - apps/agent/src/deck-intelligence/chat-refinement.ts
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/app/api/deck-structures/chat/route.ts

key-decisions:
  - "Keep the existing `:touchType` route family and validate Touch 4 artifact keys through query params at the route boundary"
  - "Use `resolveDeckStructureKey()` inside agent detail, infer, chat, and chat-refinement flows so every Touch 4 operation resolves to a single artifact row"
  - "Use `URLSearchParams` in web helpers and proxy routing so optional `artifactType` stays encoded consistently without a second endpoint family"

patterns-established:
  - "Artifact route validation: parse `c.req.query()` then resolve `{ touchType, artifactType }` before Prisma or inference work"
  - "Artifact-scoped chat refinement: lookup, re-inference, message persistence, and `lastChatAt` all share the same resolved deck key"
  - "Web query threading: helper/proxy callers append `artifactType` only when present via `URLSearchParams`"

requirements-completed: [DECK-05]

# Metrics
duration: 3 min
completed: 2026-03-07
---

# Phase 36 Plan 02: Artifact-Aware Route Contract Summary

**Artifact-qualified deck structure routes and Touch 4 chat refinement now stay isolated per proposal, talk track, and FAQ row from the web proxy through agent persistence.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T21:49:00Z
- **Completed:** 2026-03-07T21:52:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Agent `GET /deck-structures` now resolves the seven-entry contract with Touch 4 artifact rows surfaced explicitly.
- Agent detail, infer, and chat handlers now reject missing Touch 4 `artifactType` values and route valid requests to the correct `(touchType, artifactType)` row.
- Chat refinement now reads, re-infers, summarizes, and persists against the matching artifact row only.
- Web deck structure helpers and the Next.js chat proxy now thread optional `artifactType` query params without creating new endpoint families.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make agent routes and chat artifact-aware**
   - `700657a` (test) — failing agent route and chat artifact coverage
   - `4a83021` (feat) — artifact-aware agent deck structure routes and chat isolation
2. **Task 2: Thread artifactType through web helpers and chat proxy**
   - `6253671` (test) — failing web artifact transport coverage
   - `4814f11` (feat) — artifact-aware web helper and chat proxy transport

## Files Created/Modified
- `apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts` - TDD contract coverage for artifact-aware routes and chat refinement
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - Artifact-scoped deck structure lookup, re-inference, and chat persistence
- `apps/agent/src/mastra/index.ts` - Seven-entry list contract plus artifact-aware detail, infer, and chat validation
- `apps/web/src/lib/__tests__/api-client.deck-structures.test.ts` - TDD coverage for helper query threading and typed artifact payloads
- `apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts` - TDD coverage for Touch 4 proxy validation and artifact passthrough
- `apps/web/src/lib/api-client.ts` - Optional `artifactType` query support and typed artifact-aware summaries/details
- `apps/web/src/app/api/deck-structures/chat/route.ts` - Touch 4 artifact validation and agent query passthrough for streaming chat

## Decisions Made
- Kept the locked `:touchType` route family and enforced Touch 4 artifact requirements at the route boundary instead of inventing nested artifact routes.
- Reused `resolveDeckStructureKey()` in both route handlers and chat refinement so Prisma lookups and re-inference share one artifact-key contract.
- Used `URLSearchParams` for web query construction so artifact threading stays optional and encoding-safe.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's `pnpm --filter ... exec vitest run apps/...` verification paths resolve inside each workspace package, so verification used the equivalent package-relative test paths (`src/...`) to run successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 37 can request Proposal, Talk Track, and FAQ deck structures through the existing route family with explicit artifact keys.
- Touch 4 chat sessions no longer leak summaries, `lastChatAt`, or message history across artifact rows.
- Phase 36 is complete and ready for Phase 37 frontend work.

## Self-Check: PASSED

---
*Phase: 36-backend-engine-api-routes*
*Completed: 2026-03-07*
