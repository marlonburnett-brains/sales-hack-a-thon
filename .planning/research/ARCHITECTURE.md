# Architecture Research: v1.2 Templates & Slide Intelligence Integration

**Domain:** Template management, slide ingestion with vector embeddings, preview/rating engine, CI/CD pipeline
**Researched:** 2026-03-05
**Confidence:** HIGH

---

## Existing Architecture (v1.1 -- What Already Exists)

```
lumenalta-hackathon/
  apps/
    web/                          # Next.js 15 on Vercel
      src/app/(authenticated)/    # Route group: deals only
      src/lib/api-client.ts       # ALL web->agent HTTP (Bearer auth)
      src/lib/actions/            # Server Actions proxying to agent
      src/components/             # deals/, touch/, timeline/, ui/
    agent/                        # Mastra Hono on Railway (Docker)
      src/mastra/index.ts         # Mastra init + all API routes (registerApiRoute)
      src/mastra/workflows/       # touch-1..4, pre-call (5 workflows)
      src/ingestion/              # Offline scripts: extract, classify, discover
      src/lib/                    # Google APIs, AtlusAI, slide-extractor
      prisma/schema.prisma        # PostgreSQL, 9 models
  packages/schemas/               # Shared Zod types + constants
  deploy/Dockerfile               # Multi-stage Docker for Railway
  railway.toml                    # Railway config
```

**Critical invariants that must not change:**
- Web has ZERO direct database access -- all data flows through `api-client.ts` to agent
- Agent owns database via Prisma; Mastra owns `mastra` schema via PostgresStore
- Mastra workflows use suspend/resume for HITL (durable state in Postgres)
- Google API via service account (not user OAuth)
- Service-to-service auth via Bearer token in Authorization header

---

## System Overview -- v1.2 Additions

```
                              EXISTING                           NEW (v1.2)
                    +--------------------------+      +---------------------------+
                    |       apps/web           |      |    apps/web additions     |
                    |  (Next.js 15 / Vercel)   |      |                           |
                    |                          |      |  Side Panel Nav            |
                    |  /deals (existing)       |      |  /templates (CRUD)         |
                    |  /deals/[id] (existing)  |      |  /templates/[id] (preview) |
                    |                          |      |  /templates/[id]/slides    |
                    +-----------+--------------+      |    (classification review) |
                                |                     +------------+--------------+
                                | Bearer Auth                      |
                                v                                  v
                    +--------------------------+      +---------------------------+
                    |       apps/agent         |      |   apps/agent additions    |
                    |  (Mastra Hono / Railway) |      |                           |
                    |                          |      |  /templates CRUD routes   |
                    |  /companies (existing)   |      |  /templates/:id/ingest    |
                    |  /deals (existing)       |      |  /slides/:id/rate         |
                    |  /briefs (existing)      |      |  slide-ingest-workflow    |
                    |  touch-1..4-workflow     |      |                           |
                    +-----------+--------------+      +------------+--------------+
                                |                                  |
                    +-----------+----------------------------------+-----------+
                    |                    Supabase PostgreSQL                    |
                    |                                                          |
                    |  public schema (Prisma)        mastra schema (Mastra)    |
                    |  +-----------------------+     +--------------------+    |
                    |  | Company, Deal, etc.   |     | workflow state     |    |
                    |  | Template       [NEW]  |     | suspend/resume     |    |
                    |  | TemplateSlide  [NEW]  |     +--------------------+    |
                    |  | SlideRating    [NEW]  |                               |
                    |  +-----------------------+     pgvector (raw SQL)        |
                    |                                +--------------------+    |
                    |                                | slide_embeddings   |    |
                    |                                | (vector + metadata)|    |
                    |                                +--------------------+    |
                    +----------------------------------------------------------+
                                |
                    +-----------+-------------------+
                    |    Google Workspace APIs       |
                    |  Slides API (read slides)      |
                    |  Drive API (access check)      |
                    +-------------------------------+

                    +-------------------------------+
                    |    GitHub Actions [NEW]        |
                    |  push main -> deploy web+agent |
                    |  auto Prisma migrations        |
                    +-------------------------------+
```

---

## Component Responsibilities

### New Components

