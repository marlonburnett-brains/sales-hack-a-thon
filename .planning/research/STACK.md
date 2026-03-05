# Stack Research

**Domain:** Template management, slide intelligence, CI/CD for agentic sales platform
**Researched:** 2026-03-05
**Confidence:** HIGH

## Scope

This research covers ONLY new technology additions for v1.2 (Templates and Slide Intelligence). The existing stack (Next.js 15, Mastra AI 1.8, `@google/genai` ^1.43.0 with GPT-OSS 120b on Vertex AI, Prisma 6.19 + Supabase PostgreSQL, Google Workspace APIs via `googleapis` ^144.0.0, shadcn/ui, Supabase Auth + Google OAuth, `@supabase/ssr`, Sonner) is validated and NOT re-researched.

## Recommended Stack Additions

### 1. pgvector for Slide Embeddings

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pgvector (PostgreSQL extension) | 0.7.x (Supabase-managed) | Vector similarity search on slide embeddings | Supabase includes pgvector out of the box. Enable with one SQL statement in a Prisma migration. No external vector database needed -- embeddings live alongside relational data in the same Supabase PostgreSQL instance already in use. |
| `pgvector` (npm) | ^0.2.0 | Serialize/deserialize vectors for Prisma raw queries | Official pgvector-node library. Provides `toSql()` for INSERT and `fromSql()` for SELECT. Required because Prisma 6.x lacks native vector type support (tracked at prisma/prisma#26546). |

**Supabase pgvector setup:** Enable via SQL in a Prisma migration:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Prisma schema approach:** Prisma 6.19 does NOT support the `vector` type natively. Use `Unsupported("vector(768)")` in the schema for documentation purposes, but all vector read/write operations go through `$queryRaw` / `$executeRaw`. This is the established and reliable pattern.

**Critical: Do NOT upgrade to Prisma 7.x.** Version 7.1.0 has a known regression where migrations fail with `Unsupported("vector")` columns (prisma/prisma#28867). Stay on 6.19.x.

```prisma
model SlideEmbedding {
  id              String   @id @default(cuid())
  slideIndex      Int
  presentationId  String
  textContent     String
  embedding       Unsupported("vector(768)")
  metadata        String   // JSON: classification tags from SlideMetadataSchema
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([presentationId])
}
```

**Query pattern (pgvector npm + Prisma $queryRaw):**

```typescript
import pgvector from 'pgvector';

// INSERT embedding
const vec = pgvector.toSql(embeddingArray); // number[768] -> SQL string
await prisma.$executeRaw`
  INSERT INTO "SlideEmbedding" (id, "slideIndex", "presentationId", "textContent", embedding, metadata, "createdAt", "updatedAt")
  VALUES (${id}, ${idx}, ${presId}, ${text}, ${vec}::vector, ${metaJson}, NOW(), NOW())
`;

// COSINE SIMILARITY SEARCH
const queryVec = pgvector.toSql(queryEmbedding);
const results = await prisma.$queryRaw`
  SELECT id, "slideIndex", "presentationId", "textContent", metadata,
         1 - (embedding <=> ${queryVec}::vector) as similarity
  FROM "SlideEmbedding"
  ORDER BY embedding <=> ${queryVec}::vector
  LIMIT ${limit}
`;
```

**Vector index (add in a later migration after data is loaded):**

```sql
CREATE INDEX slide_embedding_vector_idx ON "SlideEmbedding"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Use IVFFlat over HNSW for the initial dataset size (hundreds to low thousands of slides). IVFFlat has lower memory overhead and faster index build time. Switch to HNSW only if dataset grows past 10K+ rows and query latency matters.

### 2. Embedding Generation via Vertex AI

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@google/genai` (EXISTING -- no install) | ^1.43.0 | Generate text embeddings via Vertex AI `text-embedding-005` | Already installed and configured with `vertexai: true` throughout the codebase. The `embedContent` method supports embedding generation. Zero new dependencies. |

**Model: `text-embedding-005` (768 dimensions)**

This is Google's current recommended English text embedding model available through Vertex AI. The newer `gemini-embedding-001` produces 3072-dimensional vectors -- overkill for slide classification, and it wastes 4x the storage and slows similarity queries with no meaningful accuracy gain at this dataset size.

**The project already authenticates to Vertex AI** via `GoogleGenAI({ vertexai: true, project, location })` in every workflow. No new auth setup needed.

```typescript
import { GoogleGenAI } from '@google/genai';
import { env } from '../env';

const ai = new GoogleGenAI({
  vertexai: true,
  project: env.GOOGLE_CLOUD_PROJECT,
  location: env.GOOGLE_CLOUD_LOCATION
});

// Generate embedding for a slide's text content
const response = await ai.models.embedContent({
  model: 'text-embedding-005',
  contents: slideTextContent,
  config: { taskType: 'RETRIEVAL_DOCUMENT' }
});
const embedding: number[] = response.embeddings[0].values; // length 768
```

**Task types to use:**
- `RETRIEVAL_DOCUMENT` -- when embedding slides for storage in pgvector
- `RETRIEVAL_QUERY` -- when embedding a search query for similarity lookup
- `CLASSIFICATION` -- when embedding for the rating/feedback classification loop

### 3. CI/CD Pipeline (GitHub Actions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| GitHub Actions | N/A | CI/CD orchestration | Already using GitHub. Natural choice for push-triggered deployment workflows. |
| `vercel` CLI | latest | Deploy web app from GitHub Actions | Vercel's official CLI. Use `vercel deploy --prebuilt` for fastest deploys. Must disable Vercel's automatic GitHub integration to avoid double-deploys. |
| Railway CLI (`@railway/cli`) | latest | Deploy agent app from GitHub Actions | Railway supports `railway up --service SERVICE_ID --detach` for CI. Use project tokens for auth (not user tokens). |
| `pnpm/action-setup@v4` | v4 | Install pnpm in CI | Official pnpm GitHub Action. Matches the project's `packageManager: pnpm@9.12.0`. |

**No GitHub Actions workflows exist yet** (verified -- no `.github/workflows/` directory in the project).

**Workflow structure (3 workflows):**

```
.github/workflows/
  ci.yml           # Lint + type-check on all PRs (runs on pull_request)
  deploy-web.yml   # Deploy web to Vercel on push to main
  deploy-agent.yml # Run migrations + deploy agent to Railway on push to main
```

**Vercel deployment pattern:**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm add -g vercel
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

Required secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

**Important:** Disable Vercel's GitHub integration auto-deploy (Settings > Git > Ignored Build Step: `exit 0` or disconnect GitHub in Vercel dashboard) to prevent double-deploys when using GitHub Actions.

**Railway deployment pattern:**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      # Run pending migrations BEFORE deploying new code
      - name: Run Pending Migrations
        run: pnpm --filter agent exec prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy Agent to Railway
        run: railway up --service ${{ secrets.RAILWAY_SERVICE_ID }} --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

Required secrets: `RAILWAY_TOKEN` (project token from Railway dashboard Settings > Tokens), `RAILWAY_SERVICE_ID`.

**Migration safety:** Use `prisma migrate deploy` (NOT `prisma migrate dev`) in CI. This applies pending migrations without generating new ones. Runs BEFORE the Railway deploy step so the database schema is updated before new application code goes live.

### 4. Google Slides API -- Slide-Level Operations for Preview

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `googleapis` (EXISTING -- no install) | ^144.0.0 | Slide thumbnail generation, page-level reads for ingestion | Already installed and used throughout the codebase (`presentations.get`, `presentations.batchUpdate`). The `presentations.pages.getThumbnail` method returns a content URL for individual slide preview images. |

**No new dependencies needed.** The existing `googleapis` package provides everything required.

**Thumbnail generation for slide preview in the rating engine:**

```typescript
import { google } from 'googleapis';

const slides = google.slides({ version: 'v1', auth });
const thumbnail = await slides.presentations.pages.getThumbnail({
  presentationId,
  pageObjectId: slideObjectId,
  thumbnailProperties: {
    mimeType: 'PNG',
    thumbnailSize: 'LARGE'  // SMALL (200px), MEDIUM (800px), LARGE (1600px)
  }
});
const imageUrl = thumbnail.data.contentUrl; // URL valid for 30 minutes
```

**Important notes:**
- Thumbnail URLs expire after 30 minutes. Cache them client-side, but regenerate on page load if stale.
- Each `getThumbnail` call counts as an "expensive read" against Google API quota. Batch carefully for presentations with many slides.
- The existing `getDriveClient` / service account auth helpers handle authentication. Reuse them.

**Access awareness (checking if service account can read a file):**

```typescript
const drive = google.drive({ version: 'v3', auth });
try {
  await drive.files.get({ fileId: presentationId, fields: 'id,name,shared' });
  // File is accessible to service account
} catch (e: any) {
  if (e.code === 403 || e.code === 404) {
    // Not shared with service account -- flag in Templates UI
  }
}
```

The existing `ContentSource` model already tracks `accessStatus` -- this pattern extends naturally.

### 5. Human Feedback and Classification Improvement

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| No new libraries needed | -- | Store ratings, update classifications, improve future embeddings | Uses existing Prisma for data, `@google/genai` for re-embedding if needed, pgvector for updated similarity search. |

**Architecture:** When a human rates a slide classification (approves tags, corrects tags, thumbs up/down):

1. Store the rating in a new `SlideRating` Prisma model
2. Update the slide's metadata tags in `SlideEmbedding.metadata` based on human correction
3. Optionally re-generate the embedding with corrected metadata appended to the slide text (improved context = better vector)
4. Use accumulated approved classifications as few-shot examples in future `classifySlide()` prompts (already in `classify-metadata.ts`)

"Real-time improvement" means the next classification or similarity search immediately benefits from stored human ratings. No WebSocket, SSE, or streaming infrastructure needed. The web app's Server Actions + REST API call to the agent suffices.

**New Prisma model:**

```prisma
model SlideRating {
  id                String   @id @default(cuid())
  slideEmbeddingId  String   // FK to SlideEmbedding (manual, since Unsupported columns prevent relation)
  raterEmail        String   // From Supabase Auth session
  action            String   // "approved" | "corrected" | "rejected"
  correctedMetadata String?  // JSON: corrected classification tags (if action = "corrected")
  comment           String?  // Optional reviewer note
  createdAt         DateTime @default(now())

  @@index([slideEmbeddingId])
  @@index([raterEmail])
}
```

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pgvector` | ^0.2.0 | Vector serialization for Prisma raw queries | Every embedding INSERT and cosine similarity search |

**This is the ONLY new npm dependency needed for the entire v1.2 milestone.**

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| GitHub Actions | CI/CD orchestration | Create `.github/workflows/` directory with 3 workflow YAML files |
| `vercel` CLI (CI only) | Vercel deployment from Actions | Installed in CI workflow, not in devDependencies |
| `@railway/cli` (CI only) | Railway deployment from Actions | Installed in CI workflow, not in devDependencies |

## Installation

```bash
# Single new dependency -- agent app only
pnpm --filter agent add pgvector
```

That is it. Everything else is already installed.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pgvector in Supabase | Pinecone / Weaviate / Qdrant | Only if dataset grows to millions of vectors with sub-10ms latency requirements. The slide dataset is hundreds to low thousands -- pgvector in the same DB is simpler, cheaper, and eliminates network hops. |
| `text-embedding-005` (768-dim) via existing `@google/genai` | OpenAI `text-embedding-3-small` or `gemini-embedding-001` (3072-dim) | OpenAI would mean a second auth/billing system. `gemini-embedding-001` produces 3072-dim vectors that quadruple storage with no accuracy gain at this scale. `text-embedding-005` is the right fit. |
| Prisma `$queryRaw` + pgvector npm | Drizzle ORM or raw `pg` client | Only if you were starting from scratch. Switching ORMs mid-project for vector queries alone is not worth the migration cost. Raw queries for vectors + Prisma for everything else is the standard community pattern. |
| `prisma migrate deploy` in CI | `prisma db push` | Never. `db push` is explicitly prohibited per CLAUDE.md. `migrate deploy` is the correct CI command. |
| IVFFlat vector index | HNSW index | HNSW is better for 100K+ vectors with concurrent reads. IVFFlat is appropriate for the current scale and has lower memory/build cost. |
| Vercel CLI in GitHub Actions | Vercel built-in GitHub integration | Only if you want zero CI/CD configuration and are okay with no migration step before deploy. CLI gives control over build order. |
| Railway CLI in GitHub Actions | Railway auto-deploy on push | Only if you do not need to run migrations before deploy. The auto-deploy does not run Prisma migrations. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma 7.x | Known regression with `Unsupported("vector")` columns causing migration failures (prisma/prisma#28867, reported Dec 2025) | Stay on Prisma 6.19.x |
| `prisma db push` | Explicitly prohibited in CLAUDE.md project rules | `prisma migrate dev --name <name>` for development, `prisma migrate deploy` for CI |
| `@google-cloud/aiplatform` | Heavyweight SDK with protobuf dependencies. The lighter `@google/genai` already supports Vertex AI embeddings via `embedContent`. | `@google/genai` (already installed) |
| LangChain PrismaVectorStore | Adds massive dependency tree (~50+ transitive deps). pgvector npm + raw queries is simpler and more maintainable. | `pgvector` npm + Prisma `$queryRaw` |
| `prisma-extension-pgvector` | Small community package with limited maintenance (last publish 2024). Raw queries are more transparent and debuggable. | `pgvector` npm + Prisma `$queryRaw` |
| Separate vector DB (Pinecone, Qdrant, etc.) | Adds external dependency, network latency, separate billing, and operational complexity for a small dataset (hundreds of slides). | pgvector in existing Supabase PostgreSQL |
| WebSocket/SSE for feedback | Overengineered. Rating a slide classification is a form submission, not a real-time stream. | Next.js Server Actions + REST API call to agent |
| `gemini-embedding-001` | 3072 dimensions quadruples vector storage and slows cosine similarity queries. No accuracy benefit at this dataset size. | `text-embedding-005` (768 dimensions) |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `pgvector` ^0.2.0 | Prisma 6.x, Node 22 | Uses `$queryRaw` / `$executeRaw` -- no coupling with Prisma internals |
| `@google/genai` ^1.43.0 | `text-embedding-005` on Vertex AI | `embedContent` method available. Requires `vertexai: true` (already configured). |
| Prisma 6.19.x | Supabase PostgreSQL 15 + pgvector 0.7.x | `Unsupported("vector(768)")` works for schema documentation. All vector ops via raw SQL. |
| pgvector extension 0.7.x | PostgreSQL 15 (Supabase default) | Supabase manages the extension version. Supports IVFFlat and HNSW indexes. |
| `pnpm/action-setup@v4` | pnpm 9.12.0 | Matches the `packageManager` field in root `package.json`. |
| `actions/setup-node@v4` | Node 22 | Use `node-version: 22` to match the Dockerfile's `node:22-alpine`. |

## Migration Strategy

All schema changes use forward-only migrations per CLAUDE.md rules:

```bash
# 1. Enable pgvector extension (create-only to inspect SQL, then apply)
pnpm --filter agent exec prisma migrate dev --name enable-pgvector-extension --create-only
# Manually add: CREATE EXTENSION IF NOT EXISTS vector;
# Then: pnpm --filter agent exec prisma migrate dev --name enable-pgvector-extension

# 2. Add SlideEmbedding table
pnpm --filter agent exec prisma migrate dev --name add-slide-embedding-table

# 3. Add SlideRating table (for human feedback)
pnpm --filter agent exec prisma migrate dev --name add-slide-rating-table

# 4. Add Template model (for templates management page)
pnpm --filter agent exec prisma migrate dev --name add-template-model

# 5. Add vector index (after data exists, use create-only)
pnpm --filter agent exec prisma migrate dev --name add-slide-embedding-vector-index --create-only
# Manually add CREATE INDEX statement, then apply
```

## CI/CD Secrets Required

| Secret | Where to Configure | Purpose |
|--------|-------------------|---------|
| `VERCEL_TOKEN` | GitHub repo Settings > Secrets | Vercel CLI authentication |
| `VERCEL_ORG_ID` | GitHub repo Settings > Secrets | Vercel organization scope |
| `VERCEL_PROJECT_ID` | GitHub repo Settings > Secrets | Vercel project scope for web app |
| `RAILWAY_TOKEN` | GitHub repo Settings > Secrets | Railway project token (Settings > Tokens in Railway dashboard) |
| `RAILWAY_SERVICE_ID` | GitHub repo Settings > Secrets | Target Railway service for agent deploys |
| `DATABASE_URL` | GitHub repo Settings > Secrets | Supabase pooled connection for `prisma migrate deploy` |
| `DIRECT_URL` | GitHub repo Settings > Secrets | Supabase direct connection (non-pooled) for migrations |

## Sources

- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) -- enabling and using pgvector in Supabase (HIGH confidence)
- [Supabase vector columns guide](https://supabase.com/docs/guides/ai/vector-columns) -- vector column usage patterns (HIGH confidence)
- [Prisma PostgreSQL extensions docs](https://www.prisma.io/docs/postgres/database/postgres-extensions) -- `Unsupported()` type and raw query patterns (HIGH confidence)
- [prisma/prisma#26546](https://github.com/prisma/prisma/issues/26546) -- first-class vector support feature request, confirms `Unsupported` is current approach (HIGH confidence)
- [prisma/prisma#28867](https://github.com/prisma/prisma/issues/28867) -- Prisma 7.x regression with vector types (HIGH confidence)
- [pgvector-node GitHub](https://github.com/pgvector/pgvector-node) -- `toSql()` / `fromSql()` usage with Prisma examples (HIGH confidence)
- [pgvector npm](https://www.npmjs.com/package/pgvector) -- package version and API (HIGH confidence)
- [Google Slides API getThumbnail](https://developers.google.com/slides/api/reference/rest/v1/presentations.pages/getThumbnail) -- slide thumbnail endpoint and options (HIGH confidence)
- [Vertex AI text embeddings docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings) -- text-embedding-005 model, task types (HIGH confidence)
- [Vertex AI text embeddings API reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api) -- API parameters and dimensions (HIGH confidence)
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) -- embedContent method availability, v1.43.0 (HIGH confidence)
- [Railway GitHub Actions blog](https://blog.railway.com/p/github-actions) -- Railway CLI deploy from CI with project tokens (MEDIUM confidence)
- [Railway CLI deploying docs](https://docs.railway.com/cli/deploying) -- CLI flags for CI/CD (HIGH confidence)
- [Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) -- Vercel CLI deploy from CI (HIGH confidence)
- [Turborepo GitHub Actions guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions) -- Turborepo + pnpm setup in CI (HIGH confidence)
- [bervProject/railway-deploy GitHub Action](https://github.com/bervProject/railway-deploy) -- community Railway deploy action reference (MEDIUM confidence)

---
*Stack research for: Lumenalta v1.2 Templates and Slide Intelligence*
*Researched: 2026-03-05*
