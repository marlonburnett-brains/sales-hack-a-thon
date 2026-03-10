---
phase: quick-27
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/generation/generation-logger.ts
  - apps/agent/src/generation/structure-driven-workflow.ts
  - apps/agent/src/generation/multi-source-assembler.ts
  - apps/agent/src/generation/modification-planner.ts
  - apps/agent/src/generation/modification-executor.ts
  - apps/agent/src/generation/blueprint-resolver.ts
  - apps/agent/src/generation/section-matcher.ts
  - apps/agent/src/generation/visual-qa.ts
  - apps/agent/src/generation/route-strategy.ts
  - apps/web/src/components/touch/generation-log-feed.tsx
  - apps/web/src/components/touch/generation-progress.tsx
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
  - apps/web/src/app/api/workflows/status/route.ts
autonomous: true
requirements: [QUICK-27]
must_haves:
  truths:
    - "During generation, users see a scrolling log of descriptive status messages with timestamps"
    - "Log messages update every 2 seconds via existing polling"
    - "Logs show user-friendly descriptions, not raw technical output"
    - "All 7 workflow steps produce log entries visible in the UI"
  artifacts:
    - path: "apps/agent/src/generation/generation-logger.ts"
      provides: "Log accumulator singleton with typed LogEntry interface"
    - path: "apps/web/src/components/touch/generation-log-feed.tsx"
      provides: "Scrolling log feed UI component"
  key_links:
    - from: "apps/agent/src/generation/structure-driven-workflow.ts"
      to: "apps/agent/src/generation/generation-logger.ts"
      via: "logger.log() calls in each step execute function"
      pattern: "logger\\.log\\("
    - from: "apps/web/src/app/api/workflows/status/route.ts"
      to: "generation-logger logs in step output"
      via: "WorkflowRunResult.steps[].output.logs"
      pattern: "output\\.logs"
---

<objective>
Stream detailed generation status logs to the UI during deck generation so users can see what's happening at each step of the pipeline.

Purpose: Currently users see a minimal spinner during multi-minute generation. The backend already logs rich progress info (slide operations, content matching, etc.) via console.log, but none reaches the UI. This surfaces those operations as a live, scrolling log feed.