| Component | Responsibility | Location | Implementation |
|-----------|---------------|----------|----------------|
| **Template model** | Store Google Slides presentation references with touch assignment | `apps/agent/prisma/schema.prisma` | Prisma model with relations to TemplateSlide |
| **TemplateSlide model** | Store per-slide classification metadata and embedding reference | `apps/agent/prisma/schema.prisma` | Prisma model; embedding stored via raw SQL |
| **SlideRating model** | Human feedback on AI classification quality | `apps/agent/prisma/schema.prisma` | Prisma model linked to TemplateSlide |
| **slide_embeddings table** | pgvector storage for semantic slide search | Raw SQL migration | `Unsupported("vector(1536)")` in Prisma, raw SQL for queries |
| **Slide ingestion workflow** | Orchestrate: extract slides -> classify -> embed -> store | `apps/agent/src/mastra/workflows/slide-ingest-workflow.ts` | Mastra workflow with steps |
| **Templates CRUD routes** | API for template management | `apps/agent/src/mastra/index.ts` (new registerApiRoute blocks) | Same pattern as existing /companies, /deals routes |
| **Templates page** | UI for managing template links and triggering ingestion | `apps/web/src/app/(authenticated)/templates/` | Next.js pages + Server Actions |
| **Preview engine** | Display slide classifications with thumbnail previews | `apps/web/src/app/(authenticated)/templates/[id]/` | Client component with Google Slides embed |
| **Rating UI** | Human thumbs-up/down on each slide classification | `apps/web/src/components/templates/` | Client component posting to agent API |
| **Side panel nav** | Collapsible sidebar with Deals + Templates sections | `apps/web/src/app/(authenticated)/layout.tsx` | Modify existing layout |
| **CI/CD pipeline** | GitHub Actions for deploy + migrations | `.github/workflows/deploy.yml` | GitHub Actions YAML |
| **vector-store.ts** | Raw SQL wrapper for pgvector insert/search operations | `apps/agent/src/lib/vector-store.ts` | `prisma.$executeRaw` / `prisma.$queryRaw` |
| **embeddings.ts** | Generate text embeddings via Vertex AI | `apps/agent/src/lib/embeddings.ts` | Vertex AI text-embedding API |

### Modified Components

| Component | Change | Why |
|-----------|--------|-----|
| `apps/web/src/app/(authenticated)/layout.tsx` | Replace top nav with side panel navigation | Side panel needed for Deals + Templates sections |
| `apps/web/src/lib/api-client.ts` | Add template + slide + rating API functions | Web needs typed wrappers for new agent endpoints |
| `apps/agent/src/mastra/index.ts` | Register template/slide/rating API routes + register ingestion workflow | New endpoints following existing `registerApiRoute` pattern |
| `apps/agent/prisma/schema.prisma` | Add Template, TemplateSlide, SlideRating models | New relational data; pgvector column via `Unsupported` |
| `packages/schemas/` | Add template Zod schemas | Shared types between web and agent |
| `deploy/Dockerfile` | No changes needed | Prisma migrations run in CI, not at container start |

---

## Recommended Project Structure (New Files Only)

```
.github/
  workflows/
    deploy.yml                    # CI/CD: lint, migrate DB, deploy web+agent

apps/agent/
  prisma/
    migrations/
      YYYYMMDD_add_templates/     # Template + TemplateSlide + SlideRating models
      YYYYMMDD_add_pgvector/      # Enable vector extension + slide_embeddings table
    schema.prisma                 # MODIFIED: new models added
  src/
    mastra/
      workflows/
        slide-ingest-workflow.ts  # NEW: extract -> classify -> embed -> store
    lib/
      embeddings.ts               # NEW: generate embeddings via Vertex AI
      vector-store.ts             # NEW: raw SQL pgvector operations (insert/search)

apps/web/
  src/
    app/(authenticated)/
      layout.tsx                  # MODIFIED: side panel nav
      templates/
        page.tsx                  # Templates list + add form
        [templateId]/
          page.tsx                # Template detail + slide preview grid
          slides/
            page.tsx              # Slide classification review + rating
    components/
      templates/
        template-card.tsx         # Template list card
        template-form.tsx         # Add/edit template form
        slide-preview.tsx         # Slide thumbnail + classification display
        slide-rating.tsx          # Thumbs up/down rating component
      nav/
        side-panel.tsx            # Collapsible side panel component
    lib/
      api-client.ts              # MODIFIED: add template/slide/rating functions
      actions/
        template-actions.ts      # NEW: Server Actions for templates

packages/schemas/
  app/
    template.ts                   # NEW: Template + TemplateSlide Zod schemas
```

