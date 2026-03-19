# Phase 63: HITL & Async Mock Capture - Research

**Researched:** 2026-03-19
**Domain:** Playwright capture infrastructure -- stateful mock server stages and sequenced polling responses
**Confidence:** HIGH

## Summary

Phase 63 extends the Phase 62 capture infrastructure to support two categories of complex UI flows: (1) multi-stage HITL workflows where content progresses through skeleton, lowfi, and hifi review gates, and (2) polling-based async workflows where the UI polls `/api/workflows/status` and shows generation progress. Both require the mock server and browser-side route mocks to become **stateful** -- serving different fixture data depending on which stage the tutorial script declares for each step.

The existing codebase is well-structured for this extension. The mock server (`mock-server.ts`) already handles all 40+ routes with fixture data. The capture spec (`getting-started.spec.ts`) already iterates script steps generically. The tutorial script schema (`tutorial-script.ts`) uses Zod and is easily extensible. The key work is: (a) adding stage state management to the mock server with a control endpoint, (b) adding sequence counter support for polling responses, (c) extending the Zod schemas with `mockStage`, `waitForText`, `resetSequences`, `touchType`, and `delayMs`, (d) updating the capture loop to call control endpoints before each step, and (e) creating a pilot Touch 4 fixture set.

**Primary recommendation:** Implement stage state as simple in-memory variables in the mock server, with `POST /mock/set-stage` control endpoint. Implement sequences as ordered arrays loaded from JSON files with independent counters per route pattern. Extend the capture spec to call control endpoints between steps based on script step fields.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Step-linked stage control: each tutorial script step declares which HITL stage it expects via `mockStage` field
- Control endpoint: capture engine calls `POST /mock/set-stage {stage}` before navigating to set the active stage
- Mock server is stateful -- maintains current stage and serves stage-appropriate fixture data
- Unified control: both the Express mock server AND page.route() browser-side mocks read the same stage state
- Capture engine passes current stage to `mockBrowserAPIs()` so workflow status polling returns stage-appropriate data
- Full lifecycle stages: `idle`, `generating`, `skeleton`, `lowfi`, `hifi`, `completed`
- Per-touch-type stage progressions: each touch type (1-4 + pre-call) has its own valid stage sequence
- Stage-quality content: fixture data at each stage reflects realistic quality progression
- Static output reference URLs across all stages
- Sequence arrays: fixtures define ordered arrays of responses per endpoint; each poll pops the next response; last response repeats after exhaustion
- Poll sequences defined in fixture files (version-controlled), not pushed via control endpoint
- Both mock server and page.route() browser-side mocks support sequences
- Named sequences with independent counters per route pattern
- Per-sequence reset: `POST /mock/reset-sequence {key}` resets a specific sequence counter
- Wait for UI state: capture engine waits for specific UI element/text to appear after polling completes before taking screenshot
- Verbose sequence logging format: `[mock-seq] {key}: response {n}/{total} (status={value})`
- `mockStage`: optional enum field on StepSchema
- `waitForText`: optional string field on StepSchema
- `resetSequences`: optional string array on StepSchema
- `touchType`: optional enum field on TutorialScriptSchema
- `delayMs`: optional number field on StepSchema
- No new HITL-specific action types -- existing click/fill/select actions target actual UI buttons
- `stages/` subdirectory per HITL tutorial
- `sequences/` subdirectory per tutorial with async flows
- Stage files merged: shared fixtures + overrides + stage-specific data
- Zod schema validation at load time for stage and sequence files
- Pilot fixture set: minimal Touch 4 HITL tutorial (5-8 steps)

