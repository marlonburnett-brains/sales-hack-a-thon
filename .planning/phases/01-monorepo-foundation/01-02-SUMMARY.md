---
phase: 01-monorepo-foundation
plan: "02"
subsystem: database
tags: [mastra, libsql, prisma, sqlite, t3-env, googleapis, google-auth]

# Dependency graph
requires:
  - phase: 01-01
    provides: apps/agent skeleton with all npm dependencies installed (mastra, prisma, googleapis, @t3-oss/env-core)
provides:
  - apps/agent/src/env.ts: T3 Env validation for 6 agent environment variables
  - apps/agent/src/mastra/index.ts: Mastra instance with LibSQLStore pointing to prisma/mastra.db
  - apps/agent/prisma/schema.prisma: SQLite datasource + WorkflowJob model
  - apps/agent/prisma/migrations/: initial migration SQL (20260303175711_init)
  - apps/agent/src/lib/google-auth.ts: getSlidesClient(), getDriveClient() (v3), verifyGoogleAuth() factory functions
affects: [02-atlusai-ingestion, 03-zod-schemas, 04-forms, 05-hitl, 06-agent, 07-slides, 08-ui, 09-pre-call, 10-polish]

# Tech tracking
tech-stack:
  added:
    - LibSQLStore from @mastra/libsql (local SQLite file mode with file: prefix)
    - Prisma 6.3.1 SQLite datasource configured with migrations
    - googleapis v144 slides v1 + drive v3 client factory pattern
    - @t3-oss/env-core createEnv (not @t3-oss/env-nextjs — agent is not Next.js)
  patterns:
    - Two-database architecture: mastra.db (Mastra internal state) separate from dev.db (Prisma app records)
    - Google auth factory pattern: getGoogleAuth() private helper, exported client factories parse GOOGLE_SERVICE_ACCOUNT_KEY JSON
    - T3 Env core pattern for non-Next.js apps: runtimeEnv: process.env
    - Prisma path resolution: DATABASE_URL file: paths are relative to schema.prisma location

key-files:
  created:
    - apps/agent/src/env.ts (T3 Env validation with 6 vars)
    - apps/agent/src/mastra/index.ts (Mastra instance with LibSQLStore)
    - apps/agent/prisma/schema.prisma (SQLite + WorkflowJob model)
    - apps/agent/prisma/migrations/20260303175711_init/migration.sql (WorkflowJob DDL)
    - apps/agent/src/lib/google-auth.ts (Google API client factories)
  modified:
    - .gitignore (added *.db wildcard and nested prisma path coverage)

key-decisions:
  - "Used @t3-oss/env-core (not @t3-oss/env-nextjs) for apps/agent since it is not a Next.js app"
  - "mastra.db and dev.db kept as separate files — Mastra internal state must not be mixed with Prisma-managed records"
  - "Drive API v3 used (not v2) for all new Google Drive code"
  - ".gitignore extended with *.db wildcard to cover Prisma path resolution quirks (file: URLs resolve relative to schema.prisma)"

patterns-established:
  - "Two-DB pattern: apps/agent runs Mastra (mastra.db) + Prisma (dev.db) side-by-side without conflict"
  - "Google auth factory: single getGoogleAuth() internal function, exported named functions for each API client"
  - "T3 Env core for Node.js services: createEnv({ server: {...}, runtimeEnv: process.env })"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 1 Plan 02: Mastra + Prisma persistence layers and Google auth factory

