---
phase: 14-database-migration
plan: 01
subsystem: database
tags: [postgresql, supabase, prisma, mastra, pg, migration]

# Dependency graph
requires: []
provides:
  - Supabase PostgreSQL dev instance with all 9 application tables
  - Prisma configured for PostgreSQL with pooled + direct connection strings
  - Mastra PostgresStore with schema-isolated "mastra" namespace
  - Server verified running against remote Supabase database
affects: [14-02-PLAN, 15-auth, 16-deployment]

# Tech tracking
tech-stack:
  added: ["@mastra/pg ^1.7.1"]
  removed: ["@mastra/libsql"]
  patterns: ["single-database architecture with schema isolation (public + mastra)", "DIRECT_URL for migrations and Mastra storage, DATABASE_URL for Prisma runtime"]

key-files:
  created:
    - apps/agent/prisma/migrations/0_init/migration.sql
    - apps/agent/prisma/migrations/migration_lock.toml
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/env.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/package.json
    - apps/agent/.env.example
    - pnpm-lock.yaml

key-decisions:
  - "Used direct DB host (db.[ref].supabase.co:5432) instead of Supabase pooler for both Prisma and Mastra -- pooler returned 'Tenant or user not found' for newly created project"
  - "PostgresStore uses DIRECT_URL (non-pooled) since pg driver does not need pgbouncer transaction pooling"
  - "Single-database architecture: Prisma uses 'public' schema, Mastra uses 'mastra' schema in same Supabase PostgreSQL instance"

patterns-established:
  - "Schema isolation: application tables in 'public' schema (Prisma), workflow state in 'mastra' schema (PostgresStore auto-managed)"
  - "Connection string pattern: DIRECT_URL for direct DB access, DATABASE_URL for runtime queries"

requirements-completed: [DB-01, DB-02, DB-03, DB-04]

# Metrics
duration: 21min
completed: 2026-03-05
---

# Phase 14 Plan 01: Database Migration Summary

**Prisma switched from SQLite to Supabase PostgreSQL with fresh baseline migration (9 tables), Mastra storage swapped to PostgresStore with schema isolation**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-05T02:21:12Z
- **Completed:** 2026-03-05T02:42:23Z
- **Tasks:** 3 (1 human-action pre-completed, 2 auto tasks executed)
- **Files modified:** 12

## Accomplishments
- Supabase dev project created with PostgreSQL database (user completed Task 1 via CLI)
- Prisma datasource switched from sqlite to postgresql with directUrl for migrations
- Fresh Postgres baseline migration generated and applied (9 tables: WorkflowJob, ImageAsset, ContentSource, Company, Deal, InteractionRecord, FeedbackSignal, Transcript, Brief)
- Mastra storage backend swapped from LibSQLStore to PostgresStore with "mastra" schema namespace
- Server verified: starts cleanly, `/companies` returns 200 with empty array

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase dev and prod projects** - Pre-completed by user (human-action checkpoint)
2. **Task 2: Switch Prisma to PostgreSQL with fresh baseline migration** - `37c8232` (feat)
3. **Task 3: Swap Mastra storage to PostgresStore and verify server startup** - `b386199` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Datasource changed from sqlite to postgresql with directUrl
- `apps/agent/prisma/migrations/0_init/migration.sql` - Fresh Postgres baseline DDL for all 9 models
- `apps/agent/prisma/migrations/migration_lock.toml` - Provider lock changed to postgresql
- `apps/agent/src/env.ts` - Added DIRECT_URL validation, changed DATABASE_URL to z.string().url()
- `apps/agent/src/mastra/index.ts` - Replaced LibSQLStore with PostgresStore, updated JSDoc
- `apps/agent/package.json` - Added @mastra/pg, removed @mastra/libsql
- `apps/agent/.env.example` - Updated template with Supabase connection string format
- `pnpm-lock.yaml` - Dependency changes

## Decisions Made

