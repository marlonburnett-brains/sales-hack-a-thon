# Phase 2: Content Library Ingestion - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate AtlusAI with all Lumenalta content at slide-block granularity across all 11 industries — including Meet Lumenalta intro deck slides, L2 capability deck slides, and 1-2 pager templates — so that RAG retrieval is functional for every downstream pipeline and touch point. Build a separate image registry for brand assets. Content is sourced from the Hack-a-thon Google Drive folder already connected to AtlusAI.

Building the RAG retrieval queries, the slide assembly pipeline, or any UI forms are out of scope — this phase delivers indexed, tagged content only.

</domain>

<decisions>
## Implementation Decisions

### Chunking strategy
- One AtlusAI document per slide — each slide extracted independently via Google Slides API
- Extract text content + speaker notes only (no visual layout descriptions)
- Store source presentation ID + slide objectId as metadata on each document (objectIds survive slide reordering — validated in Phase 1 spike)
- Keep both whole-deck documents (already in AtlusAI) and new slide-level documents — deck-level useful for broad semantic search, slide-level for precise retrieval

### Metadata tagging schema
- AI-assigned tags using Gemini to auto-classify each slide's metadata, with a human-reviewable manifest generated before bulk ingestion runs
- Solution pillars derived from existing deck content (Master Solutions deck, GTM Solutions deck) — researcher surfaces the list, user approves before tags are applied
- Funnel stages aligned to GTM touch points: First Contact (Touch 1), Intro Conversation (Touch 2), Capability Alignment (Touch 3), Solution Proposal (Touch 4+)
- Multi-value tags per dimension — a slide can belong to multiple industries, multiple pillars, multiple funnel stages
- `content_type` tag distinguishes: template, example, case_study, brand_guide, resource

### Content inventory & classification
- Content set may grow during hackathon — ingestion script must be idempotent and re-runnable without creating duplicates
- Example proposals (Alaska Airlines, MasterControl, Encompass, WSA, Satellite Industries, Gravie) serve dual purpose: reference context for AI tone/style AND retrievable slide blocks for assembly — distinguished by `content_type: example` tag
- Case studies chunked at slide level with same metadata schema as templates
- Industry coverage gaps flagged in the manifest report — no synthetic content created to fill gaps
- Core templates identified:
  - Touch 1: Two Pager Template
  - Touch 2: Meet Lumenalta - 2026 (+ NBCUniversal, Bleecker Street Group as examples)
  - Touch 3: 20251021 Master Solutions deck, 2026 GTM Solutions, 200A Master Deck
  - Touch 4: Example proposals as reference

### Image & brand asset handling
- Separate image registry (NOT AtlusAI) — JSON manifest or DB table mapping person names/categories to Google Drive file URLs
- Images served from Google Drive URLs (no GCS/public URL setup needed)
- Curated subset only: leadership headshots, company logos, key brand icons — skip stock photo variants and duplicates
- ~9,000 image files in `01 Resources/` are NOT ingested into AtlusAI

### Claude's Discretion
- Brand guidelines (Branded Basics) ingestion approach — whether to keep as whole reference document or extract structured rules
- Exact AI classification prompt design for metadata tagging
- Manifest format (JSON vs CSV vs markdown table)
- Image registry storage mechanism (JSON file, Prisma table, or both)
- How to handle slides with minimal text content (title-only slides, divider slides)

</decisions>

<specifics>
## Specific Ideas

- AtlusAI already has ~9,642 documents ingested at whole-document level from the Hack-a-thon Drive folder — the slide-level ingestion adds granularity on top of existing content
- The `hack-a-thon` AtlusAI project ID is `b455bbd9-18c7-409d-8454-24e79591ee97`
- AtlusAI supports semantic search, structured metadata filtering, and document discovery via MCP tools
- Phase 1 validated that Google Slides API objectIds are Google-generated (format: `g35b593a0db0_0_XXXX`) and must be read from the API response, never hardcoded

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/google-auth.ts`: `getSlidesClient()` and `getDriveClient()` factories — reuse for reading slide content
- `apps/agent/src/spike/slides-spike.ts`: Reference for how to call presentations.get and read slide objectIds
- `apps/agent/src/env.ts`: T3 Env validation — will need new env vars if ingestion script needs AtlusAI API credentials
- `apps/agent/src/mastra/index.ts`: Mastra instance with LibSQLStore — available if ingestion needs workflow orchestration

### Established Patterns
- T3 Env (`@t3-oss/env-core`) for env var validation with Zod schemas
- Google API client factories in `apps/agent/src/lib/`
- pnpm workspace with Turborepo task orchestration
- Two-database pattern: mastra.db (Mastra internal) + dev.db (Prisma app records)

### Integration Points
- AtlusAI MCP tools: `knowledge_base_search_semantic`, `knowledge_base_search_structured`, `discover_documents` — available for verification after ingestion
- Google Slides API (presentations.get) for reading slide content and objectIds
- Google Drive API v3 for listing files in the Hack-a-thon folder
- `packages/schemas` — currently empty, Phase 3 will populate with Zod schemas

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-content-library-ingestion*
*Context gathered: 2026-03-03*
