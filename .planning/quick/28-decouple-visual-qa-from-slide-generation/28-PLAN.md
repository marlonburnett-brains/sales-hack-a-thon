---
type: quick
task: 28
name: Decouple visual QA from slide generation
autonomous: true
files_modified:
  - apps/agent/src/generation/route-strategy.ts
  - apps/agent/src/mastra/index.ts
  - apps/agent/src/generation/visual-qa.ts
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
  - apps/web/src/components/touch/visual-qa-overlay.tsx
  - apps/web/src/components/touch/visual-qa-dialog.tsx
  - apps/agent/src/lib/regenerate-stage.ts
---

<objective>
Decouple visual QA from the slide generation pipeline so that:
1. Final slides are generated ONCE regardless of visual QA preference
2. User navigates to the final slides screen immediately after generation (not after QA)
3. Visual QA runs as a background process ON TOP of the already-generated deck
4. A real-time overlay shows QA progress and actions as they happen
5. If visual QA was not enabled, a button allows triggering it on-demand

Purpose: Currently visual QA blocks the generation pipeline (step 7 in `executeStructureDrivenPipeline`). This creates unnecessary wait time. Visual QA should be a post-generation overlay that edits the same document in real-time while the user can already see and interact with the final deck.

Output: Modified pipeline that returns immediately after modifications, new API endpoint for on-demand visual QA, new frontend overlay component showing QA status in real-time.
</objective>

<context>
@apps/agent/src/generation/route-strategy.ts (pipeline orchestration - visual QA is step 7, blocking)
@apps/agent/src/generation/visual-qa.ts (performVisualQA function)
@apps/agent/src/mastra/index.ts (agent routes - needs new visual-qa endpoint)
@apps/agent/src/lib/regenerate-stage.ts (retryGeneration also passes enableVisualQA inline)
@apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx (main UI)
@apps/web/src/components/touch/visual-qa-dialog.tsx (pre-generation QA toggle dialog)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove visual QA from pipeline, add standalone API endpoint and SSE streaming</name>
  <files>
    apps/agent/src/generation/route-strategy.ts
    apps/agent/src/generation/visual-qa.ts
    apps/agent/src/mastra/index.ts
    apps/agent/src/lib/regenerate-stage.ts
  </files>
  <action>
**1a. Remove visual QA from `executeStructureDrivenPipeline` in `route-strategy.ts`:**
- Delete the entire Step 7 block (lines 307-327) that calls `performVisualQA`. The pipeline should return `assemblyResult` immediately after step 6 (executeModifications). Remove the `enableVisualQA` param from `ExecutePipelineParams` and its destructuring. The pipeline no longer knows about visual QA at all.

**1b. Remove `enableVisualQA` from `retryGeneration` in `regenerate-stage.ts`:**
- Remove `enableVisualQA` parameter from `retryGeneration` function signature.
- Remove `enableVisualQA: enableVisualQA ?? inputs.enableVisualQA` from the `executeStructureDrivenPipeline` call (line 382). The pipeline no longer accepts it.

**1c. Enhance `performVisualQA` in `visual-qa.ts` to support real-time streaming via the `onLog` callback:**
- The `onLog` callback parameter already exists on `performVisualQA` but is never called. Wire it in:
  - Call `onLog?.("autofit", "Applying autofit to N elements")` after autofit.
  - Call `onLog?.("checking", `Checking slide ${slideObjectId} for issues`)` before each overlap check.
  - Call `onLog?.("issue_found", JSON.stringify(issues))` when issues are found.
  - Call `onLog?.("correcting", `Applying corrections to ${plan.modifications.length} elements`)` before correction pass.
  - Call `onLog?.("complete", JSON.stringify(result))` at the end.

**1d. Add a new POST route in `mastra/index.ts` at path `/visual-qa/run`:**
- Accepts JSON body: `{ presentationId: string, interactionId: string }`
- Returns an SSE stream (Content-Type: text/event-stream).
- Looks up the interaction record to get its `modifiedPlans` from the execution context. Since modification plans aren't persisted, query the presentation's slides and build `modifiedPlans` by:
  - Reading the interaction's stageContent (which at "ready" stage has `presentationId`).
  - Getting all slides from the presentation via Slides API.
  - Creating a minimal ModificationPlan[] where each slide is included (slideObjectId from the API, empty modifications array for autofit-only, or re-plan modifications if needed).
  - Actually, the simpler approach: store `activePlans` (the modification plans with element IDs) in the interaction record when generation completes. Add a new field `modificationPlans` to the InteractionRecord update in both `executeStructureDrivenPipeline` (route-strategy.ts, around line 298-302 where it logs execution results) and `retryGeneration` (regenerate-stage.ts, around line 393-410).
  - In `route-strategy.ts`, after `executeModifications` succeeds, persist `activePlans` to the interaction record. Since this function doesn't have `interactionId`, pass it through `ExecutePipelineParams` as an optional field. The callers (touch workflows, retryGeneration) should pass it.
  - Alternative simpler approach: Just persist the activePlans JSON alongside the stageContent update in `retryGeneration` (line 393-410) by adding a `modificationPlans` key to the stageContent JSON. For the HITL workflow path in `structure-driven-workflow.ts`, persist it in `executeAndRecordFinalStep`.

