# Phase 63: HITL & Async Mock Capture - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable Playwright to capture multi-stage HITL workflows (Skeleton → Low-fi → High-fi) and polling-based async flows (generation progress, ingestion status) using pre-authored fixture sequences. The mock server gains stateful stage control and sequenced polling responses. A pilot Touch 4 HITL tutorial validates the infrastructure end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Stage Sequencing
- Step-linked stage control: each tutorial script step declares which HITL stage it expects via `mockStage` field
- Control endpoint: capture engine calls `POST /mock/set-stage {stage}` before navigating to set the active stage
- Mock server is stateful — maintains current stage and serves stage-appropriate fixture data
- Unified control: both the Express mock server AND page.route() browser-side mocks read the same stage state
- Capture engine passes current stage to `mockBrowserAPIs()` so workflow status polling returns stage-appropriate data
- Full lifecycle stages: `idle`, `generating`, `skeleton`, `lowfi`, `hifi`, `completed`
- Per-touch-type stage progressions: each touch type (1-4 + pre-call) has its own valid stage sequence (Touch 1 may skip stages that Touch 4 uses)
- Stage-quality content: fixture data at each stage reflects realistic quality progression (skeleton = bullet outlines, lowfi = rough prose, hifi = polished final)
- Static output reference URLs across all stages (same mock Google Slides/Docs URLs — content quality changes but URLs stay constant)

### Polling Simulation
- Sequence arrays: fixtures define ordered arrays of responses per endpoint; each poll pops the next response; last response repeats after exhaustion
- Poll sequences defined in fixture files (version-controlled with the tutorial), not pushed via control endpoint
- Both mock server and page.route() browser-side mocks support sequences (browser-initiated polling to `/api/workflows/status` needs sequences too)
- Named sequences with independent counters: each route pattern (e.g., `workflow-status`, `ingestion-progress`) has its own counter advancing independently
- Per-sequence reset: `POST /mock/reset-sequence {key}` resets a specific sequence counter
- Wait for UI state: capture engine waits for specific UI element/text to appear after polling completes before taking screenshot (not fixed delays or poll counts)
- Verbose sequence logging: mock server logs which sequence response was served (e.g., `[mock-seq] workflow-status: response 2/5 (status=running)`)

### Script Schema Extensions
- `mockStage`: optional enum field on StepSchema (`idle | generating | skeleton | lowfi | hifi | completed`)
- `waitForText`: optional string field on StepSchema — capture engine waits for this text to appear on screen before screenshot
- `resetSequences`: optional string array on StepSchema — resets named sequence counters before step executes
- `touchType`: optional enum field on TutorialScriptSchema (`touch-1 | touch-2 | touch-3 | touch-4 | pre-call`)
- `delayMs`: optional number field on StepSchema — pause before screenshot for UI settling
- No new HITL-specific action types — existing click/fill/select actions target actual UI buttons (approve, reject, etc.)

### Fixture Organization
- `stages/` subdirectory per HITL tutorial: one JSON file per stage (idle.json, generating.json, skeleton.json, lowfi.json, hifi.json, completed.json)
- `sequences/` subdirectory per tutorial with async flows: one JSON array file per route pattern (workflow-status.json, ingestion-progress.json)
- Stage files merged: shared fixtures + overrides + stage-specific data based on current mock stage
- Zod schema validation at load time for stage and sequence files — consistent with Phase 62's fixture validation approach
- Pilot fixture set: minimal Touch 4 HITL tutorial (5-8 steps) exercising full stage progression (idle → generating → skeleton → lowfi → hifi → completed)

### Claude's Discretion
- Whether the control endpoint supports a full `/mock/reset` for all state, or if fresh server per tutorial is sufficient (based on capture.ts lifecycle)
- Whether `mockOverrides` needs stage-keyed extensions or if `mockStage` + flat `mockOverrides` combination covers all cases
- Exact Zod schemas for stage fixture files and sequence arrays
- Pilot tutorial script content and step selectors
- Mock server internal architecture for stage state management

</decisions>

<specifics>
## Specific Ideas

- Verbose sequence logging format: `[mock-seq] {key}: response {n}/{total} (status={value})` for debugging flaky captures
- Stage content should feel like the real AI output quality progression — not lorem ipsum
- Pilot should be Touch 4 because it has the most complex HITL flow (all 3 review stages)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/tutorials/scripts/mock-server.ts`: Express mock server with all 40+ endpoints — needs stage-awareness added to HITL-related routes (interactions, workflows, briefs)
- `apps/tutorials/src/helpers/route-mocks.ts`: `mockBrowserAPIs()` for page.route() interception — needs stage-aware responses for `/api/workflows/status`
- `apps/tutorials/src/types/tutorial-script.ts`: Zod schemas for TutorialScriptSchema and StepSchema — extend with new optional fields
- `apps/tutorials/fixtures/loader.ts`: fixture loader with shared + override merging — extend to load stages/ and sequences/ directories
- `apps/tutorials/fixtures/factories.ts`: fixture factory functions — extend for stage-specific data generation

### Established Patterns
- Mock server returns fixture data loaded via `loadFixtures(tutorialName)` — stage-aware loading follows same pattern
- Tutorial script JSON drives capture loop in `capture/getting-started.spec.ts` — new fields processed in same loop
- Fixture validation against Zod schemas at generation time — extend to load-time validation for stages/sequences
- Control endpoint pattern: mock server already has stateful behavior (fixture loading per tutorial) — stage state is a natural extension

### Integration Points
- `apps/tutorials/scripts/capture.ts`: orchestrates mock server + Next.js + Playwright — needs pre-step stage/sequence control calls
- `apps/tutorials/src/helpers/screenshot.ts`: screenshot capture helper — may need `waitForText` support
- `apps/tutorials/src/helpers/determinism.ts`: determinism utilities — `waitForText` aligns with existing wait strategies

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 63-hitl-async-mock-capture*
*Context gathered: 2026-03-19*
