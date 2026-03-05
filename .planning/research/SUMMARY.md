# Project Research Summary

**Project:** Lumenalta v1.2 -- Templates & Slide Intelligence
**Domain:** Agentic sales platform -- template management, AI slide classification, HITL rating, CI/CD automation
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

The v1.2 milestone transforms the Lumenalta sales platform from a deal-focused tool into an intelligent content management system. It adds six capabilities on top of the shipped v1.0/v1.1 foundation: CI/CD automation via GitHub Actions, a templates management UI with side panel navigation, an AI-powered slide ingestion pipeline that extracts, embeds, and classifies Google Slides content into pgvector, access awareness for Drive file sharing, and a human-in-the-loop rating engine that improves classifications in real time. The existing stack (Next.js 15, Mastra AI, Vertex AI, Prisma 6.19, Supabase PostgreSQL, shadcn/ui) handles nearly everything -- the only new npm dependency is `pgvector` for vector serialization.

The recommended approach is to build in four dependency-driven phases: (1) CI/CD pipeline and database schema first, because automated deploys accelerate every subsequent feature and the schema must exist before any data flows; (2) templates CRUD with navigation and access awareness, creating the user-facing surface; (3) the slide ingestion workflow with embeddings and classification, which is the core intelligence; (4) the preview and rating engine that closes the human feedback loop. This ordering follows the strict dependency chain -- each phase produces what the next phase consumes.

The top risks are: Prisma's lack of native pgvector support (requiring all vector operations via raw SQL in a dedicated repository layer), Google Slides API rate limits (60 requests/minute/user, demanding careful batching during ingestion), CI/CD migration safety (production migrations must run in isolated GitHub Actions jobs with concurrency guards), and the feedback loop trap (collecting ratings without actually using them to improve classifications). All are well-understood problems with documented prevention strategies.

## Key Findings

### Recommended Stack

The v1.2 milestone requires remarkably few additions to the existing stack. The only new npm dependency is `pgvector` (^0.2.0) for vector serialization in Prisma raw queries. Everything else -- embedding generation, slide extraction, classification, authentication -- reuses existing installed packages.

**Core technologies:**
- **pgvector (Supabase extension):** Vector similarity search on slide embeddings -- Supabase includes it out of the box, enable with one SQL statement in a Prisma migration
- **`pgvector` npm (^0.2.0):** Serialize/deserialize vectors for Prisma `$queryRaw` / `$executeRaw` -- the only new dependency for the entire milestone
- **Vertex AI `text-embedding-005` (768 dimensions):** Generate slide embeddings via the existing `@google/genai` package -- same auth, same platform, zero new dependencies
- **GitHub Actions:** CI/CD orchestration with 3 workflows (ci.yml, deploy-web.yml, deploy-agent.yml) using Vercel CLI and Railway CLI

