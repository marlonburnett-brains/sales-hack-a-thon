# Phase 56: HITL Integration - Research

**Researched:** 2026-03-09
**Domain:** Mastra workflow suspend/resume, structure-driven generation pipeline HITL mapping
**Confidence:** HIGH

## Summary

Phase 56 maps the 3-stage HITL workflow (skeleton/lowfi/highfi) to the new structure-driven generation pipeline built in Phases 50-55. The existing codebase already has a well-established suspend/resume pattern used by all four touch workflows. The task is to define new suspend/resume payloads that carry the new pipeline's data types (GenerationBlueprint, SlideSelectionPlan, ModificationPlan) through the same mechanical pattern.

The key insight is that FR-7.7 explicitly requires reusing the existing Mastra suspend/resume mechanism -- only the data payloads change. This means Phase 56 does NOT create new workflow files or new HITL infrastructure. Instead, it creates a new "structure-driven" workflow (or workflow variant) that uses the same `createStep`/`suspend`/`resumeData` pattern but carries blueprint/assembly/modification data through the three stages.

**Primary recommendation:** Create a single `structure-driven-workflow.ts` that orchestrates the full pipeline (resolve blueprint -> select slides -> SUSPEND skeleton -> assemble multi-source deck -> SUSPEND lowfi -> plan modifications -> execute modifications -> SUSPEND highfi -> record interaction), following the exact same step/suspend/resume pattern established in touch-1-workflow.ts through touch-3-workflow.ts.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-7.1 | Skeleton stage: Present GenerationBlueprint with selected slides, thumbnails, match rationale | Blueprint from `resolveBlueprint()` + section matcher output from `selectSlidesForBlueprint()`. ResolvedCandidate has `thumbnailUrl` and SlideSelectionEntry has `matchRationale`. Suspend payload carries these. |
| FR-7.2 | Skeleton stage: Allow seller to swap selections, toggle optional sections, reorder sections | Resume payload accepts modified SectionSlot array (swapped selectedSlideId, toggled isOptional, reordered sections). Downstream re-derives SlideSelectionPlan from approved blueprint. |
| FR-7.3 | Low-fi stage: Present assembled multi-source Google Slides deck URL | `assembleMultiSourceDeck()` returns `{ presentationId, driveUrl }`. Suspend payload carries these. |
| FR-7.4 | Low-fi stage: Allow seller to approve or request changes | Resume payload accepts "approved" or "request_changes". On changes, can trigger re-assembly with modified selections. |
| FR-7.5 | High-fi stage: Present modification plan summary | `planSlideModifications()` returns ModificationPlan[] per slide. Suspend payload carries summary of elements to change. |
| FR-7.6 | High-fi stage: Execute approved modifications and present final deck URL | `executeModifications()` applies plans. Final suspend payload carries presentationId + driveUrl of modified deck. |
| FR-7.7 | Reuse existing Mastra suspend/resume pattern | Same `createStep`/`createWorkflow`/`.then()` chain, same `suspend()`/`resumeData` mechanics, same `suspendSchema`/`resumeSchema` declarations. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | existing | Workflow steps, suspend/resume | Already used in all 5 workflows |
| zod | existing | Schema definitions for suspend/resume payloads | Already used in all workflows |
| @lumenalta/schemas | existing | Shared types (GenerationBlueprint, SectionSlot, SlideSelectionPlan, DealContext) | Phase 50 types |
| prisma | existing | InteractionRecord hitlStage/stageContent updates | Already used in all workflows |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| apps/agent/src/generation/blueprint-resolver | Phase 51 | resolveBlueprint() -> BlueprintWithCandidates | Skeleton stage generation |
| apps/agent/src/generation/section-matcher | Phase 54 | selectSlidesForBlueprint() -> SectionMatchResult | Skeleton stage slide selection |
| apps/agent/src/generation/multi-source-assembler | Phase 52 | buildMultiSourcePlan() + assembleMultiSourceDeck() | Low-fi stage assembly |
| apps/agent/src/generation/modification-planner | Phase 53 | planSlideModifications() | High-fi stage planning |
| apps/agent/src/generation/modification-executor | Phase 55 | executeModifications() | High-fi stage execution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single workflow file | Per-touch workflow variants | Per-touch adds 4x duplication; single workflow parameterized by touchType is cleaner since the pipeline is identical across touches |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
├── generation/
│   ├── structure-driven-workflow.ts   # NEW: The HITL workflow
│   ├── blueprint-resolver.ts          # Phase 51 (existing)
│   ├── section-matcher.ts             # Phase 54 (existing)
│   ├── multi-source-assembler.ts      # Phase 52 (existing)
│   ├── modification-planner.ts        # Phase 53 (existing)
│   ├── modification-executor.ts       # Phase 55 (existing)
│   └── types.ts                       # Agent-only types (existing)
├── mastra/
│   └── index.ts                       # Register new workflow (modify)
apps/web/src/
├── components/touch/
│   └── touch-stage-content.tsx         # Update skeleton/lowfi/highfi renderers
├── lib/actions/
│   └── touch-actions.ts               # Add structure-driven workflow actions
└── lib/
    └── api-client.ts                  # Add structure-driven workflow API calls
