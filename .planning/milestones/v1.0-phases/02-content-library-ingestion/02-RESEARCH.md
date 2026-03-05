# Phase 2: Content Library Ingestion - Research

**Researched:** 2026-03-03
**Domain:** Google Slides API text extraction, AtlusAI knowledge base ingestion, Gemini-based metadata classification, idempotent ingestion pipelines
**Confidence:** MEDIUM-HIGH (Google APIs HIGH from official docs; AtlusAI MEDIUM from observed MCP tools + project context; Gemini classification HIGH from official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- One AtlusAI document per slide -- each slide extracted independently via Google Slides API
- Extract text content + speaker notes only (no visual layout descriptions)
- Store source presentation ID + slide objectId as metadata on each document (objectIds survive slide reordering -- validated in Phase 1 spike)
- Keep both whole-deck documents (already in AtlusAI) and new slide-level documents -- deck-level useful for broad semantic search, slide-level for precise retrieval
- AI-assigned tags using Gemini to auto-classify each slide's metadata, with a human-reviewable manifest generated before bulk ingestion runs
- Solution pillars derived from existing deck content (Master Solutions deck, GTM Solutions deck) -- researcher surfaces the list, user approves before tags are applied
- Funnel stages aligned to GTM touch points: First Contact (Touch 1), Intro Conversation (Touch 2), Capability Alignment (Touch 3), Solution Proposal (Touch 4+)
- Multi-value tags per dimension -- a slide can belong to multiple industries, multiple pillars, multiple funnel stages
- `content_type` tag distinguishes: template, example, case_study, brand_guide, resource
- Content set may grow during hackathon -- ingestion script must be idempotent and re-runnable without creating duplicates
- Example proposals (Alaska Airlines, MasterControl, Encompass, WSA, Satellite Industries, Gravie) serve dual purpose: reference context for AI tone/style AND retrievable slide blocks for assembly -- distinguished by `content_type: example` tag
- Case studies chunked at slide level with same metadata schema as templates
- Industry coverage gaps flagged in the manifest report -- no synthetic content created to fill gaps
- Core templates identified:
  - Touch 1: Two Pager Template
  - Touch 2: Meet Lumenalta - 2026 (+ NBCUniversal, Bleecker Street Group as examples)
  - Touch 3: 20251021 Master Solutions deck, 2026 GTM Solutions, 200A Master Deck
  - Touch 4: Example proposals as reference
- Separate image registry (NOT AtlusAI) -- JSON manifest or DB table mapping person names/categories to Google Drive file URLs
- Images served from Google Drive URLs (no GCS/public URL setup needed)
- Curated subset only: leadership headshots, company logos, key brand icons -- skip stock photo variants and duplicates
- ~9,000 image files in `01 Resources/` are NOT ingested into AtlusAI

### Claude's Discretion
- Brand guidelines (Branded Basics) ingestion approach -- whether to keep as whole reference document or extract structured rules
- Exact AI classification prompt design for metadata tagging
- Manifest format (JSON vs CSV vs markdown table)
- Image registry storage mechanism (JSON file, Prisma table, or both)
- How to handle slides with minimal text content (title-only slides, divider slides)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-01 | All existing Lumenalta deck templates are ingested into AtlusAI at slide level -- one retrievable unit per slide with metadata tags (industry, solution pillar, persona, funnel stage) | Google Slides API text extraction pattern (presentations.get), slide-level chunking architecture, Gemini metadata classification, AtlusAI ingestion via MCP or REST |
| CONT-02 | All case studies are indexed in AtlusAI tagged by industry, subsector, solution pillar, and buyer persona | Same ingestion pipeline as CONT-01 with `content_type: case_study`; case study slides use identical metadata schema |
| CONT-03 | Brand guidelines and approved image/icon library are indexed in AtlusAI for retrieval during asset assembly | Brand guidelines ingested as AtlusAI document; image registry stored separately as Prisma table + JSON manifest with Google Drive URLs |
| CONT-04 | All 11 industries are represented in AtlusAI with at least one complete deck template and one case study each | Content inventory manifest with coverage report per industry; gap detection before bulk ingestion |
</phase_requirements>

## Summary

Phase 2 builds the content extraction and ingestion pipeline that populates AtlusAI with slide-level documents from Lumenalta's Google Drive deck library. The pipeline has four major components: (1) a Google Drive file discovery step that lists all Google Slides presentations in the Hack-a-thon folder, (2) a Google Slides API extraction step that reads each slide's text content and speaker notes, (3) a Gemini-powered metadata classification step that assigns industry, solution pillar, funnel stage, and content type tags to each slide, and (4) an AtlusAI ingestion step that creates one document per slide with full metadata.

The critical technical insight is that AtlusAI already has ~9,642 documents at the whole-document level ingested from the connected Google Drive folder. The slide-level ingestion adds granularity on top of this. The available MCP tools (`knowledge_base_search_semantic`, `knowledge_base_search_structured`, `discover_documents`) are read-only search tools -- they cannot create documents. The ingestion path needs to be discovered: either AtlusAI exposes additional MCP tools for document creation (which need to be discovered via `tools/list`), it has a REST API, or documents are ingested by placing properly structured files in the connected Google Drive folder for AtlusAI to re-index. This is the highest-uncertainty item in this phase and must be resolved first.

A separate image registry (not AtlusAI) stores curated brand assets as a Prisma table mapping person names, categories, and asset types to Google Drive file URLs. This is straightforward database work with no external API uncertainty.

**Primary recommendation:** Start with an MCP tool discovery step to find AtlusAI's document creation capabilities, then build a 2-3 deck pilot ingestion to validate the full pipeline before bulk ingestion.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | ^144.0.0 | Google Slides API (presentations.get) for slide text extraction, Google Drive API (files.list) for presentation discovery | Already installed in apps/agent; getSlidesClient() and getDriveClient() factories established in Phase 1 |
| @mastra/mcp | ^1.0.2 | MCPClient for connecting to AtlusAI SSE endpoint to discover and call ingestion tools | Official Mastra MCP client; auto-detects SSE transport; provides listTools() for tool discovery |
| @google/genai | ^1.43.0 | Gemini API for AI-powered metadata classification of slide content | Current official Google AI SDK; replaces deprecated @google/generative-ai; supports structured output with JSON Schema |
| zod | ^4.3.6 | Schema definition for metadata tags, manifest entries, and Gemini structured output | Already installed; Gemini structured output works with zod-to-json-schema |
| @prisma/client | ^6.19.2 | Image registry Prisma table for brand asset metadata | Already installed; dev.db database established in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod-to-json-schema | ^3.24+ | Convert Zod metadata schemas to JSON Schema for Gemini structured output mode | Required when calling Gemini with responseMimeType: "application/json" and responseJsonSchema |
| tsx | ^4.21.0 | Run TypeScript ingestion scripts directly without compile step | Already installed as devDependency; use for running ingestion scripts via `npx tsx` |
| crypto (Node.js built-in) | N/A | SHA-256 content hashing for idempotent ingestion deduplication | Use createHash('sha256') to generate deterministic document IDs from slide content |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @google/genai for classification | Mastra agent with Gemini provider | Mastra agent adds orchestration overhead for a batch classification task; direct SDK is simpler for a script |
| Prisma table for image registry | JSON file on disk | JSON file is simpler but lacks query capability; Prisma table enables structured queries by category/person and integrates with existing database pattern |
| Content hash for deduplication | Presentation ID + slide objectId composite key | Content hash catches content changes across re-uploads; composite key is simpler but misses content updates |

**Installation:**
```bash
cd apps/agent
pnpm add @mastra/mcp@^1.0.2 @google/genai zod-to-json-schema
```

Note: `@google/genai` is the current official Gemini SDK (replaces `@google/generative-ai` which is no longer receiving Gemini 2.0+ features). Verify the exact package name on npm before installing.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
  ingestion/                    # Phase 2 ingestion scripts (not runtime code)
    discover-content.ts           # Lists all presentations in Drive folder
    extract-slides.ts             # Extracts text + notes from each slide
    classify-metadata.ts          # Gemini assigns metadata tags
    ingest-to-atlusai.ts          # Uploads slide documents to AtlusAI
    build-image-registry.ts       # Populates image registry Prisma table
    run-ingestion.ts              # Orchestrates full pipeline end-to-end
    manifest/                     # Generated manifest files for human review
      content-manifest.json         # Full inventory of all extracted slides + tags
      coverage-report.json          # Industry coverage gap analysis
  lib/
    google-auth.ts                # [EXISTS] getSlidesClient(), getDriveClient()
    atlusai-client.ts             # [NEW] MCPClient wrapper for AtlusAI
    slide-extractor.ts            # [NEW] Reusable slide text/notes extraction
  prisma/
    schema.prisma                 # [MODIFY] Add ImageAsset model
```

### Pattern 1: Batch Extraction Pipeline (Not Runtime)
**What:** Content ingestion runs as a standalone script (`npx tsx apps/agent/src/ingestion/run-ingestion.ts`), not as part of the Mastra application runtime. It runs once to populate AtlusAI, can be re-run idempotently, and produces a human-reviewable manifest before bulk ingestion.
**When to use:** Always for content population. The architecture research explicitly warns against treating content ingestion as a runtime operation (Anti-Pattern 5 from ARCHITECTURE.md).
**Example:**
```typescript
// apps/agent/src/ingestion/run-ingestion.ts
import { discoverPresentations } from './discover-content'
import { extractAllSlides } from './extract-slides'
import { classifyAllSlides } from './classify-metadata'
import { writeManifest } from './manifest/writer'
import { ingestToAtlusAI } from './ingest-to-atlusai'

async function main() {
  // Step 1: Discover all presentations in Hack-a-thon Drive folder
  const presentations = await discoverPresentations()
  console.log(`Found ${presentations.length} presentations`)

  // Step 2: Extract slide-level content from each presentation
  const slides = await extractAllSlides(presentations)
  console.log(`Extracted ${slides.length} slides`)

  // Step 3: Classify metadata for each slide using Gemini
  const classifiedSlides = await classifyAllSlides(slides)

  // Step 4: Write manifest for human review
  await writeManifest(classifiedSlides)
  console.log('Manifest written -- review before proceeding')

  // Step 5: Ingest to AtlusAI (run separately after manifest approval)
  // await ingestToAtlusAI(classifiedSlides)
}
```

### Pattern 2: Deterministic Document IDs for Idempotency
**What:** Each slide document gets a deterministic ID derived from its source presentation ID + slide objectId. Re-running the ingestion script with the same content produces the same document IDs, enabling upsert-or-skip behavior.
**When to use:** Every ingestion run. This is a locked decision from CONTEXT.md.
**Example:**
```typescript
import { createHash } from 'node:crypto'

function generateDocumentId(presentationId: string, slideObjectId: string): string {
  return createHash('sha256')
    .update(`${presentationId}:${slideObjectId}`)
    .digest('hex')
    .substring(0, 32)
}

// Idempotency: same presentation + slide always produces same document ID
// If AtlusAI supports upsert-by-ID, this prevents duplicates
// If not, check existence before creating
```

### Pattern 3: Two-Phase Ingestion (Manifest Review Gate)
**What:** Extraction and classification run first and produce a manifest file. A human reviews the manifest (checking tag accuracy, coverage gaps, content_type assignments). Only after approval does the bulk AtlusAI ingestion run. This is a locked decision.
**When to use:** Every ingestion run. The manifest is the quality gate.
**Example manifest entry:**
```json
{
  "documentId": "a1b2c3d4e5f6...",
  "presentationId": "1ABC...",
  "presentationName": "Meet Lumenalta - 2026",
  "slideObjectId": "g35b593a0db0_0_5",
  "slideIndex": 2,
  "textContent": "Digital Solutions for Financial Services...",
  "speakerNotes": "Key talking point: 20% reduction in time-to-market...",
  "metadata": {
    "industries": ["Financial Services & Insurance"],
    "solutionPillars": ["Digital Transformation", "Data Engineering"],
    "funnelStage": "Intro Conversation",
    "contentType": "template",
    "touchType": "touch_2",
    "slideCategory": "industry_overview"
  },
  "contentHash": "sha256:abc123...",
  "status": "pending"
}
```

### Pattern 4: Google Slides Text Extraction
**What:** For each slide, extract all text from pageElements (concatenating TextRun content) and speaker notes (via notesPage.speakerNotesObjectId shape).
**When to use:** Every slide extraction.
**Example:**
```typescript
// Source: Google Slides API official docs
// https://developers.google.com/workspace/slides/api/concepts/text

interface ExtractedSlide {
  presentationId: string
  presentationName: string
  slideObjectId: string
  slideIndex: number
  textContent: string
  speakerNotes: string
}

function extractTextFromSlide(
  slide: slides_v1.Schema$Page,
  presentationId: string,
  presentationName: string,
  slideIndex: number
): ExtractedSlide {
  // Extract text from all pageElements
  const textParts: string[] = []
  for (const element of slide.pageElements ?? []) {
    if (element.shape?.text?.textElements) {
      for (const te of element.shape.text.textElements) {
        if (te.textRun?.content) {
          textParts.push(te.textRun.content)
        }
      }
    }
  }

  // Extract speaker notes from notesPage
  let speakerNotes = ''
  const notesPage = slide.slideProperties?.notesPage
  if (notesPage) {
    const speakerNotesId = notesPage.notesProperties?.speakerNotesObjectId
    if (speakerNotesId) {
      const notesShape = notesPage.pageElements?.find(
        (el) => el.objectId === speakerNotesId
      )
      if (notesShape?.shape?.text?.textElements) {
        speakerNotes = notesShape.shape.text.textElements
          .filter((te) => te.textRun?.content)
          .map((te) => te.textRun!.content!)
          .join('')
          .trim()
      }
    }
  }

  return {
    presentationId,
    presentationName,
    slideObjectId: slide.objectId ?? '',
    slideIndex,
    textContent: textParts.join('').trim(),
    speakerNotes,
  }
}
```

### Anti-Patterns to Avoid
- **Runtime ingestion on app startup:** Content ingestion is a batch administrative task. Never run it as part of the Mastra server boot sequence. Build separate scripts.
- **Ingesting without a manifest review gate:** Auto-classifying and bulk-ingesting without human review risks polluting AtlusAI with incorrectly tagged content. Always generate manifest first.
- **Hardcoding presentation IDs or slide counts:** The content set may grow during the hackathon. Discover presentations dynamically from the Drive folder.
- **Single-threaded sequential ingestion:** Processing 100+ presentations sequentially is slow. Process presentations in parallel (with rate limiting for API quotas).
- **Ingesting visual layout descriptions:** The decision is text + speaker notes only. Do not attempt to describe slide visual layout, images, or formatting in the ingested text.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Slides text extraction | Custom PDF parsing or screenshot OCR | Google Slides API presentations.get -- direct structured access to all text and notes | Slides API returns structured text elements with perfect fidelity; OCR would lose structure and introduce errors |
| Metadata classification | Regex-based keyword matching for industry/pillar tags | Gemini structured output with enum constraints | Keyword matching misses semantic context ("digital banking" -> Financial Services); Gemini understands domain meaning |
| Content deduplication | Custom diff tracking across ingestion runs | SHA-256 content hash as document ID + existence check before upsert | Content hash is deterministic and zero-state -- no need to track "what changed since last run" |
| JSON Schema from Zod | Manual JSON Schema writing for Gemini structured output | zod-to-json-schema library | Manual schemas drift from TypeScript types; library keeps them in sync |
| Drive folder traversal | Manual list of presentation IDs | Google Drive API files.list with recursive folder query | Manual lists break when content is added; API discovers everything dynamically |

**Key insight:** The Google Slides API provides direct structured access to every text element on every slide. There is no need for any document parsing, OCR, or file download step. The API response IS the structured data.

## Common Pitfalls

### Pitfall 1: AtlusAI Ingestion Mechanism Unknown
**What goes wrong:** The three visible MCP tools (`knowledge_base_search_semantic`, `knowledge_base_search_structured`, `discover_documents`) are all read-only. Without knowing how to CREATE documents in AtlusAI, the entire ingestion pipeline has no output target.
**Why it happens:** AtlusAI is an internal Lumenalta tool with no public documentation. The MCP server at `https://knowledge-base-api.lumenalta.com/sse` may expose additional tools beyond the three whitelisted in `.claude/settings.local.json`.
**How to avoid:** First task must be MCP tool discovery: connect to the AtlusAI SSE endpoint using MCPClient, call `listTools()` to enumerate ALL available tools (not just the three whitelisted ones), and document the complete tool inventory including any document creation tools. If no creation tools exist, investigate whether AtlusAI re-indexes content placed in the connected Google Drive folder (the ~9,642 existing documents were ingested from Drive). A fallback approach would be to create structured Google Docs in the connected Drive folder for AtlusAI to index.
**Warning signs:** The plan assumes a tool like `knowledge_base_create_document` exists but it does not; the ingestion script runs extraction and classification successfully but has nowhere to write.

### Pitfall 2: Google Slides API Rate Limits During Bulk Extraction
**What goes wrong:** The Google Slides API has per-user rate limits (typically 300 requests per minute for read operations). Processing 50+ presentations with presentations.get for each one, then potentially re-fetching for speaker notes, can hit rate limits and cause 429 errors that abort the ingestion.
**Why it happens:** Developers build sequential loops that fire requests as fast as possible without throttling.
**How to avoid:** Add a configurable delay between API calls (e.g., 200ms between presentations.get calls). Use a single presentations.get call per presentation (it returns ALL slides including notes pages in one response -- no need for per-slide API calls). Process in batches of 10 with a pause between batches.
**Warning signs:** HTTP 429 errors from the Slides API; ingestion script works for 5 presentations but fails at 15.

### Pitfall 3: Gemini Classification Inconsistency Across Slides
**What goes wrong:** Gemini assigns different industry tags to slides from the same deck, or assigns overly broad tags (every slide gets "Technology"), or fails to assign funnel stage correctly because the slide text alone lacks sufficient context.
**Why it happens:** Each slide is classified independently without deck-level context. A slide that says "20% cost reduction" could be any industry. Without knowing it comes from a Healthcare deck, Gemini guesses.
**How to avoid:** Pass deck-level context to the classification prompt: include the presentation name, the deck's folder path (which often contains industry names), and the first slide's content (usually a title slide with industry mention). Use enum constraints in the Zod schema so Gemini can only output from the defined taxonomy. Classify all slides from a single deck in one batch prompt (or sequential prompts with shared context) rather than individually.
**Warning signs:** The manifest shows Healthcare deck slides tagged as "Technology"; the coverage report shows 9 of 11 industries covered but Financial Services and Healthcare are missing despite having dedicated decks.

### Pitfall 4: Speaker Notes Shape Not Found on Some Slides
**What goes wrong:** Not all slides have speaker notes. The `notesPage.notesProperties.speakerNotesObjectId` may be undefined if no notes were ever added. Code that assumes every slide has notes will throw null reference errors.
**Why it happens:** The Google Slides API only creates the speaker notes shape when notes have been written. Blank-notes slides have a notesPage but no speakerNotesObjectId.
**How to avoid:** Always check for the existence of `speakerNotesObjectId` before attempting to read the notes shape. Default to empty string when notes are absent. This is already handled in the extraction pattern shown in Architecture Patterns above.
**Warning signs:** TypeError: Cannot read property 'text' of undefined during extraction; ingestion script works on first 5 presentations but crashes on the 6th.

### Pitfall 5: Title-Only and Divider Slides Produce Empty Documents
**What goes wrong:** Some slides are section dividers with only a single word ("Healthcare") or blank title slides. These produce AtlusAI documents with very little text, which score poorly in semantic search and pollute results with low-information entries.
**Why it happens:** The extraction pipeline treats every slide equally regardless of content density.
**How to avoid:** Add a minimum content threshold: slides with fewer than ~20 characters of combined text + notes should be flagged in the manifest as `slideCategory: "divider"` or `slideCategory: "title_only"` and optionally skipped during ingestion, or ingested with a `low_content: true` metadata flag so retrieval can deprioritize them. This is a Claude's Discretion area -- recommend ingesting with the flag rather than skipping, so the content library is complete.
**Warning signs:** Semantic search for "Healthcare solutions" returns a divider slide with just "Healthcare" as the top result instead of a substantive capability slide.

### Pitfall 6: Shared Drive Pagination Missed
**What goes wrong:** Google Drive API files.list returns paginated results with a default page size. If the Hack-a-thon folder has more files than one page (typically 100), the discovery step misses presentations beyond the first page.
**Why it happens:** Developers check that the first API call returns results and assume they have everything, ignoring the `nextPageToken` in the response.
**How to avoid:** Always implement pagination: continue calling files.list with the nextPageToken until it is undefined. This applies to both the top-level folder listing and any recursive subfolder traversal.
**Warning signs:** The manifest shows 20 presentations but the Drive folder visually shows 50+; some industries have zero content despite having dedicated folders.

## Code Examples

### Drive File Discovery with Pagination
```typescript
// Source: Google Drive API v3 official docs
// https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list

import { getDriveClient } from '../lib/google-auth'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  parents: string[]
}

async function listPresentationsInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const presentations: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.presentation' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, parents)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'drive',
      driveId: folderId, // Use actual Shared Drive ID if different from folder
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      presentations.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        parents: file.parents ?? [],
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return presentations
}

// Recursive discovery across subfolders
async function listSubfolders(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const folders: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, parents)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      folders.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        parents: file.parents ?? [],
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return folders
}
```

### Gemini Metadata Classification with Structured Output
```typescript
// Source: Gemini API structured output docs
// https://ai.google.dev/gemini-api/docs/structured-output

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// Metadata schema -- flat, no transforms, no unions (Gemini-safe)
const SlideMetadataSchema = z.object({
  industries: z.array(z.enum([
    'Consumer Products',
    'Education',
    'Financial Services & Insurance',
    'Health Care',
    'Industrial Goods',
    'Private Equity',
    'Public Sector',
    'Technology, Media & Telecommunications',
    'Transportation & Logistics',
    'Travel & Tourism',
    'Professional Services',
  ])).describe('Industries this slide content is relevant to. Select all that apply.'),

  solutionPillars: z.array(z.string())
    .describe('Lumenalta solution pillars this slide addresses. Use exact names from the provided pillar list.'),

  funnelStage: z.enum([
    'First Contact',
    'Intro Conversation',
    'Capability Alignment',
    'Solution Proposal',
  ]).describe('Which GTM touch point funnel stage this slide is designed for.'),

  contentType: z.enum([
    'template',
    'example',
    'case_study',
    'brand_guide',
    'resource',
  ]).describe('The type of content this slide represents.'),

  slideCategory: z.enum([
    'title',
    'divider',
    'industry_overview',
    'capability_description',
    'case_study_problem',
    'case_study_solution',
    'case_study_outcome',
    'team_intro',
    'methodology',
    'timeline',
    'pricing',
    'next_steps',
    'appendix',
    'other',
  ]).describe('The functional category of this slide within a deck.'),

  buyerPersonas: z.array(z.enum([
    'CIO',
    'CTO',
    'CFO',
    'VP Engineering',
    'VP Data',
    'VP Product',
    'VP Operations',
    'CEO',
    'General',
  ])).describe('Buyer personas this content is most relevant to.'),
})

type SlideMetadata = z.infer<typeof SlideMetadataSchema>

// Classification prompt -- includes deck context for accuracy
function buildClassificationPrompt(
  slideText: string,
  speakerNotes: string,
  deckName: string,
  deckFolderPath: string,
  titleSlideText: string,
  solutionPillarList: string[]
): string {
  return `You are classifying a single slide from a Lumenalta sales deck for a knowledge base.

DECK CONTEXT:
- Deck name: ${deckName}
- Folder path: ${deckFolderPath}
- Title slide content: ${titleSlideText}

AVAILABLE SOLUTION PILLARS:
${solutionPillarList.map(p => `- ${p}`).join('\n')}

SLIDE CONTENT:
${slideText}

SPEAKER NOTES:
${speakerNotes || '(none)'}

Classify this slide. For solutionPillars, only use names from the AVAILABLE SOLUTION PILLARS list above.
If the slide has minimal text (title-only or divider), set slideCategory accordingly.
Select ALL industries that apply -- a general capabilities slide may apply to multiple industries.`
}
```

### AtlusAI MCP Client Setup
```typescript
// Source: Mastra MCPClient docs
// https://mastra.ai/reference/tools/mcp-client

import { MCPClient } from '@mastra/mcp'

async function createAtlusAIClient() {
  const client = new MCPClient({
    id: 'atlusai-ingestion', // Prevents memory leaks on repeated instantiation
    servers: {
      'atlus-ai': {
        url: new URL('https://knowledge-base-api.lumenalta.com/sse'),
      },
    },
    timeout: 30000, // 30s timeout for ingestion operations
  })

  return client
}

// Step 1: Discover ALL available tools (not just the 3 whitelisted ones)
async function discoverAtlusAITools() {
  const client = await createAtlusAIClient()
  try {
    const tools = await client.listTools()
    console.log('Available AtlusAI MCP tools:')
    for (const [name, tool] of Object.entries(tools)) {
      console.log(`  ${name}: ${JSON.stringify(tool)}`)
    }
    return tools
  } finally {
    await client.disconnect()
  }
}
```

### Prisma Image Registry Model
```prisma
// Add to apps/agent/prisma/schema.prisma

model ImageAsset {
  id          String   @id @default(cuid())
  category    String   // "headshot" | "logo" | "icon" | "brand_element"
  name        String   // Person name or asset name (e.g., "John Smith", "Lumenalta Logo Primary")
  description String?  // Optional description for search
  driveFileId String   // Google Drive file ID
  driveUrl    String   // Direct Google Drive URL
  mimeType    String   // "image/png", "image/jpeg", etc.
  tags        String   // JSON array of tags: ["leadership", "executive"]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([driveFileId]) // Prevent duplicate entries for same Drive file
  @@index([category])
  @@index([name])
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @google/generative-ai SDK | @google/genai SDK | 2025 | Old SDK no longer receives Gemini 2.0+ features; new SDK is the official path forward |
| Gemini 2.5 Flash | Gemini 3 Flash Preview (gemini-3-flash-preview) | Early 2026 | Improved structured output, better classification accuracy; Gemini 2.5 Flash still stable and available |
| Manual metadata tagging | LLM-powered auto-classification with structured output | 2025-2026 | Gemini structured output with enum constraints makes auto-classification reliable enough for production use |
| Whole-document RAG chunking | Slide-level granular chunking | N/A (architecture decision) | Sub-document chunking is the established RAG best practice; the project correctly chose this from the start |

**Deprecated/outdated:**
- `@google/generative-ai` npm package: No longer receiving new features; use `@google/genai` instead
- Gemini 2.0 model IDs: Deprecated in favor of 2.5 and 3.x series
- Gemini 3 Pro Preview: Deprecated, shutting down March 9, 2026 -- use Gemini 3.1 Pro Preview if pro-tier needed

## Recommendations for Claude's Discretion Areas

### Brand Guidelines Ingestion
**Recommendation:** Ingest as a single whole-reference document in AtlusAI with `content_type: brand_guide`. Do NOT extract structured rules.
**Rationale:** Brand guidelines are a reference document that downstream agents will retrieve and follow as a whole. Extracting individual rules creates fragmentation and risks losing context between related rules. The whole-document approach matches how the ~9,642 existing documents are already structured.

### AI Classification Prompt Design
**Recommendation:** Use the deck-context-enriched prompt pattern shown in Code Examples above. Pass deck name, folder path, and title slide text alongside the individual slide content. Use a fixed solution pillar list (surfaced from Master Solutions and GTM Solutions decks, approved by user before ingestion runs).
**Rationale:** Individual slide text is often ambiguous without deck context. The deck name alone (e.g., "Healthcare Digital Transformation") resolves most industry classification ambiguity.

### Manifest Format
**Recommendation:** JSON files (content-manifest.json + coverage-report.json).
**Rationale:** JSON is machine-parseable for validation scripts, importable in code, and human-readable enough for review. CSV loses nested tag arrays. Markdown is not machine-parseable for automated gap analysis.

### Image Registry Storage
**Recommendation:** Prisma table (ImageAsset model) as primary store, with a JSON export capability for portability.
**Rationale:** Prisma table integrates with existing database pattern, supports structured queries (SELECT WHERE category = 'headshot'), and is available to the Mastra agent at runtime. JSON export serves as a backup and human review artifact.

### Minimal Text Slides (Title-Only, Dividers)
**Recommendation:** Ingest with `slideCategory: "title"` or `slideCategory: "divider"` metadata tag and a `low_content: true` flag. Do NOT skip them.
**Rationale:** Complete content library is better than a filtered one. Downstream retrieval can use metadata filters to deprioritize low-content slides. Skipping them creates gaps in the slide index that complicate deck reconstruction.

## Open Questions

1. **AtlusAI Document Creation Mechanism**
   - What we know: Three read-only MCP tools are visible (semantic search, structured search, discover documents). The ~9,642 existing documents were ingested from a connected Google Drive folder.
   - What's unclear: How to programmatically CREATE new documents in AtlusAI. Does the MCP server expose additional tools for document creation? Does AtlusAI have a REST API? Can we place structured documents in the Drive folder for automatic re-indexing?
   - Recommendation: First task of Plan 02-01 must be MCP tool discovery via `listTools()`. If no creation tools exist, investigate the Drive-folder-based ingestion path. This is a BLOCKING question.

2. **AtlusAI Metadata Field Support**
   - What we know: MCP tools accept structured search filters (assumed from tool name `knowledge_base_search_structured`). The metadata fields we plan to write (industry, solutionPillar, funnelStage, contentType) need to be accepted by AtlusAI.
   - What's unclear: What metadata fields AtlusAI supports on documents. Are they free-form key-value pairs? Do they need to be pre-configured? Are there field type constraints?
   - Recommendation: MCP tool discovery will reveal the schema for document creation. If metadata is limited, fall back to embedding metadata in the document text as structured headers.

3. **Solution Pillar Taxonomy**
   - What we know: Solution pillars should be derived from the Master Solutions deck and GTM Solutions deck. The user must approve the list before tags are applied.
   - What's unclear: The exact pillar names and how many there are.
   - Recommendation: The extraction step should process these two decks first and extract a candidate pillar list for user approval. This is a human checkpoint within Plan 02-01.

4. **Gemini Model ID for Classification**
   - What we know: Gemini 3 Flash Preview is `gemini-3-flash-preview`. Gemini 2.5 Flash is `gemini-2.5-flash` (stable).
   - What's unclear: Whether the Mastra agent project already specifies a Gemini model preference. The project says "Gemini 3 Flash" but the preview model ID may change.
   - Recommendation: Use `gemini-2.5-flash` (stable) for batch classification to avoid preview instability. Switch to `gemini-3-flash-preview` if 2.5 classification quality is insufficient.

5. **Drive Folder Structure and Presentation Count**
   - What we know: Content is in a "Hack-a-thon Google Drive folder." Core templates are identified by name in CONTEXT.md.
   - What's unclear: The exact folder hierarchy, total number of presentations, and whether presentations are in nested subfolders.
   - Recommendation: The discovery script must recursively traverse subfolders. The manifest will reveal the full inventory.

## Sources

### Primary (HIGH confidence)
- Google Slides API presentations.pages reference -- text extraction, speaker notes access, pageElements structure: https://developers.google.com/slides/reference/rest/v1/presentations.pages
- Google Slides API text structure and styling -- TextRun, textElements hierarchy: https://developers.google.com/workspace/slides/api/concepts/text
- Google Slides API speaker notes guide -- notesPage, speakerNotesObjectId: https://developers.google.com/workspace/slides/api/guides/notes
- Google Drive API v3 files.list reference -- shared drive query parameters, pagination: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- Gemini API structured output documentation -- JSON Schema, Zod integration, enum constraints: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini API models page -- model IDs, deprecation notices: https://ai.google.dev/gemini-api/docs/models
- Mastra MCPClient reference -- constructor, listTools(), SSE transport: https://mastra.ai/reference/tools/mcp-client

### Secondary (MEDIUM confidence)
- @mastra/mcp npm package v1.0.2 -- confirmed latest version via web search
- @google/genai npm package v1.43.0 -- confirmed as current Gemini SDK via web search
- MCP tool idempotency patterns -- deterministic document IDs, upsert semantics: https://modelcontextprotocol.io/legacy/concepts/tools

### Tertiary (LOW confidence)
- AtlusAI ingestion mechanism -- no public documentation found; inferred from project context (Drive folder connection, existing 9,642 documents, MCP tool names)
- AtlusAI metadata field schema -- not documented; must be discovered via MCP tool inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified on npm/official docs; googleapis and zod already installed
- Architecture: HIGH -- extraction pattern validated against Slides API official docs; Gemini classification pattern well-documented
- AtlusAI integration: LOW -- ingestion mechanism unknown; must be discovered in first task
- Pitfalls: MEDIUM-HIGH -- Google API pitfalls HIGH from official docs; AtlusAI pitfalls MEDIUM from inference

**Research date:** 2026-03-03
**Valid until:** 2026-03-17 (14 days -- AtlusAI tooling may be clarified quickly; Google APIs are stable)
