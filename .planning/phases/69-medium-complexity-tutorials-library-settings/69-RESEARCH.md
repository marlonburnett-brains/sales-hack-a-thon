# Phase 69: Medium-Complexity Tutorials (Library & Settings) - Research

**Researched:** 2026-03-19
**Domain:** Tutorial content authoring (scripts, fixtures, capture specs) on existing infrastructure
**Confidence:** HIGH

## Summary

Phase 69 is a pure content-authoring phase building five tutorials covering template management, slide browsing, deck structure intelligence, agent prompt editing, and AtlusAI integration. All infrastructure is built (Phases 62-66) and the content-authoring patterns are proven (Phase 67 low-complexity, Phase 68 medium-complexity). The five tutorials are: Template Library (TUT-08), Slide Library (TUT-09), Deck Structures (TUT-10), Agent Prompts (TUT-11), and AtlusAI Integration (TUT-12).

The primary technical challenges are: (1) Template Library and AtlusAI Integration both involve 3-stage async ingestion flows (click ingest, progress, complete), which need stage-aware mock server routes for template progress and discovery ingestion progress endpoints. (2) Deck Structures tutorial requires stage-based chat refinement with a brief loading state, which is different from the instant stage-switching used in Deal Chat -- the deck-structures chat endpoint `**/api/deck-structures/chat*` is already mocked in route-mocks.ts but returns a static plaintext response. (3) Agent Prompts requires a complex lifecycle (view, create draft, edit, publish, version history, rollback) across ~10-12 steps with stage-based mock server responses for the `/agent-configs/:agentId` endpoint to show different states. (4) The mock server's templates, slides, deck-structures, agent-configs, and discovery routes currently return hardcoded/empty data -- they all need stage-awareness or richer fixture data.

The secondary consideration is shared content library fixtures. The CONTEXT specifies a common set of 3-5 ingested templates across all tutorials, with each tutorial adding overrides. This requires extending `fixtures/shared/` with `templates.json` and `slides.json` files that all 5 tutorials inherit.

**Primary recommendation:** Split into two plans: Plan 01 handles script/fixture/capture authoring for all five tutorials (TUT-08 through TUT-12), Plan 02 handles TTS audio generation and MP4 rendering for all five tutorials.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Template Library (TUT-08) ingestion uses 3-stage pattern: click ingest, processing/progress state visible, complete with results. Shows the async nature and sets realistic expectations
- Template Library briefly shows ingestion results after completion (AI-generated descriptions, element maps, classifications) -- demonstrates the value of ingestion before ending
- AtlusAI Integration (TUT-12) ingestion uses the same 3-stage pattern for consistency (start, progress, done)
- AtlusAI connection uses stage switching: disconnected, connected (same pattern as Google Drive Settings tutorial). Narration explains the OAuth redirect that would happen
- Deck Structures chat refinement: 1-2 chat exchanges for structure refinement (e.g., reorder sections). Focused demo without dragging
- Deck Structures: Brief loading state between user message and updated structure -- signals AI processing for structural changes. NOT instant stage switch like Deal Chat
- Deck Structures: Show structures for multiple touch types: list all touch type structures, click into one for detail + refinement
- Deck Structures: Brief narration explanation of confidence scores (one sentence)
- Agent Prompts: Full lifecycle demonstrated: view current, create draft, edit, publish, show version history, rollback to previous version. ~10-12 steps
- Agent Prompts: Show actual prompt text with a meaningful change (e.g., adjusting tone from formal to conversational)
- Agent Prompts: List overview + one deep: start with agents list showing all available agents, then drill into one for the full edit/publish/rollback lifecycle
- Agent Prompts: Fixture prompt content should be realistic and recognizable as system prompt instructions
- All 5 tutorials are standalone -- no cross-tutorial navigation dependencies. Each opens its own page independently
- Light cross-references in narration where natural (e.g., "Templates you register here will appear in the Slide Library")
- Shared content library base: common set of 3-5 templates already ingested in shared fixtures. Each tutorial adds its own overrides. Template Library shows registering a NEW template on top of existing ones
- All tutorials share the same fictional company from existing shared fixtures (users.json, companies.json, deals.json)
- Conversational tone consistent with Phase 67/68. Normal pace for all 5 tutorials
- Standalone outro slates -- "Tutorial Complete" only, no next-tutorial direction
- Zoom ~30-40% of steps, callouts ~20-30%, cursor on all click/hover steps

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TUT-08 | "Template Library" tutorial -- register templates from Drive, classify by touch type, trigger ingestion, monitor progress | Web route `/templates` (SSR page via `listTemplatesAction`). Mock server has `/templates` GET/POST, `/templates/:id/ingest` POST, `/templates/:id/progress` GET. Progress endpoint supports sequence getter for ingestion polling. Templates page client has grid/table views, filters, TemplateForm, TemplateCard. Needs 3-5 pre-ingested templates in shared fixtures + stage fixtures for ingestion flow |
| TUT-09 | "Slide Library" tutorial -- browse slides, view details/metadata, search by content, update classifications | Web route `/slides` (SSR page via `listTemplatesAction` + `listSlidesAction` + `getSlideThumbnailsAction`). Client has filter/pagination/similarity search. Mock server has `/templates/:templateId/slides` GET, `/slides/:slideId/similar` POST. Needs slides fixture data with realistic classification metadata |
| TUT-10 | "Deck Structures" tutorial -- view inferred structures, confidence scores, section flow, chat-based refinement | Web route `/settings/deck-structures` (redirects to `/settings/deck-structures/touch-1`). Detail page uses `TouchTypeDetailView` with `getDeckStructureAction`, `ChatBar`, `SectionFlow`, `ConfidenceBadge`. Mock server has `/deck-structures` GET (list) and `/deck-structures/:touchType` GET (detail). Browser-side `**/api/deck-structures/chat*` mocked in route-mocks.ts. Needs stage fixtures for chat refinement showing updated structure |
| TUT-11 | "Agent Prompts" tutorial -- view/edit prompts, publish drafts, rollback versions, baseline prompt management | Web route `/settings/agents` (SSR list via `getAgentConfigsAction`) and `/settings/agents/[agentId]` (detail via `getAgentConfigAction` + `getAgentConfigVersionsAction`). Detail uses `AgentDetail` with `AgentPromptEditor`, `AgentVersionTimeline`, `PublishDialog`, `RollbackDialog`. Mock server has `/agent-configs` GET, `/agent-configs/:agentId` GET, `/agent-configs/:agentId/versions` GET, draft/publish/discard/rollback POST. Needs stage fixtures for lifecycle progression |
| TUT-12 | "AtlusAI Integration" tutorial -- connect account, browse/search discovery content, ingest assets | Web route `/settings/integrations` (static `IntegrationsStatus` component) + `/discovery` (SSR via `checkAtlusAccessAction` + `browseDocumentsAction`). Discovery client has browse/search/ingest UI. Mock server has `/discovery/access-check`, `/discovery/browse`, `/discovery/search`, `/discovery/ingest`, `/discovery/ingest/:batchId/progress`. Needs stage fixtures for disconnected/connected states and discovery content |