```

### Pattern 1: Suspend/Resume Step Pattern (Established)
**What:** Each HITL gate is a `createStep` with `suspendSchema`, `resumeSchema`, and the `if (!resumeData) suspend()` guard.
**When to use:** Every HITL boundary.
**Example:**
```typescript
// Source: apps/agent/src/mastra/workflows/touch-1-workflow.ts (lines 142-195)
const awaitSkeletonApproval = createStep({
  id: "await-skeleton-approval",
  inputSchema: z.object({ /* ... */ }),
  outputSchema: z.object({ /* ... */ }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedContent: SkeletonContentSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("skeleton"),
    content: SkeletonContentSchema,
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({ stage: "skeleton", content: inputData.skeletonContent, /* ... */ });
    }
    const approvedSkeleton = resumeData.refinedContent ?? inputData.skeletonContent;
    // ... update DB, return approved data
  },
});
```

### Pattern 2: InteractionRecord Stage Tracking (Established)
**What:** Every stage transition updates `InteractionRecord.hitlStage` and `stageContent`.
**When to use:** Before every suspend and on final completion.
**Example:**
```typescript
// Update hitlStage and persist stage-specific content as JSON
await prisma.interactionRecord.update({
  where: { id: inputData.interactionId },
  data: {
    hitlStage: "skeleton",
    stageContent: JSON.stringify(skeletonData),
  },
});
```

### Pattern 3: Workflow Chaining (Established)
**What:** Steps chained with `.then()` on the workflow object.
**When to use:** Workflow definition.
**Example:**
```typescript
export const structureDrivenWorkflow = createWorkflow({
  id: "structure-driven-workflow",
  inputSchema,
  outputSchema,
})
  .then(resolveAndSelectSlides)       // Blueprint + Section Matcher
  .then(awaitSkeletonApproval)        // SUSPEND 1
  .then(assembleMultiSourceDeck)      // Multi-source assembly
  .then(awaitLowfiApproval)           // SUSPEND 2
  .then(planAndPrepareModifications)  // Modification planning
  .then(awaitHighfiApproval)          // SUSPEND 3
  .then(executeAndRecordFinal)        // Execute mods + record
  .commit();
