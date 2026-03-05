# Phase 20: Slide Ingestion Agent - Research

**Researched:** 2026-03-05
**Domain:** Slide ingestion pipeline (extract, embed, classify, store) with progress tracking and smart merge
**Confidence:** HIGH

## Summary

Phase 20 connects existing, well-tested building blocks -- slide-extractor.ts, classify-metadata.ts, Vertex AI embeddings, pgvector schema -- into an end-to-end ingestion pipeline with progress tracking, auto-triggering, and smart merge on re-ingestion. The core libraries are already installed and proven in the codebase. The primary engineering work is: (1) a new ingestion API endpoint that orchestrates extraction, embedding, and classification sequentially per slide with progress tracking; (2) schema migration to add contentHash and archived fields to SlideEmbedding plus a Template-to-SlideEmbedding FK; (3) web UI updates to show inline progress on template cards and auto-trigger ingestion on template add; (4) background staleness polling with auto-re-ingestion.

No new npm dependencies are needed. The `pgvector` npm package is already installed. All embedding generation uses the existing `@google/genai` with `text-embedding-005` via Vertex AI. Classification uses the existing Gemini structured output in `classify-metadata.ts`. The slide extractor already handles text extraction including tables, groups, and speaker notes.

**Primary recommendation:** Build the ingestion as a stateful API endpoint (not a Mastra workflow) that writes progress to a new `ingestionStatus` field on Template, polled by the web app via setInterval. Use content hashing (SHA-256 of slide text + notes) for smart merge identity tracking.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Progress experience:** Inline progress on the template card itself: progress bar + "Slide N of M" text. Ingestion runs server-side in background. Completion notification via Sonner toast + card updates to Ready status with slide count. Failed slides: skip and continue, show count at end.
- **Classification depth:** Multi-value classification with MULTIPLE industries, solution pillars, personas, funnel stages, and slide categories stored as JSON arrays in TEXT columns. Single overall confidence score per slide (0-100%). All slides classified including low-content slides.
- **Ingestion trigger & flow:** Auto-ingest on add (when access confirmed). Auto-ingest on stale (background polling checks Drive modifiedTime). Sequential processing one template at a time (queue model). No manual "Re-ingest" button.
- **Re-ingestion behavior (smart merge):** Track slides by content hash (not slide index). Unchanged slides: preserve all data including human ratings. Reordered slides: silently update index. Changed slides: re-classify, keep previous rating as reference but lower confidence, flag for re-review. Removed slides: soft delete (archived). New slides: ingest normally.

