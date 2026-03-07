---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/ingestion/auto-classify-templates.ts
  - apps/agent/src/mastra/index.ts
autonomous: true
must_haves:
  truths:
    - "Templates with null contentClassification are automatically classified as template or example after ingestion"
    - "Templates that have never been ingested but are accessible get auto-enqueued for ingestion"
    - "The cron runs on a configurable interval alongside the existing staleness poll"
  artifacts:
    - path: "apps/agent/src/ingestion/auto-classify-templates.ts"
      provides: "LLM-based auto-classification logic for template vs example"
    - path: "apps/agent/src/mastra/index.ts"
      provides: "Periodic timer registration for auto-classify and auto-ingest"
  key_links:
    - from: "apps/agent/src/ingestion/auto-classify-templates.ts"
      to: "prisma.template"
      via: "findMany + update"
      pattern: "prisma\\.template\\.(findMany|update)"
    - from: "apps/agent/src/mastra/index.ts"
      to: "apps/agent/src/ingestion/auto-classify-templates.ts"
      via: "setInterval import and invocation"
      pattern: "autoClassifyTemplates"
---

<objective>
Add a periodic background job to the agent service that automatically:
1. Classifies ingested templates with null contentClassification as "template" or "example" using LLM analysis of their slide content
2. Auto-enqueues ingestion for accessible templates that have never been ingested

Purpose: Eliminate manual classification burden and ensure all templates are ingested and classified without user intervention.
Output: New auto-classify module + periodic timer wired into agent startup.
</objective>

<context>
@apps/agent/src/mastra/index.ts (staleness poll pattern at lines 34-451)
@apps/agent/src/ingestion/ingestion-queue.ts (ingestion queue singleton)
@apps/agent/src/ingestion/classify-metadata.ts (LLM classification pattern)
@apps/agent/src/ingestion/ingest-template.ts (ingestion orchestrator)
@apps/agent/prisma/schema.prisma (Template model at line 259)
</context>

<interfaces>
<!-- Existing patterns the executor needs -->

From apps/agent/src/ingestion/ingestion-queue.ts:
```typescript
export const ingestionQueue: { enqueue(templateId: string): void; isProcessing(): boolean };
```

From apps/agent/src/mastra/index.ts (staleness poll pattern):
```typescript
// Constants pattern:
const STALENESS_POLL_INTERVAL = 300_000; // 5 minutes
const STALENESS_INITIAL_DELAY = 10_000;

// Timer registration pattern (inside `startStalenessPolling()`):
setTimeout(() => {
  void pollStaleTemplates();
  setInterval(() => void pollStaleTemplates(), STALENESS_POLL_INTERVAL);
}, STALENESS_INITIAL_DELAY);
```

From apps/agent/prisma/schema.prisma:
```prisma
model Template {
  id                    String    @id @default(cuid())
  name                  String
  presentationId        String    @unique
  touchTypes            String    // JSON array
  accessStatus          String    @default("not_checked")
  lastIngestedAt        DateTime?
  slideCount            Int       @default(0)
  ingestionStatus       String    @default("idle")
  contentClassification String?   // null | "template" | "example"
}
```

From apps/agent/src/ingestion/classify-metadata.ts:
```typescript
// Uses GoogleGenAI with structured output for LLM classification
import { GoogleGenAI, Type } from "@google/genai";
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create auto-classify-templates module</name>
  <files>apps/agent/src/ingestion/auto-classify-templates.ts</files>
  <action>
Create a new module that exports two async functions:

**`autoClassifyTemplates()`** -- Finds all templates where `contentClassification IS NULL` AND `ingestionStatus = "idle"` AND `lastIngestedAt IS NOT NULL` (has been ingested). For each:
1. Load first 3 slides from SlideEmbedding (ordered by slideIndex, not archived) to get slide content text
2. Use GoogleGenAI (same pattern as classify-metadata.ts) to determine if the template is a "template" (generic/reusable with placeholder content) or "example" (company-specific filled-out proposal/case study)
3. Use a simple prompt: Given the template name and first few slides' content, classify as "template" if it contains placeholder/generic content meant to be customized, or "example" if it contains specific company names, deals, or case study content. Also infer touchTypes from the content structure (touch_1 = two-pager, touch_2 = intro deck, touch_3 = solutions deck, touch_4 = full proposal).
4. Update the template's `contentClassification` and `touchTypes` via prisma.template.update
5. Log each classification decision
6. Add a 500ms delay between LLM calls to avoid rate limits

**`autoIngestNewTemplates()`** -- Finds all templates where `accessStatus = "accessible"` AND `ingestionStatus = "idle"` AND `lastIngestedAt IS NULL` (never ingested). For each, call `ingestionQueue.enqueue(template.id)`.

Both functions should be wrapped in try/catch with console.error logging. Use the env module for GOOGLE_CLOUD_PROJECT check (skip if not configured, same as staleness poll).

Use `@google/genai` with `env.GEMINI_API_KEY` or fall back to Vertex AI pattern from classify-metadata.ts. Check which auth pattern classify-metadata.ts uses and mirror it exactly.

Import prisma from `../lib/db`. Import ingestionQueue from `./ingestion-queue`.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>auto-classify-templates.ts compiles without errors, exports autoClassifyTemplates and autoIngestNewTemplates functions</done>
</task>

<task type="auto">
  <name>Task 2: Wire periodic timer into agent startup</name>
  <files>apps/agent/src/mastra/index.ts</files>
  <action>
Add a new periodic timer alongside the existing staleness polling in `apps/agent/src/mastra/index.ts`:

1. Add constants near the existing staleness constants (around line 34):
   ```typescript
   const AUTO_CLASSIFY_INTERVAL = 600_000; // 10 minutes
   const AUTO_CLASSIFY_INITIAL_DELAY = 30_000; // 30 seconds after startup (after staleness poll starts)
   ```

2. Import the two functions from the new module:
   ```typescript
   import { autoClassifyTemplates, autoIngestNewTemplates } from "../ingestion/auto-classify-templates";
   ```

3. Find the `startStalenessPolling` function (or the startup section where `clearStaleIngestions` and staleness polling are initialized). After the staleness poll timer registration, add a new timer block:
   ```typescript
   // Auto-classify and auto-ingest timer
   setTimeout(() => {
     async function runAutoTasks() {
       await autoIngestNewTemplates();
       await autoClassifyTemplates();
     }
     void runAutoTasks();
     setInterval(() => void runAutoTasks(), AUTO_CLASSIFY_INTERVAL);
     console.log("[auto-tasks] Background auto-classify/ingest started (interval: 10m)");
   }, AUTO_CLASSIFY_INITIAL_DELAY);
   ```

This ensures: auto-ingest runs first (so newly ingested templates can be classified in the next cycle), classification runs second, and both run every 10 minutes with a 30-second startup delay to avoid competing with staleness poll initialization.

Do NOT modify any existing staleness polling code. This is purely additive.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Agent compiles cleanly, new timer is registered at startup alongside existing staleness poll, console logs confirm both timers active</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit -p apps/agent/tsconfig.json` passes with no errors
- New file `apps/agent/src/ingestion/auto-classify-templates.ts` exists with two exported functions
- `apps/agent/src/mastra/index.ts` imports and registers the new periodic timer
- Existing staleness polling code is unchanged
</verification>

<success_criteria>
- Agent service compiles and starts without errors
- Every 10 minutes, the agent automatically: (a) enqueues ingestion for accessible but never-ingested templates, (b) classifies ingested templates with null contentClassification using LLM
- No manual user action required for classification of new templates after ingestion completes
</success_criteria>
