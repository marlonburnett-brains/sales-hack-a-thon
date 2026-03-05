# Phase 14: Database Migration - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all application data (Prisma/SQLite) and workflow state (Mastra/LibSQL) from local SQLite files to Supabase PostgreSQL. Both dev and prod Supabase instances provisioned. All existing workflows execute against Postgres without application code changes. Seed data loads on dev. Prod has schema only.

</domain>

<decisions>
## Implementation Decisions

### Schema adaptation
- Keep all String fields for JSON storage (no JSONB upgrade) — matches success criteria "no application code changes"
- Keep CUIDs for all IDs (no switch to UUIDs) — zero changes, works fine in Postgres TEXT columns
- Clean slate for migrations: delete SQLite migration directory, generate one fresh Postgres baseline migration
- All existing `@@index` and `@@unique` constraints carry over as-is

### Supabase setup
- Starting from scratch — no existing Supabase projects or organization
- Region: US East (N. Virginia / us-east-1) — standard choice, good latency, aligns with future Oracle Cloud VM region
- Pricing tier: Free tier for both dev and prod instances — sufficient for hackathon/demo use
- Connection pooling: Use pooled connection strings (Supavisor) for both Prisma and Mastra — better for deployed environments

### Mastra storage backend
- Research-first approach: verify `@mastra/pg` package exists and is stable; if yes, use it; if not, fall back to `@mastra/drizzle` with pg adapter or keep `@mastra/libsql` pointed at Turso cloud
- Same database, separate schemas: Prisma uses `public` schema, Mastra uses `mastra` schema — single Supabase project per environment, clean separation
- Verify workflow durability: manually smoke test suspend/resume (trigger Touch 4, suspend at HITL, restart server, verify resume) — directly validates success criteria #3

### Seed data
- Port existing seed.ts to Postgres with same Meridian Capital Group demo scenario
- Dev only — prod starts empty (matches success criteria #5: "prod instance exists with same schema but no seed data")
- Idempotent seed script using upserts — safe to run multiple times without creating duplicates

### Claude's Discretion
- Prisma provider config details (extensions, preview features)
- Connection string format and env var naming conventions
- Migration baseline SQL generation approach
- Mastra schema namespace configuration

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint is "no application code changes" for existing workflows.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/prisma/schema.prisma`: 8 models, currently SQLite provider — change to `postgresql`
- `apps/agent/prisma/seed.ts`: Existing seed script for Meridian Capital Group demo — port to Postgres-compatible
- `apps/agent/src/mastra/index.ts`: Mastra initialization with LibSQLStore — swap to Postgres adapter

### Established Patterns
- Two-database architecture: Prisma for app data, separate store for Mastra workflow state
- PrismaClient instantiated once in `mastra/index.ts` and used across all API routes
- JSON stored as String with manual `JSON.parse()`/`JSON.stringify()` — must preserve this pattern
- `env.ts` for environment variable validation — will need new Supabase connection vars

### Integration Points
- `DATABASE_URL` env var in `.env` — currently `file:./prisma/dev.db`, will become Supabase pooled connection string
- Mastra storage config in `mastra/index.ts` line 34 — `LibSQLStore` → Postgres adapter
- `apps/agent/package.json` — `@mastra/libsql` dependency → add/replace with Postgres adapter
- 4 existing SQLite migrations in `prisma/migrations/` — will be deleted and replaced with fresh Postgres baseline

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-database-migration*
*Context gathered: 2026-03-04*