</phase_requirements>

## Standard Stack

### Core (all existing -- no new dependencies)
| Library | Version | Purpose | Already Installed |
|---------|---------|---------|-------------------|
| Playwright | (existing) | Capture screenshots per tutorial step | Yes |
| Remotion | 4.0.x | Compose screenshots + audio into MP4 | Yes |
| kokoro-js / Chatterbox | (existing) | TTS narration generation | Yes |
| Express | (existing) | Mock agent server for SSR API calls | Yes |
| Zod | (existing) | Script + fixture validation | Yes |

### No new installations needed
This phase is purely content authoring using existing infrastructure.

## Architecture Patterns

### Recommended File Structure (per new tutorial)
```
apps/tutorials/
  fixtures/
    shared/
      templates.json         # NEW: 3-5 pre-ingested templates (shared across all 5 tutorials)
      slides.json            # NEW: slides from ingested templates (shared)
    template-library/
      script.json            # 10-14 step tutorial script
      overrides.json         # Additional template for "new registration" demo
      stages/
        ingesting.json       # Stage: ingestion in progress (progress bar visible)
        ingested.json        # Stage: ingestion complete with results
    slide-library/
      script.json            # 8-12 step tutorial script
      overrides.json         # Additional slides/classification overrides
    deck-structures/
      script.json            # 10-14 step tutorial script
      overrides.json         # Deck structure list with realistic data
      stages/
        list.json            # Stage: all touch type structures listed
        detail.json          # Stage: single touch type detail view
        chat-loading.json    # Stage: brief loading after chat message
        chat-refined.json    # Stage: structure updated after refinement
    agent-prompts/
      script.json            # 10-12 step tutorial script
      overrides.json         # Agent list with realistic config data
      stages/
        list.json            # Stage: agents list view
        view-published.json  # Stage: agent detail with published version
        draft-created.json   # Stage: agent detail with draft in progress
        draft-edited.json    # Stage: draft with meaningful edit
        published.json       # Stage: newly published version
        version-history.json # Stage: version timeline with 3-4 versions
        rolled-back.json     # Stage: after rollback to previous version
    atlus-integration/
      script.json            # 10-14 step tutorial script
      overrides.json         # Base overrides for integration state
      stages/
        disconnected.json    # Stage: AtlusAI not connected (no_tokens)
        connected.json       # Stage: AtlusAI connected, browse available
        browse.json          # Stage: discovery browse with documents
        search-results.json  # Stage: discovery search results
        ingesting.json       # Stage: discovery ingestion in progress
        ingested.json        # Stage: discovery ingestion complete
  capture/
    template-library.spec.ts
    slide-library.spec.ts
    deck-structures.spec.ts
    agent-prompts.spec.ts
    atlus-integration.spec.ts
```

