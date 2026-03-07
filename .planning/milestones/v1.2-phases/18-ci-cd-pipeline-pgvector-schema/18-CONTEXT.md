# Phase 18: CI/CD Pipeline & pgvector Schema - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Every push to main automatically lints, builds, migrates, and deploys -- and the database is ready for vector operations. This phase delivers the GitHub Actions pipeline and the pgvector foundation (extension + slide_embeddings table). Template management UI, slide ingestion logic, and preview features are separate phases.

</domain>

<decisions>
## Implementation Decisions

### CI/CD trigger strategy
- Push to main only -- no PR checks, no manual dispatch
- GitHub Actions controls all deploys (Vercel CLI + Railway CLI)
- Disable native auto-deploy on both Vercel and Railway to prevent double deploys
- Sequential deploy order: migrate -> agent -> web
- Single pipeline: lint + type-check + build -> migrate -> deploy agent -> deploy web

### Migration safety
- Dedicated migration job that runs before any deploy jobs
- Uses `prisma migrate deploy` against prod database only (dev DB managed locally)
- DATABASE_URL stored as GitHub Actions secret
- Hard stop on migration failure -- no apps deploy if migration fails
- Forward-only migrations (per project rule -- never reset)

### pgvector schema design
- Enable pgvector via Prisma migration with raw SQL (`CREATE EXTENSION IF NOT EXISTS vector`)
- Embedding dimension: 768 (text-embedding-005) -- confirmed from STATE.md blocker notes
- Full classification column set in slide_embeddings table:
  - template_id, slide_index, content_text, embedding(768)
  - industry, solution_pillar, persona, funnel_stage, content_type (all TEXT -- app-level Zod validation)
  - confidence (numeric), created_at, updated_at
- HNSW index with default params (m=16, ef_construction=64) using cosine distance
- Prisma 6.19.x constraint honored (7.x has vector migration regression)

### Claude's Discretion
- Exact GitHub Actions workflow YAML structure and job naming
- Vercel CLI vs Vercel Deploy Hook implementation details
- Railway CLI authentication method in CI
- Whether to use Prisma's `Unsupported("vector(768)")` type annotation or raw SQL for the embedding column
- HNSW index creation timing (same migration or separate)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `turbo.json`: Already defines `build`, `lint`, `db:generate`, `db:migrate` tasks with correct dependency chains
- `deploy/Dockerfile`: Multi-stage Docker build for agent with Prisma generate + mastra build
- `railway.toml`: Existing Railway config pointing to `deploy/Dockerfile`
- `packages/schemas`: Shared Zod types -- classification schemas can be added here for app-level validation

### Established Patterns
- Prisma with PostgreSQL (Supabase): `datasource db` uses `url` + `directUrl` for pooler/direct connections
- Forward-only migrations: Project rule prohibits `db push` and `migrate reset`
- String columns with JSON for flexible data: Existing models use TEXT + JSON blobs rather than PG enums
- Turborepo orchestration: `build` depends on `^build` and `^db:generate`

### Integration Points
- `apps/agent/prisma/schema.prisma`: slide_embeddings model added here (raw SQL for vector type via migration)
- `.github/workflows/`: New directory for GitHub Actions workflow file
- GitHub repository settings: Vercel and Railway tokens as secrets
- Supabase prod database: pgvector extension enablement target

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches for GitHub Actions workflow structure.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 18-ci-cd-pipeline-pgvector-schema*
*Context gathered: 2026-03-05*
