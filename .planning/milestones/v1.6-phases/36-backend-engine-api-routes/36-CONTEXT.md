# Phase 36: Backend Engine & API Routes - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the backend inference engine, cron flow, chat refinement chain, and deck-structure API routes so Touch 4 operates per artifact type instead of through a generic catch-all path. This phase covers artifact-aware backend behavior and route contracts; classification UI and Touch 4 settings UI stay in Phase 37.

</domain>

<decisions>
## Implementation Decisions

### Inference scoping
- Touch 4 primary examples must match the requested `artifactType` exactly; do not include null or mismatched examples in inference for that artifact
- Touch 4 secondary templates may include all Touch 4 templates as variation sources, even if they are not artifact-matched
- If a Touch 4 artifact has zero matching examples, persist and return an empty artifact-specific structure row rather than falling back to a generic Touch 4 structure
- Keep strict artifact separation for inference inputs; do not revive best-effort or generic Touch 4 merging

### API contract
- `GET /deck-structures` should return six logical entries: Touch 1, Touch 2, Touch 3, Pre-call, plus three separate Touch 4 entries for Proposal, Talk Track, and FAQ
- Touch 4 detail, infer, and chat routes should keep the existing `:touchType` route shape and identify the artifact with `?artifactType=`
- Touch 4 requests that omit `artifactType` should fail with a clear validation error instead of returning a generic placeholder
- Non-Touch-4 requests may ignore an extra `artifactType` parameter and continue resolving against `artifactType = null`

### Cron behavior
- Cron should treat Proposal, Talk Track, and FAQ as independent Touch 4 inference keys on every cycle
- Each Touch 4 artifact key should compute its own data hash from artifact-qualified data so re-inference is scoped independently
- Active chat protection should apply per artifact row; a recent Proposal chat must not block Talk Track or FAQ re-inference
- If one artifact key fails during cron, log it and continue processing the remaining artifact keys and touch types

### Chat refinement
- Touch 4 chat history, constraint summaries, and `lastChatAt` values should be stored separately per artifact-specific deck structure row
- Chat-triggered re-inference for Touch 4 must use the same requested artifact only; do not infer from combined Touch 4 data and then filter later
- Touch 4 chat requests without `artifactType` should be rejected rather than routed to a generic or inferred default artifact
- Long-thread summarization should stay per artifact so Proposal, Talk Track, and FAQ constraints never leak into one another

### Claude's Discretion
- Exact response payload field names for representing artifact-specific list entries, as long as clients can distinguish the three Touch 4 entries cleanly
- Exact validation error wording for missing `artifactType` requests
- Exact implementation strategy for artifact-qualified hashing and deck-structure row creation timing

</decisions>

<specifics>
## Specific Ideas

- Strict separation matters most for Touch 4 Examples; templates can be reused more broadly as supporting variation input
- The backend should become explicit for Touch 4 rather than silently preserving generic fallback behavior
- Empty artifact-specific records are preferable to missing rows because they keep the API and downstream UI contract stable

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/constants.ts`: already defines `ARTIFACT_TYPES` and canonical labels/order for Proposal, Talk Track, and FAQ
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts`: existing inference engine and empty-structure helpers can be extended to accept `artifactType`
- `apps/agent/src/deck-intelligence/auto-infer-cron.ts`: existing per-key cron loop, hashing, and active-chat protection patterns can be reused for artifact-specific keys
- `apps/agent/src/deck-intelligence/chat-refinement.ts`: existing chat persistence, summarization, and re-inference flow can be scoped to artifact-specific rows

### Established Patterns
- Current deck-structure persistence uses `findFirst` plus update/create semantics for nullable `artifactType` rows because Prisma cannot target nullable compound keys directly
- Phase 35 intentionally blocks generic Touch 4 inference/chat and returns placeholder behavior until artifact-aware backend work lands
- Agent API routes in `apps/agent/src/mastra/index.ts` and web fetch helpers in `apps/web/src/lib/api-client.ts` currently assume touch-type-only identity and need to thread `artifactType` through without changing the broader route family

### Integration Points
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts`: add artifact-aware filtering, hashing inputs, and persistence for Touch 4 rows
- `apps/agent/src/deck-intelligence/auto-infer-cron.ts`: expand the loop from legacy touch types to six deck-structure keys with per-artifact protection and hashing
- `apps/agent/src/deck-intelligence/chat-refinement.ts`: scope deck structure lookup, saved chat context, and re-inference to `(touchType, artifactType)`
- `apps/agent/src/mastra/index.ts`: update list/detail/infer/chat routes to accept `?artifactType=` and expose three Touch 4 entries
- `apps/web/src/app/api/deck-structures/chat/route.ts` and `apps/web/src/lib/api-client.ts`: thread `artifactType` through existing proxy/fetch helpers so Phase 37 UI can call the new backend contract

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 36-backend-engine-api-routes*
*Context gathered: 2026-03-07*
