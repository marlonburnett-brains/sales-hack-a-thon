---
phase: quick
plan: 10
subsystem: ingestion-lifecycle
tags: [action-items, ingestion, auto-resolve, token-reconnect]
dependency_graph:
  requires: [ActionRequired model, ingestionQueue, POST /tokens handler]
  provides: [auto-resolution of share_with_sa actions, auto-retry of failed templates on reconnect]
  affects: [apps/agent/src/ingestion/ingest-template.ts, apps/agent/src/mastra/index.ts]
tech_stack:
  patterns: [fire-and-forget updateMany, non-critical try/catch]
key_files:
  modified:
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/agent/src/mastra/index.ts
decisions:
  - Re-queue ALL failed templates (not user-specific) since templates lack userId column and ingestion queue deduplicates
metrics:
  duration: 2min
  completed: "2026-03-07"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 10: Auto-resolve share_with_sa Action Items Summary

Auto-resolve stale share_with_sa banners after ingestion success + re-queue failed templates when user reconnects Google.

## What Was Done

### Task 1: Auto-resolve share_with_sa on ingestion success
- **Commit:** 6c3a5fe
- **File:** `apps/agent/src/ingestion/ingest-template.ts`
- Added `prisma.actionRequired.updateMany()` call after the successful `prisma.template.update` that sets `ingestionStatus: "idle"`
- Resolves all open `share_with_sa` ActionRequired records matching the template's `presentationId`
- Uses fire-and-forget `.catch(() => {})` pattern consistent with existing `reauth_needed` resolution in POST /tokens

### Task 2: Re-queue failed templates on Google reconnect
- **Commit:** de08f7e
- **File:** `apps/agent/src/mastra/index.ts`
- In POST /tokens handler, after resolving `reauth_needed` actions, queries for all templates with `ingestionStatus: "failed"` and enqueues each via `ingestionQueue.enqueue()`
- Logs each re-queued template for observability
- Wrapped in non-critical try/catch since reconnect should succeed even if re-queue fails
- `ingestionQueue` was already imported; no new imports needed

## Verification

- TypeScript compiles cleanly (`npx tsc --noEmit` - no errors)
- Both changes use established fire-and-forget / non-critical error handling patterns
- No schema changes required (ActionRequired model already has `resourceId`, `actionType`, `resolved`, `resolvedAt` fields)

## Deviations from Plan

None - plan executed exactly as written.