**Simplest viable approach for storing modification plans:**
- In `route-strategy.ts` `executeStructureDrivenPipeline`: Return `activePlans` as part of the result. Extend `AssembleDeckResult` return to include `modificationPlans?: ModificationPlan[]`. Actually, just return a new object that spreads assemblyResult and adds `modificationPlans: activePlans`.
- In the callers that persist to DB (retryGeneration, executeAndRecordFinalStep), serialize `result.modificationPlans` into a `modificationPlans` key in the stageContent JSON when hitlStage=ready.

**For the SSE endpoint:**
```typescript
registerApiRoute(mastra, router, "POST", "/visual-qa/run", async (req) => {
  const body = await req.json();
  const { presentationId, interactionId } = body;

  // Load modification plans from interaction stageContent
  const interaction = await prisma.interactionRecord.findUniqueOrThrow({
    where: { id: interactionId },
  });
  const stageContent = JSON.parse(interaction.stageContent ?? "{}");
  const modifiedPlans = stageContent.modificationPlans ?? [];

  // Get pooled auth
  const pooled = await getPooledGoogleAuth();
  const authOptions = pooled.accessToken ? { accessToken: pooled.accessToken } : undefined;

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await performVisualQA(
          { presentationId, modifiedPlans, authOptions },
          (type, detail) => send("log", { type, detail, timestamp: Date.now() }),
        );
        send("complete", result);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
```

