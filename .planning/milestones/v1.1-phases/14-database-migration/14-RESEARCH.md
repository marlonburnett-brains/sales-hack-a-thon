# Phase 14: Database Migration - Research

**Researched:** 2026-03-04
**Domain:** Prisma SQLite-to-PostgreSQL migration, Supabase hosting, Mastra storage backend
**Confidence:** HIGH

## Summary

This phase migrates the agent application from local SQLite files to Supabase PostgreSQL. Two databases are currently in play: Prisma manages app data (`dev.db`) and Mastra manages workflow state (`mastra.db` via LibSQLStore). Both must be redirected to Supabase PostgreSQL.

The migration is straightforward because (1) the Prisma schema uses only portable types (`String`, `DateTime`, `Int`) with no SQLite-specific features, (2) `@mastra/pg` v1.7.1 is a stable, actively-maintained drop-in replacement for `@mastra/libsql` that supports a `schemaName` parameter for namespace isolation, and (3) no application code changes are required -- only configuration, dependency, and schema provider changes.

**Primary recommendation:** Delete existing SQLite migrations, change provider to `postgresql`, generate a fresh baseline migration with `prisma migrate diff --from-empty --to-schema`, install `@mastra/pg`, swap `LibSQLStore` for `PostgresStore` with `schemaName: "mastra"`, and update env vars to use Supabase pooled + direct connection strings.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep all String fields for JSON storage (no JSONB upgrade) -- matches success criteria "no application code changes"
- Keep CUIDs for all IDs (no switch to UUIDs) -- zero changes, works fine in Postgres TEXT columns
- Clean slate for migrations: delete SQLite migration directory, generate one fresh Postgres baseline migration
- All existing `@@index` and `@@unique` constraints carry over as-is
- Starting from scratch -- no existing Supabase projects or organization
- Region: US East (N. Virginia / us-east-1)
- Pricing tier: Free tier for both dev and prod instances
- Connection pooling: Use pooled connection strings (Supavisor) for both Prisma and Mastra
- Research-first approach: verify `@mastra/pg` package exists and is stable; if yes, use it
- Same database, separate schemas: Prisma uses `public` schema, Mastra uses `mastra` schema
- Port existing seed.ts to Postgres with same Meridian Capital Group demo scenario
- Dev only -- prod starts empty
- Idempotent seed script using upserts

### Claude's Discretion
- Prisma provider config details (extensions, preview features)
- Connection string format and env var naming conventions
- Migration baseline SQL generation approach
- Mastra schema namespace configuration

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | Supabase dev and prod projects created with Prisma-compatible connection strings | Supabase free tier supports 2 active projects; connection string formats documented below; `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) pattern verified for Prisma 6.x |
| DB-02 | Prisma provider switched from sqlite to postgresql with fresh migration baseline | Provider change + `prisma migrate diff --from-empty` approach verified; `directUrl` supported in Prisma 6.19.2 schema.prisma; migration lock.toml will update automatically |
| DB-03 | All existing Prisma models work against Supabase Postgres without application code changes | Schema uses only portable types (String/TEXT, DateTime, Int); `@default(cuid())` works identically in Postgres; no SQLite-specific features used |
| DB-04 | Mastra workflow state persists in durable Postgres storage | `@mastra/pg@1.7.1` confirmed on npm with `PostgresStore` class; `schemaName: "mastra"` isolates tables; auto-creates `mastra_workflow_snapshot` etc. |
| DB-05 | Seed data loads successfully against Supabase dev instance | Existing seed.ts uses only portable Prisma operations (upsert, create, findMany); no SQL-level changes needed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mastra/pg` | 1.7.1 | Mastra PostgreSQL storage backend | Official Mastra Postgres adapter; replaces `@mastra/libsql`; peer dep `@mastra/core >=1.4.0` satisfied by project's 1.8.0 |
| `prisma` | 6.19.2 (existing) | Schema management and migrations | Already installed; only config changes needed (provider + connection strings) |
| `@prisma/client` | 6.19.2 (existing) | Database ORM client | Already installed; regenerate after provider change |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` | ^8.16.3 | Node.js PostgreSQL driver | Transitive dependency of `@mastra/pg`; installed automatically |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mastra/pg` | `@mastra/libsql` + Turso cloud | Would require Turso account + separate service; Postgres keeps everything in one database |
| `@mastra/pg` | `@mastra/drizzle` + pg adapter | Extra abstraction layer; `@mastra/pg` is the direct, purpose-built solution |