### Pattern 1: Script JSON Authoring (reuse from Phase 67/68)
**What:** Each tutorial is defined by a `script.json` following TutorialScriptSchema
**When to use:** Every tutorial follows this pattern
**Key fields per step:**
```json
{
  "id": "step-001",
  "url": "/templates",
  "narration": "Conversational text...",
  "waitFor": "main",
  "actions": [{ "type": "click", "selector": "button:has-text('Add Template')" }],
  "zoomTarget": { "selector": "main", "scale": 1.5, "x": 0.5, "y": 0.4 },
  "callout": { "text": "Label text", "x": 0.5, "y": 0.3 },
  "cursorTarget": { "x": 0.5, "y": 0.5 },
  "mockStage": "ingesting",
  "emotion": "professional",
  "delayMs": 1000
}
```

### Pattern 2: Generic Capture Loop (reuse existing)
**What:** Capture specs follow the exact pattern from `action-center.spec.ts` / Phase 68 specs
**Structure:** Load script, beforeEach sets auth + browser mocks, test iterates steps, navigate/wait/act/capture
**Key:** The loop is fully generic. New tutorials only change TUTORIAL_ID and script.json.

### Pattern 3: 3-Stage Ingestion Flow (Template Library + AtlusAI)
**What:** Use `mockStage` on steps to advance ingestion state through start/progress/complete
**Template Library flow:**
1. Step shows existing templates (3-5 pre-ingested) -- base fixtures
2. Step clicks "Add Template" button -- form dialog
3. Step fills Google Slides URL and touch type -- form fields
4. Step submits -- mock POST returns new template
5. Step sets `mockStage: "ingesting"` -- navigate/reload shows progress bar on new template
6. Step sets `mockStage: "ingested"` -- navigate/reload shows completed ingestion with results

**AtlusAI ingestion flow:**
1. Step selects document from browse results
2. Step clicks ingest -- mock POST returns batchId
3. Step sets `mockStage: "ingesting"` -- shows progress
4. Step sets `mockStage: "ingested"` -- shows completion

**Key insight:** Template ingestion progress uses the `/templates/:id/progress` endpoint which already supports `getNextSequenceResponse("ingestion-progress")`. HOWEVER, stage-based approach is simpler and more consistent with Phase 67/68 patterns. Use stage switching for the template card's visual state rather than actual polling.

### Pattern 4: Stage-Based Agent Config Lifecycle
**What:** Use `mockStage` to show different agent config states at each lifecycle step
**How it works:**
1. `mockStage: "list"` -- `/agent-configs` returns array of 6-8 agents grouped by family
2. Navigate to `/settings/agents/{agentId}` with `mockStage: "view-published"` -- returns config with published version, no draft
3. `mockStage: "draft-created"` -- config returns with draft field populated (same rolePrompt as published)
4. `mockStage: "draft-edited"` -- draft has meaningfully different rolePrompt
5. `mockStage: "published"` -- publishedVersion updated, draft null
6. `mockStage: "version-history"` -- versions endpoint returns 3-4 versions
7. `mockStage: "rolled-back"` -- publishedVersion shows older version restored

**Critical:** The mock server's `/agent-configs` and `/agent-configs/:agentId` routes need stage-awareness. Currently they return hardcoded empty/minimal data.

### Pattern 5: Deck Structures Chat with Loading State
**What:** Unlike Deal Chat's instant stage switching, deck structures chat shows a brief loading state
**How it works:**
1. User sends chat message (narrate the intent, e.g., "Move the Executive Summary before the Intro")
2. `mockStage: "chat-loading"` -- page shows a loading/spinner state on the chat response area
3. Short delay (`delayMs: 1500`) on the loading step
4. `mockStage: "chat-refined"` -- structure updated with sections reordered, chat shows assistant response with diff
**Key insight:** The `TouchTypeDetailView` component uses `getDeckStructureAction` via Server Action. The mock server `GET /deck-structures/:touchType` route must be stage-aware to return different structures per stage. The browser-side `**/api/deck-structures/chat*` POST mock in route-mocks.ts returns plaintext -- the actual structure update comes from re-fetching via Server Action after chat completes.

### Pattern 6: AtlusAI Connection via Stage Switching
**What:** Mirror the Google Drive Settings disconnected/connected pattern from Phase 67
**How it works:**
1. `mockStage: "disconnected"` -- `/discovery/access-check` returns `{ hasAccess: false, reason: "no_tokens" }`. Discovery page shows "AtlusAI Not Available" with "Connect AtlusAI" button.
2. Navigate to settings/integrations page to show integration status
3. Narrate the OAuth flow that would happen
4. `mockStage: "connected"` -- `/discovery/access-check` returns `{ hasAccess: true }`. Navigate to `/discovery` to show browse results.
**Key insight:** The discovery page's SSR checks `checkAtlusAccessAction` first. If no access, it renders a no-access page with connect button. The mock server `/discovery/access-check` route needs stage-awareness.