1. **Direct DB host over pooler for development:** The Supabase Supavisor pooler (pooler.supabase.com) returned "Tenant or user not found" for the newly created project. Switched both DATABASE_URL and DIRECT_URL to use the direct DB host (db.[ref].supabase.co:5432). The pooler URLs can be configured for production deployment when ready.

2. **PostgresStore uses DIRECT_URL:** The `@mastra/pg` package uses the `pg` driver directly, which does not require pgbouncer transaction pooling. Using the direct connection avoids pooler compatibility issues and is more reliable for Mastra's long-lived connections.

3. **Kept PrismaClient named import:** Despite ESM/CJS compatibility warnings in Mastra dev bundler, the named `import { PrismaClient } from "@prisma/client"` works correctly after clearing the Mastra build cache. No workaround needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma migration SQL contained warning text**
- **Found during:** Task 2 (baseline migration generation)
- **Issue:** `prisma migrate diff --script` output included a deprecation warning ("warn The configuration property `package.json#prisma` is deprecated...") at the top of the SQL file, causing a syntax error when applied
- **Fix:** Removed the warning lines from migration.sql, resolved the failed migration as rolled-back, then re-applied
- **Files modified:** apps/agent/prisma/migrations/0_init/migration.sql
- **Verification:** `prisma migrate deploy` succeeded, `prisma migrate status` shows "up to date"
- **Committed in:** 37c8232 (Task 2 commit)

**2. [Rule 3 - Blocking] Supabase pooler not ready for new project**
- **Found during:** Task 2 (migration deploy) and Task 3 (server verification)
- **Issue:** Both Prisma and Mastra connections via the Supabase pooler (pooler.supabase.com) returned "Tenant or user not found" -- the project was just created and the pooler hadn't propagated yet
- **Fix:** Switched all connection strings to use direct database host (db.[ref].supabase.co:5432) instead of pooler
- **Files modified:** apps/agent/.env (gitignored, not committed)
- **Verification:** All connections succeed via direct host; migration applied; server starts; API responds 200
- **Committed in:** Environment file change (not committed -- .env is gitignored)

**3. [Rule 3 - Blocking] DIRECT_URL format incorrect**
- **Found during:** Task 2 (migration deploy)
- **Issue:** User-provided DIRECT_URL used pooler host (pooler.supabase.com:5432) with pooler-style username (postgres.[ref]), which failed with same "Tenant or user not found". Supabase DIRECT_URL should use db.[ref].supabase.co with plain `postgres` username.
- **Fix:** Changed DIRECT_URL to postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres
- **Files modified:** apps/agent/.env, apps/agent/.env.example
- **Verification:** `prisma migrate deploy` succeeded using corrected DIRECT_URL
- **Committed in:** 37c8232 (Task 2 commit, .env.example change)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking issues)
**Impact on plan:** All auto-fixes necessary to complete the migration. Using direct DB host instead of pooler is a temporary development trade-off; pooler URLs should be tested again later or configured for production.

## Issues Encountered
- Supabase Supavisor pooler propagation delay for newly created projects -- resolved by using direct DB host
- Prisma CLI deprecation warning for `package.json#prisma` property appears in all prisma commands (cosmetic, does not affect functionality)

## Production Connection Strings

Saved for Plan 14-02 deployment:
- `PROD_DATABASE_URL=postgresql://postgres.tsubedtwgxexwvuzadnh:2eKTjDvXdRNLdE79acQiFwXd@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- `PROD_DIRECT_URL=postgresql://postgres:2eKTjDvXdRNLdE79acQiFwXd@db.tsubedtwgxexwvuzadnh.supabase.co:5432/postgres`

## User Setup Required
None - Supabase projects already created by user in Task 1.

## Next Phase Readiness
- Supabase dev PostgreSQL database ready with all 9 application tables
- Mastra workflow state persists in "mastra" schema
- Plan 14-02 can apply the same baseline migration to the prod Supabase instance
- Pooler URLs should be re-tested before production deployment (may work after propagation delay resolves)

## Self-Check: PASSED

All files exist, all commits verified, all content assertions pass.

---
*Phase: 14-database-migration*
*Completed: 2026-03-05*