**Installation:**
```bash
cd apps/agent
pnpm add @mastra/pg@^1.7.1
pnpm remove @mastra/libsql
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/
  prisma/
    schema.prisma         # provider = "postgresql", directUrl added
    migrations/
      0_init/
        migration.sql     # Fresh Postgres baseline (all 8 models)
    seed.ts               # Unchanged logic, idempotent upserts
  src/
    env.ts                # Add DIRECT_URL, keep DATABASE_URL
    mastra/
      index.ts            # PostgresStore replaces LibSQLStore
  .env                    # Supabase connection strings
  .env.example            # Template with placeholder URLs
```

### Pattern 1: Dual Connection Strings (Pooled + Direct)
**What:** Prisma uses two connection strings -- a pooled URL for runtime queries and a direct URL for migrations/introspection.
**When to use:** Always with Supabase + Prisma, because Supavisor (the pooler) runs in transaction mode and does not support prepared statements or schema migrations.
**Example:**
```prisma
// Source: Prisma docs + Supabase docs
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
```env
# Pooled (Supavisor transaction mode, port 6543)
DATABASE_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct (for migrations, port 5432)
DIRECT_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### Pattern 2: Same Database, Separate Schemas
**What:** Prisma app models live in `public` schema (default), Mastra internal tables live in `mastra` schema. Single Supabase project per environment.
**When to use:** This phase -- clean separation without cross-database complexity.
**Example:**
```typescript
// Source: Mastra docs - https://mastra.ai/reference/storage/postgresql
import { PostgresStore } from "@mastra/pg";

const storage = new PostgresStore({
  id: "mastra-store",
  connectionString: process.env.DATABASE_URL!, // Uses same pooled connection
  schemaName: "mastra", // Tables created in "mastra" schema, not "public"
});
```

### Pattern 3: Fresh Baseline Migration
**What:** Delete all SQLite migrations, generate one Postgres-native baseline using `prisma migrate diff`.
**When to use:** When switching database providers (SQLite migration SQL is incompatible with PostgreSQL).
**Example:**
```bash
# 1. Delete old SQLite migrations
rm -rf prisma/migrations/

# 2. Generate Postgres baseline SQL (without applying)
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 3. Apply to the Supabase database
npx prisma migrate deploy

# Note: On a fresh database, migrate deploy applies all pending migrations
```

### Anti-Patterns to Avoid
- **Using `prisma db push` for schema changes:** Project rule (CLAUDE.md) explicitly forbids this. Always use `prisma migrate dev --name <name>`.
- **Using `prisma migrate reset`:** Project rule forbids resetting/recreating databases. Treat all databases as production.
- **Pointing migrations at the pooled URL:** Prisma Schema Engine requires a direct connection. The `directUrl` field in schema.prisma handles this automatically.
- **Removing `?pgbouncer=true` from `DATABASE_URL`:** Prisma Client uses prepared statements by default; this flag disables them for Supavisor compatibility.
- **Creating Mastra tables in `public` schema:** Would intermix with Prisma-managed tables. Use `schemaName: "mastra"` for clean isolation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workflow state persistence | Custom Postgres tables for workflow snapshots | `@mastra/pg` PostgresStore | Mastra auto-creates and manages `mastra_workflow_snapshot`, `mastra_threads`, `mastra_messages`, `mastra_traces`, `mastra_evals`, `mastra_scorers`, `mastra_resources` tables |
| Connection pooling | Manual pg.Pool management | Supavisor (built into Supabase) | Supabase provides connection pooling via Supavisor at no cost; just use the pooled connection string |
| Schema migration from SQLite to Postgres | Manual SQL conversion | `prisma migrate diff --from-empty --to-schema` | Prisma generates correct Postgres DDL from the schema file automatically |
| Database provisioning | Manual PostgreSQL setup | Supabase Dashboard (web UI) | Two clicks to create a project; provides connection strings, pooler config, and dashboard out of the box |