```

### Anti-Patterns to Avoid
- **Duplicating pipeline logic inside workflow steps:** Each step should call the existing Phase 51-55 functions, NOT reimplement their logic. The workflow steps are orchestration glue only.
- **Creating per-touch workflow variants:** The structure-driven pipeline is touch-type agnostic. The touchType is a parameter, not a workflow fork.
- **Breaking the suspend contract:** The frontend relies on `stage` field in the suspend payload being one of `"skeleton" | "lowfi" | "highfi"`. Do not introduce new stage names.
- **Storing large data in stageContent:** The stageContent JSON goes to the DB and is fetched by the frontend on page load. Keep it to summaries, thumbnails URLs, rationales -- not full element maps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blueprint resolution | Custom DeckStructure parser | `resolveBlueprint()` from Phase 51 | Already handles query batching, template resolution, null fallback |
| Slide selection | Manual scoring in workflow step | `selectSlidesForBlueprint()` from Phase 54 | Has metadata scoring, vector tiebreaking, prior-touch exclusion |
| Multi-source assembly | Direct Google API calls in step | `assembleMultiSourceDeck()` from Phase 52 | Handles primary/secondary sources, temp cleanup, reordering |
| Modification planning | Inline LLM prompting | `planSlideModifications()` from Phase 53 | Has hallucination guard, post-validation, fallback handling |
| Modification execution | Direct batchUpdate calls | `executeModifications()` from Phase 55 | Handles objectId drift, per-slide failure isolation, element validation |
| Workflow mechanics | Custom suspend/resume protocol | Mastra `createStep` with `suspend()`/`resumeData` | Battle-tested in 5 existing workflows |

**Key insight:** Phase 56 is purely an orchestration layer. All the hard logic already exists in Phases 51-55. The workflow steps should be thin wrappers that call existing functions and shape data for suspend payloads.

## Common Pitfalls

### Pitfall 1: Stale Blueprint Data After Skeleton Approval
**What goes wrong:** Seller swaps a slide selection at skeleton stage, but the downstream assembly step still uses the original SlideSelectionPlan.
**Why it happens:** The resume payload with the seller's changes is not properly threaded to the assembly step.
**How to avoid:** When the seller approves with modifications (swapped slides, toggled sections, reordered sections), re-derive the SlideSelectionPlan from the modified SectionSlot array. The assembly step must consume the approved selections, not the original ones.
**Warning signs:** Assembly produces a deck with slides the seller deselected.

### Pitfall 2: Oversized stageContent JSON
**What goes wrong:** Storing full ResolvedCandidate objects (with classificationJson, embedding references) in `InteractionRecord.stageContent` causes slow page loads.
**Why it happens:** The skeleton suspend payload includes all candidate data for rendering.
**How to avoid:** For skeleton stageContent, store only: sectionName, selectedSlideId, thumbnailUrl, matchRationale, isOptional, candidateSlideIds (IDs only, not full objects). The frontend does NOT need classificationJson or confidence scores.
**Warning signs:** stageContent JSON exceeds 50KB.

### Pitfall 3: Missing Workflow Registration
**What goes wrong:** New workflow is not accessible via API because it was not registered in `apps/agent/src/mastra/index.ts`.
**Why it happens:** Forgetting to add the workflow to the Mastra instance's workflow registry.
**How to avoid:** Import and register the workflow in `index.ts` just like `touch1Workflow` through `touch4Workflow`.
**Warning signs:** 404 when attempting to start or check status of the workflow.

### Pitfall 4: Frontend Touch Type Routing Gap
**What goes wrong:** The new workflow is backend-ready but the frontend cannot start or poll it.
**Why it happens:** `touch-page-client.tsx` has hardcoded switch statements for touch types (getStatusChecker, startGeneration) that don't know about the new workflow.
**How to avoid:** This is Phase 57 routing work. Phase 56 focuses on the workflow itself. But the workflow MUST be testable via direct API calls.
**Warning signs:** N/A for Phase 56 -- this is Phase 57 scope.

### Pitfall 5: Resume Payload Schema Mismatch
**What goes wrong:** Frontend sends a resume payload that doesn't match the workflow step's `resumeSchema`, causing Zod parse failure.
**Why it happens:** The suspend and resume schemas are defined in the workflow file but the frontend constructs payloads independently.
**How to avoid:** Define the resume payload shapes in a shared location or document them clearly. Test resume payloads with unit tests.
**Warning signs:** Zod validation errors on workflow resume.

## Code Examples

### Structure-Driven Workflow Skeleton Stage Suspend Payload
```typescript
// What gets sent to the frontend when skeleton stage suspends
const skeletonSuspendPayload = {
  stage: "skeleton" as const,
  interactionId: interaction.id,
  dealId: dealContext.dealId,
  blueprint: {
    touchType: blueprint.touchType,
    sequenceRationale: blueprint.sequenceRationale,
    sections: blueprint.sections.map(section => ({
      sectionName: section.sectionName,
      purpose: section.purpose,
      isOptional: section.isOptional,
      selectedSlideId: section.selectedSlideId,
      sourcePresentationId: section.sourcePresentationId,
      candidateSlideIds: section.candidateSlideIds,
    })),
  },
  selections: plan.selections.map(sel => ({
    sectionName: sel.sectionName,
    slideId: sel.slideId,
    matchRationale: sel.matchRationale,
    thumbnailUrl: candidates.get(sel.slideId)?.thumbnailUrl ?? null,
  })),
};
```

### Structure-Driven Workflow Skeleton Resume Payload
```typescript
// What the frontend sends back to approve/modify skeleton
const skeletonResumePayload = {
  decision: "approved" as const, // or "refined"
  // Only present when decision is "refined":
  refinedBlueprint: {
    sections: [
      // Reordered, toggled, or with swapped selectedSlideId
      {
        sectionName: "Introduction",
        isOptional: false,
        selectedSlideId: "slide-abc-123", // may be swapped
        candidateSlideIds: ["slide-abc-123", "slide-def-456"],
      },
      // ... other sections
    ],
  },
};
```

### Low-fi Stage Suspend Payload
```typescript
// After multi-source assembly completes
const lowfiSuspendPayload = {
  stage: "lowfi" as const,
  interactionId: inputData.interactionId,
  dealId: inputData.dealId,
  presentationId: assemblyResult.presentationId,
  driveUrl: assemblyResult.driveUrl,
  slideCount: approvedSections.length,
};
```

### High-fi Stage Suspend Payload
```typescript
// After modification planning completes
const highfiSuspendPayload = {
  stage: "highfi" as const,
  interactionId: inputData.interactionId,
  dealId: inputData.dealId,
  presentationId: inputData.presentationId,
  driveUrl: inputData.driveUrl,
  modificationSummary: plans.map(plan => ({
    slideId: plan.slideId,
    modificationCount: plan.modifications.length,
    elements: plan.modifications.map(mod => ({
      elementId: mod.elementId,
      reason: mod.reason,
      // Truncated preview of what changes
      preview: `${mod.currentContent.slice(0, 50)} -> ${mod.newContent.slice(0, 50)}`,
    })),
  })),
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Touch 1: LLM generates content, then assembles from template | Structure-driven: Blueprint resolves sections, matcher selects slides from multiple sources | Phase 50-55 (current milestone) | Skeleton stage now shows section/slide selections instead of text outline |
| Touch 2/3: AI selects slides from single source, copy-and-prune | Structure-driven: Multi-source assembly with secondary slide injection | Phase 52 | Low-fi stage now shows assembled multi-source deck instead of single-source |
| No modification planning | Element-map-guided surgical modifications via LLM | Phase 53/55 | High-fi stage now has modification plan summary to approve |

**Deprecated/outdated:**
- Legacy HITL stages in touch-1/2/3-workflow.ts will remain for fallback (FR-9.4) but the structure-driven workflow is the new primary path

## Open Questions

1. **Frontend rendering of skeleton stage blueprint**
   - What we know: The current `TouchStageContent` has renderers for skeleton/lowfi/highfi per touch type. The structure-driven workflow has a different skeleton payload shape (sections + candidates + thumbnails).
   - What's unclear: Whether Phase 56 scope includes updating the frontend renderers or if that's Phase 57 (routing).
   - Recommendation: Phase 56 should define the suspend/resume payloads and workflow. Frontend rendering updates are minimal glue work -- include basic rendering in Phase 56 so the workflow is testable end-to-end, but defer polish to Phase 57.

2. **Re-assembly on low-fi rejection**
   - What we know: FR-7.4 says seller can "request changes" at low-fi stage, which "triggers re-assembly or section-level adjustments."
   - What's unclear: Does "request changes" loop back to skeleton? Or does it accept section-level swaps and re-assemble inline?
   - Recommendation: On "request_changes", loop back to skeleton stage. This is simpler and consistent with the revert pattern already in the codebase (revertStageAction). Avoid building inline section-level re-assembly which would be complex and is not explicitly required.

3. **How the workflow is started (Phase 57 coupling)**
   - What we know: Phase 57 (Touch-Type Routing) will route touches to this workflow when a DeckStructure exists.
   - What's unclear: What input the workflow expects at start time (just dealId + touchType, or full DealContext?).
   - Recommendation: The workflow should accept `{ dealId, touchType, artifactType? }` and resolve DealContext internally from the deal record, matching the pattern used by existing workflows.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing in apps/agent) |
