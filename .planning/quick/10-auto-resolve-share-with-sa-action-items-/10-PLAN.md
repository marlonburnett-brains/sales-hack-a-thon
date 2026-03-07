---
phase: quick
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/ingestion/ingest-template.ts
  - apps/agent/src/mastra/index.ts
autonomous: true
must_haves:
  truths:
    - "share_with_sa action items auto-resolve when ingestion succeeds for that presentationId"
    - "Templates with failed ingestion get re-queued when user reconnects Google"
  artifacts:
    - path: "apps/agent/src/ingestion/ingest-template.ts"
      provides: "Auto-resolve share_with_sa after successful ingestion"
      contains: "share_with_sa"
    - path: "apps/agent/src/mastra/index.ts"
      provides: "Re-queue failed templates on Google reconnect"
      contains: "ingestionStatus.*failed"
  key_links:
    - from: "apps/agent/src/ingestion/ingest-template.ts"
      to: "prisma.actionRequired"
      via: "updateMany resolving share_with_sa by presentationId"
      pattern: "actionType.*share_with_sa.*resolved.*true"
    - from: "apps/agent/src/mastra/index.ts"
      to: "ingestionQueue.enqueue"
      via: "re-queue failed templates after token save"
      pattern: "ingestionQueue\\.enqueue"
---

<objective>
Close two gaps in the action-item lifecycle:

1. When ingestion succeeds for a template, auto-resolve any open `share_with_sa` ActionRequired records for that presentationId (staleness polling creates these on 403/404 but nothing clears them).

2. When a user reconnects Google (POST /tokens), find templates with `ingestionStatus: "failed"` and re-queue them so the user doesn't have to manually retry.

Purpose: Prevent stale action banners and ensure failed ingestions auto-recover after auth fixes.
Output: Two surgical edits to existing files.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/ingestion/ingest-template.ts
@apps/agent/src/mastra/index.ts
@apps/agent/src/ingestion/ingestion-queue.ts
@apps/agent/prisma/schema.prisma
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-resolve share_with_sa on ingestion success</name>
  <files>apps/agent/src/ingestion/ingest-template.ts</files>
  <action>
In `ingestTemplate()`, after the successful template update at line ~320 (the `prisma.template.update` that sets `ingestionStatus: "idle"` and `lastIngestedAt`), add a fire-and-forget call to resolve any open `share_with_sa` action items for this template's presentationId:

```typescript
// Auto-resolve share_with_sa action items now that ingestion succeeded
await prisma.actionRequired.updateMany({
  where: {
    resourceId: template.presentationId,
    actionType: "share_with_sa",
    resolved: false,
  },
  data: { resolved: true, resolvedAt: new Date() },
}).catch(() => {}); // fire and forget
```

Place this right after the `prisma.template.update` block (before the thumbnail caching section). Use the same fire-and-forget `.catch(() => {})` pattern already used in the POST /tokens handler for reauth_needed resolution.

The `template` variable (fetched at line ~80) has `presentationId` available. No new imports needed -- `prisma` is already imported.
  </action>
  <verify>grep -n "share_with_sa" apps/agent/src/ingestion/ingest-template.ts | head -5</verify>
  <done>After successful ingestion, any open share_with_sa ActionRequired records matching the template's presentationId are resolved with resolvedAt timestamp.</done>
</task>

<task type="auto">
  <name>Task 2: Re-queue failed templates on Google reconnect</name>
  <files>apps/agent/src/mastra/index.ts</files>
  <action>
In the POST /tokens handler (line ~1642), after the existing `prisma.actionRequired.updateMany` that resolves `reauth_needed` actions (line ~1678-1685), add logic to find and re-queue templates that have `ingestionStatus: "failed"`:

```typescript
// Re-queue templates with failed ingestion so they auto-retry
try {
  const failedTemplates = await prisma.template.findMany({
    where: { ingestionStatus: "failed" },
    select: { id: true, name: true },
  });
  for (const t of failedTemplates) {
    ingestionQueue.enqueue(t.id);
    console.log(`[tokens] Re-queued failed template "${t.name}" after Google reconnect`);
  }
} catch { /* non-critical */ }
```

Place this between the reauth_needed resolution block and the `return c.json({ success: true, tokenId: token.id })` line.

Verify that `ingestionQueue` is already imported at the top of the file. If not, add:
```typescript
import { ingestionQueue } from "../ingestion/ingestion-queue";
```

NOTE: Templates don't have a userId column, so we re-queue ALL failed templates (not just user-specific ones). This is acceptable because: (a) failed templates need retry regardless of which user reconnects, and (b) the ingestion queue deduplicates and processes sequentially. Log each re-queue for observability.
  </action>
  <verify>grep -n "Re-queue\|failedTemplates\|ingestionQueue" apps/agent/src/mastra/index.ts | head -10</verify>
  <done>When a user stores a new Google token via POST /tokens, all templates with ingestionStatus "failed" are enqueued for re-ingestion with console logging.</done>
</task>

</tasks>

<verification>
1. `grep -n "share_with_sa" apps/agent/src/ingestion/ingest-template.ts` -- confirms resolution logic added
2. `grep -n "failedTemplates\|Re-queue" apps/agent/src/mastra/index.ts` -- confirms retry logic added
3. `npx tsc --noEmit -p apps/agent/tsconfig.json` -- no type errors
</verification>

<success_criteria>
- Successful ingestion resolves share_with_sa ActionRequired records for that presentationId
- POST /tokens re-queues all failed templates
- Both changes use fire-and-forget / non-critical error handling patterns
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/10-auto-resolve-share-with-sa-action-items-/10-SUMMARY.md`
</output>
