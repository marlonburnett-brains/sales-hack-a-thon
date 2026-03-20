# Phase 69: Medium-Complexity Tutorials (Library & Settings) - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Five tutorials covering template/slide management, deck intelligence, agent configuration, and AtlusAI integration are captured, narrated, and rendered as MP4 videos. The tutorials are: Template Library (TUT-08), Slide Library (TUT-09), Deck Structures (TUT-10), Agent Prompts (TUT-11), and AtlusAI Integration (TUT-12). Infrastructure (mock server, capture engine, TTS, Remotion, visual effects) is fully built from Phases 62-66. Stage/sequence patterns from Phase 63 are available for async flows. This phase is content authoring only.

</domain>

<decisions>
## Implementation Decisions

### Ingestion & async flows
- Template Library (TUT-08) ingestion uses 3-stage pattern: click ingest → processing/progress state visible → complete with results. Shows the async nature and sets realistic expectations
- AtlusAI Integration (TUT-12) ingestion uses the same 3-stage pattern for consistency (start → progress → done)
- Template Library briefly shows ingestion results after completion (AI-generated descriptions, element maps, classifications) — demonstrates the value of ingestion before ending
- AtlusAI connection uses stage switching: disconnected → connected (same pattern as Google Drive Settings tutorial). Narration explains the OAuth redirect that would happen

### Deck Structures chat refinement
- 1-2 chat exchanges for structure refinement (e.g., reorder sections). Focused demo without dragging
- Brief loading state between user message and updated structure — signals AI processing for structural changes. NOT instant stage switch like Deal Chat
- Show structures for multiple touch types: list all touch type structures, click into one for detail + refinement
- Brief narration explanation of confidence scores (one sentence, e.g., "Confidence scores show how well each section maps to real templates in your library")

### Agent Prompts editing
- Full lifecycle demonstrated: view current → create draft → edit → publish → show version history → rollback to previous version. ~10-12 steps
- Show actual prompt text with a meaningful change (e.g., adjusting tone from formal to conversational). Viewers understand what prompts look like and what they can change
- List overview + one deep: start with agents list showing all available agents, then drill into one for the full edit/publish/rollback lifecycle
- Fixture prompt content should be realistic and recognizable as system prompt instructions

### Narrative & fixture strategy
- All 5 tutorials are standalone — no cross-tutorial navigation dependencies. Each opens its own page independently. Viewers can watch in any order
- Light cross-references in narration where natural (e.g., "Templates you register here will appear in the Slide Library"). Consistent with Phase 67/68 pattern
- Shared content library base: common set of 3-5 templates already ingested in shared fixtures. Each tutorial adds its own overrides. Template Library shows registering a NEW template on top of existing ones. Realistic — you wouldn't start from empty
- All tutorials share the same fictional company from existing shared fixtures (users.json, companies.json, deals.json) — consistent with Phase 62/67/68 decisions

### Narration & pacing
- Conversational tone consistent with Phase 67/68. Normal pace for all 5 tutorials
- Light cross-references where natural — builds series cohesion without overloading
- Standalone outro slates — "Tutorial Complete" only, no next-tutorial direction (Phase 67 decision)
- Standard timing for navigation steps, slightly longer holds on first UI reveals within each tutorial

### Visual effects usage
- Zoom ~30-40% of steps, callouts ~20-30%, cursor on all click/hover steps (Phase 67/68 decisions carry forward)
- No "Next: [Tutorial Name]" on outro slates (Phase 67 decision)

### Claude's Discretion
- Exact step count per tutorial
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Slide Library search approach (text search only vs. text + semantic search, based on what the UI supports)
- Fixture content details for templates, slides, deck structures, and prompts
- Exact stage names and fixture file structure per tutorial
- Which agent to feature in Agent Prompts tutorial
- Specific prompt text and the meaningful edit to demonstrate

</decisions>

<specifics>
## Specific Ideas

- Template Library ingestion results should briefly showcase the AI intelligence — descriptions, classifications, element maps — so viewers understand why they'd use the feature
- Agent Prompts edit should be a meaningful tone/instruction change, not a trivial typo fix — demonstrates WHY prompt management matters
- AtlusAI connection mirrors the Google Drive Settings pattern — viewers who watched that tutorial will recognize the flow
- Shared content library fixtures create a realistic "lived-in" feel — the UI has existing templates and slides, not an empty state

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fixtures/shared/`: companies.json, deals.json, users.json — shared base data for all tutorials
- `fixtures/touch-4-hitl/stages/`: Stage fixture pattern (idle.json, generating.json, completed.json) — reuse for ingestion async flows
- Generic capture loop in `capture/*.spec.ts`: Iterates script.steps JSON — new tutorials follow this pattern exactly
- `src/helpers/route-mocks.ts`: mockBrowserAPIs with stageGetter closure — reuse for ingestion and connection state transitions
- `scripts/mock-server.ts`: Mock agent server with stage/sequence support — handles SSR API mocking
- `scripts/tts.ts`: TTS pipeline processes any tutorial's script.json → audio files
- `scripts/render.ts`: Render pipeline composes any tutorial's screenshots + audio → MP4

### Established Patterns
- Stage ref pattern: mutable variable in capture loop shared via closure with browser mocks (Phase 63)
- Fixture loader: `loadFixtures(tutorialId)` loads shared + per-tutorial overrides
- StepSchema fields: zoomTarget, callout, cursorTarget, shortcutKey, emotion, mockStage — all optional
- mockStage on steps: sets mock server stage before step executes — enables state transitions

### Integration Points
- New capture specs: `capture/template-library.spec.ts`, `capture/slide-library.spec.ts`, `capture/deck-structures.spec.ts`, `capture/agent-prompts.spec.ts`, `capture/atlus-integration.spec.ts`
- New fixture dirs: `fixtures/template-library/`, `fixtures/slide-library/`, `fixtures/deck-structures/`, `fixtures/agent-prompts/`, `fixtures/atlus-integration/`
- Shared content fixtures: extend `fixtures/shared/` with templates.json, slides.json for common content library base
- Web app routes: `/templates` (library), `/slides` (library), `/settings/deck-structures`, `/settings/agents`, `/settings/integrations` (AtlusAI)
- Auth routes: `/auth/atlus/connect` and `/auth/atlus/callback` (AtlusAI OAuth flow — mocked via stage switch)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 69-medium-complexity-tutorials-library-settings*
*Context gathered: 2026-03-19*