### Claude's Discretion
- Background polling interval for staleness detection
- Rate limiting between API calls (200-500ms delays based on existing patterns)
- Content hash algorithm for smart merge
- Exact progress bar styling and animation
- Queue implementation details for sequential processing
- How to store "previous rating reference" on changed slides

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLIDE-02 | User can trigger slide ingestion for an accessible template | Auto-trigger on template add (POST /templates response triggers ingestion). Ingestion endpoint at POST /templates/:id/ingest. |
| SLIDE-03 | Agent extracts text content from each slide via Google Slides API | Existing `slide-extractor.ts` with `extractSlidesFromPresentation()` handles this completely. |
| SLIDE-04 | Agent generates vector embedding for each slide via Vertex AI text-embedding model | Use `@google/genai` `embedContent()` with `text-embedding-005` model, `RETRIEVAL_DOCUMENT` task type, 768 dimensions. |
| SLIDE-05 | Agent classifies each slide by industry, solution pillar, persona, funnel stage, and content type via LLM structured output | Existing `classify-metadata.ts` with `classifySlide()` / `classifyAllSlides()` handles this. Multi-value output already matches the schema. |
| SLIDE-06 | Embeddings and classifications are stored in Supabase pgvector | Use existing `SlideEmbedding` model with `$executeRaw` for vector INSERT via `pgvector` npm `toSql()`. Schema migration adds contentHash, archived, and multi-value classification columns. |
| SLIDE-07 | User can see real-time progress during multi-slide ingestion (slide N/M) | Store progress on Template model (ingestionProgress TEXT field with JSON). Web app polls GET /templates/:id/progress every 2s. Inline progress bar on TemplateCard. |
| SLIDE-08 | Each classification includes a confidence score (0-100%) | Add confidence generation to classification prompt. Store as Float on SlideEmbedding (column already exists). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | ^1.43.0 | Vertex AI embeddings via `embedContent()` and Gemini classification | Already installed, configured with `vertexai: true` throughout codebase |
| `googleapis` | ^144.0.0 | Google Slides API for text extraction, Drive API for staleness checks | Already installed, auth helpers exist in `google-auth.ts` |
| `pgvector` | ^0.2.0 | Vector serialization for Prisma raw queries | Already installed in agent app |
| Prisma | 6.19.x | ORM for all non-vector queries, migrations | Already installed. MUST stay on 6.x (Prisma 7.x has vector regression) |
| `@mastra/core` | 1.8.x | HTTP server with `registerApiRoute()` for ingestion endpoints | Already the agent server framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | existing | Toast notifications for ingestion completion | Web app: show "X slides ingested" toast |
| `date-fns` | existing | Format timestamps for staleness display | Web app: template card time display |
| shadcn/ui Progress | N/A | Progress bar component for inline card progress | Install via `npx shadcn@latest add progress` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling for progress | Server-Sent Events (SSE) | SSE adds complexity; polling every 2s is sufficient for slide-by-slide progress (each slide takes 1-3s to process). Existing codebase uses polling everywhere. |
| Stateful API endpoint | Mastra workflow | Mastra workflows are designed for multi-step HITL flows with suspend/resume. Ingestion is a simple sequential loop -- a regular async function with progress writes is simpler and more debuggable. |
| Template field for progress | Separate IngestionJob table | Extra table adds complexity for a single active job per template. Storing progress state directly on Template is simpler. |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
├── ingestion/
│   ├── classify-metadata.ts     # EXISTING - Gemini classification
│   ├── ingest-template.ts       # NEW - Main ingestion orchestrator
│   ├── embed-slide.ts           # NEW - Vertex AI embedding generation
│   └── smart-merge.ts           # NEW - Content hash comparison and merge logic
├── lib/
│   ├── slide-extractor.ts       # EXISTING - Google Slides text extraction
│   └── google-auth.ts           # EXISTING - Service account auth
└── mastra/
    └── index.ts                 # MODIFIED - Add ingestion + progress endpoints

apps/web/src/
├── components/
│   ├── template-card.tsx        # MODIFIED - Add inline progress bar
│   ├── template-status-badge.tsx # MODIFIED - Add "Ingesting" status
│   └── ui/progress.tsx          # NEW - shadcn Progress component
├── lib/
│   ├── template-utils.ts        # MODIFIED - Add "ingesting" status type
│   └── actions/
│       └── template-actions.ts  # MODIFIED - Add triggerIngestion, getProgress actions
└── app/(authenticated)/templates/
    └── templates-page-client.tsx # MODIFIED - Auto-trigger ingestion, poll progress
