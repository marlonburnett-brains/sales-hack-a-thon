---
phase: quick
plan: 2
subsystem: agent-database
tags: [prisma, singleton, tech-debt, connection-pool]
dependency_graph:
  requires: []
  provides: [prisma-singleton]
  affects: [agent-app]
tech_stack:
  added: []
  patterns: [globalThis-singleton]
key_files:
  created:
    - apps/agent/src/lib/db.ts
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/lib/google-auth.ts
    - apps/agent/src/lib/token-cache.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/mastra/workflows/pre-call-workflow.ts
    - apps/agent/src/ingestion/ingestion-queue.ts
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/agent/src/ingestion/sync-content-sources.ts
    - apps/agent/src/ingestion/build-image-registry.ts
decisions:
  - Used globalThis singleton pattern to prevent hot-reload duplicate instances
metrics:
  duration: 4m
  completed: "2026-03-06T19:12:53Z"
  tasks_completed: 2
  tasks_total: 2
requirements_completed: []
---

# Quick Task 2: PrismaClient Singleton Consolidation Summary

Consolidated 12 scattered `new PrismaClient()` instances into a single globalThis-based singleton at `apps/agent/src/lib/db.ts`, preventing connection pool exhaustion and reducing cold-start overhead.

## What Changed

### Task 1: Create PrismaClient singleton and update all consumers

Created `apps/agent/src/lib/db.ts` with the standard globalThis singleton pattern that prevents hot-reload from creating duplicate instances in development. Updated all 12 consumer files to import `prisma` from the shared module instead of instantiating their own `PrismaClient`.

**Import path mapping:**
- `lib/` files (google-auth.ts, token-cache.ts): `import { prisma } from "./db"`
- `mastra/` (index.ts): `import { prisma } from "../lib/db"`
- `mastra/workflows/` (5 workflow files): `import { prisma } from "../../lib/db"`
- `ingestion/` (4 files): `import { prisma } from "../lib/db"`

**Commit:** `905a481`

### Task 2: Verify no remaining scattered PrismaClient instantiations

Verified:
- `new PrismaClient()` appears exactly once (in `db.ts`)
- `import { PrismaClient }` appears exactly once (in `db.ts`)
- All 12 consumer files import `prisma` from the singleton module

No code changes needed -- verification-only task.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `new PrismaClient()` appears only in `lib/db.ts` -- PASS
- `import { PrismaClient }` appears only in `lib/db.ts` -- PASS
- All 12 consumer files import from singleton -- PASS
- TypeScript compiles without prisma-related errors -- PASS (pre-existing Mastra API signature errors unrelated to this change)

## Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create PrismaClient singleton and update all consumers | 905a481 | 13 files (1 created, 12 modified) |
| 2 | Verify no remaining scattered PrismaClient instantiations | (verification only) | 0 files |

## Self-Check: PASSED