### Claude's Discretion
- Whether the control endpoint supports a full `/mock/reset` for all state, or if fresh server per tutorial is sufficient (based on capture.ts lifecycle)
- Whether `mockOverrides` needs stage-keyed extensions or if `mockStage` + flat `mockOverrides` combination covers all cases
- Exact Zod schemas for stage fixture files and sequence arrays
- Pilot tutorial script content and step selectors
- Mock server internal architecture for stage state management

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAPT-03 | Playwright can mock HITL workflow stages (Skeleton -> Low-fi -> High-fi) with pre-authored stage responses for each touch type | Stage state management in mock server, `mockStage` field in script schema, stage-aware fixture loading from `stages/` directory, stage-aware route handlers for interactions/briefs/workflows endpoints |
| CAPT-04 | Playwright can mock polling/async workflows (generation progress, ingestion status) with pre-sequenced status updates | Sequence arrays in fixture files, independent counters per route pattern, sequence-aware page.route() handlers, `waitForText` for UI state verification after polling |
</phase_requirements>

## Architecture Patterns

### Current Codebase Structure (from Phase 62)
```
apps/tutorials/
  capture/
    getting-started.spec.ts     # Generic capture loop iterating script steps
  fixtures/
    shared/                     # Shared fixture JSON (companies, deals, users)
    getting-started/
      script.json               # Tutorial script definition
      overrides.json            # Tutorial-specific fixture overrides
    loader.ts                   # loadFixtures() with deep merge
    factories.ts                # Zod-validated factory functions
    types.ts                    # FixtureSet + all fixture Zod schemas
  scripts/
    capture.ts                  # Orchestrator: mock server + Next.js + Playwright
    mock-server.ts              # Express server with 40+ routes
  src/
    helpers/
      auth.ts                   # Supabase session injection
      determinism.ts            # disableAnimations + waitForStableState
      route-mocks.ts            # mockBrowserAPIs() page.route() interceptors
      screenshot.ts             # captureStep() with determinism prep
    types/
      tutorial-script.ts        # Zod schemas: TutorialScriptSchema, StepSchema
  playwright.config.ts
```

### Target Structure (Phase 63 additions)
```
apps/tutorials/
  capture/
    getting-started.spec.ts     # Unchanged
    touch-4-hitl.spec.ts        # NEW: Pilot Touch 4 HITL capture spec
  fixtures/
    shared/                     # Unchanged
    getting-started/            # Unchanged
    touch-4-hitl/               # NEW: Pilot tutorial
      script.json               # Script with mockStage, waitForText, touchType
      overrides.json            # Base fixture overrides for Touch 4
      stages/                   # NEW: Stage-specific fixture data
        idle.json
        generating.json
        skeleton.json
        lowfi.json
        hifi.json
        completed.json
      sequences/                # NEW: Polling response sequences
        workflow-status.json    # Array of ordered status responses
    loader.ts                   # EXTENDED: loadStageFixtures(), loadSequences()
    factories.ts                # EXTENDED: interaction/stage factories
    types.ts                    # EXTENDED: StageFixture, SequenceFile schemas
  scripts/
    capture.ts                  # EXTENDED: pre-step stage/sequence control
    mock-server.ts              # EXTENDED: stage state + sequence counters + control endpoints
  src/
    helpers/
      route-mocks.ts            # EXTENDED: stage-aware + sequence-aware handlers
      determinism.ts            # EXTENDED: waitForText utility
    types/
      tutorial-script.ts        # EXTENDED: mockStage, waitForText, etc.
```

### Pattern 1: Stage State Management in Mock Server
**What:** The mock server maintains a mutable `currentStage` variable. Control endpoints modify it. Route handlers read it to select fixture data.
**When to use:** Every HITL-related route (interactions, briefs, workflows).