**Critical version constraint:** Stay on Prisma 6.19.x. Prisma 7.x has a known regression where migrations fail with `Unsupported("vector")` columns (prisma/prisma#28867).

### Expected Features

**Must have (table stakes -- 10 features for v1.2 launch):**
- CI/CD pipeline -- eliminates manual deploy bottleneck (224 commits in 3 days)
- Side panel navigation -- structural prerequisite for templates section
- Templates CRUD page -- register Google Slides decks with touch type assignment
- Access awareness -- immediate feedback when files are not shared with service account
- pgvector setup -- database extension and schema for embeddings
- Slide ingestion agent -- extract, embed, classify slides into vector store
- Slide thumbnail preview -- visual grid of ingested slides
- Classification display -- AI-assigned tags on each slide card
- Human rating (thumbs up/down + tag correction) -- basic feedback loop
- Real-time classification improvement -- corrections update pgvector immediately

**Should have (add in v1.2.x after validation):**
- Confidence scores on classification tags -- helps prioritize reviews
- Template version tracking (staleness detection) -- flags modified source decks
- Batch ingestion progress tracking -- transparency for large decks
- Slide similarity search -- find cross-deck duplicates via pgvector cosine similarity

**Defer (v2+):**
- Cross-template deduplication, classification analytics dashboard, Drive webhook auto-re-ingestion, full-text slide content search
- Drag-and-drop slide reordering, in-browser slide editing, automated nightly re-classification, multi-tenant template libraries (all identified as anti-features)

### Architecture Approach

The architecture extends the existing web-agent-database pattern without changing any foundational boundaries. The web app (Next.js on Vercel) gets new `/templates` routes and a side panel layout. The agent (Mastra Hono on Railway) gets template CRUD API routes, a slide ingestion Mastra workflow, and rating endpoints. The database (Supabase PostgreSQL) gets three new Prisma models (Template, TemplateSlide, SlideRating) plus a raw SQL `slide_embeddings` table with pgvector. The critical invariant -- web has zero direct database access, all data flows through the agent API -- remains unchanged.

**Major components:**
1. **Template model + CRUD routes** -- user-managed Google Slides references with touch assignment, extending the existing `ContentSource` pattern
2. **Slide ingestion workflow** -- Mastra workflow (extract slides, classify via LLM structured output, embed via Vertex AI, store in pgvector) following the same pattern as touch-1 through touch-4 workflows
3. **Vector store module (`vector-store.ts`)** -- typed wrapper around raw SQL pgvector operations (insert, cosine similarity search), isolating all non-ORM queries
4. **Embeddings module (`embeddings.ts`)** -- Vertex AI text-embedding-005 integration via existing `@google/genai`
5. **Preview and rating engine** -- slide thumbnail grid with classification tags and thumbs up/down feedback that updates pgvector metadata in real time
6. **CI/CD pipeline** -- GitHub Actions workflows for lint, migrate, deploy web (Vercel), deploy agent (Railway)

### Critical Pitfalls

1. **Prisma has no native pgvector support** -- all vector operations must use `$queryRaw` / `$executeRaw` wrapped in a typed repository layer. Never attempt Prisma client methods on vector columns. Use `--create-only` for vector migrations and manually add `CREATE EXTENSION IF NOT EXISTS vector`.

2. **Google Slides API 60 req/min rate limit** -- a 30-slide deck needs 31+ API calls. Use `presentations.get` to fetch ALL slide data in one call. Batch thumbnails with delays. Implement exponential backoff on 429 responses. Make ingestion idempotent for resume-after-failure.

3. **CI/CD migration race conditions** -- use `prisma migrate deploy` (not `migrate dev`) in CI. Run migrations in a dedicated job with a concurrency group before deploying either app. Never run migrations from Vercel build steps or Docker entrypoints.

4. **Vercel git integration conflicts with GitHub Actions** -- disable Vercel's automatic GitHub integration before adding GitHub Actions deploy workflows. Otherwise, both trigger simultaneously, creating duplicate deployments.

5. **HITL feedback stored but never consumed** -- the rating UI and the feedback consumption mechanism must ship in the same phase. Design the consumption path (few-shot example retrieval from verified classifications) before building the storage. Track "% accepted without changes" as the improvement metric.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (CI/CD + Database Schema)
**Rationale:** CI/CD has zero feature dependencies and accelerates deployment of everything that follows. Database schema (Template, TemplateSlide, SlideRating models + pgvector extension + slide_embeddings table) must exist before any feature can write data.
**Delivers:** Automated lint/deploy pipeline on push to main; complete database schema for all v1.2 features
**Addresses:** CI/CD pipeline, pgvector setup
**Avoids:** Migration race conditions (concurrency groups), Vercel double-deploy (disable git integration), shadow database extension conflicts (use `migrate deploy` in CI)
**Stack:** GitHub Actions, Vercel CLI, Railway CLI, Prisma migrations with `--create-only` for vector columns

### Phase 2: Template Management (CRUD + Navigation + Access Awareness)
**Rationale:** The user-facing surface must exist before the ingestion pipeline has anything to process. Templates CRUD, side panel navigation, and access awareness are tightly coupled -- they form a single coherent user experience.
**Delivers:** Users can register Google Slides templates, assign touch types, see access status, navigate between Deals and Templates sections
**Addresses:** Templates CRUD page, side panel navigation, access awareness, touch type assignment
**Avoids:** Side panel breaking existing deal pages (test all existing routes with sidebar present), stale access status (re-check on every ingestion attempt, show `lastCheckedAt`)
**Uses:** Existing `ContentSource` patterns (borrowed, not extended -- create dedicated `Template` model), shadcn/ui sidebar, Google Drive API `files.get`

### Phase 3: Slide Intelligence (Ingestion + Embeddings + Classification)
**Rationale:** This is the core differentiator and the most complex phase. It depends on Phase 1 (schema) and Phase 2 (template records to process). Should be a single phase because the ingestion pipeline is one continuous flow: extract, embed, classify, store.
**Delivers:** AI-powered slide ingestion that transforms Google Slides into classified, searchable vector embeddings
**Addresses:** Slide ingestion agent, slide thumbnail preview, classification display
**Avoids:** Embedding dimension mismatch (lock on text-embedding-005 at 768 dims, document in migration SQL), Google API rate limits (batch with delays, idempotent processing), raw SQL scattered across codebase (isolate in `vector-store.ts`)
**Uses:** `pgvector` npm, Vertex AI text-embedding-005, Mastra workflow, Google Slides API `presentations.get` + `getThumbnail`

### Phase 4: Human Review (Rating + Classification Improvement)
**Rationale:** The feedback loop requires both visual preview (Phase 3) and classification display (Phase 3) to provide meaningful context for ratings. Must ship feedback collection AND consumption together to avoid the open feedback loop trap.
**Delivers:** Human-in-the-loop classification review with real-time improvement -- corrections update pgvector metadata immediately and feed into future classifications as few-shot examples
**Addresses:** Human rating (thumbs up/down + tag correction), real-time classification improvement
**Avoids:** Feedback stored but never consumed (ship few-shot retriever in same phase), review fatigue (show low-confidence classifications first, auto-accept high-confidence ones)
**Uses:** SlideRating model, existing FeedbackSignal pattern, pgvector metadata updates

### Phase Ordering Rationale

- **Strict dependency chain:** Each phase produces what the next consumes. CI/CD and schema enable everything. Templates create the input data. Ingestion processes that data. Rating validates the output.
- **Risk front-loading:** The hardest integration (Prisma + pgvector + Supabase extensions) is in Phase 1 schema work, surfacing problems before feature code depends on it.
- **CI/CD first pays compound dividends:** Every feature in Phases 2-4 benefits from automated deployment. At 224 commits in 3 days, manual deploys are already a bottleneck.
- **Feedback loop closure in Phase 4:** Combining rating collection with consumption prevents the most common HITL pitfall (storing feedback that never improves anything).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (CI/CD):** Supabase shadow database + pgvector extension interaction needs careful migration testing. The `CREATE EXTENSION IF NOT EXISTS vector SCHEMA public` pattern must be validated against the specific Supabase project configuration.
- **Phase 3 (Slide Intelligence):** Most complex phase. The ingestion workflow combines Google Slides API, Vertex AI embeddings, LLM classification, and pgvector storage in a single pipeline. Rate limiting strategy and idempotent processing design need detailed phase-level research.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Template Management):** Standard CRUD with existing patterns. Side panel navigation is well-documented in shadcn/ui. Access awareness reuses existing `ContentSource.accessStatus` approach.
- **Phase 4 (Human Review):** Follows the existing FeedbackSignal approve/override pattern from Touch 1. The rating UI is a straightforward form. Few-shot example retrieval is a well-documented LLM prompting technique.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (`pgvector` npm). All other technologies already in use. Version constraints verified against official issue trackers. |
| Features | HIGH | Feature set derived from direct codebase analysis. Dependency graph is clear. Anti-features well-identified. |
| Architecture | HIGH | Extends existing patterns (Mastra workflows, API routes, Prisma models) without architectural changes. One discrepancy resolved: ARCHITECTURE.md references 1536-dim vectors but STACK.md correctly recommends 768-dim via `text-embedding-005`. Use 768. |
| Pitfalls | HIGH | All pitfalls verified against official docs and GitHub issues. Prevention strategies are specific and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **Embedding dimension discrepancy:** ARCHITECTURE.md references `vector(1536)` in schema examples and scaling notes, while STACK.md recommends `text-embedding-005` at 768 dimensions. Resolution: use 768 dimensions. Update all schema references during implementation.
- **IVFFlat vs HNSW index choice:** STACK.md recommends IVFFlat (lower memory, faster build at small scale), while ARCHITECTURE.md recommends HNSW (better recall, no training step). Resolution: start with IVFFlat for the initial dataset (hundreds of slides). Add the index in a later migration after data exists, making it easy to switch to HNSW if needed.
- **Template model vs ContentSource reuse:** ARCHITECTURE.md recommends a dedicated `Template` model, while FEATURES.md notes that `ContentSource` already has most needed fields. Resolution: create a dedicated `Template` model as ARCHITECTURE.md recommends. The concerns are different enough (user-managed CRUD with slide relations vs. offline batch discovery) to warrant separation.
- **Thumbnail caching strategy:** Not resolved. Google Slides thumbnail URLs expire after 30 minutes. Options: re-fetch on page load (simple, more API calls) or download and store in Supabase Storage (complex, fewer API calls). Decide during Phase 3 implementation based on actual usage patterns.
- **Prisma migration ordering:** The pgvector extension must be enabled before the `slide_embeddings` table can be created, and the Template/TemplateSlide models must exist before `slide_embeddings` can reference them. This means at least 2-3 sequential migrations in Phase 1. Plan the migration order explicitly.