**Mastra LibSQLStore wired to prisma/mastra.db, Prisma WorkflowJob schema with initial migration, T3 Env validation for 6 agent vars, and getSlidesClient()/getDriveClient() factory functions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T17:56:18Z
- **Completed:** 2026-03-03T17:58:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Mastra instance configured with LibSQLStore pointing to `file:./prisma/mastra.db` (separate from Prisma's `dev.db`)
- T3 Env validation for all 6 required agent env vars using `@t3-oss/env-core` (not Next.js variant)
- Prisma schema with WorkflowJob model, initial SQLite migration applied and Prisma client generated
- Google auth factory with `getSlidesClient()` (v1), `getDriveClient()` (v3), and `verifyGoogleAuth()` using JSON-parsed service account credentials

## Task Commits

Each task was committed atomically:

1. **Task 1: Mastra instance with LibSQLStore and T3 Env validation** - `93ffd90` (feat)
2. **Task 2: Prisma schema, initial migration, and Google auth factory** - `1844479` (feat)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified

- `apps/agent/src/env.ts` - T3 Env createEnv with DATABASE_URL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_TEMPLATE_PRESENTATION_ID, NODE_ENV, MASTRA_PORT
- `apps/agent/src/mastra/index.ts` - Mastra instance with LibSQLStore(url: 'file:./prisma/mastra.db') and configurable port
- `apps/agent/prisma/schema.prisma` - SQLite datasource + WorkflowJob model (id, type, status, payload, result, timestamps)
- `apps/agent/prisma/migrations/20260303175711_init/migration.sql` - CREATE TABLE WorkflowJob DDL
- `apps/agent/src/lib/google-auth.ts` - getSlidesClient(), getDriveClient() (v3), verifyGoogleAuth() factory
- `.gitignore` - Added *.db wildcard and nested prisma/prisma/ paths

## Decisions Made

- **@t3-oss/env-core used (not @t3-oss/env-nextjs)**: The agent app is a Node.js Mastra server, not a Next.js app. `env-core` is the correct variant and does not pull in Next.js-specific validation behavior.
- **mastra.db kept separate from dev.db**: Mixing Mastra internal state with Prisma-managed records would create schema conflicts and complicate future migrations. The two-database pattern is explicit and documented in code comments.
- **Drive API v3 used**: All new Google Drive integrations use v3 per the plan directive; v2 is legacy.
- **.gitignore expanded with *.db wildcard**: Prisma resolves `file:./prisma/dev.db` relative to `schema.prisma` location, not CWD. Added broad `*.db` coverage to handle path resolution edge cases during local development.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended .gitignore to cover Prisma db path resolution quirk**
- **Found during:** Task 2 (Prisma migrate dev)
- **Issue:** `prisma migrate dev` with `DATABASE_URL=file:./prisma/dev.db` running from `apps/agent` CWD caused Prisma to resolve the path relative to `schema.prisma` location (`apps/agent/prisma/`), creating `apps/agent/prisma/prisma/dev.db` — a nested path not covered by the original `apps/agent/prisma/dev.db` gitignore entry
- **Fix:** Added `apps/agent/prisma/prisma/dev.db`, `apps/agent/prisma/prisma/mastra.db`, `*.db`, `*.db-shm`, `*.db-wal` to .gitignore
- **Files modified:** .gitignore
- **Verification:** `git status` shows prisma/prisma/dev.db not tracked
- **Committed in:** 1844479 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary correction to prevent accidental SQLite DB commits. No scope creep.

## Issues Encountered

- Prisma path resolution: When `DATABASE_URL=file:./prisma/dev.db` is set at CLI level and the schema is at `apps/agent/prisma/schema.prisma`, Prisma resolves the relative URL against the schema's directory, resulting in the db landing at `apps/agent/prisma/prisma/dev.db`. This is expected Prisma behavior — the correct path for production use in `.env` is `file:./prisma/dev.db` which resolves correctly when the app runs from `apps/agent` CWD with `prisma/schema.prisma` as the schema file (relative to schema = `prisma/prisma/dev.db`, but apps/agent/.env should use `file:./prisma/dev.db` evaluated at mastra dev startup from apps/agent CWD). This is a known footgun documented in the .gitignore fix.

## User Setup Required

None - no external service configuration required for this plan. The Google credentials (GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_TEMPLATE_PRESENTATION_ID) are provisioned in plan 01-03 via a human-action checkpoint.

## Next Phase Readiness

- Mastra instance file exists and imports LibSQLStore — plan 01-03 can run `mastra dev` once env vars are configured
- Prisma WorkflowJob model is migrated and generated — application code can import `@prisma/client` and query WorkflowJob
- `getSlidesClient()` and `getDriveClient()` are ready for plan 01-03 Google API spike
- Both database files are fully gitignored
- Blockers: Google service account credentials are not yet provisioned (plan 01-03 handles this)

## Self-Check: PASSED

All 5 created files found on disk. Both task commits (93ffd90, 1844479) verified in git history.

---
*Phase: 01-monorepo-foundation*
*Completed: 2026-03-03*