```typescript
// In mock-server.ts -- stage state management
let currentStage: string = "idle";
let currentTutorial: string = tutorialName;

// Control endpoint: set stage
app.post("/mock/set-stage", (req: Request, res: Response) => {
  const { stage } = req.body;
  currentStage = stage;
  console.log(`[mock-stage] Stage set to: ${stage}`);
  res.json({ stage: currentStage });
});

// Control endpoint: full reset (recommended -- fresh state without restarting server)
app.post("/mock/reset", (_req: Request, res: Response) => {
  currentStage = "idle";
  Object.keys(sequenceCounters).forEach(k => { sequenceCounters[k] = 0; });
  console.log(`[mock] Full state reset`);
  res.json({ stage: currentStage, sequences: "reset" });
});

// Stage-aware route example
app.get("/deals/:dealId/interactions", (_req: Request, res: Response) => {
  const stageFixtures = loadStageFixtures(currentTutorial, currentStage);
  const interactions = stageFixtures?.interactions ?? fixtures.interactions ?? [];
  res.json(interactions);
});
```

**Recommendation on `/mock/reset`:** Include it. The capture.ts orchestrator starts a fresh mock server per tutorial (line 124), so per-tutorial isolation already exists. But `/mock/reset` costs nothing to add and allows future multi-tutorial captures without server restart.

### Pattern 2: Sequence Counters for Polling
**What:** Named sequence arrays loaded from fixture JSON files. Each route pattern has an independent counter. Each request advances the counter; after exhaustion, the last response repeats.
**When to use:** Any polling endpoint (workflow status, ingestion progress, generation logs).

```typescript
// Sequence state
const sequences: Record<string, unknown[]> = {};
const sequenceCounters: Record<string, number> = {};

function getNextSequenceResponse(key: string): unknown | null {
  const seq = sequences[key];
  if (!seq || seq.length === 0) return null;

  const idx = sequenceCounters[key] ?? 0;
  const response = seq[Math.min(idx, seq.length - 1)]; // Last repeats
  sequenceCounters[key] = idx + 1;

  const total = seq.length;
  const serving = Math.min(idx + 1, total);
  console.log(`[mock-seq] ${key}: response ${serving}/${total} (status=${(response as Record<string, unknown>)?.status ?? "?"})`);

  return response;
}

// Control endpoint: reset specific sequence
app.post("/mock/reset-sequence", (req: Request, res: Response) => {
  const { key } = req.body;
  sequenceCounters[key] = 0;
  console.log(`[mock-seq] Reset: ${key}`);
  res.json({ key, counter: 0 });
});
```

### Pattern 3: Stage-Aware Browser Mocks via Closure
**What:** Pass current stage to `mockBrowserAPIs()` so page.route() handlers can serve stage-appropriate responses. Since page.route() runs in the browser context but the handler runs in Node, the stage must be accessible via closure or a fetch to the control endpoint.
**When to use:** Browser-initiated polling to `/api/workflows/status`.

```typescript
// Extended mockBrowserAPIs signature
export async function mockBrowserAPIs(
  page: Page,
  fixtures: FixtureSet,
  options?: {
    stageGetter?: () => string;          // Returns current stage
    sequenceGetter?: (key: string) => unknown; // Returns next sequence response
  }
): Promise<void> {
  // Workflow status polling -- stage-aware
  await page.route("**/api/workflows/status*", async (route: Route) => {
    // Option A: Use sequence if available
    const seqResponse = options?.sequenceGetter?.("workflow-status");
    if (seqResponse) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(seqResponse),
      });
      return;
    }

    // Option B: Derive from current stage
    const stage = options?.stageGetter?.() ?? "completed";
    const statusMap: Record<string, string> = {
      idle: "completed",
      generating: "running",
      skeleton: "suspended",
      lowfi: "suspended",
      hifi: "suspended",
      completed: "completed",
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        runId: new URL(route.request().url()).searchParams.get("runId") ?? "mock-run",
        status: statusMap[stage] ?? "completed",
        steps: {},
        result: {},
      }),
    });
  });
}
```

