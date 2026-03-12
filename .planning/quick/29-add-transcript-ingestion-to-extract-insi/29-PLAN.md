---
phase: quick-29
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/schemas/generation/types.ts
  - apps/agent/src/generation/route-strategy.ts
  - apps/agent/src/generation/modification-planner.ts
autonomous: true
requirements: [QUICK-29]

must_haves:
  truths:
    - "Deck generation for touches 2/3 incorporates transcript insights when available"
    - "Modification planner prompt includes customer pain points, business outcomes, and stakeholder info extracted from transcripts"
    - "Touches with no transcript data continue working unchanged (graceful fallback)"
  artifacts:
    - path: "packages/schemas/generation/types.ts"
      provides: "DealContext with optional transcriptInsights field"
      contains: "transcriptInsights"
    - path: "apps/agent/src/generation/route-strategy.ts"
      provides: "buildDealContext queries DealContextSource + Transcript records"
      contains: "transcriptInsights"
    - path: "apps/agent/src/generation/modification-planner.ts"
      provides: "Prompt includes transcript insights section"
      contains: "Transcript Insights"
  key_links:
    - from: "apps/agent/src/generation/route-strategy.ts"
      to: "prisma.dealContextSource"
      via: "database query in buildDealContext"
      pattern: "prisma\\.dealContextSource\\.findMany|prisma\\.transcript\\.find"
    - from: "apps/agent/src/generation/modification-planner.ts"
      to: "DealContext.transcriptInsights"
      via: "prompt builder reads transcriptInsights"
      pattern: "transcriptInsights"
---

<objective>
Wire transcript insights from saved DealContextSource/Transcript records into the deck generation pipeline so that touches 2/3 produce slide content grounded in actual customer conversation data (pain points, business outcomes, stakeholders, constraints, timeline).

Purpose: Currently touches 2/3 generate deck content using only basic deal metadata (company, industry, pillars). When a seller has saved a meeting transcript via deal chat or processed one through touch 4, those extracted insights sit unused by earlier touch workflows. This task enriches DealContext with transcript insights so the modification planner can produce highly tailored slide content.

Output: Updated DealContext type, enriched buildDealContext function, and transcript-aware modification planner prompt.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/schemas/generation/types.ts
@apps/agent/src/generation/route-strategy.ts
@apps/agent/src/generation/modification-planner.ts
@apps/agent/src/deal-chat/context.ts
@apps/agent/prisma/schema.prisma

<interfaces>
<!-- Key types and contracts the executor needs -->

From packages/schemas/generation/types.ts:
```typescript
export interface DealContext {
  dealId: string;
  companyName: string;
  industry: string;
  pillars: string[];
  persona: string;
  funnelStage: string;
  priorTouchSlideIds: string[];
}
```

From apps/agent/src/generation/route-strategy.ts:
```typescript
export function buildDealContext(
  touchType: string,
  input: { dealId: string; companyName: string; industry: string; [key: string]: unknown },
): DealContext;

export async function executeStructureDrivenPipeline(params: ExecutePipelineParams): Promise<...>;
```

From apps/agent/prisma/schema.prisma:
```prisma
model DealContextSource {
  id              String   @id @default(cuid())
  dealId          String
  sourceType      String   // "note" | "transcript"
  touchType       String?
  rawText         String
  refinedText     String?
  status          String   @default("pending_confirmation")
  ...
}

model Transcript {
  id              String   @id @default(cuid())
  interactionId   String   @unique
  rawText         String
  customerContext    String @default("")
  businessOutcomes   String @default("")
  constraints        String @default("")
  stakeholders       String @default("")
  timeline           String @default("")
  budget             String @default("")
  ...
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add transcriptInsights to DealContext and enrich buildDealContext</name>
  <files>packages/schemas/generation/types.ts, apps/agent/src/generation/route-strategy.ts</files>
  <action>
1. In `packages/schemas/generation/types.ts`, add an optional `transcriptInsights` field to `DealContext`:

```typescript
export interface TranscriptInsight {
  /** Source of insight: "transcript" (from deal chat) or "processed" (from touch 4 pipeline) */
  source: "transcript" | "processed";
  customerContext: string;
  businessOutcomes: string;
  constraints: string;
  stakeholders: string;
  timeline: string;
  budget: string;
}

