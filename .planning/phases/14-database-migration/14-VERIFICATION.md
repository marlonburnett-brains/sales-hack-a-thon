---
phase: 14-database-migration
verified: 2026-03-05T04:00:00Z
status: human_needed
score: 6/6 automated must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Start agent server and verify it connects to Supabase PostgreSQL without errors"
    expected: "pnpm dev in apps/agent starts on port 4111 with no connection errors or import errors"
    why_human: "Cannot run the server programmatically; requires live Supabase credentials in .env"
  - test: "Verify all Touch 1-4 and Pre-Call workflows execute against PostgreSQL"
    expected: "Existing workflows run against Supabase dev with no application code changes (success criterion 2)"
    why_human: "End-to-end workflow execution requires live server + Supabase instance + Google API credentials"
  - test: "Verify a suspended HITL workflow survives agent server restart"
    expected: "A Touch 4 workflow paused at brief approval checkpoint is still in pending_approval state after server restart (Mastra state in Postgres, not local file)"
    why_human: "Requires running a full Touch 4 workflow up to HITL checkpoint, stopping server, restarting, and re-fetching workflow state"
  - test: "Verify Meridian Capital Group seed data appears in web UI"
    expected: "http://localhost:3000 shows Meridian Capital Group and 'Enterprise Digital Transformation - Q1 2026' deal"
    why_human: "UI rendering cannot be verified programmatically"
  - test: "Verify Supabase prod instance has schema applied but no seed data"
    expected: "8+ tables exist in prod public schema; all tables are empty (no Meridian Capital Group data)"
    why_human: "Requires Supabase dashboard access or prod connection credentials not present in repo"
---

# Phase 14: Database Migration Verification Report

**Phase Goal:** Migrate from local SQLite to Supabase PostgreSQL — single-database architecture with schema isolation (public for Prisma, mastra for workflow state). All existing application data and Mastra workflow state persists in Supabase PostgreSQL.
**Verified:** 2026-03-05T04:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths from PLAN frontmatter must_haves verified. Additional truths derived from ROADMAP success criteria.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Prisma schema declares postgresql provider with pooled + direct connection strings | VERIFIED | `provider = "postgresql"`, `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")` in schema.prisma lines 5-9 |
| 2 | A single Postgres baseline migration exists with DDL for all 9 models | VERIFIED | `0_init/migration.sql` contains 9 CREATE TABLE statements (WorkflowJob, ImageAsset, ContentSource, Company, Deal, InteractionRecord, FeedbackSignal, Transcript, Brief); migration_lock.toml shows `provider = "postgresql"` |
| 3 | Mastra uses PostgresStore with schemaName 'mastra' instead of LibSQLStore | VERIFIED | `import { PostgresStore } from "@mastra/pg"` and `new PostgresStore({ id: "mastra-store", connectionString: env.DATABASE_URL, schemaName: "mastra" })` in mastra/index.ts lines 3, 34-38 |
| 4 | @mastra/pg is installed and @mastra/libsql is removed | VERIFIED | `"@mastra/pg": "^1.7.1"` in package.json; zero `@mastra/libsql` references across all .ts and .json files |
| 5 | env.ts validates both DATABASE_URL and DIRECT_URL | VERIFIED | `DATABASE_URL: z.string().url()` and `DIRECT_URL: z.string().url()` in env.ts lines 7-9 |
| 6 | Seed script is idempotent using upsert patterns | VERIFIED | `prisma.company.upsert`, `prisma.contentSource.upsert`, and existence checks (`findMany` before `create`) for Deal and InteractionRecord in seed.ts |
| 7 | Supabase dev instance is reachable and Prisma can connect | ? NEEDS HUMAN | Cannot verify live connectivity without running the server against real credentials |
| 8 | All existing workflows execute against PostgreSQL without application code changes | ? NEEDS HUMAN | Requires live server execution |
| 9 | A suspended HITL workflow can be resumed after agent server restart | ? NEEDS HUMAN | Requires full Touch 4 workflow run + server restart cycle |
| 10 | Meridian Capital Group seed scenario appears in web UI | ? NEEDS HUMAN | UI rendering requires running both agent and web app |
| 11 | Supabase prod has schema applied but no seed data | ? NEEDS HUMAN | Requires prod Supabase credentials or dashboard access |