---

## Architectural Patterns

### Pattern 1: Prisma + Raw SQL Hybrid for pgvector

**What:** Use Prisma for all relational data (Template, TemplateSlide, SlideRating) but raw SQL (`$executeRaw` / `$queryRaw`) for vector operations. The `slide_embeddings` table is created via a custom migration with `--create-only`, and the Prisma schema uses `Unsupported("vector(1536)")` so introspection does not break.

**Why this approach:** Prisma does not natively support the `vector` type for read/write operations. Using `Unsupported` in the schema keeps Prisma aware of the column for migrations, while raw SQL handles the actual vector insert and cosine similarity search. This avoids adding a separate ORM or abandoning Prisma.

**Trade-offs:** Vector queries are not type-safe through Prisma. Acceptable because vector operations are isolated to a single `vector-store.ts` module with well-defined TypeScript function signatures on top.

**Example:**
```typescript
// apps/agent/src/lib/vector-store.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function insertSlideEmbedding(
  slideId: string,
  embedding: number[],
  metadata: Record<string, unknown>
) {
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO slide_embeddings (id, slide_id, embedding, metadata)
    VALUES (gen_random_uuid(), ${slideId}, ${vectorStr}::vector, ${JSON.stringify(metadata)}::jsonb)
    ON CONFLICT (slide_id) DO UPDATE SET
      embedding = ${vectorStr}::vector,
      metadata = ${JSON.stringify(metadata)}::jsonb,
      updated_at = now()
  `;
}