### Anti-Patterns to Avoid
- **Hardcoding fixture data in capture specs:** All data belongs in fixture JSON files. Capture specs should only reference TUTORIAL_ID.
- **Using sequences for ingestion progress:** While the mock server supports ingestion progress sequences, stage switching is simpler and more consistent with the established tutorial pattern. Use stages, not sequences.
- **Forgetting shared templates.json/slides.json:** The CONTEXT requires 3-5 pre-ingested templates visible across tutorials. These MUST be in shared fixtures, not duplicated per tutorial.
- **Not making mock routes stage-aware:** The following mock server routes currently return hardcoded/empty data and NEED stage-awareness for these tutorials: `/agent-configs`, `/agent-configs/:agentId`, `/agent-configs/:agentId/versions`, `/deck-structures`, `/deck-structures/:touchType`, `/discovery/access-check`, `/discovery/browse`, `/discovery/search`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capture automation | Custom screenshot logic | Existing generic capture loop pattern | Already handles navigation, waiting, actions, stage switching |
| TTS generation | New TTS code | `pnpm --filter tutorials tts <tutorial-name>` | Pipeline handles audio gen + timing manifests |
| Video rendering | New composition code | `pnpm --filter tutorials render <tutorial-name>` | Remotion compositions handle all visual effects |
| Fixture loading | Manual JSON reading | `loadFixtures(tutorialId)` from `fixtures/loader.ts` | Handles shared + override merging with validation |
| Stage switching | Custom mock logic | `mockStage` field on steps + `/mock/set-stage` endpoint | Already built in Phase 63 |
| Ingestion progress | Custom polling mocks | Stage fixtures showing progress/complete states | Stage switching is proven; polling mocks add unnecessary complexity |
| Agent lifecycle states | Custom state machine | Stage fixtures per lifecycle step | Each stage file is a complete snapshot of the mock server response |

## Common Pitfalls

### Pitfall 1: Mock Server Routes Not Stage-Aware for New Domains
**What goes wrong:** The `/agent-configs`, `/deck-structures`, and `/discovery/access-check` routes return hardcoded data regardless of current stage. Tutorials that rely on state transitions won't show different UI states.
**Why it happens:** These routes were built as minimal stubs in Phase 62. No tutorial has needed dynamic state for these domains until now.
**How to avoid:** Make these routes stage-aware by checking `loadStageFixtures(tutorialName, currentStage)` for domain-specific fields (e.g., `agentConfigs`, `agentConfigDetail`, `agentConfigVersions`, `deckStructures`, `deckStructureDetail`, `discoveryAccess`, `discoveryBrowse`, `discoverySearch`).
**Warning signs:** Agent list always shows empty array. Deck structures always show "No data". Discovery always shows "AtlusAI Not Available".

### Pitfall 2: Slide Library SSR Joins Templates + Slides
**What goes wrong:** The `/slides` page SSR calls `listTemplatesAction()` first, filters to templates with `slideCount > 0`, then calls `listSlidesAction(t.id)` for each. If shared templates have `slideCount: 0`, the page shows "No ingested slides yet."
**Why it happens:** The slide library page is not a simple list -- it's a join operation across templates and slides.
**How to avoid:** Shared template fixtures MUST have `slideCount > 0` for at least 2-3 templates. The mock server's `/templates/:templateId/slides` route returns `fixtures.slides` (all slides regardless of template) -- this is fine for tutorials as long as there are slides in the fixtures.
**Warning signs:** Slide Library page shows empty state with "No ingested slides yet."

### Pitfall 3: Templates Page Client Uses localStorage for View Mode
**What goes wrong:** The `TemplatesPageClient` reads `template-view-mode` from localStorage in a useEffect. If localStorage is empty (default), it defaults to "grid" view.
**Why it happens:** Client-side state management.
**How to avoid:** This is fine for tutorials -- grid view is the default and appropriate for demonstration. No action needed unless the tutorial needs to show table view (in which case, use URL query params or an explicit click action to toggle).

### Pitfall 4: Deck Structures Page Redirects to touch-1
**What goes wrong:** `/settings/deck-structures` immediately redirects to `/settings/deck-structures/touch-1`. The tutorial needs to show the list of ALL touch type structures first.
**Why it happens:** The page.tsx is a redirect, not a list page. The list is actually a sidebar/navigation component within the settings layout.
**How to avoid:** The tutorial's first deck-structures step should navigate directly to `/settings/deck-structures` and let the redirect happen. The settings layout includes a sidebar with deck-structure links. OR navigate to `/settings/deck-structures/touch-1` directly and narrate the sidebar links. The CONTEXT says "list all touch type structures, click into one for detail" -- the settings sidebar serves as the list.
**Warning signs:** Tutorial shows only one touch type's details without context of the list.