```

### Pattern 1: Ingestion Orchestrator
**What:** A single async function that processes slides sequentially, writing progress to the database after each slide.
**When to use:** For any long-running, slide-by-slide processing pipeline.
**Example:**
```typescript
// apps/agent/src/ingestion/ingest-template.ts
export async function ingestTemplate(templateId: string): Promise<IngestResult> {
  const template = await prisma.template.findUniqueOrThrow({ where: { id: templateId } });

  // 1. Extract all slides (single API call)
  const slides = await extractSlidesFromPresentation(
    template.presentationId, template.name, ""
  );
  const totalSlides = slides.length;

  // Update progress: extraction complete
  await updateProgress(templateId, { phase: "classifying", current: 0, total: totalSlides });

  // 2. Smart merge: compute content hashes and compare with existing
  const existingEmbeddings = await getExistingEmbeddings(templateId);
  const mergeResult = computeMerge(slides, existingEmbeddings);

  let processed = 0;
  let skipped = 0;

  // 3. Process each slide that needs work
  for (const slide of mergeResult.toProcess) {
    try {
      // Classify via Gemini
      const classified = await classifySlide(slide, titleText, pillars);
      // Generate embedding via Vertex AI
      const embedding = await generateEmbedding(slide.textContent + " " + slide.speakerNotes);
      // Upsert into SlideEmbedding
      await upsertSlideEmbedding(templateId, slide, classified, embedding);
      processed++;
    } catch (err) {
      skipped++;
      console.error(`Skipped slide ${slide.slideIndex}: ${err}`);
    }
    // Update progress after each slide
    await updateProgress(templateId, { phase: "classifying", current: processed + skipped, total: totalSlides });
    // Rate limit
    await delay(300);
  }

  // 4. Handle removed slides (soft delete)
  await archiveRemovedSlides(mergeResult.toArchive);

  // 5. Update template metadata
  await prisma.template.update({
    where: { id: templateId },
    data: {
      lastIngestedAt: new Date(),
      slideCount: processed,
      ingestionProgress: null, // Clear progress
    },
  });

  return { processed, skipped, archived: mergeResult.toArchive.length };
}
```

### Pattern 2: Progress Polling from Web App
**What:** Web app polls a lightweight GET endpoint every 2 seconds while ingestion is running.
**When to use:** When template card shows "Ingesting" status.
**Example:**
```typescript
// In TemplateCard component
useEffect(() => {
  if (status !== "ingesting") return;
  const interval = setInterval(async () => {
    const progress = await getIngestionProgressAction(template.id);
    if (progress) {
      setCurrentSlide(progress.current);
      setTotalSlides(progress.total);
    }
    if (!progress || progress.phase === "complete") {
      clearInterval(interval);
      onRefresh?.();
      toast.success(`${template.name} ingested (${progress?.total} slides)`);
    }
  }, 2000);
  return () => clearInterval(interval);
}, [status]);
```

### Pattern 3: Smart Merge via Content Hash
**What:** Track slide identity by SHA-256 hash of content rather than position index.
**When to use:** On every re-ingestion to determine which slides changed, moved, or were removed.
**Example:**
```typescript
function computeContentHash(textContent: string, speakerNotes: string): string {
  return createHash("sha256")
    .update(`${textContent}\n---\n${speakerNotes}`)
    .digest("hex")
    .substring(0, 40);
}

interface MergeResult {
  unchanged: { existing: SlideEmbedding; newIndex: number }[];  // Just update index
  changed: { existing: SlideEmbedding; slide: ExtractedSlide }[]; // Re-classify
  added: ExtractedSlide[];    // New slides
  toArchive: SlideEmbedding[]; // Removed slides
}
```

### Pattern 4: Sequential Queue for Templates
**What:** Simple in-memory queue ensuring only one template ingests at a time.
**When to use:** Prevents Google API rate limit issues from concurrent ingestions.
**Example:**
```typescript
class IngestionQueue {
  private queue: string[] = [];
  private processing = false;

  async enqueue(templateId: string): Promise<void> {
    if (this.queue.includes(templateId)) return; // Deduplicate
    this.queue.push(templateId);
    if (!this.processing) this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) { this.processing = false; return; }
    this.processing = true;
    const templateId = this.queue.shift()!;
    try {
      await ingestTemplate(templateId);
    } catch (err) {
      console.error(`Ingestion failed for ${templateId}:`, err);
    }
    this.processNext(); // Process next in queue
  }
}

