# Phase 18: CI/CD Pipeline & pgvector Schema - Research

**Researched:** 2026-03-05
**Domain:** GitHub Actions CI/CD, Vercel CLI deployment, Railway CLI deployment, Prisma migrations, pgvector/HNSW
**Confidence:** HIGH

## Summary

This phase delivers two distinct but related capabilities: (1) a GitHub Actions pipeline that lints, type-checks, builds, migrates, and deploys both apps on every push to main, and (2) the pgvector foundation (extension + slide_embeddings table + HNSW index) via a Prisma migration with raw SQL.

The CI/CD pipeline is well-trodden territory -- Vercel CLI and Railway CLI both have documented GitHub Actions patterns. The main complexity is sequencing: migration must succeed before either app deploys, and native auto-deploy must be disabled on both platforms to prevent double deploys. The pgvector schema work requires careful handling of Prisma's limitations around custom index types (HNSW indexes are not natively understood by Prisma's schema engine, so they must be managed via raw SQL in migration files).

**Primary recommendation:** Build a single GitHub Actions workflow with sequential jobs (lint/build -> migrate -> deploy-agent -> deploy-web) using Vercel CLI `--prebuilt` and Railway CLI `--ci` flags. Create the pgvector migration using `prisma migrate dev --create-only` with hand-written raw SQL for the extension, table, and HNSW index.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Push to main only -- no PR checks, no manual dispatch
- GitHub Actions controls all deploys (Vercel CLI + Railway CLI)
- Disable native auto-deploy on both Vercel and Railway to prevent double deploys
- Sequential deploy order: migrate -> agent -> web
- Single pipeline: lint + type-check + build -> migrate -> deploy agent -> deploy web
- Dedicated migration job that runs before any deploy jobs
- Uses `prisma migrate deploy` against prod database only (dev DB managed locally)
- DATABASE_URL stored as GitHub Actions secret
- Hard stop on migration failure -- no apps deploy if migration fails
- Forward-only migrations (per project rule -- never reset)
- Enable pgvector via Prisma migration with raw SQL (`CREATE EXTENSION IF NOT EXISTS vector`)
- Embedding dimension: 768 (text-embedding-005)
- Full classification column set in slide_embeddings table (template_id, slide_index, content_text, embedding(768), industry, solution_pillar, persona, funnel_stage, content_type, confidence, created_at, updated_at)
- HNSW index with default params (m=16, ef_construction=64) using cosine distance
- Prisma 6.19.x constraint honored (7.x has vector migration regression)

### Claude's Discretion
- Exact GitHub Actions workflow YAML structure and job naming
- Vercel CLI vs Vercel Deploy Hook implementation details
- Railway CLI authentication method in CI
- Whether to use Prisma's `Unsupported("vector(768)")` type annotation or raw SQL for the embedding column
- HNSW index creation timing (same migration or separate)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | Push to main triggers automated lint, type-check, and build via GitHub Actions | Turborepo + pnpm GitHub Actions workflow pattern; `pnpm/action-setup@v3` + `actions/setup-node@v4` with cache |
| CICD-02 | Web app auto-deploys to Vercel after checks pass | Vercel CLI `vercel pull` + `vercel build --prod` + `vercel deploy --prebuilt --prod`; project already linked at root |
| CICD-03 | Agent auto-deploys to Railway after checks pass | Railway CLI container `ghcr.io/railwayapp/cli:latest`; `railway up --service=SVC_ID --ci` |
| CICD-04 | Pending Prisma migrations auto-run against target database before deploy | `prisma migrate deploy` in dedicated job; DATABASE_URL from GitHub secrets |
| SLIDE-01 | pgvector extension enabled in Supabase with slide embeddings table and HNSW index | Raw SQL migration: CREATE EXTENSION, CREATE TABLE, CREATE INDEX USING hnsw |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | v2 workflow syntax | CI/CD orchestration | Native to GitHub, zero additional cost, YAML-based |
| Vercel CLI | latest (npm) | Web app deployment | Official CLI; `--prebuilt` pattern avoids double builds |
| Railway CLI | latest (container image) | Agent deployment | Official container `ghcr.io/railwayapp/cli:latest` |
| Prisma CLI | 6.19.2 (locked) | Database migrations | Already in project; `migrate deploy` for CI |
| pgvector | Supabase-bundled | Vector operations | Pre-installed on Supabase; just needs `CREATE EXTENSION` |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| pnpm/action-setup | v3 | pnpm installation in CI | Every workflow run |
| actions/setup-node | v4 | Node.js + pnpm cache | Every workflow run; use `cache: 'pnpm'` |
| actions/checkout | v4 | Repository checkout | Every workflow run; `fetch-depth: 2` for diff detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel CLI deploy | Vercel Deploy Hooks | Deploy hooks are simpler (one curl) but don't support `--prebuilt` pattern, so builds happen twice (GH Actions + Vercel). CLI is better for monorepo control. |
| Railway CLI container | `npm install -g @railway/cli` | Container image is faster (no install step) and always has correct version |
| Raw SQL migration | Prisma schema `Unsupported("vector(768)")` | Unsupported type works for column definition but cannot define HNSW index; raw SQL gives full control |