export interface DealContext {
  // ... existing fields ...
  /** Extracted insights from meeting transcripts, ordered newest first. Empty array if none. */
  transcriptInsights: TranscriptInsight[];
}
```

2. In `apps/agent/src/generation/route-strategy.ts`, make `buildDealContext` async and query for transcript data:

- Query `prisma.transcript.findMany` joined through `InteractionRecord` for the deal's touch_4 transcripts (these have structured extracted fields from the LLM pipeline). Filter to only transcripts where at least one field is non-empty.
- Query `prisma.dealContextSource.findMany` where `dealId` matches and `sourceType = "transcript"` and `status = "confirmed"`. These are raw transcripts saved via deal chat.
- For DealContextSource transcripts (raw text only), use the `refinedText` or `rawText` as `customerContext` and leave other fields empty -- the raw text still provides useful grounding.
- Combine into `TranscriptInsight[]`, sorted newest first, limit to 3 most recent.
- Return the enriched DealContext with `transcriptInsights` (empty array if none found).

3. Update all callers of `buildDealContext` in touch workflows (touch-1, touch-2, touch-3, touch-4) to await the now-async function. Search for `buildDealContext(` in `apps/agent/src/mastra/workflows/` and add `await`. The function is already called inside async step execute handlers, so just adding `await` is sufficient.

IMPORTANT: Keep backward compatibility -- if no transcripts exist, `transcriptInsights` is `[]` and all existing behavior is unchanged.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>DealContext includes transcriptInsights field, buildDealContext queries DB for transcript data, all workflow callers updated to await, TypeScript compiles clean</done>
</task>

<task type="auto">
  <name>Task 2: Wire transcript insights into modification planner prompt</name>
  <files>apps/agent/src/generation/modification-planner.ts</files>
  <action>
1. In `modification-planner.ts`, update the `buildPrompt` function to accept `DealContext` (which now includes `transcriptInsights`) and render a "Transcript Insights" section in the prompt when insights are available.

2. Add a `formatTranscriptInsights` helper function (similar to existing `formatDraftContent`):

```typescript
function formatTranscriptInsights(insights: TranscriptInsight[]): string {
  if (!insights || insights.length === 0) return "";

  const sections: string[] = [];
  for (const insight of insights) {
    const parts: string[] = [];
    if (insight.customerContext) parts.push(`- **Customer Context:** ${insight.customerContext}`);
    if (insight.businessOutcomes) parts.push(`- **Business Outcomes:** ${insight.businessOutcomes}`);
    if (insight.constraints) parts.push(`- **Constraints:** ${insight.constraints}`);
    if (insight.stakeholders) parts.push(`- **Stakeholders:** ${insight.stakeholders}`);
    if (insight.timeline) parts.push(`- **Timeline:** ${insight.timeline}`);
    if (insight.budget) parts.push(`- **Budget:** ${insight.budget}`);
    if (parts.length > 0) sections.push(parts.join("\n"));
  }

  if (sections.length === 0) return "";

  return `

## Transcript Insights (from customer meetings)

Use these real customer insights to ground your modifications in actual deal context. Reference specific pain points, outcomes, and stakeholders when tailoring slide content.

${sections.join("\n\n---\n\n")}`;
}
```

3. Insert the transcript insights section in the prompt AFTER the Deal Context section and BEFORE the Approved Draft Content section. This ensures the LLM sees the customer's own words when deciding how to modify slide text.

4. Truncate each transcript insight field to 300 chars to avoid prompt bloat (reuse the existing `truncateContent` pattern but with a lower limit for insight fields).
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Modification planner prompt includes transcript insights when available, insights are truncated to avoid prompt bloat, prompt renders cleanly with zero insights (no empty section)</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit -p apps/agent/tsconfig.json` passes
2. TypeScript compilation: `npx tsc --noEmit -p packages/schemas/tsconfig.json` passes
3. Existing tests still pass: `cd apps/agent && npx vitest run --reporter=verbose 2>&1 | tail -20`
4. Manual verification: The modification planner prompt for a deal with saved transcripts should include a "Transcript Insights" section. For a deal with no transcripts, the prompt should be identical to before (no empty section rendered).
</verification>

<success_criteria>
- DealContext.transcriptInsights is populated from Transcript and DealContextSource records when available
- buildDealContext is async and queries the database for transcript data
- Modification planner prompt includes customer meeting insights for grounding slide modifications
- All existing tests pass unchanged (backward compatible)
- Deals with no transcript data produce identical behavior to before
</success_criteria>

<output>
After completion, create `.planning/quick/29-add-transcript-ingestion-to-extract-insi/29-SUMMARY.md`
</output>