export const ingestionQueue = new IngestionQueue();
```

### Anti-Patterns to Avoid
- **Parallel slide classification:** Do NOT classify slides concurrently. Google/Vertex AI rate limits will cause 429 errors. Process sequentially with 200-300ms delays between calls.
- **Storing embeddings via Prisma ORM:** Do NOT use `prisma.slideEmbedding.create()` for embedding columns. Prisma does not support the vector type. Use `$executeRaw` with `pgvector.toSql()`.
- **Using Mastra workflow for ingestion:** Mastra workflows add suspend/resume state overhead. Ingestion is a fire-and-forget background task, not an interactive workflow. A simple async function is cleaner.
- **Relying on slide index for identity:** Slide positions change when users reorder in Google Slides. Content hash is the stable identity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text extraction from slides | Custom Google Slides API parsing | `slide-extractor.ts` `extractSlidesFromPresentation()` | Already handles shapes, tables, groups, speaker notes, low-content detection |
| Slide classification | Custom LLM prompt + JSON parsing | `classify-metadata.ts` `classifySlide()` | Already has Gemini structured output, Zod validation, error handling, rate limiting |
| Vector serialization | Manual SQL string building | `pgvector` npm `toSql()` / `fromSql()` | Handles proper vector format for PostgreSQL, prevents SQL injection |
| Progress bar UI | Custom div with width calculation | shadcn/ui `<Progress />` component | Accessible, animated, consistent with existing UI |
| Content hashing | Custom string comparison | Node.js `crypto.createHash("sha256")` | Already used in `slide-extractor.ts` for `generateDocumentId()` |

**Key insight:** This phase is primarily integration/orchestration work. All the hard problems (text extraction, classification, embedding, vector storage) are already solved in existing modules. The main engineering challenge is the smart merge logic and progress tracking UX.

## Common Pitfalls

### Pitfall 1: Vector INSERT via Prisma ORM
**What goes wrong:** Using `prisma.slideEmbedding.create({ data: { embedding: vectorArray } })` throws "Unknown type vector" error.
**Why it happens:** Prisma 6.x marks the column as `Unsupported("vector(768)")` and does not serialize it.
**How to avoid:** Always use `$executeRaw` with `pgvector.toSql(embeddingArray)` + `::vector` cast.
**Warning signs:** "Invalid value for argument" or "Unknown type" errors from Prisma.

### Pitfall 2: Rate Limiting on Vertex AI Embeddings
**What goes wrong:** 429 Too Many Requests from Vertex AI when generating embeddings for 20+ slides quickly.
**Why it happens:** Vertex AI has per-minute rate limits on `text-embedding-005` (typically 300 RPM for standard tier).
**How to avoid:** Add 200-300ms delay between embedding calls. The existing `classify-metadata.ts` uses 300ms (`RATE_LIMIT_DELAY`). Match this pattern.
**Warning signs:** Sporadic 429 errors after processing ~5-10 slides.

### Pitfall 3: Prisma Migration with Existing Data
**What goes wrong:** Adding new required columns to SlideEmbedding fails because existing rows have no values.
**Why it happens:** Forward-only migrations cannot add NOT NULL columns without defaults when data exists.
**How to avoid:** Add new columns as nullable (contentHash String?, archived Boolean @default(false)), or provide explicit defaults. The SlideEmbedding table may already have rows from manual testing.
**Warning signs:** "Column X cannot be null" migration errors.

### Pitfall 4: Content Hash Collision with Empty Slides
**What goes wrong:** Multiple empty/low-content slides produce the same content hash, causing merge confusion.
**Why it happens:** Title slides with just "Company Name" or empty dividers have near-identical content.
**How to avoid:** Include the slideObjectId (from Google Slides API) as a fallback differentiator in the hash computation. Use `hash(textContent + speakerNotes + slideObjectId)` to ensure uniqueness even for empty slides.
**Warning signs:** Slides being incorrectly identified as "unchanged" during re-ingestion.

### Pitfall 5: Template Progress State Left Dirty on Crash
**What goes wrong:** If the agent process crashes mid-ingestion, the template is stuck in "ingesting" state forever.
**Why it happens:** Progress state on the Template model was never cleared.
**How to avoid:** On agent startup, clear any stale ingestion progress (templates with non-null ingestionProgress older than 10 minutes). Also add a timeout check in the progress polling endpoint.
**Warning signs:** Templates permanently showing "Ingesting" badge with no progress.

### Pitfall 6: SlideEmbedding Schema Mismatch
**What goes wrong:** Current SlideEmbedding has single-value TEXT columns (industry, solutionPillar, persona, funnelStage, contentType) but the classification returns multi-value arrays.
**Why it happens:** Phase 18 schema was designed before multi-value classification was decided.
**How to avoid:** The migration for this phase MUST alter these columns or add new JSON/TEXT columns for the multi-value arrays. Store the full classification as a JSON TEXT column (e.g., `classificationJson TEXT`) alongside the existing single-value columns (which can be deprecated or populated with the primary value for backward compatibility).
**Warning signs:** Only the first industry or persona being stored, losing multi-value richness.

## Code Examples

### Generating Vertex AI Embeddings
```typescript
// apps/agent/src/ingestion/embed-slide.ts
import { GoogleGenAI } from "@google/genai";
import { env } from "../env";