**Key insight on unified control:** The mock server and page.route() handlers need to share stage state. Since both run in the same Node.js process (mock server is in-process in capture.ts, page.route handlers run in Playwright's Node context), a shared module-level variable or a fetch to `http://localhost:4112/mock/get-stage` works. The simplest approach: page.route() handlers fetch the mock server's control endpoint to get current stage when needed, OR the capture spec passes a closure that holds mutable state.

### Pattern 4: Capture Loop Pre-Step Control
**What:** Before navigating to a step's URL, the capture spec calls control endpoints to set stage and reset sequences.
**When to use:** Every step in the capture loop that has `mockStage`, `resetSequences`, or needs sequence awareness.

```typescript
// In the capture spec loop
for (let i = 0; i < script.steps.length; i++) {
  const step = script.steps[i];

  await test.step(`Step ${i + 1}: ${step.id}`, async () => {
    // Pre-step: set mock stage if specified
    if (step.mockStage) {
      await fetch(`http://localhost:${MOCK_PORT}/mock/set-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: step.mockStage }),
      });
    }

    // Pre-step: reset sequences if specified
    if (step.resetSequences) {
      for (const key of step.resetSequences) {
        await fetch(`http://localhost:${MOCK_PORT}/mock/reset-sequence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
      }
    }

    // Navigate
    if (step.url && step.url !== currentUrl) {
      await page.goto(step.url, { waitUntil: "domcontentloaded" });
      currentUrl = step.url;
    }

    // ... actions ...

    // Post-action: wait for text if specified
    if (step.waitForText) {
      await page.waitForFunction(
        (text: string) => document.body.innerText.includes(text),
        step.waitForText,
        { timeout: 15_000 }
      );
    }

    // Post-action: delay if specified
    if (step.delayMs) {
      await page.waitForTimeout(step.delayMs);
    }

    await captureStep(page, tutorialId, i);
  });
}
```

### Pattern 5: Stage Fixture File Structure
**What:** Each stage JSON file contains partial FixtureSet overrides that get deep-merged onto the base fixtures.

```json
// fixtures/touch-4-hitl/stages/skeleton.json
{
  "interactions": [
    {
      "id": "int-touch4-001",
      "dealId": "deal-001",
      "touchType": "touch_4",
      "status": "in_progress",
      "hitlStage": "skeleton",
      "stageContent": "{\"proposal\":{\"sections\":[{\"title\":\"Executive Summary\",\"content\":\"- Key value propositions for Meridian Dynamics\\n- Cloud transformation ROI\\n- Implementation timeline\"}]},\"talkTrack\":{\"sections\":[{\"title\":\"Opening\",\"content\":\"- Greet stakeholders\\n- Reference previous conversations\"}]},\"faq\":[{\"q\":\"What is the implementation timeline?\",\"a\":\"- Phase 1: 3 months\\n- Phase 2: 6 months\"}]}",
      "outputRefs": "{\"deckUrl\":\"https://docs.google.com/presentation/d/mock-touch4/edit\",\"talkTrackUrl\":\"https://docs.google.com/document/d/mock-talk/edit\",\"faqUrl\":\"https://docs.google.com/document/d/mock-faq/edit\"}"
    }
  ]
}
```

### Anti-Patterns to Avoid
- **Fixed delays for polling:** Never use `waitForTimeout(3000)` to wait for polling to "complete." Use `waitForText` or `waitForSelector` to detect the UI state change. Fixed delays are flaky across machines.
- **Hardcoded stage in route handlers:** Don't add if/else branches for specific tutorials in mock-server.ts. The stage state + fixture loading pattern keeps tutorial logic in fixture files, not server code.
- **Mutating fixture objects:** Always return copies/new objects from fixture loading. The shared fixtures object is reused across requests.
- **Coupled sequence counters:** Each sequence key must have its own independent counter. Don't use a single global counter for all sequences.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep merge of stage fixtures onto base | Custom recursive merge | Existing `deepMerge()` in `loader.ts` | Already handles arrays, nulls, nested objects correctly |
| Polling wait strategies | Custom retry loops | Playwright's `page.waitForFunction()` with text check | Built-in timeout, retries, and error handling |
| Schema validation for stage/sequence files | Manual type guards | Zod schemas (already used throughout) | Consistent with Phase 62 pattern, catches fixture drift |
| Screenshot determinism | Manual animation disabling | Existing `prepareForScreenshot()` in `determinism.ts` | Already handles animations, fonts, skeletons |

## Common Pitfalls

### Pitfall 1: Race Between Stage Set and Navigation
**What goes wrong:** Capture engine navigates to a page BEFORE the mock server has processed the `set-stage` call. The page loads with stale fixture data.
**Why it happens:** `fetch()` to the control endpoint is async. If the capture engine doesn't await it before `page.goto()`, the SSR data fetch hits the mock server before stage is set.
**How to avoid:** Always `await` the `POST /mock/set-stage` call and verify the response before navigating. The control endpoint should be synchronous (set state, return immediately).
**Warning signs:** Screenshots showing the wrong stage's content intermittently.

### Pitfall 2: page.route() vs Mock Server Response Mismatch
**What goes wrong:** The browser-side route mock returns "completed" status while the mock server returns stage-appropriate interaction data showing "in_progress." The UI gets confused.
**Why it happens:** page.route() handlers are set up once in `beforeEach` with static responses. They don't automatically track stage changes.
**How to avoid:** Make page.route() handlers dynamically query current stage. Either (a) have handlers fetch `GET /mock/get-stage` from the mock server, or (b) share a mutable reference object that both the capture spec and route handlers can read.
**Warning signs:** UI shows generation spinner but interaction data shows completed content.

### Pitfall 3: Sequence Exhaustion Behavior
**What goes wrong:** A sequence with 3 entries gets polled 5 times. If the implementation returns `undefined` after exhaustion instead of repeating the last entry, the UI breaks.
**Why it happens:** Simple array indexing without bounds clamping.
**How to avoid:** Always clamp to the last index: `seq[Math.min(idx, seq.length - 1)]`. The decision doc explicitly states "last response repeats after exhaustion."
**Warning signs:** Mock server returning `undefined` or empty responses; UI showing error states unexpectedly.

### Pitfall 4: Network Idle Timeout with Active Polling
**What goes wrong:** `page.waitForLoadState("networkidle")` never resolves because the UI is polling `/api/workflows/status` every 3 seconds (as the real app does).
**Why it happens:** The `waitForStableState()` helper waits for network idle, but polling keeps the network active.
**How to avoid:** For steps that involve polling, use `waitForText` instead of network idle. The capture engine should skip network idle wait when the step has polling-related sequences active. Alternatively, the sequence can quickly reach a terminal state (completed/suspended) so polling stops naturally.
**Warning signs:** Playwright timeout errors on `waitForLoadState("networkidle")`.

### Pitfall 5: SSR vs CSR Data Fetching Mismatch
**What goes wrong:** The mock server serves stage-aware data for SSR (Server Actions via `fetchAgent()`), but the client-side re-fetch after navigation gets different data because the browser route mock hasn't been updated.
**Why it happens:** Next.js does SSR on initial page load (hitting mock server), then the client may re-fetch via browser routes (hitting page.route() mocks).
**How to avoid:** Ensure both data paths are stage-aware. The workflow status route (`/api/workflows/status`) is the primary browser-side poll -- it must use sequences or stage-derived status. Interaction data is fetched via Server Actions (SSR) so it hits the mock server directly.
**Warning signs:** Page initially renders correctly then flickers to wrong state after client hydration.

## Code Examples

### Zod Schema Extensions for StepSchema

```typescript
// tutorial-script.ts -- extended StepSchema
export const StepSchema = z.object({
  id: z.string(),
  url: z.string(),
  narration: z.string(),
  actions: z.array(ActionSchema).optional(),
  waitFor: z.string().optional(),
  zoomTarget: z.object({
    selector: z.string(),
    scale: z.number().default(1.5),
  }).optional(),
  mockOverrides: z.record(z.string(), z.unknown()).optional(),
  // Phase 63 additions
  mockStage: z.enum(["idle", "generating", "skeleton", "lowfi", "hifi", "completed"]).optional(),
  waitForText: z.string().optional(),
  resetSequences: z.array(z.string()).optional(),
  delayMs: z.number().optional(),
});

export const TutorialScriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  steps: z.array(StepSchema).min(1),
  fixtures: z.string().optional(),
  // Phase 63 addition
  touchType: z.enum(["touch-1", "touch-2", "touch-3", "touch-4", "pre-call"]).optional(),
});
```

### Stage Fixture Zod Schema

```typescript
// fixtures/types.ts -- new schemas for stage and sequence files

export const StageFixtureSchema = z.object({
  interactions: z.array(InteractionFixtureSchema).optional(),
  // Can override any FixtureSet field
  companies: z.array(CompanyFixtureSchema).optional(),
  deals: z.array(DealFixtureSchema).optional(),
  users: z.array(UserFixtureSchema).optional(),
  templates: z.array(TemplateFixtureSchema).optional(),
}).passthrough(); // Allow additional keys for extensibility

export type StageFixture = z.infer<typeof StageFixtureSchema>;

export const SequenceResponseSchema = z.object({
  status: z.string().optional(),
  runId: z.string().optional(),
  steps: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
}).passthrough();

export const SequenceFileSchema = z.array(SequenceResponseSchema).min(1);
export type SequenceFile = z.infer<typeof SequenceFileSchema>;
```

### Fixture Loader Extensions

```typescript
// fixtures/loader.ts -- new functions

export function loadStageFixtures(
  tutorialName: string,
  stage: string
): Partial<FixtureSet> | null {
  const stagePath = path.join(FIXTURES_DIR, tutorialName, "stages", `${stage}.json`);
  const stageData = loadJsonFile<Partial<FixtureSet>>(stagePath);
  if (!stageData) return null;

  // Validate at load time
  StageFixtureSchema.parse(stageData);
  return stageData;
}

export function loadSequences(
  tutorialName: string
): Record<string, unknown[]> {
  const seqDir = path.join(FIXTURES_DIR, tutorialName, "sequences");
  if (!fs.existsSync(seqDir)) return {};

  const sequences: Record<string, unknown[]> = {};
  const files = fs.readdirSync(seqDir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const key = file.replace(".json", "");
    const data = loadJsonFile<unknown[]>(path.join(seqDir, file));
    if (data) {
      SequenceFileSchema.parse(data);
      sequences[key] = data;
    }
  }

  return sequences;
}
```

### Pilot Touch 4 Script Structure

```json
{
  "id": "touch-4-hitl",
  "title": "Touch 4: Transcript-to-Proposal Pipeline",
  "description": "Generate a full proposal deck, talk track, and buyer FAQ from a meeting transcript using the 6-phase HITL pipeline.",
  "touchType": "touch-4",
  "fixtures": "touch-4-hitl",
  "steps": [
    {
      "id": "step-001",
      "url": "/deals/deal-001/touch/4",
      "narration": "Navigate to the Touch 4 page for the Meridian Dynamics deal.",
      "mockStage": "idle",
      "waitFor": "main"
    },
    {
      "id": "step-002",
      "url": "/deals/deal-001/touch/4",
      "narration": "Click Generate to start the proposal pipeline. The system begins analyzing the transcript.",
      "mockStage": "generating",
      "waitForText": "Generating",
      "actions": [{ "type": "click", "selector": "[data-testid='generate-btn']" }]
    },
    {
      "id": "step-003",
      "url": "/deals/deal-001/touch/4",
      "narration": "The skeleton outline is ready for review. Each section shows bullet-point key themes.",
      "mockStage": "skeleton",
      "waitForText": "Outline"
    },
    {
      "id": "step-004",
      "url": "/deals/deal-001/touch/4",
      "narration": "After approving the outline, the draft is generated with rough prose for each section.",
      "mockStage": "lowfi",
      "waitForText": "Draft",
      "actions": [{ "type": "click", "selector": "[data-testid='approve-stage-btn']" }]
    },
    {
      "id": "step-005",
      "url": "/deals/deal-001/touch/4",
      "narration": "The final polished version is ready. Review the complete proposal, talk track, and FAQ.",
      "mockStage": "hifi",
      "waitForText": "Final",
      "actions": [{ "type": "click", "selector": "[data-testid='approve-stage-btn']" }]
    },
    {
      "id": "step-006",
      "url": "/deals/deal-001/touch/4",
      "narration": "All three artifacts are complete and saved to Google Drive.",
      "mockStage": "completed",
      "waitForText": "Saved to Drive"
    }
  ]
}
```

## Discretion Recommendations

### Full `/mock/reset` vs Fresh Server
**Recommendation:** Include `POST /mock/reset`. The capture.ts lifecycle already creates a fresh mock server per tutorial, but `/mock/reset` is cheap to implement (3 lines) and enables future optimizations where multiple tutorials share a server instance. The reset should clear `currentStage` to `"idle"` and zero all sequence counters.

### `mockOverrides` Stage Extensions
**Recommendation:** Keep `mockStage` + flat `mockOverrides` combination. Do NOT add stage-keyed extensions to `mockOverrides`. The `stages/` directory already provides stage-specific fixture data. If a step needs both a stage AND per-step overrides, the merge order is: shared -> tutorial overrides -> stage fixtures -> step mockOverrides. This keeps the schema simple.

### Mock Server Architecture
**Recommendation:** Use module-level mutable variables (`let currentStage`, `const sequenceCounters`) in mock-server.ts. The server is single-tenant (one tutorial at a time), single-threaded (Node.js event loop), and short-lived (capture.ts kills it after each tutorial). Class-based state management or external state stores are unnecessary complexity.

## Open Questions

1. **Touch 4 UI Selectors**
   - What we know: The touch page has approve/reject buttons, stage stepper, and content display areas
   - What's unclear: Exact `data-testid` attributes on Touch 4 HITL buttons (approve-stage-btn, etc.)
   - Recommendation: During implementation, inspect the real touch page component to confirm selectors. The pilot script selectors may need adjustment.

2. **Stage Content Realism**
   - What we know: Skeleton = bullet outlines, lowfi = rough prose, hifi = polished final
   - What's unclear: Exact format of `stageContent` JSON for each stage (the real app stores it as a JSON string in the interaction record)
   - Recommendation: Inspect the real Touch 4 workflow output in the agent code to match the exact stageContent structure. Fixture data should mirror this structure.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all Phase 62 files (mock-server.ts, route-mocks.ts, tutorial-script.ts, capture.ts, getting-started.spec.ts, loader.ts, types.ts, factories.ts, determinism.ts, screenshot.ts)
- Direct codebase inspection of real app files (touch-page-client.tsx, hitl-stage-stepper.tsx, touch-context-provider.tsx, workflows/status/route.ts)
- Phase 63 CONTEXT.md with locked implementation decisions

### Secondary (MEDIUM confidence)
- Playwright page.route() and waitForFunction behavior (well-documented API, verified against existing usage in route-mocks.ts)

## Metadata

**Confidence breakdown:**
- Architecture: HIGH - All extension points clearly identified in existing codebase; patterns follow Phase 62 conventions
- Stage management: HIGH - Simple in-memory state in single-tenant server; well-understood pattern
- Sequence implementation: HIGH - Straightforward array + counter pattern; behavior explicitly specified in CONTEXT.md
- Pilot fixture content: MEDIUM - Stage content structure needs verification against real app data

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable infrastructure, not dependent on fast-moving libraries)