### Pitfall 5: Agent Detail Page Calls Two Server Actions in Parallel
**What goes wrong:** `/settings/agents/[agentId]/page.tsx` calls `getAgentConfigAction(agentId)` and `getAgentConfigVersionsAction(agentId)` via `Promise.all`. Both need to return stage-appropriate data simultaneously.
**Why it happens:** The page fetches config detail and version history in one SSR pass.
**How to avoid:** Stage fixtures must include BOTH `agentConfigDetail` and `agentConfigVersions` fields in each stage file. The mock server's `/agent-configs/:agentId` and `/agent-configs/:agentId/versions` routes must both check stage fixtures.
**Warning signs:** Agent detail shows published version but empty version history, or vice versa.

### Pitfall 6: Discovery Page Access Check Determines Render Path
**What goes wrong:** The discovery page SSR calls `checkAtlusAccessAction()` first. If `hasAccess: false`, it renders the no-access page and NEVER calls `browseDocumentsAction`. The mock server must return the correct access check result BEFORE navigation.
**Why it happens:** SSR conditional rendering based on access check result.
**How to avoid:** Set `mockStage` BEFORE navigating to `/discovery`. The mock server's `/discovery/access-check` stage fixture must match the expected state. For the "disconnected" stage, return `{ hasAccess: false, reason: "no_tokens" }`. For "connected" and subsequent stages, return `{ hasAccess: true }`.
**Warning signs:** Discovery page always shows "AtlusAI Not Available" even in connected stage.

### Pitfall 7: Settings Layout Has Navigation Sidebar
**What goes wrong:** The settings pages share a layout with a sidebar navigation showing Drive, Agents, Deck Structures, Integrations links. Screenshots capture the full layout including sidebar.
**Why it happens:** Shared layout component.
**How to avoid:** This is actually beneficial -- the sidebar provides visual context for which settings area is active. No workaround needed. Tutorials navigating within settings will naturally show the sidebar highlighting the active section.

## Code Examples

### Example 1: Stage-Aware Agent Configs Route (mock-server.ts modification)
```typescript
// Replace the existing GET /agent-configs handler:
app.get("/agent-configs", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const stageAgents = (stageFixtures as Record<string, unknown>)?.agentConfigs;
  if (Array.isArray(stageAgents)) {
    res.json(stageAgents);
  } else {
    res.json([]);
  }
});

// Replace the existing GET /agent-configs/:agentId handler:
app.get("/agent-configs/:agentId", (req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const detail = (stageFixtures as Record<string, unknown>)?.agentConfigDetail;
  if (detail) {
    res.json(detail);
  } else {
    res.json({
      agentId: req.params.agentId,
      name: "Mock Agent",
      responsibility: "Mock responsibility",
      family: "mock",
      isShared: false,
      publishedVersion: null,
      draft: null,
    });
  }
});

// Replace the existing GET /agent-configs/:agentId/versions handler:
app.get("/agent-configs/:agentId/versions", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const versions = (stageFixtures as Record<string, unknown>)?.agentConfigVersions;
  if (Array.isArray(versions)) {
    res.json(versions);
  } else {
    res.json([]);
  }
});
```

### Example 2: Stage-Aware Deck Structures Routes (mock-server.ts modification)
```typescript
// Replace the existing GET /deck-structures handler:
app.get("/deck-structures", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const structures = (stageFixtures as Record<string, unknown>)?.deckStructures;
  if (Array.isArray(structures)) {
    res.json(structures);
  } else {
    res.json([]);
  }
});

// Replace the existing GET /deck-structures/:touchType handler:
app.get("/deck-structures/:touchType", (req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const detail = (stageFixtures as Record<string, unknown>)?.deckStructureDetail;
  if (detail) {
    res.json(detail);
  } else {
    res.json({
      touchType: req.params.touchType,
      structure: { sections: [], sequenceRationale: "Mock rationale" },
      exampleCount: 0,
      confidence: 0,
      confidenceColor: "red",
      confidenceLabel: "No data",
      chatMessages: [],
      chatContext: null,
      slideIdToThumbnail: {},
      inferredAt: null,
      lastChatAt: null,
    });
  }
});
```

### Example 3: Stage-Aware Discovery Access Check (mock-server.ts modification)
```typescript
// Replace the existing GET /discovery/access-check handler:
app.get("/discovery/access-check", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const access = (stageFixtures as Record<string, unknown>)?.discoveryAccess;
  if (access) {
    res.json(access);
  } else {
    res.json({ hasAccess: true });
  }
});

// Replace the existing GET /discovery/browse handler:
app.get("/discovery/browse", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const browse = (stageFixtures as Record<string, unknown>)?.discoveryBrowse;
  if (browse) {
    res.json(browse);
  } else {
    res.json({ documents: [], ingestedHashes: [] });
  }
});

// Replace the existing POST /discovery/search handler:
app.post("/discovery/search", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const search = (stageFixtures as Record<string, unknown>)?.discoverySearch;
  if (search) {
    res.json(search);
  } else {
    res.json({ results: [], ingestedHashes: [] });
  }
});
```