const ai = new GoogleGenAI({
  vertexai: true,
  project: env.GOOGLE_CLOUD_PROJECT,
  location: env.GOOGLE_CLOUD_LOCATION,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "text-embedding-005",
    contents: text,
    config: { taskType: "RETRIEVAL_DOCUMENT" },
  });
  return response.embeddings![0]!.values!; // number[768]
}
```

### Upserting SlideEmbedding with Vector
```typescript
// Using pgvector npm for vector serialization
import pgvector from "pgvector";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function upsertSlideEmbedding(
  templateId: string,
  slideIndex: number,
  contentText: string,
  embedding: number[],
  classification: SlideMetadata,
  contentHash: string,
  confidence: number,
): Promise<void> {
  const id = cuid();
  const vec = pgvector.toSql(embedding);
  const classJson = JSON.stringify(classification);

  await prisma.$executeRaw`
    INSERT INTO "SlideEmbedding" (
      id, "templateId", "slideIndex", "contentText", embedding,
      industry, "solutionPillar", persona, "funnelStage", "contentType",
      confidence, "contentHash", "classificationJson", archived,
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${templateId}, ${slideIndex}, ${contentText}, ${vec}::vector,
      ${classification.industries[0] ?? null},
      ${classification.solutionPillars[0] ?? null},
      ${(classification.buyerPersonas[0] as string) ?? null},
      ${classification.funnelStages[0] ?? null},
      ${classification.contentType},
      ${confidence}, ${contentHash}, ${classJson}, false,
      NOW(), NOW()
    )
    ON CONFLICT ("templateId", "contentHash")
    DO UPDATE SET
      "slideIndex" = EXCLUDED."slideIndex",
      "contentText" = EXCLUDED."contentText",
      embedding = EXCLUDED.embedding,
      industry = EXCLUDED.industry,
      "solutionPillar" = EXCLUDED."solutionPillar",
      persona = EXCLUDED.persona,
      "funnelStage" = EXCLUDED."funnelStage",
      "contentType" = EXCLUDED."contentType",
      confidence = EXCLUDED.confidence,
      "classificationJson" = EXCLUDED."classificationJson",
      archived = false,
      "updatedAt" = NOW()
  `;
}
```

### Adding Ingestion Endpoint to Mastra
```typescript
// In apps/agent/src/mastra/index.ts
registerApiRoute("/templates/:id/ingest", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    // Enqueue for sequential processing
    ingestionQueue.enqueue(id);
    return c.json({ queued: true });
  },
}),