## Architecture Patterns

### Recommended Project Structure
```
.github/
└── workflows/
    └── deploy.yml           # Single workflow file for the entire pipeline
apps/
├── agent/
│   └── prisma/
│       └── migrations/
│           ├── 0_init/
│           └── YYYYMMDD_add_pgvector_slide_embeddings/
│               └── migration.sql    # Raw SQL: extension + table + index
└── web/
.vercel/
    └── project.json          # Already exists (projectId + orgId)
railway.toml                  # Already exists
```

### Pattern 1: Single Workflow with Sequential Jobs
**What:** One workflow file with dependent jobs using `needs:` to enforce ordering.
**When to use:** Always -- this is the locked decision.
**Example:**
```yaml
# Source: Vercel KB + Railway docs + Turborepo docs
name: Deploy
on:
  push:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint build

  migrate:
    needs: checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx prisma migrate deploy
        working-directory: apps/agent
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  deploy-agent:
    needs: migrate
    runs-on: ubuntu-latest
    container: ghcr.io/railwayapp/cli:latest
    env:
      RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - run: railway up --service ${{ vars.RAILWAY_SERVICE_ID }} --ci

  deploy-web:
    needs: migrate
    runs-on: ubuntu-latest
    env:
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npm install --global vercel@latest
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Pattern 2: pgvector Migration with Raw SQL
**What:** A Prisma migration created with `--create-only`, then hand-edited with raw SQL for pgvector.
**When to use:** For the slide_embeddings table and HNSW index.
**Example:**
```sql
-- Source: Supabase pgvector docs + pgvector GitHub
-- Migration: add_pgvector_slide_embeddings

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create slide_embeddings table
CREATE TABLE "SlideEmbedding" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "templateId"      TEXT NOT NULL,
    "slideIndex"      INTEGER NOT NULL,
    "contentText"     TEXT NOT NULL,
    "embedding"       vector(768) NOT NULL,
    "industry"        TEXT,
    "solutionPillar"  TEXT,
    "persona"         TEXT,
    "funnelStage"     TEXT,
    "contentType"     TEXT,
    "confidence"      DOUBLE PRECISION,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideEmbedding_pkey" PRIMARY KEY ("id")
);

-- HNSW index for cosine similarity search
CREATE INDEX "SlideEmbedding_embedding_idx"
    ON "SlideEmbedding"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Composite index for filtering by template