### Example 4: Stage-Aware Templates Route (mock-server.ts modification)
```typescript
// Replace the existing GET /templates handler:
app.get("/templates", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const stageTemplates = (stageFixtures as Record<string, unknown>)?.templates;
  if (Array.isArray(stageTemplates)) {
    res.json(stageTemplates);
  } else {
    res.json(fixtures.templates ?? []);
  }
});
```

### Example 5: Agent Config Stage Fixture (view-published stage)
```json
{
  "agentConfigDetail": {
    "agentId": "agent-precall-001",
    "name": "Pre-Call Research Agent",
    "responsibility": "Generates company research, value hypotheses, and discovery questions for pre-call briefings",
    "family": "pre-call",
    "isShared": false,
    "publishedVersion": {
      "id": "ver-001",
      "version": 1,
      "baselinePrompt": "You are an AI sales research assistant for Lumenalta...",
      "rolePrompt": "Your role is to research companies and generate pre-call briefings. Use formal, analytical language. Structure your output with clear sections: Company Research, Value Hypotheses, and Discovery Questions. Always cite specific data points from available sources.",
      "compiledPrompt": null,
      "changeSummary": "Initial published version",
      "publishedAt": "2026-03-01T10:00:00.000Z",
      "publishedBy": "user-tutorial-001"
    },
    "draft": null
  },
  "agentConfigVersions": [
    {
      "id": "ver-001",
      "version": 1,
      "rolePrompt": "Your role is to research companies and generate pre-call briefings...",
      "changeSummary": "Initial published version",
      "isPublished": true,
      "publishedAt": "2026-03-01T10:00:00.000Z",
      "publishedBy": "user-tutorial-001",
      "createdAt": "2026-03-01T10:00:00.000Z"
    }
  ]
}
```

### Example 6: Deck Structure Detail Stage Fixture (detail stage)
```json
{
  "deckStructureDetail": {
    "touchType": "touch_1",
    "structure": {
      "sections": [
        {
          "order": 1,
          "name": "Introduction",
          "purpose": "Company overview and meeting context",
          "isOptional": false,
          "variationCount": 3,
          "slideIds": ["slide-001", "slide-002"]
        },
        {
          "order": 2,
          "name": "Executive Summary",
          "purpose": "Key value proposition and engagement rationale",
          "isOptional": false,
          "variationCount": 2,
          "slideIds": ["slide-003"]
        },
        {
          "order": 3,
          "name": "Capabilities Overview",
          "purpose": "Relevant service areas and expertise",
          "isOptional": false,
          "variationCount": 4,
          "slideIds": ["slide-004", "slide-005", "slide-006"]
        },
        {
          "order": 4,
          "name": "Case Studies",
          "purpose": "Relevant past engagements demonstrating expertise",
          "isOptional": true,
          "variationCount": 5,
          "slideIds": ["slide-007", "slide-008"]
        },
        {
          "order": 5,
          "name": "Next Steps",
          "purpose": "Proposed timeline and engagement model",
          "isOptional": false,
          "variationCount": 2,
          "slideIds": ["slide-009"]
        }
      ],
      "sequenceRationale": "The Introduction establishes context, followed by the Executive Summary to frame the value proposition. Capabilities Overview demonstrates relevant expertise, supported by optional Case Studies for proof points. Next Steps closes with a clear call to action."
    },
    "exampleCount": 8,
    "confidence": 0.82,
    "confidenceColor": "green",
    "confidenceLabel": "High",
    "chatMessages": [],
    "chatContext": null,
    "slideIdToThumbnail": {},
    "inferredAt": "2026-03-10T14:00:00.000Z",
    "lastChatAt": null
  }
}
```

### Example 7: Discovery Browse Stage Fixture (browse stage)
```json
{
  "discoveryAccess": { "hasAccess": true },
  "discoveryBrowse": {
    "documents": [
      {
        "slideId": "disc-001",
        "documentTitle": "Q4 2025 Cloud Migration Trends Report",
        "textContent": "Enterprise cloud migration continues to accelerate with 73% of organizations...",
        "speakerNotes": "",
        "metadata": { "author": "AtlusAI Research", "publishedDate": "2025-12-15" },
        "source": "mcp",
        "mimeType": "application/vnd.google-apps.presentation",
        "isGoogleSlides": true,
        "googleSlidesUrl": "https://docs.google.com/presentation/d/mock-disc-001",
        "thumbnailUrl": null
      },
      {
        "slideId": "disc-002",
        "documentTitle": "Digital Transformation ROI Framework",
        "textContent": "Measuring ROI for digital transformation initiatives requires...",
        "speakerNotes": "",
        "metadata": { "author": "AtlusAI Research", "publishedDate": "2026-01-20" },
        "source": "mcp",
        "mimeType": "application/vnd.google-apps.presentation",
        "isGoogleSlides": true,
        "googleSlidesUrl": "https://docs.google.com/presentation/d/mock-disc-002",
        "thumbnailUrl": null
      }
    ],
    "ingestedHashes": []
  }
}
```