registerApiRoute("/templates/:id/progress", {
  method: "GET",
  handler: async (c) => {
    const id = c.req.param("id");
    const template = await prisma.template.findUnique({
      where: { id },
      select: { ingestionProgress: true },
    });
    if (!template?.ingestionProgress) {
      return c.json(null);
    }
    return c.json(JSON.parse(template.ingestionProgress));
  },
}),
```

### Confidence Score in Classification Prompt
```typescript
// Add to classification prompt in classify-metadata.ts
// The confidence score should be added to the Gemini response schema:
confidence: {
  type: Type.NUMBER,
  description: "Overall confidence score (0-100) for this classification. " +
    "100 = highly confident all tags are correct, " +
    "50 = moderate confidence, some tags may be wrong, " +
    "below 30 = low confidence, slide content is ambiguous."
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-value classification columns | Multi-value JSON arrays in TEXT columns | This phase (user decision) | Schema migration needed: add classificationJson TEXT column |
| Slide identity by index position | Content hash-based identity | This phase (user decision) | Enables smart merge on re-ingestion |
| Manual re-ingest button | Auto-ingest on add + staleness polling | This phase (user decision) | Fully automated ingestion lifecycle |

**Deprecated/outdated:**
- Single-value `industry`, `solutionPillar`, `persona`, `funnelStage` columns on SlideEmbedding will be retained for backward compatibility but the `classificationJson` TEXT column becomes the source of truth for multi-value classifications.

## Schema Migration Plan

The following changes are needed to the Prisma schema (forward-only migration per CLAUDE.md):

### Migration 1: Add ingestion support columns
```sql
-- Add to SlideEmbedding
ALTER TABLE "SlideEmbedding" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "classificationJson" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SlideEmbedding" ADD COLUMN "speakerNotes" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "slideObjectId" TEXT;

-- Add to Template
ALTER TABLE "Template" ADD COLUMN "ingestionProgress" TEXT;
ALTER TABLE "Template" ADD COLUMN "ingestionStatus" TEXT NOT NULL DEFAULT 'idle';

-- Unique constraint for smart merge upsert
CREATE UNIQUE INDEX "SlideEmbedding_templateId_contentHash_key"
  ON "SlideEmbedding" ("templateId", "contentHash");

-- Index for archived filtering
CREATE INDEX "SlideEmbedding_archived_idx" ON "SlideEmbedding" (archived);
```

### Prisma Schema Updates
```prisma
model SlideEmbedding {
  id                 String   @id @default(cuid())
  templateId         String
  slideIndex         Int
  slideObjectId      String?
  contentText        String
  speakerNotes       String?
  embedding          Unsupported("vector(768)")
  // Single-value columns (backward compat, populated with primary value)
  industry           String?
  solutionPillar     String?
  persona            String?
  funnelStage        String?
  contentType        String?
  // Multi-value classification (source of truth)
  classificationJson String?  // Full SlideMetadata as JSON
  confidence         Float?
  contentHash        String?  // SHA-256 of text+notes+slideObjectId
  archived           Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([templateId, contentHash])
  @@index([templateId])
  @@index([archived])
  @@index([embedding], name: "SlideEmbedding_embedding_idx")
}

model Template {
  id                String    @id @default(cuid())
  name              String
  presentationId    String    @unique
  googleSlidesUrl   String
  touchTypes        String
  accessStatus      String    @default("not_checked")
  lastIngestedAt    DateTime?
  sourceModifiedAt  DateTime?
  slideCount        Int       @default(0)
  ingestionStatus   String    @default("idle") // "idle" | "queued" | "ingesting" | "failed"
  ingestionProgress String?   // JSON: { current, total, phase, skipped }
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([accessStatus])
}
```

## Background Staleness Polling

**Recommended interval:** 5 minutes (300,000ms). This balances freshness detection with API quota conservation. Google Drive `files.get` is a lightweight read (does not count against Slides API quota).

**Implementation:** Use `setInterval` in the agent's startup code (after Mastra initializes). On each tick:
1. Fetch all templates with `accessStatus = "accessible"` and `ingestionStatus = "idle"`
2. For each, call Drive API to get `modifiedTime`
3. If `modifiedTime > lastIngestedAt`, enqueue for re-ingestion
4. Rate limit: 200ms between Drive API calls

## Open Questions

1. **Confidence score generation approach**
   - What we know: User wants a single 0-100% confidence per slide. The existing Gemini schema does not include a confidence field.
   - What's unclear: Whether to add confidence to the Gemini response schema (LLM self-assessment) or compute it heuristically (e.g., based on text length, number of tags assigned).
   - Recommendation: Add confidence to the Gemini response schema. LLM self-assessment is standard practice and simpler to implement. Heuristic computation would require calibration data we do not have.

2. **Previous rating reference on changed slides**
   - What we know: User wants changed slides to keep the previous human rating as a "reference" with lowered confidence.
   - What's unclear: No SlideRating model exists yet (that is Phase 21). How to store a "previous confidence" value.
   - Recommendation: When a slide's content changes during re-ingestion, lower the confidence score by 50% (e.g., 80% becomes 40%) and set a `needsReReview` boolean flag. Store the previous classificationJson in a `previousClassificationJson` TEXT column. Phase 21 will handle the actual rating display and re-review flow.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no automated test framework configured) |
| Config file | none |
| Quick run command | `pnpm --filter agent build && pnpm --filter web build` |
| Full suite command | `pnpm lint && pnpm typecheck && pnpm build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLIDE-02 | Trigger ingestion for accessible template | smoke | `curl -X POST localhost:4111/templates/:id/ingest -H "X-API-Key: ..."` | Wave 0 |
| SLIDE-03 | Extract text from slides via Slides API | integration | Manual: verify extracted text matches slide content | Wave 0 |
| SLIDE-04 | Generate 768-dim embedding via Vertex AI | integration | Manual: verify embedding array length = 768 | Wave 0 |
| SLIDE-05 | Classify slide with multi-value tags | integration | Manual: verify classificationJson contains valid arrays | Wave 0 |
| SLIDE-06 | Store in pgvector | integration | `psql -c "SELECT id, confidence FROM \"SlideEmbedding\" WHERE \"templateId\" = '...'"` | Wave 0 |
| SLIDE-07 | Real-time progress (N/M) | manual-only | Visual: observe progress bar on template card during ingestion | N/A |
| SLIDE-08 | Confidence score 0-100% | integration | Manual: verify confidence column populated with value in 0-100 range | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter agent build && pnpm --filter web build`
- **Per wave merge:** `pnpm lint && pnpm typecheck && pnpm build`
- **Phase gate:** Full suite green + manual smoke test of ingestion flow

### Wave 0 Gaps
- No automated test infrastructure -- all validation is build-time type checking + manual smoke testing
- This is consistent with the existing project approach (no test files exist in the codebase)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/agent/src/lib/slide-extractor.ts` -- verified text extraction patterns
- Existing codebase: `apps/agent/src/ingestion/classify-metadata.ts` -- verified classification patterns with Gemini structured output
- Existing codebase: `apps/agent/prisma/schema.prisma` -- verified current SlideEmbedding and Template models
- Existing codebase: `apps/agent/src/mastra/index.ts` -- verified registerApiRoute pattern and existing template endpoints
- `.planning/research/STACK.md` -- verified `text-embedding-005` model, `embedContent()` API, pgvector patterns
- `.planning/phases/20-slide-ingestion-agent/20-CONTEXT.md` -- user decisions on progress UX, smart merge, auto-trigger

### Secondary (MEDIUM confidence)
- Vertex AI text-embedding-005 rate limits: ~300 RPM standard tier (based on prior research in STACK.md, verified against Google documentation patterns)

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase and prior research

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in codebase
- Architecture: HIGH -- patterns directly derived from existing codebase patterns (registerApiRoute, Prisma raw queries, polling)
- Pitfalls: HIGH -- identified from actual codebase constraints (Prisma vector limitation, rate limits from existing code)
- Schema migration: HIGH -- based on verified current schema and CLAUDE.md migration rules
- Smart merge: MEDIUM -- content hash approach is standard but the specific edge cases (empty slides, reordering) need careful implementation

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (30 days -- stable domain, no external dependency changes expected)