Also update the existing `/interactions/:id/retry-generation` route to remove `enableVisualQA` from the body parsing (it's no longer used).

**1e. Update `executeStructureDrivenPipeline` return type:**
- Change the return to `assemblyResult & { modificationPlans: ModificationPlan[] }` by spreading: `return { ...assemblyResult, modificationPlans: activePlans }`.
- Update the function signature return type accordingly.

**1f. Persist modification plans in callers:**
- In `retryGeneration` (regenerate-stage.ts), after `executeStructureDrivenPipeline` returns, include `modificationPlans: result.modificationPlans` in the stageContent JSON that gets written at line 399.
- In `executeAndRecordFinalStep` (structure-driven-workflow.ts), after `executeModifications`, serialize the plans into the final InteractionRecord update. The modification plans come from `inputData.modificationPlans`.
  </action>
  <verify>
    TypeScript compilation: `cd apps/agent && npx tsc --noEmit` passes without errors.
  </verify>
  <done>
    - Pipeline returns immediately after text modifications (no visual QA blocking)
    - `performVisualQA` calls `onLog` at each step for real-time streaming
    - New `/visual-qa/run` SSE endpoint accepts presentationId + interactionId and streams QA progress
    - Modification plans are persisted in stageContent for later QA retrieval
    - `enableVisualQA` removed from pipeline params and retry endpoint
  </done>
</task>

<task type="auto">
  <name>Task 2: Add visual QA overlay to the ready-state UI with on-demand trigger</name>
  <files>
    apps/web/src/components/touch/visual-qa-overlay.tsx
    apps/web/src/components/touch/visual-qa-dialog.tsx
    apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
    apps/web/src/lib/actions/touch-actions.ts
  </files>
  <action>
**2a. Create `visual-qa-overlay.tsx` component:**
A floating overlay component that connects to the SSE stream and shows real-time QA progress.

Props:
```typescript
interface VisualQAOverlayProps {
  interactionId: string;
  presentationId: string;
  autoStart: boolean;  // true if user opted in during generation
}
```

Implementation:
- State: `qaStatus: "idle" | "running" | "complete" | "error"`, `logs: Array<{type: string, detail: string, timestamp: number}>`, `result: VisualQAResult | null`, `expanded: boolean` (whether log feed is showing).
- `startQA()` function: Opens an EventSource/fetch to the agent's `/visual-qa/run` endpoint via a Next.js API route proxy (to handle auth). Use `fetch` with streaming reader, not EventSource, since it's a POST.
- If `autoStart` is true, call `startQA()` on mount via useEffect.
- Render as a fixed-position bottom-right floating card:
  - When idle + not autoStart: Show a button "Run Visual QA" (with a sparkle/wand icon).
  - When running: Show a pulsing indicator "Visual QA in progress..." with a chevron to expand the log feed.
  - When expanded: Show a scrollable list of log entries (timestamp + message), auto-scrolling to bottom.
  - When complete with status "clean": Show green badge "Visual QA: All clear" that fades after 5 seconds.
  - When complete with status "corrected": Show blue badge "Visual QA: N corrections applied" with option to expand details. Add a note "Slides updated in real-time - refresh to see changes".
  - When complete with status "warning": Show amber badge "Visual QA: N issues remain" with expandable details.
  - When error: Show red badge with error message and a "Retry" button.

**2b. Add Next.js API route proxy for visual QA SSE:**
Create `apps/web/src/app/api/visual-qa/route.ts`:
- POST handler that proxies to the agent's `/visual-qa/run` endpoint.
- Passes through the auth token from the request cookies/headers (use the same Supabase JWT pattern as other API routes in this project).
- Returns the SSE stream directly.
- Read the agent base URL from `process.env.NEXT_PUBLIC_AGENT_URL` or the existing pattern used by `api-client.ts`.

Actually, check how other streaming endpoints work in this codebase first. Look at the generation-logs polling pattern already in touch-page-client.tsx (line 258-275) - it uses a simple polling GET to `/api/generation-logs`. For visual QA, we can use the same polling pattern instead of SSE for simplicity:
- Add a new route `GET /api/visual-qa/status?interactionId=X` that returns the current QA status.
- But SSE is better for real-time streaming. Keep the SSE approach.

For the proxy, use `fetch` to the agent URL and pipe the response stream through:
```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:4111";
  const token = // extract Supabase JWT from cookie/header

  const response = await fetch(`${agentUrl}/visual-qa/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

Look at how auth is handled in existing API routes (e.g., `apps/web/src/app/api/workflows/status/route.ts` or `apps/web/src/app/api/generation-logs/route.ts`) and follow the same pattern.

**2c. Modify `visual-qa-dialog.tsx`:**
- Change from a pre-generation dialog to a post-generation preference. The dialog should no longer block generation.
- Actually, keep the dialog as-is but change when it's shown. It should now appear as a toggle in the generation form (touch-1-form, touch-2-form, etc.) rather than a blocking dialog. BUT for minimal change: just remove the dialog from the generation flow entirely. The visual QA is always available as on-demand after generation.
- Simplest approach: Remove the VisualQADialog usage from touch-page-client.tsx for the retry flow. The `handleRetryClick` should just call retry directly without asking about QA. Remove `showRetryQADialog` state variable.
- Keep the VisualQADialog component file but repurpose it: it's no longer needed pre-generation. Can delete it or leave it unused.

**2d. Integrate overlay into `touch-page-client.tsx`:**
- Import `VisualQAOverlay` component.
- In the "ready" state render block (line 659-706), add the overlay:
  ```tsx
  <VisualQAOverlay
    interactionId={activeInteraction.id}
    presentationId={parsedStageContent.presentationId}
    autoStart={false}  // always on-demand from ready screen
  />
  ```
- Parse `presentationId` from the ready-state stageContent (it's already there as `stageContent.presentationId`).
- For the generation flow: after generation completes and the user is navigated to the ready screen, if `enableVisualQA` was chosen (stored in the interaction's inputs), pass `autoStart={true}` so QA starts immediately in the background.
- To track the user's QA preference: Store it in the interaction inputs during form submission. Then read it from `activeInteraction.inputs` when rendering the ready state.
- Remove `enableVisualQA` from `retryGenerationAction` params in touch-actions.ts (it's no longer passed to the agent).
- Remove `handleRetryGeneration` callback's `enableVisualQA` parameter. Simplify retry to just call `retryGenerationAction(activeInteraction.id)` directly.
- Remove `showRetryQADialog` state and the `VisualQADialog` usage in the retry flow.
  </action>
  <verify>
    TypeScript compilation: `cd apps/web && npx tsc --noEmit` passes without errors.
    Manual verification: Start the app, generate a deck, confirm immediate navigation to ready screen, confirm "Run Visual QA" button appears, clicking it streams real-time updates.
  </verify>
  <done>
    - New `VisualQAOverlay` component renders as floating card on ready screen
    - On-demand "Run Visual QA" button available when QA wasn't auto-started
    - Real-time log feed shows QA progress (autofit, checking, correcting, complete)
    - QA runs against the already-generated deck, editing it in real-time
    - User sees the final slides immediately without waiting for QA
    - Visual QA dialog removed from pre-generation and retry flows
    - Results show clear status (clean/corrected/warning) with expandable details
  </done>
</task>

</tasks>

<verification>
1. Generate a deck for any touch type - verify user is taken to final slides screen immediately (no QA wait)
2. On the ready screen, verify "Run Visual QA" button appears
3. Click "Run Visual QA" - verify overlay shows real-time progress logs
4. After QA completes, verify the overlay shows the result status (clean/corrected/warning)
5. Verify the Google Slides document was modified in real-time during QA (check for autofit/corrections)
6. Retry a failed generation - verify it no longer asks about visual QA pre-generation
</verification>

<success_criteria>
- Slide generation completes and navigates to ready screen without any visual QA delay
- Visual QA overlay available on-demand from the ready screen
- QA streams real-time progress via SSE
- QA modifies the same Google Slides document that the user is viewing
- No regressions in generation pipeline (all touch types still produce decks)
</success_criteria>

<output>
After completion, create `.planning/quick/28-decouple-visual-qa-from-slide-generation/28-SUMMARY.md`
</output>
