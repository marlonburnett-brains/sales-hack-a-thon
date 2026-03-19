# Phase 68: Medium-Complexity Tutorials (Deals & Briefing) - Research

**Researched:** 2026-03-19
**Domain:** Tutorial content authoring (scripts, fixtures, capture specs) on existing infrastructure
**Confidence:** HIGH

## Summary

Phase 68 is a pure content-authoring phase building four tutorials covering deal management and pre-call briefing workflows. All infrastructure is built (Phases 62-66) and the content-authoring patterns are proven (Phase 67). The four tutorials -- Creating & Managing Deals (TUT-04), Deal Overview (TUT-05), Deal Chat (TUT-06), and Pre-Call Briefing (TUT-07) -- each need script JSON files, fixture data, capture specs, TTS audio generation, and MP4 rendering.

The primary technical challenge is the Deal Chat tutorial (TUT-06), which requires stage-based fixture switching for chat message progression (showing prior messages, then adding new exchanges). The chat operates through both SSR routes (mock server) and browser-side routes (`page.route()` for streaming POST). The current chat mock returns empty messages and a generic greeting -- these need stage-aware overrides to show realistic multi-message conversations. The Pre-Call Briefing tutorial (TUT-07) follows the well-established stage-switching pattern (idle/generating/complete) from the touch-4-hitl and action-center tutorials.

A secondary consideration is the deals grid (TUT-04), which needs 5-8 deals with varied statuses. The shared fixtures currently have only 4 deals, all with `status: "open"` except one `"won"`. The overrides file for the deals tutorial must expand this to show the full range of deal statuses and filtering behavior.

**Primary recommendation:** Split into two plans: Plan 01 handles script/fixture/capture authoring for all four tutorials (TUT-04 through TUT-07), Plan 02 handles TTS audio generation and MP4 rendering for all four tutorials.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Creating & Managing Deals (TUT-04): Single comprehensive tutorial covering create deal, assign team, one status change (e.g., Active -> Won), grid/table views, and filtering. ~12-15 steps. Not split into sub-tutorials
- Deal Overview (TUT-05): Standalone entry -- navigates directly to overview sub-page. Covers metrics cards, activity timeline, collaborator management
- Deal Chat (TUT-06): Standalone entry -- navigates directly to chat sub-page. Covers 2-3 chat exchanges (context-aware question, knowledge base query, note save), transcript upload, and full note-to-touch binding flow
- Pre-Call Briefing (TUT-07): Generation flow + history view. Show all three stages (idle -> generating -> complete), quick scroll through all output sections, then navigate to history showing 2-3 past briefings (list view only, no click-through)
- All 4 tutorials are standalone -- no cross-tutorial navigation dependencies. Each opens its own deal sub-page independently
- AI responses appear instantly via stage switching -- no typing animation or loading indicator between user message and AI response
- Transcript upload uses stage switching: click upload button -> stage switch to "transcript uploaded and parsed" state. OS file picker skipped
- Three-stage capture for briefing: idle (no briefing) -> generating (loading/progress state visible) -> complete (results rendered)
- All 4 tutorials use the same primary deal (e.g., "Meridian Health Partnership") viewed at different contexts/sub-pages
- Deals grid (TUT-04) shows 5-8 deals with variety (different statuses, companies). Reuses shared fixture companies where possible
- Deal Chat starts with 1-2 prior chat messages already visible
- Briefing fixture content references the actual company from the deal (company-specific research, value hypotheses, discovery questions)
- All tutorials share the same fictional company from existing shared fixtures (users.json, companies.json, deals.json)
- Conversational tone consistent with Phase 67. Normal pace for all 4 tutorials
- Standalone outro slates -- "Tutorial Complete" only, no next-tutorial direction
- Zoom ~30-40% of steps, callouts ~20-30%, cursor on all click/hover steps

