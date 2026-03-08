---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Deals & HITL Pipeline
status: executing
stopped_at: Completed 45-02-PLAN.md
last_updated: "2026-03-08T23:20:30.000Z"
last_activity: "2026-03-08 - Completed 45-02 (deal chat orchestrator, routes, and regression coverage)"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 39
  completed_plans: 37
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** v1.7 Deals & HITL Pipeline -- Phase 45 plan 02 complete, Phase 47 continuing in parallel

## Current Position

Phase: 47 of 47 (Drive Artifact Integration)
Plan: 2 of 3 in current phase (next)
Status: Executing
Last activity: 2026-03-08 - Completed 45-02 (deal chat orchestrator, routes, and regression coverage)

Progress: [██████████] 95%

## Performance Metrics

**Velocity:**
- Total plans completed: 94 (v1.0: 27, v1.1: 6, v1.2: 10, v1.3: 10, v1.4: 12, v1.5: 8, v1.6: 20)
- Total project time: ~6 days (2026-03-03 -> 2026-03-08)
- Total LOC: ~50,876 TypeScript/TSX/Prisma

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
- v1.7 roadmap: Maximum parallelization with 4 tiers -- Phases 41+43 concurrent, 42+44 concurrent, 45+46 concurrent, then 47.
- v1.7 roadmap: Deal pipeline page (41) owns schema migrations for Deal.status/stage/assignment. Agent architecture (43) owns AgentConfig/AgentConfigVersion migrations. Independent migration streams avoid batching pitfall.
- 41-01: Used manual migration + resolve --applied to bypass init migration drift (per CLAUDE.md: never reset)
- 41-01: Collaborators stored as JSON string field, parsed client-side
- 41-01: Known users derived from UserGoogleToken with email-to-name heuristic
- [Phase 41]: Filter state stored in URL params (status, assignee, view) for shareability and refresh persistence
- [Phase 43]: Named-agent roster now covers all prompt-bearing workflow, ingestion, deck-intelligence, extraction, and validation responsibilities as first-class agents.
- [Phase 43]: AgentConfig is the stable identity row and AgentConfigVersion stores immutable baselinePrompt, rolePrompt, compiledPrompt, and the publishedVersion pointer.
- [Phase 43]: Used a focused forward-only SQL migration for AgentConfig models because prisma migrate dev was blocked by existing shared-db drift and reset flows are forbidden.
- [Phase 43]: Runtime prompt resolution now composes baseline and role layers from Prisma-published versions and caches by immutable version id rather than by agent id.
- [Phase 43]: The shared Mastra named-agent registry and helper execution seam both return prompt version metadata so long-running workflows can pin exact published prompts.
- [Phase 43]: Named agent execution now injects the resolved compiled prompt at call time so workflows can pin immutable version ids without changing caller schemas.
- [Phase 43]: Touch 2/3 slide selection stays under one shared deck-slide-selector family, while Touch 4 copy generation stays on the dedicated proposal-copywriter role.
- [Phase 43]: Deck intelligence keeps separate named agents for structure inference and chat refinement instead of collapsing both concerns into one role.
- [Phase 43]: Repo governance now uses a prompt-bearing business-file coverage suite so new direct provider prompt calls fail before named-agent drift can land.
- [Phase 42]: Deal layout uses negative margins to reclaim global sidebar padding for full-bleed deal sidebar
- [Phase 43]: Internal/background jobs now use the same runtime named-agent executor as seller-facing flows rather than keeping a separate prompt path.
- [Phase 43]: Background structured outputs now rely on shared schema package definitions so internal prompt contracts stay versioned and reusable.
- [Phase 42]: DealAssignmentPicker requires parallel knownUsers fetch; touch completion counts unique touch types with completed-status interactions
- [Phase 42]: BriefingChatPanel reuses generatePreCallBriefingAction with default inputs for one-click briefing generation
- [Phase 44]: Used 'any' type for Prisma agentConfig queries due to pre-existing type drift from forward-only SQL migrations
- [Phase 46]: Used manual migration + resolve --applied for HITL fields due to existing DB drift
- [Phase 44]: Publish dialog upgraded from simple set-based LineDiff to proper diffLines-based AgentDiffView
- [Phase 44]: Agent chat uses Vertex AI GoogleGenAI client (not API key) to match existing agent executor pattern
- [Phase 44]: Chat state is ephemeral (client-side only) -- no DB persistence for prompt editing conversations
- [Phase 46]: InteractionRecord created at workflow start for hitlStage tracking from first suspend
- [Phase 46]: Touch 4 recordInteraction changed from create to update since InteractionRecord exists from parseTranscript
- [Phase 46]: Touch page split into server+client components for data fetching and interactive HITL state management
- [Phase 45]: Phase 45 starts from one shared deal-chat schema surface so downstream storage, route, and UI plans import canonical request and metadata contracts.
- [Phase 45]: Deal chat uses one governed deal-chat-assistant orchestrator identity instead of per-page or transcript-cleanup prompt agents.
- [Phase 45]: Used a forward-only manual SQL migration for deal chat because prisma migrate dev --create-only was blocked by shared-db drift and reset flows are forbidden.
- [Phase 45]: Deal chat keeps full persisted message history while prompt compaction lives separately on DealChatThread.promptSummary.
- [Phase 47]: Used manual migration + resolve --applied for UserSetting due to existing DB drift
- [Phase 47]: OAuth scope upgraded to full drive (not drive.readonly) for folder creation and permission management
- [Phase 47]: makePubliclyViewable kept as deprecated export until Plan 03 migrates all call sites
- [Phase 45]: Kept one governed deal-chat-assistant orchestration entrypoint that loads explicit deal grounding while route handlers stay thin and persist only messages plus confirmed bindings.
- [Phase 45]: Returned structured answer metadata and prompt-version data with each streamed turn so the web proxy can mirror one verified contract.

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 13 | Implement UI for visualizing and deleting deck structure memories | 2026-03-08 | c35085a | [13-implement-ui-for-visualizing-and-deletin](./quick/13-implement-ui-for-visualizing-and-deletin/) |
| Phase 43 P01 | 6 min | 2 tasks | 8 files |
| Phase 43 P02 | 4 min | 2 tasks | 8 files |
| Phase 43 P03 | 10 min | 2 tasks | 8 files |
| Phase 43 P04 | 12 min | 2 tasks | 14 files |
| Phase 42 P01 | 4min | 2 tasks | 10 files |
| Phase 42 P02 | 3min | 1 tasks | 2 files |
| Phase 42 P03 | 3min | 2 tasks | 4 files |
| Phase 43 P05 | 22 min | 2 tasks | 7 files |
| Phase 44 P01 | 5min | 2 tasks | 6 files |
| Phase 46 P01 | 6min | 2 tasks | 6 files |
| Phase 44 P02 | 4min | 2 tasks | 6 files |
| Phase 44 P03 | 12min | 2 tasks | 12 files |
| Phase 46 P02 | 13min | 2 tasks | 6 files |
| Phase 46 P03 | 5min | 2 tasks | 8 files |
| Phase 45 P01 | 1 min | 1 tasks | 6 files |
| Phase 45 P04 | 8 min | 2 tasks | 6 files |
| Phase 45 P02 | 10 min | 2 tasks | 8 files |

### Blockers/Concerns

- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking)
- Prisma version constraint: Stay on 6.19.x -- Prisma 7.x has vector migration regression (#28867)
- Research flag: @mastra/editor API surface needs validation during Phase 43 planning
- Research flag: Mastra Memory thread retrieval API needs validation during Phase 45 planning

## Session Continuity

Last session: 2026-03-08T23:19:49.894Z
Stopped at: Completed 45-02-PLAN.md
Next action: Execute 47-02-PLAN.md for Drive settings UI.