## Sources

### Primary (HIGH confidence)
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) -- extension setup, vector columns, similarity search
- [Prisma pgvector issues #18442, #26546](https://github.com/prisma/prisma/issues/18442) -- `Unsupported` type workaround, raw SQL pattern
- [Prisma 7.x vector regression #28867](https://github.com/prisma/prisma/issues/28867) -- stay on 6.19.x
- [pgvector-node GitHub](https://github.com/pgvector/pgvector-node) -- `toSql()` / `fromSql()` with Prisma examples
- [Google Slides API getThumbnail](https://developers.google.com/slides/api/reference/rest/v1/presentations.pages/getThumbnail) -- thumbnail extraction, 30-min TTL
- [Google Slides API usage limits](https://developers.google.com/workspace/slides/api/limits) -- 60 requests/minute/user
- [Vertex AI text embeddings docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings) -- text-embedding-005, 768 dimensions
- [Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) -- CLI deploy pattern
- [Railway CLI deploying docs](https://docs.railway.com/cli/deploying) -- CLI flags for CI/CD
- Codebase analysis: `apps/agent/prisma/schema.prisma`, `apps/web/src/app/(authenticated)/layout.tsx`, `turbo.json`, `apps/agent/src/mastra/index.ts`

### Secondary (MEDIUM confidence)
- [Railway GitHub Actions blog](https://blog.railway.com/p/github-actions) -- project tokens, CI deploy
- [Prisma shadow database extension conflicts #26231](https://github.com/prisma/prisma/issues/26231) -- shadow DB + extensions schema
- [HITL AI design patterns 2025](https://blog.ideafloats.com/human-in-the-loop-ai-in-2025/) -- review queue UX, feedback types

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