CREATE INDEX "SlideEmbedding_templateId_idx" ON "SlideEmbedding"("templateId");
```

### Pattern 3: Prisma Schema with Unsupported Type
**What:** Declare the model in schema.prisma using `Unsupported("vector(768)")` so Prisma Client is aware of the table structure, while the actual column and index are managed by raw SQL.
**When to use:** To enable Prisma Client to query the table (with raw queries for vector operations).
**Example:**
```prisma
// Source: Prisma docs on Unsupported types
model SlideEmbedding {
  id             String   @id @default(cuid())
  templateId     String
  slideIndex     Int
  contentText    String
  embedding      Unsupported("vector(768)")
  industry       String?
  solutionPillar String?
  persona        String?
  funnelStage    String?
  contentType    String?
  confidence     Float?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([templateId])
  @@index([embedding], name: "SlideEmbedding_embedding_idx")
}
```

**CRITICAL NOTE on `@@index` for HNSW:** Prisma does not natively support `USING hnsw` or operator classes like `vector_cosine_ops`. Including `@@index([embedding])` in the schema prevents Prisma from detecting the index as drift, but the actual HNSW index must be created via raw SQL in the migration file. The `@@index` annotation produces a standard btree index in the generated SQL, so the migration file MUST be edited to replace it with the HNSW version.

### Anti-Patterns to Avoid
- **Running `prisma migrate dev` in CI:** Use `prisma migrate deploy` only. `migrate dev` is interactive and can create/modify migrations.
- **Using `prisma db push` anywhere:** Project rule explicitly prohibits this.
- **Letting Vercel/Railway auto-deploy:** Creates race conditions with migrations. Disable native auto-deploy on both platforms.
- **Putting DATABASE_URL in code or .env committed to git:** Use GitHub Actions secrets exclusively.
- **Creating the HNSW index without `--create-only`:** If you let Prisma auto-generate the migration SQL, subsequent `migrate dev` runs will drop the HNSW index because Prisma doesn't understand it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CI/CD orchestration | Custom shell scripts | GitHub Actions workflow YAML | Built-in parallelism, secrets management, job dependencies |
| Vercel deployment | Custom API calls to Vercel REST API | Vercel CLI (`vercel deploy --prebuilt`) | Handles auth, project linking, build artifacts correctly |
| Railway deployment | Docker build + push to registry | Railway CLI (`railway up --ci`) | Railway handles Docker build from Dockerfile internally |
| Vector similarity search | Custom distance functions in SQL | pgvector `<=>` operator (cosine) | Native C implementation, uses HNSW index automatically |
| Migration orchestration | Custom migration runner script | `prisma migrate deploy` | Tracks migration state, handles failures, idempotent |

**Key insight:** Every tool in this pipeline has a CLI purpose-built for CI/CD. Using them via their CLIs (not APIs or custom scripts) is both simpler and more maintainable.

## Common Pitfalls

### Pitfall 1: Double Deploys from Native Auto-Deploy
**What goes wrong:** Both GitHub Actions and Vercel/Railway's native git integration trigger deploys, causing duplicate deployments.
**Why it happens:** Vercel and Railway auto-deploy on push by default when connected to a GitHub repo.
**How to avoid:** Disable auto-deploy in Vercel project settings (Settings > Git > Deployment) and Railway service settings (Settings > Source > uncheck auto-deploy). Do this BEFORE the first workflow push.
**Warning signs:** Two deployments appearing for each push in Vercel/Railway dashboards.

### Pitfall 2: HNSW Index Dropped by Prisma
**What goes wrong:** Running `prisma migrate dev` after creating an HNSW index generates a new migration that drops it.
**Why it happens:** Prisma's schema engine doesn't recognize HNSW as a valid index type. It sees it as drift from the schema and "fixes" it by dropping.
**How to avoid:** (1) Include `@@index([embedding], name: "SlideEmbedding_embedding_idx")` in the Prisma schema so Prisma knows an index exists. (2) Always use `--create-only` for future migrations and inspect the SQL before applying. (3) In CI, only `prisma migrate deploy` is used, which applies migration files as-is (no schema drift detection).
**Warning signs:** Migration file containing `DROP INDEX "SlideEmbedding_embedding_idx"`.

### Pitfall 3: Missing Prisma in Production Dependencies
**What goes wrong:** `prisma migrate deploy` fails in CI because `prisma` CLI is a devDependency.
**Why it happens:** CI may install with `--prod` flag, skipping devDependencies.
**How to avoid:** Use `pnpm install --frozen-lockfile` (installs all deps including dev). The migrate job only needs to run the CLI, not build the app.

### Pitfall 4: Vercel Build Fails Without Environment Variables
**What goes wrong:** `vercel build --prod` fails because Next.js env validation (`@t3-oss/env-nextjs`) runs at build time.
**Why it happens:** `vercel pull` fetches environment variables from Vercel project settings, but if variables are missing there, the build fails.
**How to avoid:** Ensure all required env vars are set in Vercel project settings before the first CI deploy. The existing `apps/web/src/env.ts` file validates `AGENT_SERVICE_URL`, `AGENT_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Pitfall 5: Railway Service ID vs Project Token Confusion
**What goes wrong:** `railway up` deploys to wrong service or fails auth.
**Why it happens:** Railway project tokens are scoped to a project, but you still need to specify which service within the project.
**How to avoid:** Use `RAILWAY_TOKEN` (project token, stored as secret) + `--service=SERVICE_ID` (can be a GitHub variable, not secret -- service IDs are not sensitive).