**Automated Score:** 6/6 must-haves verified
**ROADMAP Success Criteria:** 5 items — all flagged for human verification (programmatic checks pass on code artifacts; runtime behavior unverifiable)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/prisma/schema.prisma` | PostgreSQL datasource with directUrl | VERIFIED | provider = "postgresql", url = env("DATABASE_URL"), directUrl = env("DIRECT_URL") |
| `apps/agent/prisma/migrations/0_init/migration.sql` | Postgres baseline DDL for all 9 models | VERIFIED | 9 CREATE TABLE statements, valid Postgres SQL, no warning text, all FK constraints present |
| `apps/agent/prisma/migrations/migration_lock.toml` | provider = "postgresql" lock | VERIFIED | `provider = "postgresql"` |
| `apps/agent/src/env.ts` | DIRECT_URL env var validation | VERIFIED | DIRECT_URL: z.string().url() on line 9 |
| `apps/agent/src/mastra/index.ts` | PostgresStore storage config | VERIFIED | PostgresStore imported from @mastra/pg, instantiated with schemaName: "mastra" |
| `apps/agent/.env.example` | Template with Supabase connection strings | VERIFIED | DATABASE_URL pooled (port 6543) and DIRECT_URL direct (port 5432) documented with format strings |
| `apps/agent/prisma/seed.ts` | Idempotent seed script for Postgres | VERIFIED | prisma.company.upsert, prisma.contentSource.upsert, existence checks before create |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/agent/prisma/schema.prisma` | DATABASE_URL env var | `url = env("DATABASE_URL")` in datasource | WIRED | Line 7: `url = env("DATABASE_URL")` — exact pattern match |
| `apps/agent/prisma/schema.prisma` | DIRECT_URL env var | `directUrl = env("DIRECT_URL")` in datasource | WIRED | Line 8: `directUrl = env("DIRECT_URL")` — exact pattern match |
| `apps/agent/src/mastra/index.ts` | DATABASE_URL env var | `connectionString` in PostgresStore constructor | WIRED | Line 36: `connectionString: env.DATABASE_URL` — env object used, not process.env directly |
| `apps/agent/prisma/seed.ts` | Supabase dev Postgres | PrismaClient using DATABASE_URL | WIRED | `new PrismaClient()` on line 3 — Prisma Client reads DATABASE_URL from env at runtime |

### Requirements Coverage

All 5 requirement IDs appear across the two plans. Cross-referenced against REQUIREMENTS.md.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DB-01 | 14-01-PLAN (req), 14-02-PLAN (req) | Supabase dev and prod projects created with Prisma-compatible connection strings | SATISFIED | schema.prisma uses postgresql provider; .env.example documents Supabase connection string format; SUMMARY-01 confirms Supabase dev created and connected |
| DB-02 | 14-01-PLAN | Prisma provider switched from sqlite to postgresql with fresh migration baseline | SATISFIED | `provider = "postgresql"` in schema.prisma; `0_init/migration.sql` is Postgres DDL (9 tables); migration_lock.toml locked to postgresql |
| DB-03 | 14-01-PLAN, 14-02-PLAN | All existing Prisma models work against Supabase Postgres without application code changes | SATISFIED (programmatic) | All 9 models in schema.prisma match migration.sql exactly; no application code modified beyond env.ts, mastra/index.ts, schema.prisma, package.json — as planned. Runtime execution needs human verification |
| DB-04 | 14-01-PLAN | Mastra workflow state persists in durable Postgres storage (not local SQLite file) | SATISFIED (programmatic) | PostgresStore with schemaName "mastra" configured in mastra/index.ts; @mastra/libsql fully removed; runtime HITL durability requires human verification |
| DB-05 | 14-02-PLAN | Seed data loads successfully against Supabase dev instance | SATISFIED (programmatic) | seed.ts is substantive and idempotent; SUMMARY-02 documents successful seed run; runtime confirmation requires human |

