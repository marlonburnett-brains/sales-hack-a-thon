---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/lib/db.ts
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
autonomous: true
requirements: []
must_haves:
  truths:
    - "Only one PrismaClient instance exists across the entire agent app"
    - "All 12 files import prisma from the shared singleton module"
    - "No file contains `new PrismaClient()` except the singleton module"
    - "TypeScript compiles without errors"
  artifacts:
    - path: "apps/agent/src/lib/db.ts"
      provides: "PrismaClient singleton export"
      exports: ["prisma"]
  key_links:
    - from: "apps/agent/src/lib/db.ts"
      to: "12 consumer files"
      via: "relative import"
      pattern: "import.*prisma.*from.*lib/db"
---

<objective>
Consolidate 12 scattered `new PrismaClient()` instances into a single shared singleton at `apps/agent/src/lib/db.ts`.

Purpose: Prevent connection pool exhaustion and reduce cold-start overhead. Multiple PrismaClient instances each open their own connection pool, which is wasteful and can hit database connection limits.
Output: One singleton file + 12 updated consumer files with zero `new PrismaClient()` calls outside the singleton.
</objective>

<context>
@./CLAUDE.md
This project uses relative imports (no path aliases). All files are in `apps/agent/src/`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create PrismaClient singleton and update all consumers</name>
  <files>
    apps/agent/src/lib/db.ts,
    apps/agent/src/mastra/index.ts,
    apps/agent/src/lib/google-auth.ts,
    apps/agent/src/lib/token-cache.ts,
    apps/agent/src/mastra/workflows/touch-1-workflow.ts,
    apps/agent/src/mastra/workflows/touch-2-workflow.ts,
    apps/agent/src/mastra/workflows/touch-3-workflow.ts,
    apps/agent/src/mastra/workflows/touch-4-workflow.ts,
    apps/agent/src/mastra/workflows/pre-call-workflow.ts,
    apps/agent/src/ingestion/ingestion-queue.ts,
    apps/agent/src/ingestion/ingest-template.ts,
    apps/agent/src/ingestion/sync-content-sources.ts,
    apps/agent/src/ingestion/build-image-registry.ts
  </files>
  <action>
    1. Create `apps/agent/src/lib/db.ts` with the standard singleton pattern:
       ```typescript
       import { PrismaClient } from "@prisma/client";

       const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

       export const prisma = globalForPrisma.prisma ?? new PrismaClient();

       if (process.env.NODE_ENV !== "production") {
         globalForPrisma.prisma = prisma;
       }
       ```
       The `globalThis` trick prevents hot-reload from creating duplicate instances in development.

    2. In each of the 12 consumer files, make TWO changes:
       a. REMOVE the `import { PrismaClient } from "@prisma/client"` line
       b. REMOVE the `const prisma = new PrismaClient()` line
       c. ADD `import { prisma } from "{relative_path_to_lib/db}"` — use the correct relative path for each file's location:
          - Files in `lib/` (google-auth.ts, token-cache.ts): `import { prisma } from "./db"`
          - Files in `mastra/` (index.ts): `import { prisma } from "../lib/db"`
          - Files in `mastra/workflows/` (touch-1 through touch-4, pre-call): `import { prisma } from "../../lib/db"`
          - Files in `ingestion/` (ingestion-queue, ingest-template, sync-content-sources, build-image-registry): `import { prisma } from "../lib/db"`

    3. Do NOT change anything else in these files — only the import and instantiation lines.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && pnpm --filter agent exec tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `apps/agent/src/lib/db.ts` exists with singleton pattern
    - Zero occurrences of `new PrismaClient()` outside of db.ts
    - All 12 consumer files import from the singleton
    - TypeScript compiles cleanly
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify no remaining scattered PrismaClient instantiations</name>
  <files>apps/agent/src/lib/db.ts</files>
  <action>
    Run a grep across `apps/agent/src/` to confirm:
    1. `new PrismaClient()` appears ONLY in `lib/db.ts`
    2. `import { PrismaClient }` appears ONLY in `lib/db.ts`
    3. All 12 consumer files contain `from` paths ending in `/db"` or `/db'`

    If any stray instances found, fix them using the same pattern from Task 1.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && echo "=== new PrismaClient() occurrences ===" && grep -rn "new PrismaClient" apps/agent/src/ && echo "=== import PrismaClient occurrences ===" && grep -rn "import.*PrismaClient.*from" apps/agent/src/ && echo "DONE"</automated>
  </verify>
  <done>
    - `new PrismaClient()` appears exactly once (in db.ts)
    - `import { PrismaClient }` appears exactly once (in db.ts)
  </done>
</task>

</tasks>

<verification>
1. `pnpm --filter agent exec tsc --noEmit` passes with no errors
2. `grep -rn "new PrismaClient" apps/agent/src/` returns only `lib/db.ts`
3. `grep -rn "import.*PrismaClient" apps/agent/src/` returns only `lib/db.ts`
</verification>

<success_criteria>
- Single PrismaClient singleton at apps/agent/src/lib/db.ts
- All 12 consumer files use the shared singleton via relative imports
- No other file instantiates PrismaClient directly
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-prisma-client-singleton-tech-debt/2-SUMMARY.md`
</output>
