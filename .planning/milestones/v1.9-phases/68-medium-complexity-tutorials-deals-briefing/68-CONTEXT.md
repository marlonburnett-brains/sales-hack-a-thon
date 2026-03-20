# Phase 68: Medium-Complexity Tutorials (Deals & Briefing) - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Four tutorials covering deal management and pre-call briefing workflows are captured, narrated, and rendered as MP4 videos. The tutorials are: Creating & Managing Deals (TUT-04), Deal Overview (TUT-05), Deal Chat (TUT-06), and Pre-Call Briefing (TUT-07). Infrastructure (mock server, capture engine, TTS, Remotion, visual effects) is fully built from Phases 62-66. Stage/sequence patterns from Phase 63 are available for async flows. This phase is content authoring only.

</domain>

<decisions>
## Implementation Decisions

### Tutorial scope & depth
- Creating & Managing Deals (TUT-04): Single comprehensive tutorial covering create deal, assign team, one status change (e.g., Active → Won), grid/table views, and filtering. ~12-15 steps. Not split into sub-tutorials
- Deal Overview (TUT-05): Standalone entry — navigates directly to overview sub-page. Covers metrics cards, activity timeline, collaborator management
- Deal Chat (TUT-06): Standalone entry — navigates directly to chat sub-page. Covers 2-3 chat exchanges (context-aware question, knowledge base query, note save), transcript upload, and full note-to-touch binding flow
- Pre-Call Briefing (TUT-07): Generation flow + history view. Show all three stages (idle → generating → complete), quick scroll through all output sections, then navigate to history showing 2-3 past briefings (list view only, no click-through)
- All 4 tutorials are standalone — no cross-tutorial navigation dependencies. Each opens its own deal sub-page independently

### Deal Chat interaction style
- AI responses appear instantly via stage switching — no typing animation or loading indicator between user message and AI response. Matches stage pattern from touch-4-hitl
- Transcript upload uses stage switching: click upload button → stage switch to "transcript uploaded and parsed" state. OS file picker skipped (Playwright can't control it). Narration explains what happened
- 2-3 chat exchanges per tutorial: one context-aware deal question, one knowledge base query, one note save
- Note binding shows full flow: save note from chat → select Touch 1 as target → confirm binding. Narration explains this feeds into artifact generation

### Briefing async flow
- Three-stage capture: idle (no briefing) → generating (loading/progress state visible) → complete (results rendered). Uses stage switching like Action Center tutorial
- Quick scroll through ALL output sections (company research, value hypotheses, discovery questions) with brief pause on each. Comprehensive coverage
- History view shows 2-3 past briefings with different dates in the list. Narration explains you can click any to review. No click-through into past briefing content

### Fixture & data continuity
- All 4 tutorials use the same primary deal (e.g., "Meridian Health Partnership") viewed at different contexts/sub-pages. Builds narrative continuity across the deal tutorial series
- Deals grid (TUT-04) shows 5-8 deals with variety (different statuses, companies). Reuses shared fixture companies where possible
- Deal Chat starts with 1-2 prior chat messages already visible — shows persistent conversation. New messages added during tutorial build on this history
- Briefing fixture content references the actual company from the deal (company-specific research, value hypotheses, discovery questions). Not generic — creates believable, cohesive demo
- All tutorials share the same fictional company from existing shared fixtures (users.json, companies.json, deals.json) — consistent with Phase 62/67 decisions

### Narration & pacing
- Conversational tone consistent with Phase 67. Normal pace for all 4 tutorials (no special warm intro — that was a Getting Started one-time choice)
- Light cross-references where natural ("We configured Drive settings in another tutorial")
- Standalone outro slates — "Tutorial Complete" only, no next-tutorial direction (Phase 67 decision)
- Standard timing for navigation steps, slightly longer holds on first UI reveals within each tutorial

### Visual effects usage
- Zoom ~30-40% of steps, callouts ~20-30%, cursor on all click/hover steps (Phase 67 decisions carry forward)
- No "Next: [Tutorial Name]" on outro slates (Phase 67 decision)

### Claude's Discretion
- Exact step count per tutorial (within the ranges/guidance above)
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Chat message content (questions, AI responses, notes) — should be realistic and deal-relevant
- Briefing fixture content details (specific research, hypotheses, questions about the fictional company)
- Grid deal names and statuses for the 5-8 deals shown
- Exact stage names and fixture file structure per tutorial

</decisions>

<specifics>
## Specific Ideas

- Same deal across all 4 tutorials creates a "follow one deal's journey" narrative — viewers feel they're learning by doing with a real deal
- Deal Chat should feel like a practical tool demo — "Here's how the AI helps you prepare" not just "here's the chat interface"
- Briefing generation wait (loading state) is shown deliberately — it sets realistic expectations about the async nature of AI content generation
- Transcript upload skips file picker but narration makes the action clear — no confusing jumps

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fixtures/shared/`: companies.json, deals.json, users.json — shared base data for all tutorials
- `fixtures/touch-4-hitl/stages/`: Stage fixture pattern (idle.json, generating.json, completed.json) — reuse for briefing async flow
- `fixtures/touch-4-hitl/sequences/`: Sequence fixture pattern — reuse for chat message progression
- Generic capture loop in `capture/*.spec.ts`: Iterates script.steps JSON — new tutorials follow this pattern exactly
- `src/helpers/route-mocks.ts`: mockBrowserAPIs with stageGetter closure — reuse for chat and briefing state transitions
- `scripts/mock-server.ts`: Mock agent server with stage/sequence support — handles SSR API mocking
- `scripts/tts.ts`: TTS pipeline processes any tutorial's script.json → audio files
- `scripts/render.ts`: Render pipeline composes any tutorial's screenshots + audio → MP4

### Established Patterns
- Stage ref pattern: mutable variable in capture loop shared via closure with browser mocks (Phase 63)
- Fixture loader: `loadFixtures(tutorialId)` loads shared + per-tutorial overrides
- StepSchema fields: zoomTarget, callout, cursorTarget, shortcutKey, emotion, mockStage — all optional
- mockStage on steps: sets mock server stage before step executes — enables state transitions (idle → generating → complete)

### Integration Points
- New capture specs: `capture/deals.spec.ts`, `capture/deal-overview.spec.ts`, `capture/deal-chat.spec.ts`, `capture/briefing.spec.ts`
- New fixture dirs: `fixtures/deals/`, `fixtures/deal-overview/`, `fixtures/deal-chat/`, `fixtures/briefing/`
- Web app routes: `/deals` (grid), `/deals/[dealId]/overview`, `/deals/[dealId]/chat` (via `/api/deals/[dealId]/chat`), `/deals/[dealId]/briefing`
- Stage fixtures needed: Deal Chat (message progression), Briefing (idle/generating/complete)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 68-medium-complexity-tutorials-deals-briefing*
*Context gathered: 2026-03-19*