### Claude's Discretion
- Exact step count per tutorial (within the ranges/guidance above)
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Chat message content (questions, AI responses, notes) -- should be realistic and deal-relevant
- Briefing fixture content details (specific research, hypotheses, questions about the fictional company)
- Grid deal names and statuses for the 5-8 deals shown
- Exact stage names and fixture file structure per tutorial

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TUT-04 | "Creating & Managing Deals" tutorial -- create deal, assign team, status lifecycle, grid/table views, filtering | Web route `/deals` (grid/table SSR page) + `/deals/[dealId]/overview` (deal detail). Mock server has complete deals CRUD routes. Needs 5-8 deals in overrides with varied statuses. CreateDealDialog, DealStatusFilter, DealViewToggle, DealAssigneeFilter components drive the UI |
| TUT-05 | "Deal Overview" tutorial -- metrics cards, activity timeline, collaborator management | Web route `/deals/[dealId]/overview`. getDealAction + listKnownUsersAction via SSR. Needs interaction fixtures to populate metrics (touches completed, days in pipeline, last activity, total interactions). InteractionTimeline, DealStatusAction, DealAssignmentPicker components |
| TUT-06 | "Deal Chat" tutorial -- context-aware questions, transcript upload, saving notes, binding notes to touches | PersistentDealChat component in deal layout (all deal sub-pages). Chat bootstrap via `/deals/:dealId/chat` (SSR + browser POST). Stage-based message progression needed. Browser-side `page.route()` already mocks chat POST and bindings POST. Transcript upload skips file picker via stage switch |
| TUT-07 | "Pre-Call Briefing" tutorial -- generate company research, value hypotheses, discovery questions, view history | Web route `/deals/[dealId]/briefing`. Uses getInteractionsAction for PriorBriefingsList. Briefing page shows "Shared assistant" banner + prior briefings list. Needs pre_call interaction fixtures with generatedContent containing company research, value hypotheses, discovery questions. Three-stage pattern (idle/generating/complete) reuses touch-4-hitl approach |

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
    deals/
      script.json            # 12-15 step tutorial script
      overrides.json         # 5-8 deals with varied statuses + additional companies
    deal-overview/
      script.json            # 8-12 step tutorial script
      overrides.json         # Interactions for metrics + timeline
    deal-chat/
      script.json            # 10-14 step tutorial script
      overrides.json         # Base chat state (1-2 prior messages)
      stages/
        chat-initial.json    # Stage: prior messages visible, pre-first-exchange
        chat-exchange-1.json # Stage: after first AI response
        chat-exchange-2.json # Stage: after knowledge base query response
        chat-note-saved.json # Stage: after note save + binding
        transcript-uploaded.json # Stage: after transcript upload
    briefing/
      script.json            # 10-14 step tutorial script
      overrides.json         # Base interactions (empty pre_call history)
      stages/
        idle.json            # Stage: no briefing generated yet
        generating.json      # Stage: briefing generation in progress
        complete.json        # Stage: briefing results rendered
        history.json         # Stage: 2-3 past briefings in interactions
  capture/
    deals.spec.ts
    deal-overview.spec.ts
    deal-chat.spec.ts
    briefing.spec.ts