## Mock Server Gaps Summary

These routes need modification for Phase 69 tutorials:

| Route | Current State | Needed State |
|-------|--------------|--------------|
| `GET /templates` | Returns `fixtures.templates ?? []` | Stage-aware: returns templates from stage fixtures when present, else falls back to base fixtures |
| `GET /deck-structures` | Returns `[]` | Stage-aware: returns deck structure summaries from stage fixtures |
| `GET /deck-structures/:touchType` | Returns hardcoded minimal data | Stage-aware: returns full detail from stage fixtures including sections, confidence, chatMessages |
| `GET /agent-configs` | Returns `[]` | Stage-aware: returns agent list from stage fixtures |
| `GET /agent-configs/:agentId` | Returns minimal mock | Stage-aware: returns full detail with publishedVersion and draft from stage fixtures |
| `GET /agent-configs/:agentId/versions` | Returns `[]` | Stage-aware: returns version history from stage fixtures |
| `GET /discovery/access-check` | Returns `{ hasAccess: true }` | Stage-aware: returns access check from stage fixtures (disconnected vs connected) |
| `GET /discovery/browse` | Returns `{ documents: [], ingestedHashes: [] }` | Stage-aware: returns browse results from stage fixtures |
| `POST /discovery/search` | Returns `{ results: [], ingestedHashes: [] }` | Stage-aware: returns search results from stage fixtures |

**Key insight:** This phase requires more mock server route modifications than Phase 68 because it touches 5 entirely new API domains (templates, slides, deck-structures, agent-configs, discovery). The pattern is identical for all: check `loadStageFixtures(tutorialName, currentStage)` for a domain-specific field, return it if present, else fall back to current behavior.

## Shared Content Library Fixtures

The CONTEXT mandates a shared content library base with 3-5 templates already ingested. This requires new shared fixture files:

### `fixtures/shared/templates.json`
3-5 templates with realistic data:
- Template 1: "Lumenalta Introduction Deck" (touch_1, ingested, 12 slides)
- Template 2: "Cloud Transformation Proposal" (touch_3, ingested, 18 slides)
- Template 3: "Customer Success Case Studies" (touch_1, touch_2, ingested, 8 slides)
- Template 4: "Technical Architecture Overview" (touch_4, ingested, 15 slides)
- Template 5: "Q2 Pipeline Review" (internal, not ingested, 0 slides)

All ingested templates should have `ingestionStatus: "completed"`, `slideCount > 0`, `lastIngestedAt` set, and realistic `contentClassification`.

### `fixtures/shared/slides.json`
15-20 slides across the ingested templates with:
- Realistic `contentText` (title + body text matching slide purpose)
- `classificationJson` with industry, solutionPillar, persona, funnelStage, contentType fields
- Mix of `reviewStatus`: "approved", "unreviewed", "needs_correction"
- `slideObjectId` values for thumbnail mapping (will be null in mock, but field must exist)

These shared fixtures ensure all 5 tutorials start with a "lived-in" content library.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded capture scripts | Generic capture loop driven by JSON | Phase 62 | New tutorials only need script.json |
| Manual fixture setup | loadFixtures with shared + overrides | Phase 62 | Consistent data across tutorials |
| Static mock responses | Stage-aware mock server | Phase 63 | Enables before/after state transitions |
| Fixed mockStage enum | Free-form z.string() mockStage | Phase 67 | Any custom stage name works |
| No visual effects | Zoom, callout, cursor, transitions | Phase 66 | Scripts now include effect metadata |
| Phase 67 (3 tutorials) | Phase 68 (4 tutorials) | Current | Same patterns, more complex content |
| Chat proxy pattern | Browser-side chat GET proxied to mock server | Phase 68 | Pattern ready for deck-structures chat |

## Open Questions

1. **Deck Structure Chat POST Response Format**
   - What we know: The browser-side `**/api/deck-structures/chat*` mock in route-mocks.ts returns plaintext. The actual `TouchTypeDetailView` component calls `getDeckStructureAction` after chat to get updated structure.
   - What's unclear: Whether the chat POST response needs to return specific data (like updated structure diff) or if the component ignores the POST response and just re-fetches the structure.
   - Recommendation: Keep the browser-side chat POST mock as-is (plaintext response). Use stage switching to update what `getDeckStructureAction` returns. The component likely uses the chat POST response for display in the chat panel, then re-fetches the structure. For the tutorial, narrate the message, switch stage, reload to show updated structure.