Output: A generation logger utility on the backend that accumulates structured log entries per workflow run, log entries included in step outputs returned via existing polling, and a new GenerationLogFeed component rendering those logs in real-time.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/generation/structure-driven-workflow.ts
@apps/web/src/components/touch/generation-progress.tsx
@apps/web/src/components/touch/pipeline-stepper.tsx
@apps/web/src/app/api/workflows/status/route.ts
@apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
@apps/web/src/lib/api-client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create generation logger and instrument backend workflow steps</name>
  <files>
    apps/agent/src/generation/generation-logger.ts
    apps/agent/src/generation/structure-driven-workflow.ts
    apps/agent/src/generation/multi-source-assembler.ts
    apps/agent/src/generation/modification-planner.ts
    apps/agent/src/generation/modification-executor.ts
    apps/agent/src/generation/blueprint-resolver.ts
    apps/agent/src/generation/section-matcher.ts
    apps/agent/src/generation/visual-qa.ts
    apps/agent/src/generation/route-strategy.ts
  </files>
  <action>
    **1. Create `apps/agent/src/generation/generation-logger.ts`:**

    Create a simple in-memory log accumulator keyed by runId. This is NOT a global singleton -- it should use a module-level Map so logs are scoped per workflow run.

    ```typescript
    export interface GenerationLogEntry {
      timestamp: string;   // ISO string
      step: string;        // e.g. "resolve-and-select-slides", "assemble-multi-source-deck"
      message: string;     // User-friendly message
      detail?: string;     // Optional technical detail (not shown in UI by default)
    }

    // Module-level store: runId -> log entries
    const logStore = new Map<string, GenerationLogEntry[]>();

    export function createRunLogger(runId: string) {
      if (!logStore.has(runId)) logStore.set(runId, []);
      return {
        log(step: string, message: string, detail?: string) {
          logStore.get(runId)!.push({
            timestamp: new Date().toISOString(),
            step,
            message,
            detail,
          });
        },
      };
    }

    export function getRunLogs(runId: string): GenerationLogEntry[] {
      return logStore.get(runId) ?? [];
    }

    export function clearRunLogs(runId: string) {
      logStore.delete(runId);
    }
    ```

    **2. Instrument each workflow step in `structure-driven-workflow.ts`:**

    The challenge is that Mastra workflow steps don't have access to the runId inside `execute`. Instead, use a **context-passing approach**: pass logs through step outputs so each step accumulates and forwards them.

    Actually, the simpler approach: Since each workflow step's `execute` function runs server-side in the same Node process, and Mastra's `createStep` doesn't provide runId in the execute context, use a **thread-local-like pattern** with AsyncLocalStorage:

    ```typescript
    import { AsyncLocalStorage } from "node:async_hooks";
    ```

    Add to `generation-logger.ts`:
    ```typescript
    import { AsyncLocalStorage } from "node:async_hooks";

    const asyncStorage = new AsyncLocalStorage<{ runId: string }>();

    export function withRunContext<T>(runId: string, fn: () => Promise<T>): Promise<T> {
      return asyncStorage.run({ runId }, fn);
    }

    export function log(step: string, message: string, detail?: string) {
      const store = asyncStorage.getStore();
      if (!store) return; // graceful no-op if no context
      const runId = store.runId;
      if (!logStore.has(runId)) logStore.set(runId, []);
      logStore.get(runId)!.push({
        timestamp: new Date().toISOString(),
        step,
        message,
        detail,
      });
    }
    ```

    However, since Mastra manages the workflow execution lifecycle and we don't control how steps are invoked, the AsyncLocalStorage approach won't work directly.

    **USE THE SIMPLEST APPROACH:** Add a `logs` array to each step's output. Each step:
    1. Creates a local `logs: GenerationLogEntry[]` array at the start of execute
    2. Pushes log entries as work progresses
    3. Includes `logs` in the step's return value
    4. The polling endpoint already returns step outputs, so logs flow to the client automatically

    In `structure-driven-workflow.ts`, for each of the 7 steps, add a local logs array and push entries at key points. Update each step's `outputSchema` to include `logs: z.array(z.any()).optional()`.

    **Step 1 (resolveAndSelectSlidesStep):** Add logs:
    - "Resolving deck blueprint for {touchType}..."
    - "Found blueprint with {N} sections"
    - "Selecting best-matching slides for each section..."
    - "Selected {N} slides from {M} source presentations"
    - "Created interaction record"

    **Step 3 (assembleMultiSourceDeckStep):** Add logs:
    - "Preparing deck assembly for {companyName}..."
    - "Fetching slide data from {N} source presentations..."
    - "Building multi-source assembly plan..."
    - "Assembling deck: {deckName}..."
    - "Deck assembled with {N} slides"

    **Step 5 (planAndPrepareModificationsStep):** Add logs:
    - "Planning content modifications for {N} slides..."
    - For each slide: "Planning modifications for slide {i+1}: {sectionName}..."
    - "Planned {totalMods} modifications across {N} slides"

    **Step 7 (executeAndRecordFinalStep):** Add logs:
    - "Executing {N} modification plans..."
    - "Applying text modifications to slides..."
    - "Recording final interaction state..."
    - "Generation complete"

    Steps 2, 4, 6 are suspend/resume steps -- add a simple log:
    - "Awaiting {stage} approval..."

    **3. Instrument helper modules with callback-based logging:**

    For the deep helper modules (`multi-source-assembler.ts`, `modification-executor.ts`, etc.), do NOT refactor them to return logs. Instead, add an optional `onLog?: (message: string, detail?: string) => void` parameter to the key exported functions:

    - `assembleMultiSourceDeck(params, onLog?)` -- log "Copying slide {i} from {presentationId}...", "Removing {N} unused slides..."
    - `executeModifications(params, onLog?)` -- log "Modifying slide {slideObjectId}: {N} text updates...", "Batch update complete for slide {i}"
    - `planSlideModifications(params, onLog?)` -- log "Analyzing slide elements for modifications...", "Found {N} elements to modify"
    - `selectSlidesForBlueprint(params, onLog?)` -- log "Matching candidates for section: {sectionName}...", "Selected slide {slideId} (score: {score})"

    The `onLog` callbacks push into the step's local `logs` array. Keep existing console.log calls as-is (they serve server debugging).

    **Important:** Only add onLog to the top-level exported functions, not to internal helpers. Keep the change surface minimal. If an existing function signature would break, make onLog the last parameter and optional.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - generation-logger.ts exists with GenerationLogEntry type and helpers
    - All 7 workflow steps in structure-driven-workflow.ts include logs in their output
    - Key helper functions accept optional onLog callback
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Create log feed UI component and wire into generation progress display</name>
  <files>
    apps/web/src/components/touch/generation-log-feed.tsx
    apps/web/src/components/touch/generation-progress.tsx
    apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
    apps/web/src/app/api/workflows/status/route.ts
    apps/web/src/lib/api-client.ts
  </files>
  <action>
    **1. Update `WorkflowRunResult` type in `apps/web/src/lib/api-client.ts`:**

    The existing type already has `output?: unknown` in step data. No type change needed -- the logs will be in `steps[stepId].output.logs`. But add a helper type for clarity:

    ```typescript
    export interface GenerationLogEntry {
      timestamp: string;
      step: string;
      message: string;
      detail?: string;
    }
    ```

    **2. Create `apps/web/src/components/touch/generation-log-feed.tsx`:**

    A scrolling log feed component that shows generation progress messages with timestamps.

    Props:
    ```typescript
    interface GenerationLogFeedProps {
      logs: GenerationLogEntry[];
    }
    ```

    Implementation:
    - "use client" component
    - Auto-scroll to bottom when new logs arrive (use useEffect + ref on container)
    - Show each log as a single line: `[HH:MM:SS] message`
    - Use monospace-ish font for timestamps, regular font for messages
    - Container: max-h-48 (or similar) with overflow-y-auto, subtle border, rounded, bg-slate-50
    - Timestamps in text-slate-400, messages in text-slate-700
    - Latest entry should have a subtle pulse/highlight animation (use a CSS transition or Tailwind animate-pulse on the last item for 1 second)
    - If no logs yet, show nothing (don't render the container)
    - The container should have a "Generation Log" small header text above it

    Styling: Keep it compact and professional. Monospace for timestamps (font-mono text-xs), regular text-sm for messages. The whole thing should feel like a condensed activity feed, not a terminal.

    **3. Update `apps/web/src/components/touch/generation-progress.tsx`:**

    Replace the simple skeleton loader with PipelineStepper + GenerationLogFeed.

    Change the component signature to accept optional logs:
    ```typescript
    interface GenerationProgressProps {
      message: string;
      logs?: GenerationLogEntry[];
    }
    ```

    Render: Keep the existing Loader2 spinner + message at top. Below it, render `<GenerationLogFeed logs={logs} />` if logs is provided and non-empty.

    **4. Extract logs from polling response in `touch-page-client.tsx`:**

    In the polling logic (the `startPolling` callback around line 233), after receiving `status` from `checkStatus(currentRunId)`:

    - Extract logs from all step outputs: iterate `Object.values(status.steps ?? {})`, for each step with `output`, check if `output.logs` is an array, and flatten all log arrays into one sorted by timestamp.
    - Store logs in a new state variable: `const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([])`.
    - On each poll tick, update the logs state with the accumulated logs.
    - Pass `generationLogs` to `<GenerationProgress>` when rendering the generating state.
    - Clear `generationLogs` when generation completes or user starts a new generation.

    Find the section where `isGenerating` is true and `<GenerationProgress>` is rendered (search for `GenerationProgress` usage). Update to pass logs prop.

    **5. Also instrument the Touch2Form and Touch3Form polling (if they use their own polling):**

    Looking at `touch-2-form.tsx`, it has its own `pollStatus` function (line 63). In this polling loop, extract logs the same way:
    - After getting `status`, extract logs from `status.steps` outputs
    - The Touch2Form currently only renders `PipelineStepper` during generation. Add `GenerationLogFeed` below the `PipelineStepper` in both the "generating" and "error" states.
    - Add a `const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([])` state.
    - In the pollStatus while loop, after processing steps, extract and set logs.

    Do the same for `touch-3-form.tsx` (it follows the identical pattern).

    **6. No changes needed to `apps/web/src/app/api/workflows/status/route.ts`:**
    The status endpoint already returns the full WorkflowRunResult including step outputs. Logs in step outputs will flow through automatically.

    **Important UI details:**
    - Import GenerationLogEntry from api-client.ts in components that need it
    - The log feed should appear below the pipeline stepper (when both are shown)
    - On the touch-page-client.tsx (structure-driven workflow), the GenerationProgress component is what shows during generation -- enhance it with logs
    - Use `useRef` + `scrollIntoView({ behavior: 'smooth' })` for auto-scroll in the log feed
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - GenerationLogFeed component exists and renders a scrolling log feed
    - GenerationProgress accepts and displays logs
    - touch-page-client.tsx extracts logs from poll responses and passes to GenerationProgress
    - touch-2-form.tsx and touch-3-form.tsx show log feed during generation
    - TypeScript compiles without errors in the web app
  </done>
</task>

</tasks>

<verification>
1. `cd apps/agent && npx tsc --noEmit` -- agent compiles
2. `cd apps/web && npx tsc --noEmit` -- web compiles
3. Manual verification: Start a Touch 2/3 generation and observe the log feed appearing below the pipeline stepper with timestamped messages updating every 2 seconds
</verification>

<success_criteria>
- Backend workflow steps include structured logs in their step output
- Frontend extracts logs from existing polling responses (no new endpoints or SSE)
- Users see a scrolling, timestamped log feed during generation showing descriptive messages like "Selecting slides from template library...", "Assembling deck with 8 slides...", "Applying text modifications to slide 3..."
- Existing pipeline stepper continues to work alongside the new log feed
- No regressions in generation flow
</success_criteria>

<output>
After completion, create `.planning/quick/27-stream-detailed-generation-status-logs-t/27-SUMMARY.md`
</output>