### Pitfall 6: pgvector Extension Not Available
**What goes wrong:** `CREATE EXTENSION IF NOT EXISTS vector` fails.
**Why it happens:** The database user might not have permission, or pgvector isn't installed on the server.
**How to avoid:** Supabase includes pgvector out of the box. Use the `postgres` role (which Supabase provides via `DATABASE_URL`). If using the pooled connection string, note that some DDL operations may not work through PgBouncer -- use the direct connection URL (`DIRECT_URL`) for migrations.

### Pitfall 7: Using Pooled URL for Migrations
**What goes wrong:** `prisma migrate deploy` hangs or fails with connection errors.
**Why it happens:** Supabase's pooled connection goes through PgBouncer, which doesn't support the extended query protocol needed by some migration operations.
**How to avoid:** The Prisma schema already uses `directUrl` for migrations. Ensure the CI `DATABASE_URL` points to the direct connection (port 5432, not 6543) or set both `DATABASE_URL` and `DIRECT_URL` in CI secrets.

## Code Examples

### Vercel CLI Monorepo Deploy (Production)
```bash
# Source: Vercel KB official docs
# Run from monorepo root. Vercel CLI reads .vercel/project.json for project ID.
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

### Railway CLI Deploy (CI mode)
```bash
# Source: Railway docs - CLI deploying
# Container: ghcr.io/railwayapp/cli:latest
# RAILWAY_TOKEN env var handles auth automatically
railway up --service=$RAILWAY_SERVICE_ID --ci
# --ci streams build logs and exits when build completes
```

### Prisma Migrate Deploy (CI)
```bash
# Source: Prisma docs - deploy database changes
# Run from apps/agent directory where schema.prisma lives
npx prisma migrate deploy
# Applies all pending migrations in order
# Exits non-zero on failure (migration job fails, blocking deploys)
```

### pgvector Cosine Similarity Query (for later phases)
```sql
-- Source: Supabase pgvector docs
-- Find top 5 most similar slides using cosine distance
SELECT id, "templateId", "slideIndex", "contentText",
       1 - ("embedding" <=> $1::vector) as similarity