```

### Pattern 1: Script JSON Authoring (reuse from Phase 67)
**What:** Each tutorial is defined by a `script.json` following TutorialScriptSchema
**When to use:** Every tutorial follows this pattern
**Key fields per step:**
```json
{
  "id": "step-001",
  "url": "/deals",
  "narration": "Conversational text...",
  "waitFor": "main",
  "actions": [{ "type": "click", "selector": "button:has-text('New Deal')" }],
  "zoomTarget": { "selector": "main", "scale": 1.5, "x": 0.5, "y": 0.4 },
  "callout": { "text": "Label text", "x": 0.5, "y": 0.3 },
  "cursorTarget": { "x": 0.5, "y": 0.5 },
  "mockStage": "chat-exchange-1",
  "emotion": "professional",
  "delayMs": 1000
}
```

### Pattern 2: Generic Capture Loop (reuse existing)
**What:** Capture specs follow the exact pattern from `action-center.spec.ts`
**Structure:** Load script -> beforeEach sets auth + browser mocks -> test iterates steps -> navigate, wait, act, capture
**Key:** The loop is fully generic. New tutorials only change TUTORIAL_ID and script.json.

### Pattern 3: Stage-Based Fixture Switching for Chat Progression
**What:** Use `mockStage` on steps to advance the chat state. Each stage provides different chat messages/state via stage fixtures.
**How it works:**
1. Step has `mockStage: "chat-initial"` -- mock server `/deals/:dealId/chat` returns 1-2 prior messages
2. Step has `mockStage: "chat-exchange-1"` -- mock server returns prior messages + new user question + AI response
3. Step has `mockStage: "chat-note-saved"` -- mock server returns all messages + note saved confirmation
**Key insight:** The `PersistentDealChat` is a client component that calls `getDealChatBootstrap` via Server Action. The mock server's `/deals/:dealId/chat` GET route needs to be stage-aware, returning different message arrays per stage. The browser-side chat POST route already exists in route-mocks.ts but returns a generic response -- for the tutorial, we avoid POST altogether and use stage switches to show the "result" of a chat exchange.

### Pattern 4: Briefing Three-Stage Pattern (reuse from touch-4-hitl)
**What:** Use `mockStage` to transition briefing through idle -> generating -> complete states
**How it works:**
1. Step `mockStage: "idle"` -- no pre_call interactions, briefing page shows empty state
2. Step `mockStage: "generating"` -- interaction with `status: "running"`, shows progress UI
3. Step `mockStage: "complete"` -- interaction with `status: "completed"` and rich `generatedContent`
4. Step `mockStage: "history"` -- 2-3 completed pre_call interactions with different dates
**Requires:** Stage fixture files at `fixtures/briefing/stages/{idle,generating,complete,history}.json`

### Pattern 5: Deals Grid with Override Fixtures
**What:** Expand shared fixtures to show 5-8 deals with varied statuses for the deals grid
**How it works:** `overrides.json` replaces the `deals` array with 5-8 deals referencing existing shared companies + 2-3 new companies. Include statuses: open, won, lost, and abandoned for visual variety.
**Important:** The deals page uses `listDealsFilteredAction` which calls `GET /deals` with query params. The mock server's existing `/deals` route already supports status/assignee filtering.

### Anti-Patterns to Avoid
- **Hardcoding fixture data in capture specs:** All data belongs in fixture JSON files. Capture specs should only reference TUTORIAL_ID.
- **Attempting to render real chat streaming:** Do NOT use the POST chat route for real exchanges. Use stage-based fixture switching to show the "result" of each exchange. The streaming POST response is a plain text mock, not a rich message structure.
- **Mixing browser-side and SSR mock concerns:** The `PersistentDealChat` bootstraps via Server Action (SSR -> mock server). Chat messages in the initial load come from the mock server GET. Only the streaming POST comes through browser-side page.route(). Stage switching handles both by updating mock server state before page navigation/reload.
- **Using the same deal ID across all tutorials:** While the CONTEXT says all tutorials use the same primary deal, each capture spec is independent. Use deal-001 consistently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capture automation | Custom screenshot logic | Existing generic capture loop pattern | Already handles navigation, waiting, actions, stage switching |
| TTS generation | New TTS code | `pnpm --filter tutorials tts <tutorial-name>` | Pipeline handles audio gen + timing manifests |
| Video rendering | New composition code | `pnpm --filter tutorials render <tutorial-name>` | Remotion compositions handle all visual effects |
| Fixture loading | Manual JSON reading | `loadFixtures(tutorialId)` from `fixtures/loader.ts` | Handles shared + override merging with validation |
| Stage switching | Custom mock logic | `mockStage` field on steps + `/mock/set-stage` endpoint | Already built in Phase 63 |
| Chat message mocking | Streaming response logic | Stage fixtures with pre-authored message arrays | Stage switching is proven; streaming is unreliable in mocked env |
| Briefing async flow | Custom polling mocks | Stage fixtures (idle/generating/complete) | Same pattern as touch-4-hitl and action-center |

## Common Pitfalls

### Pitfall 1: Mock Server Chat Route Not Stage-Aware
**What goes wrong:** The `GET /deals/:dealId/chat` mock route currently returns hardcoded empty messages and a generic greeting. It is NOT stage-aware.
**Why it happens:** The chat mock was built as a minimal stub in Phase 62. No tutorial has needed dynamic chat state until now.
**How to avoid:** Make the `/deals/:dealId/chat` GET route stage-aware in mock-server.ts. Check `loadStageFixtures(tutorialName, currentStage)` for a `chat` or `chatBootstrap` field. Return stage-specific messages, greeting, and suggestions.
**Warning signs:** Chat panel shows "Hello! How can I help you with this deal?" with no prior messages regardless of stage.

### Pitfall 2: PersistentDealChat Is a Client Component with useEffect Bootstrap
**What goes wrong:** The `PersistentDealChat` component calls `getDealChatBootstrap` in a `useEffect`. This means the chat bootstrap happens AFTER initial page render, not during SSR. Stage must be set BEFORE navigation, but the bootstrap fetch happens from the browser.
**Why it happens:** Client-side `useEffect` fires after hydration, making a Server Action call which goes through the mock server.
**How to avoid:** Set the `mockStage` BEFORE navigating to a page that shows the deal chat. The mock server stage will be set, and when the client-side `useEffect` fires `getDealChatBootstrap`, the Server Action will call the mock server which returns the correct stage fixtures. Also need the browser-side route-mocks chat GET handler to be stage-aware (currently returns hardcoded empty messages).
**Critical detail:** The browser-side `page.route("**/api/deals/*/chat")` intercepts the browser GET too. This needs to be made stage-aware or the browser mock needs to proxy to the mock server for GET requests (like the actions/count handler does).

### Pitfall 3: Briefing Page Uses Interactions for History, Not a Separate Endpoint
**What goes wrong:** The `PriorBriefingsList` component filters interactions by `touchType === "pre_call"`. There is no separate `/briefings` endpoint.
**Why it happens:** Briefings are modeled as interactions with `touchType: "pre_call"`.
**How to avoid:** Stage fixtures for the briefing tutorial must provide `interactions` arrays with `pre_call` entries. The `generatedContent` field must be a JSON string containing structured briefing content (companyResearch, valueHypotheses, discoveryQuestions). The `inputs` field must contain a JSON string with `buyerRole` and `meetingContext`.
**Warning signs:** Briefing history shows "No briefings yet" even in the history stage.

### Pitfall 4: Deals Grid Needs Status Variety in Fixtures
**What goes wrong:** The shared `deals.json` has only 4 deals (3 open, 1 won). The deals grid tutorial needs 5-8 deals with varied statuses for filtering demonstration.
**Why it happens:** Shared fixtures were designed for minimum viable data, not tutorial-specific needs.
**How to avoid:** The `deals` tutorial overrides must replace the deals array with 5-8 deals. Add 2-3 new companies to the overrides as well. Ensure at least one deal each of: open, won, lost. Use existing company IDs from shared fixtures where possible.

### Pitfall 5: Deal Layout Wraps All Sub-Pages with PersistentDealChat
**What goes wrong:** Every deal sub-page (`/deals/[dealId]/*`) renders the `PersistentDealChat` component via the deal layout. This means the chat bootstrap fires on EVERY deal page navigation.
**Why it happens:** The layout is shared across overview, briefing, and touch pages.
**How to avoid:** For tutorials that don't focus on chat (TUT-04, TUT-05, TUT-07), the chat panel state doesn't matter as much, but the bootstrap call must not fail. The default mock server chat response (empty messages + greeting) is sufficient. Only TUT-06 needs stage-aware chat responses.
**Warning signs:** Chat panel errors or shows loading state that never resolves on non-chat tutorials.

### Pitfall 6: Browser-Side Chat Mock Intercepts Before Mock Server
**What goes wrong:** The `page.route("**/api/deals/*/chat")` in route-mocks.ts intercepts the browser-side GET request for chat bootstrap. This returns hardcoded empty messages, bypassing the mock server entirely.
**Why it happens:** The Server Action `getDealChatBootstrap` runs server-side and hits the mock server. But if the browser also makes a direct fetch to the chat endpoint (e.g., during client-side navigation), the browser-side mock intercepts it.
**How to avoid:** Two options: (1) Make the browser-side chat route handler stage-aware by fetching from the mock server (like the actions/count handler does), or (2) ensure the chat bootstrap only goes through Server Actions (which it does via `getDealChatBootstrap` action). Verify by checking if the browser ever directly fetches the chat endpoint.
**Recommended:** Make the browser-side chat GET handler proxy to the mock server for stage awareness. This is the same pattern used for `/api/actions/count`.

## Code Examples

### Example 1: Stage-Aware Chat GET Route (mock-server.ts modification)
```typescript
// Replace the existing GET /deals/:dealId/chat handler:
app.get("/deals/:dealId/chat", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(tutorialName, currentStage);
  const chatData = (stageFixtures as Record<string, unknown>)?.chatBootstrap;
  if (chatData) {
    res.json(chatData);
  } else {
    res.json({
      messages: [],
      greeting: "Hello! How can I help you with this deal?",
      suggestions: [
        { label: "Summarize this deal", value: "Summarize this deal" },
        { label: "What are the next steps?", value: "What are the next steps?" },
      ],
    });
  }
});
```

### Example 2: Browser-Side Chat Mock Proxy (route-mocks.ts modification)
```typescript
// Replace the existing deal chat handler to proxy GET to mock server:
await page.route("**/api/deals/*/chat", async (route: Route) => {
  if (route.request().method() === "POST") {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "This is a mock response from the deal chat assistant.",
    });
  } else {
    // GET -- proxy to mock server for stage-awareness
    const mockPort = process.env.MOCK_SERVER_PORT ?? "4112";
    const url = new URL(route.request().url());
    const dealId = url.pathname.split("/deals/")[1]?.split("/chat")[0];
    try {
      const resp = await fetch(
        `http://localhost:${mockPort}/deals/${dealId}/chat${url.search}`
      );
      const data = await resp.json();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    } catch {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [],
          greeting: "Hello! How can I help you with this deal?",
          suggestions: [],
        }),
      });
    }
  }
});
```

### Example 3: Chat Stage Fixture Shape
```json
// fixtures/deal-chat/stages/chat-exchange-1.json
{
  "chatBootstrap": {
    "messages": [
      {
        "id": "msg-prior-1",
        "role": "user",
        "content": "What's the latest status on the Meridian Dynamics deal?",
        "createdAt": "2026-03-18T14:30:00.000Z"
      },
      {
        "id": "msg-prior-2",
        "role": "assistant",
        "content": "The Meridian Dynamics Q2 Digital Transformation Initiative is currently open. The deal was created on February 10 and last updated on March 5. James Mitchell is listed as a collaborator.",
        "createdAt": "2026-03-18T14:30:05.000Z"
      },
      {
        "id": "msg-new-1",
        "role": "user",
        "content": "What are the key pain points we should address in our next meeting?",
        "createdAt": "2026-03-19T10:00:00.000Z"
      },
      {
        "id": "msg-new-2",
        "role": "assistant",
        "content": "Based on the deal context for Meridian Dynamics, here are the key pain points to address:\n\n1. **Legacy system integration** -- Their existing ERP is 8+ years old\n2. **Data silos** -- Marketing and sales teams use separate tools\n3. **Scalability concerns** -- Current infrastructure can't handle projected Q3 growth\n\nI'd recommend focusing on the integration story since that's typically the highest-value conversation starter for technology consulting firms.",
        "createdAt": "2026-03-19T10:00:08.000Z"
      }
    ],
    "greeting": "Hello! How can I help you with the Meridian Dynamics deal?",
    "suggestions": [
      { "label": "Draft meeting prep", "value": "Help me prepare for the next meeting" },
      { "label": "Summarize activity", "value": "Summarize recent deal activity" }
    ]
  }
}
```

### Example 4: Briefing Complete Stage Fixture Shape
```json
// fixtures/briefing/stages/complete.json
{
  "interactions": [
    {
      "id": "int-briefing-001",
      "dealId": "deal-001",
      "touchType": "pre_call",
      "status": "completed",
      "inputs": "{\"buyerRole\":\"VP of Technology\",\"meetingContext\":\"Initial discovery call to discuss digital transformation roadmap\"}",
      "decision": null,
      "generatedContent": "{\"companyResearch\":{\"industryPosition\":\"Meridian Dynamics is a mid-market technology consulting firm specializing in enterprise digital transformation.\",\"recentNews\":\"Recently expanded their cloud practice with 3 new senior hires.\",\"competitiveContext\":\"Competing with Accenture and Deloitte Digital for mid-market deals.\"},\"valueHypotheses\":[\"Legacy ERP modernization could save 40% on integration costs\",\"Unified data platform would reduce sales-to-marketing handoff time by 60%\",\"Cloud migration path aligned with their Q3 growth projections\"],\"discoveryQuestions\":[\"What's driving the urgency on the digital transformation timeline?\",\"How are your teams currently sharing customer data across departments?\",\"What does success look like for your Q3 scalability targets?\"]}",
      "outputRefs": "{\"briefingDocUrl\":\"https://docs.google.com/document/d/mock-briefing-doc\"}",
      "driveFileId": null,
      "hitlStage": null,
      "stageContent": null,
      "createdAt": "2026-03-19T09:00:00.000Z",
      "updatedAt": "2026-03-19T09:05:00.000Z"
    }
  ]
}
```

### Example 5: Deals Grid Override Fixtures (expanded deals array)
```json
// fixtures/deals/overrides.json (partial -- shows structure)
{
  "deals": [
    { "id": "deal-001", "companyId": "comp-meridian-001", "name": "Q2 Digital Transformation Initiative", "status": "open", "...": "..." },
    { "id": "deal-002", "companyId": "comp-nexus-002", "name": "Patient Portal Modernization", "status": "open", "...": "..." },
    { "id": "deal-003", "companyId": "comp-atlas-003", "name": "Compliance Automation Platform", "status": "won", "...": "..." },
    { "id": "deal-004", "companyId": "comp-verde-004", "name": "Smart Grid Analytics Dashboard", "status": "open", "...": "..." },
    { "id": "deal-005", "companyId": "comp-pinnacle-005", "name": "Omnichannel Retail Platform", "status": "lost", "...": "..." },
    { "id": "deal-006", "companyId": "comp-horizon-006", "name": "Fleet Management Integration", "status": "abandoned", "...": "..." },
    { "id": "deal-007", "companyId": "comp-meridian-001", "name": "Internal Knowledge Base Refresh", "status": "won", "...": "..." }
  ],
  "interactions": [
    "// 3-5 interactions for deal-001 to populate overview metrics and timeline"
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded capture scripts | Generic capture loop driven by JSON | Phase 62 | New tutorials only need script.json |
| Manual fixture setup | loadFixtures with shared + overrides | Phase 62 | Consistent data across tutorials |
| Static mock responses | Stage-aware mock server | Phase 63 | Enables before/after state transitions |
| Fixed mockStage enum | Free-form z.string() mockStage | Phase 67 | Any custom stage name works |
| No visual effects | Zoom, callout, cursor, transitions | Phase 66 | Scripts now include effect metadata |
| Phase 67 (3 tutorials) | Phase 68 (4 tutorials) | Current | Same patterns, more complex content |

## Mock Server Gaps Summary

These routes need modification for Phase 68 tutorials:

| Route | Current State | Needed State |
|-------|--------------|--------------|
| `GET /deals/:dealId/chat` | Returns hardcoded empty messages | Stage-aware: returns messages from stage fixtures when `chatBootstrap` field present |
| Browser-side `**/api/deals/*/chat` GET | Returns hardcoded empty messages | Proxy to mock server for stage awareness (like actions/count pattern) |
| `GET /deals/:dealId/interactions` | Stage-aware (checks `interactions` field) | Already works -- briefing history just needs correct stage fixture data |
| `GET /deals` | Supports status/assignee filtering | Already works -- just needs more deals in override fixtures |

**Key insight:** Most mock server routes are already adequate. Only the chat bootstrap route needs a stage-awareness enhancement. The briefing tutorial can leverage the existing stage-aware interactions route entirely through fixture data.

## Open Questions

1. **Chat Panel Visibility During Capture**
   - What we know: `PersistentDealChat` renders as a docked/panel chat on all deal pages. It starts closed (collapsed).
   - What's unclear: Whether we need to explicitly open/close the chat panel during TUT-06 capture, or if it auto-opens on the chat sub-page
   - Recommendation: Steps in TUT-06 should include an explicit click action to open the chat panel if it starts collapsed. For non-chat tutorials (TUT-04, TUT-05, TUT-07), the collapsed panel is fine and can be ignored.

2. **Briefing "Generating" Visual State**
   - What we know: The briefing page shows a "Shared assistant" banner and prior briefings list. There's no obvious built-in "generating" loading state on the briefing page itself.
   - What's unclear: Whether the generating state is shown via a workflow status indicator elsewhere, or if the briefing page has a progress component
   - Recommendation: The generating state may need to be shown via the chat panel (user asks assistant to generate briefing) or via a page reload showing a running interaction. Investigate the actual UI rendering of a `status: "running"` pre_call interaction. If no progress UI exists on the briefing page, narrate the generating concept and stage-switch to complete.

3. **Transcript Upload UI in Deal Chat**
   - What we know: CONTEXT says transcript upload skips the OS file picker and uses stage switching. Narration explains what happened.
   - What's unclear: What UI element triggers the transcript upload. Need to identify the upload button in `DealChatThread` or `PersistentDealChat`.
   - Recommendation: During planning, inspect the chat thread component for the upload trigger. The step should hover/highlight the upload button, then stage-switch to show the "uploaded and parsed" state.

## Validation Architecture

> Config does not explicitly set nyquist_validation to false; treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (capture specs as functional tests) |
| Config file | `apps/tutorials/playwright.config.ts` |
| Quick run command | `pnpm --filter tutorials capture <tutorial-name>` |
| Full suite command | `pnpm --filter tutorials capture deals && pnpm --filter tutorials capture deal-overview && pnpm --filter tutorials capture deal-chat && pnpm --filter tutorials capture briefing` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUT-04 | Deals tutorial captures 12-15 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture deals` | Wave 0 |
| TUT-05 | Deal Overview tutorial captures 8-12 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture deal-overview` | Wave 0 |
| TUT-06 | Deal Chat tutorial captures 10-14 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture deal-chat` | Wave 0 |
| TUT-07 | Briefing tutorial captures 10-14 screenshots + renders MP4 | smoke | `pnpm --filter tutorials capture briefing` | Wave 0 |

### Sampling Rate
- **Per task commit:** Capture the tutorial being authored and verify screenshot count
- **Per wave merge:** Run all four captures and verify MP4 output exists
- **Phase gate:** All four tutorials render as MP4 with correct step counts

### Wave 0 Gaps
- [ ] `capture/deals.spec.ts` -- covers TUT-04
- [ ] `capture/deal-overview.spec.ts` -- covers TUT-05
- [ ] `capture/deal-chat.spec.ts` -- covers TUT-06
- [ ] `capture/briefing.spec.ts` -- covers TUT-07
- [ ] `fixtures/deals/script.json` -- 12-15 step tutorial script
- [ ] `fixtures/deals/overrides.json` -- 5-8 deals with varied statuses
- [ ] `fixtures/deal-overview/script.json` -- 8-12 step tutorial script
- [ ] `fixtures/deal-overview/overrides.json` -- interactions for metrics
- [ ] `fixtures/deal-chat/script.json` -- 10-14 step tutorial script
- [ ] `fixtures/deal-chat/overrides.json` -- base chat state
- [ ] `fixtures/deal-chat/stages/*.json` -- chat message progression stages
- [ ] `fixtures/briefing/script.json` -- 10-14 step tutorial script
- [ ] `fixtures/briefing/overrides.json` -- base briefing state
- [ ] `fixtures/briefing/stages/*.json` -- idle/generating/complete/history stages
- [ ] Mock server: stage-aware `GET /deals/:dealId/chat` route
- [ ] Route-mocks: stage-aware browser-side chat GET proxy

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/tutorials/` infrastructure (capture specs, mock server, fixtures, types, route-mocks)
- Direct code inspection of `apps/web/src/app/(authenticated)/deals/` (page.tsx, layout.tsx, overview/page.tsx, briefing/page.tsx)
- Direct code inspection of `apps/web/src/components/deals/` (persistent-deal-chat.tsx, prior-briefings-list.tsx)
- Direct code inspection of `apps/web/src/lib/actions/deal-chat-actions.ts` (Server Action for chat bootstrap)
- Direct code inspection of `apps/web/src/lib/api-client.ts` (getDealChatBootstrap function)
- Phase 62-67 decisions from STATE.md
- Phase 67 research and plan patterns

### Secondary (MEDIUM confidence)
- Chat component interaction flow inference (client useEffect -> Server Action -> mock server)
- Briefing "generating" state UI behavior (may not have visible progress indicator on briefing page)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all infrastructure exists
- Architecture: HIGH - established patterns from Phases 62-67, well-proven by Phase 67's three tutorials
- Pitfalls: HIGH - identified through direct code inspection of mock server routes, chat component lifecycle, and briefing data model

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- content authoring on frozen infrastructure)