2. **Settings Layout Navigation Structure**
   - What we know: Settings pages share a layout. The sidebar shows Drive, Agents, Deck Structures, Integrations links.
   - What's unclear: Whether the deck-structures sidebar shows individual touch type links or if touch types are tabs/accordion on the detail page.
   - Recommendation: Navigate to `/settings/deck-structures` (auto-redirects to `/settings/deck-structures/touch-1`). The settings sidebar will highlight the active section. Use narration to point out other touch types are available in the sidebar navigation. Click into one for the detail + refinement demo.

3. **Slide Library Depends on Templates Having slideCount > 0**
   - What we know: The slide library SSR filters templates by `slideCount > 0`, then fetches slides per template.
   - What's unclear: Whether the mock server's `/templates/:templateId/slides` route uses the templateId parameter to filter slides or returns all slides.
   - Recommendation: The current mock server returns `fixtures.slides ?? []` regardless of templateId. This is fine -- all slides will appear in the slide library. Just ensure shared templates have `slideCount > 0` so the SSR doesn't skip them.

## Validation Architecture

> Config does not explicitly set nyquist_validation to false; treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (capture specs as functional tests) |
| Config file | `apps/tutorials/playwright.config.ts` |
| Quick run command | `pnpm --filter tutorials capture <tutorial-name>` |
| Full suite command | `pnpm --filter tutorials capture template-library && pnpm --filter tutorials capture slide-library && pnpm --filter tutorials capture deck-structures && pnpm --filter tutorials capture agent-prompts && pnpm --filter tutorials capture atlus-integration` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUT-08 | Template Library tutorial captures 10-14 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture template-library` | Wave 0 |
| TUT-09 | Slide Library tutorial captures 8-12 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture slide-library` | Wave 0 |
| TUT-10 | Deck Structures tutorial captures 10-14 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture deck-structures` | Wave 0 |
| TUT-11 | Agent Prompts tutorial captures 10-12 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture agent-prompts` | Wave 0 |
| TUT-12 | AtlusAI Integration tutorial captures 10-14 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture atlus-integration` | Wave 0 |

### Sampling Rate
- **Per task commit:** Capture the tutorial being authored and verify screenshot count
- **Per wave merge:** Run all five captures and verify MP4 output exists
- **Phase gate:** All five tutorials render as MP4 with correct step counts

### Wave 0 Gaps
- [ ] `fixtures/shared/templates.json` -- shared content library base (3-5 templates)
- [ ] `fixtures/shared/slides.json` -- shared slide data for ingested templates
- [ ] `capture/template-library.spec.ts` -- covers TUT-08
- [ ] `capture/slide-library.spec.ts` -- covers TUT-09
- [ ] `capture/deck-structures.spec.ts` -- covers TUT-10
- [ ] `capture/agent-prompts.spec.ts` -- covers TUT-11
- [ ] `capture/atlus-integration.spec.ts` -- covers TUT-12
- [ ] `fixtures/template-library/script.json` -- tutorial script
- [ ] `fixtures/slide-library/script.json` -- tutorial script
- [ ] `fixtures/deck-structures/script.json` -- tutorial script
- [ ] `fixtures/agent-prompts/script.json` -- tutorial script
- [ ] `fixtures/atlus-integration/script.json` -- tutorial script
- [ ] All stage fixture directories and files per tutorial
- [ ] Mock server: 9 routes made stage-aware (see Mock Server Gaps Summary)

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/tutorials/` infrastructure (capture specs, mock server, fixtures, types, route-mocks)
- Direct code inspection of `apps/web/src/app/(authenticated)/templates/` (page.tsx, templates-page-client.tsx)
- Direct code inspection of `apps/web/src/app/(authenticated)/slides/` (page.tsx, slide-library-client.tsx)
- Direct code inspection of `apps/web/src/app/(authenticated)/settings/` (deck-structures, agents, integrations pages and components)
- Direct code inspection of `apps/web/src/app/(authenticated)/discovery/` (page.tsx, discovery-client.tsx)
- Direct code inspection of `apps/web/src/lib/api-client.ts` (Template, DeckStructureDetail, AgentConfigDetail, AccessCheckResult, BrowseResult types and functions)
- Direct code inspection of `apps/web/src/components/settings/` (agent-detail.tsx, agent-list.tsx, touch-type-detail-view.tsx, integrations-status.tsx)
- Phase 62-68 decisions from STATE.md
- Phase 67/68 research and plan patterns

### Secondary (MEDIUM confidence)
- Deck structures chat component interaction flow inference (POST chat -> re-fetch structure via Server Action)
- Settings layout sidebar navigation structure (inferred from file structure)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all infrastructure exists
- Architecture: HIGH - established patterns from Phases 62-68, well-proven by 7 prior tutorials
- Pitfalls: HIGH - identified through direct code inspection of mock server routes, page SSR patterns, component data requirements, and fixture loader mechanics

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- content authoring on frozen infrastructure)