FROM "SlideEmbedding"
WHERE "industry" = $2
ORDER BY "embedding" <=> $1::vector
LIMIT 5;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel GitHub integration auto-deploy | Vercel CLI `--prebuilt` via GitHub Actions | 2023+ | Build once in CI, deploy artifacts. Faster, more control. |
| Railway GitHub auto-deploy | Railway CLI via container in GHA | 2024+ | Sequential control, migration-first ordering |
| IVFFlat indexes for pgvector | HNSW indexes | pgvector 0.5.0 (2023) | Better recall, no need for training data, better for small datasets |
| Prisma 7.x | Prisma 6.19.x (pinned) | Ongoing | Prisma 7.x has vector migration regression (issue #28867) |

**Deprecated/outdated:**
- Prisma `postgresqlExtensions` preview feature: Not needed for this approach. Raw SQL in migration files is more reliable for pgvector.
- IVFFlat indexes: HNSW is strictly better for this use case (small dataset, high recall needed).

## Open Questions

1. **Vercel project root directory setting**
   - What we know: `.vercel/project.json` exists at monorepo root with projectId. Vercel CLI will work from root.
   - What's unclear: Whether Vercel project settings have "Root Directory" set to `apps/web`. If not, `vercel build` may not find the Next.js app.
   - Recommendation: Verify in Vercel dashboard that Root Directory is set to `apps/web`. If not, set it before first CI deploy.

2. **Railway service ID**
   - What we know: `railway.toml` exists at repo root. Railway CLI needs `--service=SERVICE_ID`.
   - What's unclear: The exact service ID value.
   - Recommendation: Get service ID from Railway dashboard (Settings > Service > Service ID) and add as `RAILWAY_SERVICE_ID` GitHub variable.

3. **Direct URL for CI migrations**
   - What we know: Prisma schema uses `directUrl` for non-pooled connections. Supabase provides both pooled (port 6543) and direct (port 5432) URLs.
   - What's unclear: Whether the CI environment needs `DIRECT_URL` as a separate secret or if `DATABASE_URL` should point to the direct connection.
   - Recommendation: Set `DATABASE_URL` to the direct connection string (port 5432) in GitHub secrets for the migration job. This avoids PgBouncer issues.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (CI/CD pipeline + database schema) |
| Config file | `.github/workflows/deploy.yml` |
| Quick run command | `act -j checks` (local) or push to main (remote) |
| Full suite command | Push to main and verify all jobs pass in GitHub Actions |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CICD-01 | Push triggers lint + type-check + build | smoke | Push to main, check GHA run | N/A (workflow) |
| CICD-02 | Web deploys to Vercel after checks | smoke | Check Vercel deployment URL after push | N/A (workflow) |
| CICD-03 | Agent deploys to Railway after checks | smoke | Check Railway deployment logs after push | N/A (workflow) |
| CICD-04 | Prisma migrations run before deploy | smoke | Check migration job logs in GHA | N/A (workflow) |
| SLIDE-01 | pgvector + slide_embeddings + HNSW index | manual | `SELECT * FROM pg_extension WHERE extname = 'vector';` + `\d "SlideEmbedding"` + `\di "SlideEmbedding_embedding_idx"` | N/A (SQL) |

### Sampling Rate
- **Per task commit:** Lint + build locally with `pnpm turbo lint build`
- **Per wave merge:** Push to main and verify full pipeline passes
- **Phase gate:** All 5 GHA jobs green + pgvector extension confirmed + slide_embeddings table verified

### Wave 0 Gaps
- [ ] `.github/workflows/deploy.yml` -- the workflow file itself (core deliverable)
- [ ] Migration file for pgvector + slide_embeddings (core deliverable)
- [ ] GitHub secrets configured: `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`
- [ ] GitHub variables configured: `RAILWAY_SERVICE_ID`
- [ ] Vercel auto-deploy disabled
- [ ] Railway auto-deploy disabled

## Sources

### Primary (HIGH confidence)
- [Vercel KB - GitHub Actions with Vercel](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) - Vercel CLI workflow pattern
- [Railway Blog - GitHub Actions](https://blog.railway.com/p/github-actions) - Railway CLI container pattern
- [Railway Docs - CLI Deploying](https://docs.railway.com/cli/deploying) - `railway up` flags (--ci, --service)
- [Turborepo Docs - GitHub Actions](https://turborepo.dev/repo/docs/ci/github-actions) - pnpm + turbo CI pattern
- [Prisma Docs - Deploy Database Changes](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) - `prisma migrate deploy` for CI
- [Supabase Docs - pgvector](https://supabase.com/docs/guides/database/extensions/pgvector) - pgvector extension + vector columns
- [Prisma Docs - PostgreSQL Extensions](https://www.prisma.io/docs/orm/prisma-schema/postgresql-extensions) - raw SQL migration for extensions

### Secondary (MEDIUM confidence)
- [Prisma Issue #28414](https://github.com/prisma/prisma/issues/28414) - HNSW index dropped by migrate dev
- [Prisma Issue #27770](https://github.com/prisma/prisma/issues/27770) - Workaround: @@index in schema to prevent drift detection
- [Prisma Issue #28867](https://github.com/prisma/prisma/issues/28867) - Prisma 7.x vector migration regression

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools are officially documented with CI/CD patterns
- Architecture: HIGH - workflow pattern is well-established; pgvector SQL is standard PostgreSQL
- Pitfalls: HIGH - HNSW index issue verified via multiple Prisma GitHub issues; double-deploy and connection pooling issues are well-documented

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable tools, 30-day validity)