**Key insight:** This migration is primarily a configuration change, not a code change. The only code modifications are in `mastra/index.ts` (swap storage adapter), `env.ts` (add `DIRECT_URL`), and `schema.prisma` (change provider + add `directUrl`).

## Common Pitfalls

### Pitfall 1: Migration Points at Pooled URL
**What goes wrong:** `prisma migrate deploy` fails with cryptic errors about prepared statements or transaction isolation.
**Why it happens:** Supavisor in transaction mode does not support the prepared statements that Prisma's Schema Engine uses.
**How to avoid:** Always configure `directUrl` in `schema.prisma` pointing to the direct (port 5432) connection string. Prisma CLI commands automatically use `directUrl` when present.
**Warning signs:** Errors mentioning "prepared statement already exists" or "cannot execute in transaction mode".

### Pitfall 2: Forgetting `?pgbouncer=true` on DATABASE_URL
**What goes wrong:** Runtime queries fail intermittently with prepared statement errors.
**Why it happens:** Prisma Client uses named prepared statements by default, which Supavisor in transaction mode does not support.
**How to avoid:** Always append `?pgbouncer=true` to the pooled `DATABASE_URL`. This makes Prisma use unnamed prepared statements.
**Warning signs:** Intermittent "prepared statement X already exists" errors during normal operation.

### Pitfall 3: Supabase Free Tier Auto-Pause
**What goes wrong:** Dev or prod Supabase project becomes unreachable after 7 days of inactivity.
**Why it happens:** Supabase free tier automatically pauses projects after 7 days without activity.
**How to avoid:** For dev: regular usage prevents pause. For prod: monitor activity; if needed, set up a lightweight cron ping or accept the startup delay on resume. Note: paused projects can be unpaused from the dashboard.
**Warning signs:** Connection timeout errors after a period of inactivity.

### Pitfall 4: Leaving Old Migration Lock File
**What goes wrong:** `prisma migrate dev` fails with "migration lock" provider mismatch error.
**Why it happens:** The `migration_lock.toml` file records `provider = "sqlite"`. When you switch to `postgresql`, Prisma detects the mismatch.
**How to avoid:** Delete the entire `prisma/migrations/` directory (including `migration_lock.toml`) before generating the fresh Postgres baseline. The new migration will create a fresh lock file with `provider = "postgresql"`.
**Warning signs:** Error message "Migration provider mismatch".

### Pitfall 5: Mastra PostgresStore Schema Not Auto-Created
**What goes wrong:** Tables fail to create if the `mastra` schema doesn't exist yet in PostgreSQL.
**Why it happens:** PostgresStore auto-creates tables but may not auto-create the PostgreSQL schema itself.
**How to avoid:** Before first Mastra startup, ensure the `mastra` schema exists: `CREATE SCHEMA IF NOT EXISTS mastra;` -- either via a Prisma migration, Supabase SQL editor, or by checking if PostgresStore handles schema creation automatically.
**Warning signs:** "schema mastra does not exist" error on first startup.

### Pitfall 6: Seed Script Fails on Empty Postgres
**What goes wrong:** Seed script fails with foreign key constraint errors or data type mismatches.
**Why it happens:** Unlikely in this project since the seed uses only portable Prisma operations and TEXT columns. However, running seed before migrations would fail.
**How to avoid:** Always run `prisma migrate deploy` before `prisma db seed`. The existing seed.ts should work unchanged since it uses `upsert`, `create`, and `findMany` -- all Prisma Client operations that are database-agnostic.
**Warning signs:** "relation does not exist" errors.

## Code Examples

Verified patterns from official sources:

### schema.prisma Provider Change
```prisma
// Source: Prisma docs - https://www.prisma.io/docs/orm/overview/databases/supabase
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// All existing models remain UNCHANGED
// String fields stay as String (mapped to TEXT in Postgres)
// @default(cuid()) works identically
// DateTime uses timestamptz in Postgres (vs TEXT in SQLite)
// All @@index and @@unique constraints carry over
```

### Mastra Storage Swap (mastra/index.ts)
```typescript
// Source: Mastra docs - https://mastra.ai/reference/storage/postgresql
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
// REMOVE: import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mastra-store",
    connectionString: env.DATABASE_URL,
    schemaName: "mastra",
  }),
  // ... rest unchanged
});
```

### Environment Variables (.env)
```env
# Supabase Pooled Connection (runtime queries via Supavisor)
DATABASE_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Direct Connection (migrations, introspection)
DIRECT_URL="postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### env.ts Update
```typescript
// Source: project pattern - apps/agent/src/env.ts
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // Supabase pooled connection string (runtime)
    DATABASE_URL: z.string().url(),

    // Supabase direct connection string (migrations)
    // Used by Prisma CLI via directUrl in schema.prisma
    DIRECT_URL: z.string().url(),

    // ... rest unchanged
  },
  runtimeEnv: process.env,
})
```

### Baseline Migration Generation
```bash
# Source: Prisma docs - https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/baseline-your-database-typescript-postgresql

# Step 1: Delete old SQLite migrations
rm -rf apps/agent/prisma/migrations/

# Step 2: Generate fresh Postgres baseline
cd apps/agent
mkdir -p prisma/migrations/0_init
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# Step 3: Review generated SQL (CLAUDE.md: inspect before applying)
cat prisma/migrations/0_init/migration.sql