export async function searchSimilarSlides(
  queryEmbedding: number[],
  limit: number = 10,
  filters?: { touchType?: string; industry?: string }
) {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  return prisma.$queryRaw`
    SELECT se.slide_id, se.metadata,
           1 - (se.embedding <=> ${vectorStr}::vector) as similarity
    FROM slide_embeddings se
    WHERE (${filters?.touchType}::text IS NULL
           OR se.metadata->>'touchType' = ${filters?.touchType})
    ORDER BY se.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
}
```

### Pattern 2: Mastra Workflow for Slide Ingestion

**What:** A new Mastra workflow (`slide-ingest-workflow`) that processes a template's slides through extraction, classification, and embedding in discrete steps. Each step has clear inputs/outputs, enabling retry on failure and progress tracking.

**Why:** The existing codebase uses Mastra workflows for all multi-step AI operations (touch-1 through touch-4, pre-call). Slide ingestion follows the same pattern: multi-step, potentially long-running, benefits from durable state. However, this workflow does NOT need suspend/resume (no HITL checkpoint), so it runs to completion once triggered.

**Trade-offs:** Workflow overhead for what could be a simple async function. Worth it because: (1) consistency with existing 5 workflows, (2) built-in retry/error tracking via Mastra's PostgresStore, (3) progress visibility via workflow status polling from the web UI.

**Steps:**
```
trigger (templateId)
  -> validate-access (check Google Drive sharing via files.get)
  -> extract-slides (Google Slides API -> ExtractedSlide[])
  -> classify-slides (LLM structured output -> ClassifiedSlide[])
       -- reuses existing classify-metadata.ts pattern + Gemini schema
  -> generate-embeddings (text -> vector via Vertex AI embedding model)
  -> store-results (Prisma upsert TemplateSlide + raw SQL slide_embeddings)
  -> update-template-status (mark ingestion complete, set slideCount)
```

### Pattern 3: Access Awareness via Drive API Pre-check

**What:** Before ingestion, verify the Google Slides file is shared with the service account. If not shared, mark the template with `accessStatus: "not_shared"` and surface this in the UI with instructions to share.

**Why:** The project already has this exact pattern in the `ContentSource` model (`accessStatus` field). Templates reuse the same approach. The existing `discover-content.ts` ingestion script already handles Drive access checks.

**Implementation:** On template creation (user pastes Google Slides URL), immediately call Drive API `files.get` with the service account. If 403/404, set `accessStatus = "not_shared"`. Do NOT attempt ingestion on inaccessible files. Show a badge in the UI: "Not shared with service account."

### Pattern 4: Side Panel Navigation via Layout Refactor

**What:** Replace the current top-bar-only nav with a collapsible side panel containing "Deals" and "Templates" sections, while keeping the top bar for user info/logout.

**Why:** The authenticated layout currently has a simple top nav bar with just a logo link and user avatar. Adding templates as a second major section requires persistent navigation. A side panel is the standard pattern for internal tools with 2+ navigation sections.

**Implementation:** Modify `apps/web/src/app/(authenticated)/layout.tsx` to include a `<SidePanel>` component alongside the existing content area. Use a cookie or localStorage for collapsed state. The top bar remains for branding and user avatar. Active route is highlighted via `usePathname()`.

### Pattern 5: Rating-Driven Classification Improvement

**What:** Each slide classification gets human thumbs-up/down ratings stored in `SlideRating`. When a slide gets a thumbs-down, the rating includes the corrected classification. On re-ingestion, slides with negative ratings are re-classified using the corrected classifications as few-shot examples in the LLM prompt.

**Why:** The project's knowledge growth model explicitly calls for "overrides become improvement signals." Slide classification follows the same approve/override pattern as Touch 1's feedback loop via `FeedbackSignal`.

**Data flow:**
```
User sees slide classification in preview
  -> Thumbs down + corrected tags
  -> SlideRating stored with original vs corrected
  -> Next ingestion run queries SlideRating for corrected examples
  -> Corrected examples added as few-shot to LLM classification prompt
  -> Classification quality improves per-template
```

---

## Data Flow

### Template Creation Flow

```
User (web)
  -> Paste Google Slides URL + assign touch type(s) + name
  -> Server Action -> POST /templates (agent)
  -> Agent: parse presentation ID from URL
  -> Agent: Drive API files.get (access check with service account)
  -> Agent: Create Template record (Prisma)
  -> Return template with accessStatus
  -> Web: show template card with access status badge
```

### Slide Ingestion Flow

```
User clicks "Ingest" on accessible template (web)
  -> POST /templates/:id/ingest (agent)
  -> Agent: update Template.ingestionStatus = "ingesting"
  -> Agent: start slide-ingest-workflow with templateId
  -> Return { runId } immediately
  -> Web polls GET /templates/:id for status updates

Workflow executes asynchronously:
  Step 1: Google Slides API presentations.get -> all slides
          (reuses existing slide-extractor.ts)
  Step 2: For each slide, LLM classifies metadata
          (reuses existing classify-metadata.ts with Gemini structured output)
  Step 3: For each slide, generate text embedding
          (combine textContent + speakerNotes + classification tags -> Vertex AI)
  Step 4: Upsert TemplateSlide (Prisma) + slide_embeddings (raw SQL)
  Step 5: Update Template: slideCount, ingestedCount, ingestionStatus = "ingested"
```

### Preview & Rating Flow

```
User opens template detail page (web)
  -> Server Action -> GET /templates/:id (agent)
  -> Returns Template with TemplateSlide[] (classification metadata)
  -> Web renders grid: slide thumbnail + classification tags + rating buttons

User clicks thumbs-up/down on a slide:
  -> POST /slides/:id/rate (agent)
  -> Agent stores SlideRating {slideId, raterEmail, rating, correctedTags?}
  -> Unique constraint: one rating per user per slide (upsert)
  -> Web updates UI optimistically
```

### Deck Assembly Enhancement (Future -- Touches 1-3 Use Embeddings)

```
Touch 2/3 workflow requests relevant slides for a deal:
  -> Generate embedding from deal context (industry + capabilities + company info)
  -> searchSimilarSlides(embedding, filters: { touchType: "touch_2" })
  -> Return ranked TemplateSlide[] by cosine similarity
  -> Existing copy-and-prune assembly uses ranked results instead of hardcoded selection
```

---

## New Prisma Models

### Template

```prisma
model Template {
  id              String          @id @default(cuid())
  name            String          // User-provided display name
  presentationId  String          @unique // Google Slides presentation ID (extracted from URL)
  presentationUrl String          // Full Google Slides URL
  touchTypes      String          // JSON array: ["touch_1", "touch_2"]
  accessStatus    String          @default("unknown") // "accessible" | "not_shared" | "unknown"
  ingestionStatus String          @default("pending") // "pending" | "ingesting" | "ingested" | "failed"
  slideCount      Int             @default(0)
  ingestedCount   Int             @default(0)
  lastIngestedAt  DateTime?
  workflowRunId   String?         // Mastra workflow run ID for current/last ingestion
  errorMessage    String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  slides          TemplateSlide[]

  @@index([accessStatus])
  @@index([ingestionStatus])
}

model TemplateSlide {
  id                String        @id @default(cuid())
  templateId        String
  template          Template      @relation(fields: [templateId], references: [id], onDelete: Cascade)
  slideObjectId     String        // Google Slides slide object ID
  slideIndex        Int           // 0-based position in presentation
  documentId        String        @unique // SHA-256 hash (matches existing ExtractedSlide pattern)
  textContent       String        // Extracted text content
  speakerNotes      String        @default("") // Extracted speaker notes
  isLowContent      Boolean       @default(false)
  classification    String        // JSON: SlideMetadata from classify-metadata.ts
  thumbnailUrl      String?       // Google Slides thumbnail export URL
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  ratings           SlideRating[]

  @@unique([templateId, slideIndex])
  @@index([templateId])
}

model SlideRating {
  id                String        @id @default(cuid())
  slideId           String
  slide             TemplateSlide @relation(fields: [slideId], references: [id], onDelete: Cascade)
  raterEmail        String        // From Supabase Auth user (passed via web Server Action)
  rating            Int           // 1 (thumbs down) or 5 (thumbs up)
  correctedTags     String?       // JSON: corrected SlideMetadata if thumbs-down
  comment           String?
  createdAt         DateTime      @default(now())

  @@unique([slideId, raterEmail]) // One rating per user per slide (upsert on re-rate)
  @@index([slideId])
}
```

### slide_embeddings (Raw SQL Migration -- use `--create-only`)

```sql
-- Migration: add_pgvector_slide_embeddings

-- Enable pgvector extension (Supabase has this pre-installed, just needs enabling)
CREATE EXTENSION IF NOT EXISTS vector;

-- Slide embeddings table for semantic search
-- Managed outside Prisma ORM, queried via $queryRaw/$executeRaw
CREATE TABLE slide_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id   TEXT NOT NULL UNIQUE,
  embedding  vector(1536) NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_slide
    FOREIGN KEY (slide_id) REFERENCES "TemplateSlide"(id) ON DELETE CASCADE
);

-- HNSW index for cosine similarity search
-- HNSW over IVFFlat because: better recall, no training step, handles < 100k vectors well
CREATE INDEX slide_embeddings_hnsw_idx ON slide_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- GIN indexes for metadata-filtered searches
CREATE INDEX slide_embeddings_metadata_idx ON slide_embeddings
  USING GIN (metadata);
```

**Migration execution order matters:** The Template + TemplateSlide migration MUST run before the pgvector migration because `slide_embeddings` references `TemplateSlide.id`.

---

## CI/CD Pipeline Architecture

### GitHub Actions Workflow Structure

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup pnpm + node
      - pnpm install --frozen-lockfile
      - pnpm turbo lint

  migrate-db:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node
      - pnpm install --frozen-lockfile
      - cd apps/agent && npx prisma migrate deploy
    env:
      DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
      DIRECT_URL: ${{ secrets.PROD_DIRECT_URL }}

  deploy-web:
    needs: migrate-db
    runs-on: ubuntu-latest
    steps:
      - checkout
      - npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-agent:
    needs: migrate-db
    runs-on: ubuntu-latest
    steps:
      - checkout
      - npm i -g @railway/cli
      - railway up --service agent
    env:
      RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Key CI/CD Decisions

| Decision | Rationale |
|----------|-----------|
| Migrations run in CI, not at container start | Prevents race conditions; matches CLAUDE.md discipline ("treat dev DB as production") |
| `prisma migrate deploy` (not `db push`) | Forward-only migrations per project rules in CLAUDE.md |
| Separate jobs for web and agent | Vercel and Railway are independent; parallel deploy after migration |
| Migrations before deploy | New code may depend on new schema; deploying before migration causes runtime errors |
| Lint before migrate | Catch issues before touching production database |

---

## Integration Points

### External Services

| Service | Integration Pattern | New in v1.2 | Notes |
|---------|---------------------|-------------|-------|
| Google Slides API | Read presentation structure + slide content | Reused | Existing `slide-extractor.ts` handles extraction |
| Google Drive API | Access check for template files | Reused | Existing `getDriveClient()` + `files.get` |
| GPT-OSS 120b (Vertex AI) | Slide classification structured output | Reused | Existing `classify-metadata.ts` Gemini schema pattern |
| Vertex AI Embeddings | Generate 1536-dim vectors from slide text | **NEW** | `textembedding-gecko` or equivalent model |
| Supabase PostgreSQL | pgvector extension for semantic search | **NEW** | Raw SQL via Prisma `$queryRaw` |
| Vercel | Web app deployment via CLI | **NEW** | GitHub Actions integration |
| Railway | Agent deployment via CLI | **NEW** | GitHub Actions integration |
| GitHub Actions | CI/CD orchestration | **NEW** | Lint -> Migrate -> Deploy |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web -> Agent (templates) | REST via `api-client.ts` + Bearer auth | Same pattern as existing /deals, /companies |
| Agent -> Supabase (vectors) | Raw SQL via `prisma.$queryRaw` | Cannot use Prisma ORM for `vector` type |
| Agent -> Supabase (relational) | Prisma ORM | Standard pattern for Template/TemplateSlide/SlideRating |
| CI -> Supabase | `prisma migrate deploy` with prod DATABASE_URL | GitHub Actions secret |
| CI -> Vercel | `vercel deploy --prod` | GitHub Actions secret (VERCEL_TOKEN) |
| CI -> Railway | `railway up` | GitHub Actions secret (RAILWAY_TOKEN) |
| Ingestion workflow -> existing libs | Direct import | `slide-extractor.ts`, `classify-metadata.ts` are reusable |

---

## Build Order (Dependency-Driven)

The features have clear dependencies that dictate build order:

```
1. CI/CD Pipeline (no dependencies on new features, unblocks automated deploys)
   |
2. Prisma Schema + Migrations
   |   Template, TemplateSlide, SlideRating models
   |   pgvector extension + slide_embeddings table (via --create-only)
   |
3. Templates CRUD (agent routes + web pages) -- needs schema
   |   |
   |   4. Side Panel Navigation -- can parallel with CRUD, purely UI
   |
5. Access Awareness (Drive API check on template create) -- needs Template model
   |
6. Slide Ingestion Workflow (extract + classify + embed) -- needs schema + pgvector + embeddings.ts
   |
7. Preview Engine (display classified slides with thumbnails) -- needs ingested data
   |
8. Rating System (human feedback on classifications) -- needs preview working
```

**Recommended phase grouping:**

1. **Phase A: Foundation** -- CI/CD pipeline + Prisma migrations (Template/TemplateSlide/SlideRating + pgvector)
2. **Phase B: Template Management** -- CRUD routes + pages + side panel nav + access awareness
3. **Phase C: Slide Intelligence** -- Ingestion workflow + embeddings module + vector-store module
4. **Phase D: Human Review** -- Preview engine + rating system + classification improvement loop

**Phase ordering rationale:**
- Phase A enables automated deploys for all subsequent phases and ensures the database schema exists
- Phase B creates the user-facing surface (templates list, add form) that Phase C populates
- Phase C is the core intelligence -- it transforms raw Google Slides into classified, searchable vectors
- Phase D closes the feedback loop -- humans validate AI classifications, improving future runs

---

## Anti-Patterns

### Anti-Pattern 1: Storing Embeddings in Prisma JSON Column

**What people do:** Store embedding arrays as JSON strings in a regular Prisma `String` column to avoid the `Unsupported` type complexity.
**Why it is wrong:** Cannot use pgvector's HNSW/IVFFlat indexes. Similarity search becomes a full table scan with application-level cosine math. Performance degrades from O(log n) to O(n). Defeats the purpose of having pgvector.
**Do this instead:** Use raw SQL for vector operations via `prisma.$queryRaw`. The `Unsupported("vector(1536)")` annotation keeps Prisma schema in sync; raw queries handle reads/writes.

### Anti-Pattern 2: Running Ingestion Synchronously in API Handler

**What people do:** Process all slides (extract + classify + embed) inside the POST handler, making the HTTP request hang for minutes.
**Why it is wrong:** Google Slides API rate limits + LLM classification latency = 30-120 seconds for a 20-slide deck. HTTP timeout kills the request. No progress visibility. Railway's healthcheck may think the service is hung.
**Do this instead:** Trigger a Mastra workflow and return the `runId` immediately. Web polls template status for progress. This matches the existing pattern used by touch-1 through touch-4 workflows.

### Anti-Pattern 3: Running Prisma Migrations at Container Start

**What people do:** Add `prisma migrate deploy` to the Docker entrypoint or container startup script.
**Why it is wrong:** Multiple container instances racing to migrate. Migration failures crash the container and trigger Railway's restart loop. No visibility into migration status.
**Do this instead:** Run migrations in CI/CD (GitHub Actions job) before deploying new containers. Single execution, sequential, with clear success/failure status.

### Anti-Pattern 4: Dual Embedding Storage Without Foreign Keys

**What people do:** Store embedding metadata in Prisma model AND vector data in a separate unlinked table, with no referential integrity.
**Why it is wrong:** Data gets out of sync. Orphaned embeddings accumulate when slides are deleted. No cascading deletes.
**Do this instead:** `slide_embeddings.slide_id` references `TemplateSlide.id` with `ON DELETE CASCADE`. The TemplateSlide is the source of truth; the embedding is a computed derivative that follows the lifecycle of its parent.

### Anti-Pattern 5: Adding Templates to ContentSource Model

**What people do:** Reuse the existing `ContentSource` model for templates instead of creating a new `Template` model.
**Why it is wrong:** `ContentSource` was designed for offline batch discovery scripts. It lacks touch assignment, ingestion workflow tracking, and the relation to `TemplateSlide`. Overloading it couples two different concerns.
**Do this instead:** Create a dedicated `Template` model that borrows patterns from `ContentSource` (like `accessStatus`) but is purpose-built for user-managed template CRUD with slide-level relations.

---

## Scaling Considerations

| Concern | Current Scale (< 100 templates, < 2000 slides) | At 1000+ templates | Notes |
|---------|------------------------------------------------|---------------------|-------|
| pgvector search | HNSW index handles this trivially | Still fine with HNSW up to ~1M vectors | No scaling concern at projected scale |
| Ingestion throughput | Sequential workflow, one at a time | Queue multiple workflows | Mastra handles concurrent workflow runs natively |
| Slide thumbnails | Google Slides export URL (on-demand per view) | Cache thumbnails in Supabase Storage or CDN | Not needed at current scale |
| Rating aggregation | COUNT query per slide | Add `ratingCount` / `avgRating` columns to TemplateSlide | Not needed at current scale |
| Embedding dimension | 1536 (standard) | Consider 768 if storage is a concern | 1536 is fine for < 100k vectors |

### Scaling Priorities

1. **First bottleneck:** LLM classification latency during ingestion. A 50-slide deck takes ~2 minutes with rate limiting. Mitigation: batch slides in groups of 3-5 per LLM call (classify multiple slides per request using array schema).
2. **Second bottleneck:** Google Slides API rate limits (300 requests per minute per project). Mitigation: existing 200ms delay between calls in `extract-slides.ts` already handles this.

---

## Sources

- [Supabase pgvector documentation](https://supabase.com/docs/guides/database/extensions/pgvector) -- extension setup, HNSW indexing, vector operations
- [Prisma pgvector discussion #18220](https://github.com/prisma/prisma/discussions/18220) -- `Unsupported("vector")` workaround pattern
- [Prisma pgvector issue #18442](https://github.com/prisma/prisma/issues/18442) -- raw SQL approach for vector operations
- [Railway CI/CD with GitHub Actions](https://help.railway.com/questions/deploy-using-ci-cd-github-actions-18407bf0) -- Railway CLI deployment from GitHub Actions
- [Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) -- Vercel CLI deployment pattern
- [Railway monorepo docs](https://docs.railway.com/guides/monorepo) -- watch path configuration for monorepo services
- Existing codebase: `apps/agent/src/ingestion/classify-metadata.ts` (LLM classification), `apps/agent/src/lib/slide-extractor.ts` (slide extraction), `apps/agent/src/mastra/index.ts` (API route registration pattern), `apps/agent/prisma/schema.prisma` (current schema with 9 models)

---
*Architecture research for: v1.2 Templates & Slide Intelligence Integration*
*Researched: 2026-03-05*