| Config file | apps/agent/vitest.config.ts |
| Quick run command | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FR-7.1 | Skeleton suspend payload contains blueprint sections, thumbnails, rationale | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "skeleton suspend"` | No - Wave 0 |
| FR-7.2 | Resume with refined sections re-derives SlideSelectionPlan | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "skeleton resume"` | No - Wave 0 |
| FR-7.3 | Low-fi suspend payload contains presentationId and driveUrl | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "lowfi suspend"` | No - Wave 0 |
| FR-7.4 | Low-fi resume with "request_changes" loops back | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "lowfi changes"` | No - Wave 0 |
| FR-7.5 | High-fi suspend payload contains modification plan summary | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "highfi suspend"` | No - Wave 0 |
| FR-7.6 | High-fi resume executes modifications and returns final URL | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "highfi execute"` | No - Wave 0 |
| FR-7.7 | Workflow uses standard createStep/suspend/resume pattern | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "mastra pattern"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts`
- **Per wave merge:** `cd apps/agent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/generation/__tests__/structure-driven-workflow.test.ts` -- covers FR-7.1 through FR-7.7
- [ ] Test mocks for `resolveBlueprint`, `selectSlidesForBlueprint`, `assembleMultiSourceDeck`, `planSlideModifications`, `executeModifications`

## Sources

### Primary (HIGH confidence)
- Existing workflow files: `touch-1-workflow.ts`, `touch-2-workflow.ts`, `touch-3-workflow.ts` -- suspend/resume pattern reference
- Phase 50-55 implementation files: `blueprint-resolver.ts`, `section-matcher.ts`, `multi-source-assembler.ts`, `modification-planner.ts`, `modification-executor.ts` -- function signatures and return types
- `packages/schemas/generation/types.ts` -- shared type contracts

### Secondary (MEDIUM confidence)
- Frontend files: `touch-page-client.tsx`, `touch-stage-content.tsx`, `touch-actions.ts`, `api-client.ts` -- UI integration patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries and patterns are already in the codebase
- Architecture: HIGH - Direct extension of established workflow patterns
- Pitfalls: HIGH - Identified from reading actual workflow code and understanding data flow

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- internal codebase patterns, no external dependency flux)