# Step 4: Apply to Supabase
npx prisma migrate deploy
```

### Supabase Project Setup (Manual Steps)
```
1. Go to https://supabase.com/dashboard
2. Create organization (e.g., "lumenalta-hackathon")
3. Create project "lumenalta-dev" (Region: US East, us-east-1)
4. Note the database password (only shown once)
5. Go to Settings > Database > Connection string
6. Copy "URI" for DIRECT_URL (port 5432)
7. Copy "Connection Pooling > URI" for DATABASE_URL (port 6543, append ?pgbouncer=true)
8. Create second organization for prod
9. Create project "lumenalta-prod" (same region)
10. Repeat connection string steps
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@mastra/libsql` for local SQLite | `@mastra/pg` for PostgreSQL | Always available | Enables durable workflow state across restarts |
| `file:./prisma/dev.db` SQLite | Supabase PostgreSQL | This phase | Cloud-hosted, accessible from deployed environments |
| PgBouncer for connection pooling | Supavisor (built into Supabase) | 2024 | Same `?pgbouncer=true` flag works with Supavisor |
| Prisma `directUrl` in schema.prisma | Prisma `directUrl` in schema.prisma (Prisma 6) or `prisma.config.ts` (Prisma 7+) | Prisma 7.x | Project uses Prisma 6.19.2, so schema.prisma `directUrl` is the correct approach |

**Deprecated/outdated:**
- `@mastra/store-pg`: Old package name. Use `@mastra/pg` instead (same functionality, current naming).
- Prisma `shadowDatabaseUrl`: Not needed for this migration since we are generating a clean baseline, not baselining an existing production database.
- Supabase PgBouncer (dedicated): Only available on paid plans. Use Supavisor (included in free tier) instead.

## Open Questions

1. **Does `PostgresStore` auto-create the PostgreSQL schema (`mastra`) or just the tables?**
   - What we know: PostgresStore documentation says it "handles schema creation and updates automatically" and creates 7 tables during initialization.
   - What's unclear: Whether `CREATE SCHEMA IF NOT EXISTS mastra` is executed automatically, or only table creation within an existing schema.
   - Recommendation: Test during implementation. If it fails, add a Prisma migration that creates the schema: `CREATE SCHEMA IF NOT EXISTS mastra;` as a SQL statement in the baseline migration.

2. **Does `DATABASE_URL` need to include `?pgbouncer=true` for `@mastra/pg` PostgresStore?**
   - What we know: Prisma Client requires `?pgbouncer=true` to disable named prepared statements. `@mastra/pg` uses the `pg` driver directly (not Prisma).
   - What's unclear: Whether the `pg` driver uses named prepared statements by default when going through Supavisor.
   - Recommendation: Use the pooled URL without `?pgbouncer=true` for Mastra's PostgresStore (since it uses `pg` directly, not Prisma). If issues arise, either add the parameter or use the direct URL for Mastra. Alternatively, use a separate env var (`MASTRA_DATABASE_URL`) pointing to the direct connection.

3. **Supabase free tier: can both organizations stay active simultaneously?**
   - What we know: Free tier allows 2 active projects (one per organization). Projects auto-pause after 7 days of inactivity.
   - What's unclear: Whether two free organizations with one project each can coexist without issues.
   - Recommendation: Create both during setup. If Supabase restricts this, consolidate to one organization with a paid plan, or accept auto-pause on the prod instance until deployment phase.

## Validation Architecture

> Note: `workflow.nyquist_validation` is not explicitly set in config.json, so validation architecture is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (no test framework installed in project) |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | Supabase connectivity | smoke | Manual: verify `prisma migrate deploy` succeeds against both instances | N/A (manual) |
| DB-02 | Provider switched, baseline applied | smoke | `cd apps/agent && npx prisma migrate status` | N/A (manual) |
| DB-03 | Models work against Postgres | smoke | `cd apps/agent && pnpm dev` then test API endpoints | N/A (manual) |
| DB-04 | Mastra state persists across restart | manual-only | Trigger Touch 4, suspend at HITL, restart server, verify resume | N/A (manual) |
| DB-05 | Seed data loads | smoke | `cd apps/agent && npx prisma db seed` | N/A (manual) |

### Sampling Rate
- **Per task commit:** Manual smoke test (start server, verify no errors)
- **Per wave merge:** Full manual walkthrough (seed + all workflows + restart persistence)
- **Phase gate:** All 5 success criteria verified manually

### Wave 0 Gaps
None -- this phase is infrastructure/configuration changes. Validation is inherently manual (verify connectivity, server startup, seed success, workflow durability). No automated test framework exists in the project.

## Sources

### Primary (HIGH confidence)
- [@mastra/pg npm registry](https://www.npmjs.com/package/@mastra/pg) - Version 1.7.1 confirmed, peer deps verified, dependencies checked
- [Mastra PostgreSQL Storage Reference](https://mastra.ai/reference/storage/postgresql) - Constructor params, `schemaName`, auto-table-creation, pool options
- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer) - `directUrl`, `?pgbouncer=true`, dual connection string pattern
- [Supabase Database Connections](https://supabase.com/docs/guides/database/connecting-to-postgres) - Connection string formats, port numbers, pooler modes
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) - `directUrl` support in Prisma 6.x

### Secondary (MEDIUM confidence)
- [Prisma Baseline Migration Guide](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/baseline-your-database-typescript-postgresql) - `prisma migrate diff` approach for fresh baseline
- [Supabase Prisma Integration](https://supabase.com/docs/guides/database/prisma) - Supabase-specific Prisma setup guidance
- [Supabase Pricing](https://supabase.com/pricing) - Free tier: 2 projects, 500 MB, auto-pause after 7 days

### Tertiary (LOW confidence)
- Supabase free tier organization limits (2 organizations, 1 active project each) - sourced from community discussions, not official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `@mastra/pg` verified on npm with compatible peer deps; Prisma 6.19.2 supports `directUrl`; all verified via primary sources
- Architecture: HIGH - Dual connection string pattern is well-documented by both Prisma and Supabase; `schemaName` parameter confirmed in Mastra docs
- Pitfalls: HIGH - Common issues (pooler vs direct URL, prepared statements, migration lock) are well-documented across official sources
- Schema migration: HIGH - `prisma migrate diff --from-empty` is the documented approach for provider changes

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain; Prisma 6.x is current; `@mastra/pg` is actively maintained)