**Orphaned Requirements Check:** REQUIREMENTS.md traceability table maps DB-01 through DB-05 exclusively to Phase 14. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/agent/prisma/schema.prisma` | 142 | Stale SQLite comment: `// Full transcript text (SQLite TEXT, no practical limit)` | Info | Cosmetic only — comment describes old storage type. Does not affect functionality. No action required before deployment. |
| `apps/agent/prisma/schema.prisma` | 163 | Stale SQLite comment: `// JSON array of strings (SQLite has no array type)` | Info | Cosmetic only — comment references SQLite limitation that no longer applies. Does not affect functionality. |

No blockers or warnings found. Both issues are informational stale comments.

**Commit hash discrepancy (informational):** SUMMARY-02 documented plan metadata commit as `93d30f1`. The actual docs commit is `e77de64`. Git confirms `93d30f1` resolves to a real commit hash (it is a valid prefix). Non-blocking discrepancy in documentation.

### Human Verification Required

#### 1. Agent Server Connectivity to Supabase

**Test:** `cd apps/agent && pnpm dev`
**Expected:** Server starts on port 4111 with no connection errors. Logs should show Mastra initialization and PostgresStore connecting to the `mastra` schema.
**Why human:** Cannot run the server programmatically without live Supabase credentials in .env (not committed to repo).

#### 2. Existing Workflows Execute Against PostgreSQL

**Test:** After server starts, trigger a Touch 1 workflow or Pre-Call Briefing via the web UI or API.
**Expected:** Workflow runs to completion using Supabase PostgreSQL with no application code errors. `curl http://localhost:4111/api/companies` returns Meridian Capital Group.
**Why human:** End-to-end workflow execution requires live server + Supabase instance + Google API credentials.

#### 3. HITL Workflow State Survives Server Restart (DB-04 Runtime Verification)

**Test:** (1) Trigger Touch 4 workflow through to the brief approval HITL checkpoint. (2) Stop the agent server with Ctrl+C. (3) Restart with `pnpm dev`. (4) Check that the workflow is still in `pending_approval` state — not lost.
**Expected:** Mastra PostgresStore persists workflow snapshot in the `mastra` schema across restart. Brief record still shows `approvalStatus: "pending_approval"`.
**Why human:** Requires full workflow execution to a suspend point followed by server restart — cannot simulate programmatically.

#### 4. Web UI Displays Seed Data (DB-05 Runtime Verification)

**Test:** Start both `apps/agent` and `apps/web` (pnpm dev in each). Open http://localhost:3000.
**Expected:** Meridian Capital Group company and "Enterprise Digital Transformation - Q1 2026" deal appear in the UI. Touch 1 approved interaction visible in the deal timeline.
**Why human:** UI rendering requires running both apps; visual output cannot be verified programmatically.

#### 5. Supabase Prod Has Schema But No Seed Data (DB-01 Prod Verification)

**Test:** Open the Supabase dashboard for the prod project (lumenalta-prod). Go to Table Editor.
**Expected:** 9 tables exist in the `public` schema (WorkflowJob, ImageAsset, ContentSource, Company, Deal, InteractionRecord, FeedbackSignal, Transcript, Brief). All tables are empty — no Meridian Capital Group data.
**Why human:** Requires Supabase dashboard access or prod connection credentials not committed to repo.

### Gaps Summary

No automated gaps. All 6 plan must_haves verified at all three levels (exists, substantive, wired). All 5 requirement IDs (DB-01 through DB-05) are accounted for and satisfied at the code level.

The 5 human verification items are runtime/connectivity checks that cannot be executed programmatically. They verify behaviors that depend on live infrastructure (Supabase connection, Google APIs, web UI rendering) rather than code correctness, which has been fully verified.

The two stale SQLite comments in schema.prisma are informational only and do not affect functionality.

---
_Verified: 2026-03-05T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
