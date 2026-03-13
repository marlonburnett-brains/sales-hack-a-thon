---
phase: quick-31
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/mastra/workflows/touch-2-workflow.ts
  - apps/agent/src/mastra/workflows/touch-3-workflow.ts
  - apps/agent/src/generation/route-strategy.ts
autonomous: true
requirements: [CONTEXT-PERSIST-01, CONTEXT-QUERY-02, CONTEXT-LIMIT-03]

must_haves:
  truths:
    - "Touch 1-3 context input strings are persisted as DealContextSource records after InteractionRecord creation"
    - "queryTranscriptInsights returns note and upload source types alongside transcripts"
    - "Up to 5 transcript insights are included in deal context instead of 3"
  artifacts:
    - path: "apps/agent/src/mastra/workflows/touch-1-workflow.ts"
      provides: "DealContextSource persist for touch 1 context"
      contains: "sourceType.*note"
    - path: "apps/agent/src/mastra/workflows/touch-2-workflow.ts"
      provides: "DealContextSource persist for touch 2 context"
      contains: "sourceType.*note"
    - path: "apps/agent/src/mastra/workflows/touch-3-workflow.ts"
      provides: "DealContextSource persist for touch 3 context"
      contains: "sourceType.*note"
    - path: "apps/agent/src/generation/route-strategy.ts"
      provides: "Broadened source type filter and increased limit"
      contains: "in.*transcript.*note.*upload"
  key_links:
    - from: "touch-1-workflow.ts generateContent step"
      to: "DealContextSource table"
      via: "prisma.dealContextSource.create after InteractionRecord create"
      pattern: "dealContextSource\\.create"
    - from: "touch-2-workflow.ts selectSlides step"
      to: "DealContextSource table"
      via: "prisma.dealContextSource.create after InteractionRecord create"
      pattern: "dealContextSource\\.create"
    - from: "touch-3-workflow.ts selectSlides step"
      to: "DealContextSource table"
      via: "prisma.dealContextSource.create after InteractionRecord create"
      pattern: "dealContextSource\\.create"
    - from: "route-strategy.ts queryTranscriptInsights"
      to: "DealContextSource table"
      via: "prisma query with broadened sourceType filter"
      pattern: "sourceType.*in.*transcript.*note.*upload"
---

<objective>
Persist touch 1-3 context input strings as DealContextSource records and broaden the queryTranscriptInsights filter so accumulated knowledge flows into deck assembly across all touches.

Purpose: Currently the `context` parameter passed to each touch workflow is stored only in InteractionRecord.inputs JSON and never surfaces in later touch deck generation. This creates a knowledge gap where user-provided context about the deal is invisible to the generation pipeline.

Output: All four files modified so context flows end-to-end from touch input through DealContextSource to deck assembly.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/mastra/workflows/touch-1-workflow.ts
@apps/agent/src/mastra/workflows/touch-2-workflow.ts
@apps/agent/src/mastra/workflows/touch-3-workflow.ts
@apps/agent/src/generation/route-strategy.ts
@apps/agent/prisma/schema.prisma

<interfaces>
<!-- DealContextSource model (from schema.prisma): -->
```prisma
model DealContextSource {
  id              String             @id @default(cuid())
  dealId          String
  deal            Deal               @relation(fields: [dealId], references: [id], onDelete: Cascade)
  sourceType      String             // "transcript" | "note" | "upload"
  touchType       String?
  interactionId   String?
  interaction     InteractionRecord? @relation(fields: [interactionId], references: [id], onDelete: SetNull)
  originPage      String
  rawText         String
  refinedText     String?
  status          String             @default("pending_confirmation")
  bindingMetaJson String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Persist context as DealContextSource in touch 1-3 workflows</name>
  <files>
    apps/agent/src/mastra/workflows/touch-1-workflow.ts
    apps/agent/src/mastra/workflows/touch-2-workflow.ts
    apps/agent/src/mastra/workflows/touch-3-workflow.ts
  </files>
  <action>
In each of the three touch workflow files, add a DealContextSource creation block immediately after the InteractionRecord is created in the first step. Only persist when context is non-empty.

**touch-1-workflow.ts** — In `generateContent` step, after line 96 (after `const interaction = await prisma.interactionRecord.create(...)`) and before the prompt construction, add:

```typescript
// Persist context as DealContextSource so it flows into later touches
if (inputData.context && inputData.context.trim().length > 0) {
  await prisma.dealContextSource.create({
    data: {
      dealId: inputData.dealId,
      sourceType: "note",
      touchType: "touch_1",
      interactionId: interaction.id,
      originPage: "touch-1-workflow",
      rawText: inputData.context,
      status: "saved",
    },
  });
}
```

**touch-2-workflow.ts** — In `selectSlides` step, after line 113 (after `const interaction = await prisma.interactionRecord.create(...)`) and before the `buildDealContext` call, add the same pattern but with `touchType: "touch_2"` and `originPage: "touch-2-workflow"`. Note: touch 2 `context` is optional (`z.string().optional()`), so guard with `inputData.context && inputData.context.trim().length > 0`.

**touch-3-workflow.ts** — In `selectSlides` step, after line 106 (after `const interaction = await prisma.interactionRecord.create(...)`) and before the `buildDealContext` call, add the same pattern but with `touchType: "touch_3"` and `originPage: "touch-3-workflow"`. Note: touch 3 `context` is also optional.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Each touch workflow (1, 2, 3) creates a DealContextSource record with sourceType "note" when context is non-empty, linked to the interactionId and tagged with the correct touchType.</done>
</task>

<task type="auto">
  <name>Task 2: Broaden queryTranscriptInsights filter and increase limit</name>
  <files>apps/agent/src/generation/route-strategy.ts</files>
  <action>
Two changes in `route-strategy.ts`:

1. **Line 97**: Change `MAX_TRANSCRIPT_INSIGHTS` from `3` to `5`.

2. **Lines 162-165**: In the `queryTranscriptInsights` function, change the `prisma.dealContextSource.findMany` query filter from:
```typescript
sourceType: "transcript",
```
to:
```typescript
sourceType: { in: ["transcript", "note", "upload"] },
```

This ensures DealContextSource records saved as "note" (from touch workflows and deal chat) and "upload" (from file uploads) are included in the transcript insights that flow into deck generation. Keep `status: "saved"` filter unchanged.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>queryTranscriptInsights queries all three source types (transcript, note, upload) and returns up to 5 insights instead of 3.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes with no errors: `npx tsc --noEmit -p apps/agent/tsconfig.json`
2. Grep confirms DealContextSource creation in all three touch workflows: `grep -n "dealContextSource.create" apps/agent/src/mastra/workflows/touch-{1,2,3}-workflow.ts`
3. Grep confirms broadened filter: `grep -n "in.*transcript.*note.*upload" apps/agent/src/generation/route-strategy.ts`
4. Grep confirms increased limit: `grep -n "MAX_TRANSCRIPT_INSIGHTS.*5" apps/agent/src/generation/route-strategy.ts`
</verification>

<success_criteria>
- Touch 1-3 workflows persist non-empty context as DealContextSource with sourceType "note", correct touchType, linked interactionId, and status "saved"
- queryTranscriptInsights includes "note" and "upload" source types alongside "transcript"
- MAX_TRANSCRIPT_INSIGHTS increased from 3 to 5
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/31-ensure-touch-1-3-context-persists-as-dea/31-SUMMARY.md`
</output>
