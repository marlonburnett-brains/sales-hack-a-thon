# Lumenalta Agentic Sales Orchestration

## What This Is

A deployed agentic AI platform for Lumenalta sellers covering all four touch points in the 2026 GTM sales strategy — from first-contact pagers through intro decks and capability alignment decks to fully custom solution proposals with human-in-the-loop review. The system now operates as a full deal-management platform: sellers manage deals through a pipeline view with status lifecycle, navigate deal details via breadcrumbs and sidebar sub-pages (Overview, Briefing, Touch 1-4), and generate artifacts through a 3-stage HITL workflow (Skeleton → Low-fi → High-fi) with AI chat refinement at each stage. A persistent AI chat bar across all deal pages enables context capture, transcript upload with binding, deal data queries, and knowledge base search. All LLM interactions route through named agents with DB-backed versioned system prompts, manageable via a Settings UI with draft/publish workflow and version history rollback. Generated artifacts save to user-selected Google Drive folders with org-wide sharing defaults. Templates can be registered from Google Slides, AI-ingested with vector embeddings, multi-axis classification, rich AI descriptions, and structured element maps, then previewed with human rating and tag correction, and searched by similarity. Content is classified as Template or Example with touch type binding, enabling AI-inferred deck structures per touch type with confidence scoring and conversational chat refinement. AtlusAI content is accessed via Mastra MCP client with pooled token auth, 3-tier access detection, and a discovery UI for browsing/searching/ingesting content via semantic search. The platform is deployed to Vercel (web) and Railway (agent) with CI/CD automation via CircleCI, Google OAuth authentication restricted to @lumenalta.com, and Supabase PostgreSQL with pgvector for durable and vector storage.

## Core Value

Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## Current State

Shipped `v1.7 Deals & HITL Pipeline` on 2026-03-09. The app is now a full deal-management platform with pipeline views (card/table toggle, status lifecycle, assignment filtering), deal detail navigation (breadcrumbs, sidebar, overview dashboard, briefing page), persistent AI chat across all deal pages, 3-stage HITL artifact generation for all 4 touches with stage revert, Google Drive integration with folder selection and org sharing, named agent architecture with 20+ DB-backed versioned agents, and agent management UI with draft/publish and version rollback.

## Current Milestone: v1.8 Structure-Driven Deck Generation

**Goal:** Close the 5 gaps between the intelligence layer (DeckStructure + element maps) and the generation layer so all touches (1-4) produce visually diverse, design-preserved decks assembled from multiple source presentations using DeckStructure blueprints, context-aware slide selection, and element-map-guided surgical modifications.

**Target features:**
- DeckStructure consumed as generation blueprint for all touches
- Multi-source slide assembly (cherry-pick slides from different source presentations)
- Design-preserved output (each slide retains its original layout)
- Per-slide modification planning using element maps
- Context-aware section-to-slide matching (industry, pillar, persona, funnel stage)
- 3-stage HITL integration (Skeleton=blueprint+selections, Low-fi=assembled deck, High-fi=surgical modifications)

## Requirements

### Validated

**Touch 1: First Contact (1-2 Pager)** — v1.0
- ✓ Seller selects first-contact flow, inputs company name, industry, and key context
- ✓ System suggests a branded 1-2 slide Google Slides pager; seller can approve or override with a custom version
- ✓ Approved pagers recorded as success; overrides recorded as learning signals and ingested into AtlusAI for future retrieval
- ✓ Generated or overridden pager is saved to per-deal folder in shared Lumenalta Drive

**Touch 2: Intro Conversation (Meet Lumenalta Deck)** — v1.0
- ✓ Seller selects intro deck flow, inputs company name, industry, salesperson name/photo, and optionally customer logo
- ✓ System AI-selects relevant "Meet Lumenalta" slides based on industry and client context
- ✓ System assembles selected slides into Google Slides deck with salesperson/customer customizations applied
- ✓ Generated intro deck is saved to shared Lumenalta Drive

**Touch 3: Capability & Use Case Alignment** — v1.0
- ✓ Seller selects capability alignment flow, inputs company name, industry, and 1-2 capability areas
- ✓ System AI-selects relevant slides from AtlusAI deck and L2 capability decks
- ✓ System assembles selected slides into Google Slides deck with customizations
- ✓ Generated capability deck is saved to shared Lumenalta Drive

**Touch 4+: Solution & Proposal Development** — v1.0
- ✓ Seller pastes raw transcript into web UI and selects industry + subsector (from 11 industries / 62 subsectors)
- ✓ AI extracts structured fields: Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget
- ✓ System flags missing critical inputs (e.g., budget not mentioned) and notifies seller before proceeding
- ✓ System generates Multi-Pillar Sales Brief (Primary + Secondary solution pillars identified)
- ✓ HITL Checkpoint 1: Seller and SME review/approve brief in web app before any slides are generated
- ✓ System queries AtlusAI content library for relevant slide blocks, case studies, and assets
- ✓ System assembles custom slide order as structured JSON and generates bespoke copy for each block
- ✓ System creates Google Slides deck in shared Lumenalta Drive via Google Slides API (service account)
- ✓ System generates talk track (Google Doc) and buyer FAQ with objection handling (Google Doc)
- ✓ HITL Checkpoint 2: Seller, SME, Marketing, Solutions review final assets in web app
- ✓ Human edits to output are tracked for system refinement

**Pre-Call Briefing Flow** — v1.0
- ✓ Seller inputs company name, buyer role, and meeting context into a web UI
- ✓ System queries AtlusAI and public sources to generate company snapshot (initiatives, news, financials)
- ✓ System generates role-specific hypotheses and 5-10 prioritized discovery questions mapped to Lumenalta solutions
- ✓ Briefing is delivered as a formatted one-pager in the web app and saved to Google Drive

**Data Capture & Knowledge Growth** — v1.0
- ✓ Every interaction across all touch points captures inputs, decisions (approve/override/edit), and output references
- ✓ All transcripts, notes, and conversation context are stored and indexed for future retrieval
- ✓ Approved outputs become positive examples; overrides become improvement signals ingested into AtlusAI
- ✓ Company interaction history carries forward across touch points
- ✓ The knowledge base grows with each use, making future outputs increasingly relevant

**Quality & Governance** — v1.0
- ✓ AI output restricted to assembling pre-approved building blocks — no hallucinated layouts or capabilities
- ✓ Zod v4 schema validation rejects incomplete transcript data and returns specific missing-field errors
- ✓ Generated output passes a quality checklist (client name present, problem restatement, 2-3 options, next steps)
- ✓ ROI framing module produces 2-3 business-outcome statements and 1 value hypothesis per use case

**Content Library (AtlusAI)** — v1.0 (partial)
- ✓ Content indexed by industry (all 11), subsector, solution pillar, persona, and funnel stage
- ✓ Slide chunks indexed as discrete retrievable units (deck ID + slide index + tags)
- ⚠ Deck templates partially loaded (38 slides from 5 accessible presentations; 12+ presentations pending Drive access)
- ⚠ Case studies not yet ingested (source presentations among inaccessible Drive shortcuts)
- ⚠ Building Block Library incomplete pending case study and full template access
- ✓ Brand guidelines ingested as whole-reference document

**Infrastructure & Access Control** — v1.1
- ✓ SQLite → Supabase PostgreSQL with dev and prod instances — v1.1
- ✓ Prisma provider switch with fresh baseline migration — v1.1
- ✓ Mastra durable PostgresStore with schema isolation — v1.1
- ✓ Service-to-service API key auth (SimpleAuth middleware) — v1.1
- ✓ Google OAuth login wall via Supabase Auth (@lumenalta.com only) — v1.1
- ✓ Web deployed to Vercel with prod/preview environments — v1.1
- ✓ Agent deployed to Railway with Docker and auto-restart — v1.1

**CI/CD & Vector Infrastructure** — v1.2
- ✓ CI/CD pipeline (CircleCI) automates lint, build, migrate, and deploy on push to main — v1.2
- ✓ pgvector enabled in Supabase with SlideEmbedding table and HNSW cosine index — v1.2

**Navigation & Template Management** — v1.2
- ✓ Collapsible sidebar navigation with Deals, Templates, and Slide Library sections — v1.2
- ✓ Template CRUD with Google Slides URL validation, Drive access awareness, and touch type assignment — v1.2
- ✓ Template staleness detection via Drive modifiedTime comparison — v1.2

**Slide Intelligence** — v1.2
- ✓ AI-powered slide ingestion: Google Slides extraction, Vertex AI embedding (768-dim), Gemini classification (8 axes + confidence) — v1.2
- ✓ Smart merge for idempotent re-ingestion (unchanged preserved, changed re-classified, removed archived) — v1.2
- ✓ Real-time ingestion progress (slide N of M) with auto-trigger on template add — v1.2
- ✓ Background staleness polling with auto-re-ingestion every 5 minutes — v1.2

**Preview & Review** — v1.2
- ✓ Per-template slide viewer with keyboard navigation and thumbnail strip — v1.2
- ✓ AI classification display (industry, pillar, persona, stage, content type, slide category) — v1.2
- ✓ Thumbs-up/down rating with inline tag correction via multi-select dropdowns — v1.2
- ✓ Corrections update pgvector metadata immediately — v1.2
- ✓ Cross-template vector similarity search with color-coded results — v1.2

**Google API Auth — User-Delegated Credentials** -- v1.3
- ✓ OAuth scope expansion with Drive, Slides, Docs read-only scopes and offline access -- v1.3
- ✓ AES-256-GCM encrypted refresh token storage per user (UserGoogleToken model) -- v1.3
- ✓ Dual-mode Google API client factories (user token or service account fallback) -- v1.3
- ✓ Web-to-agent token passthrough via X-Google-Access-Token header -- v1.3
- ✓ Background job token pool with ordered fallback and health alerting -- v1.3
- ✓ Middleware re-consent detection with cookie-cached token status -- v1.3
- ✓ 52-test regression suite for auth priority chain -- v1.3

**AtlusAI Authentication & Discovery** -- v1.4
- ✓ AtlusAI token storage with AES-256-GCM encryption, pool rotation, and env var fallback -- v1.4
- ✓ 3-tier access detection (account → project → full access) with ActionRequired integration -- v1.4
- ✓ Mastra MCP client singleton with lifecycle management, OAuth refresh, and graceful shutdown -- v1.4
- ✓ MCP semantic search replacing Drive API fallback with LLM extraction adapter -- v1.4
- ✓ Discovery UI with browse/search views, batch selective ingestion, and dedup markers -- v1.4
- ✓ Chunked LLM extraction for large MCP results (32K threshold) -- v1.4

**UX Polish** -- v1.5
- ✓ Gallery-style Discovery cards with GCS-cached thumbnails and file-type corner badges -- v1.5
- ✓ Unified ingestion status (IngestionStatusBadge + IngestionProgress) across Discovery and Templates -- v1.5
- ✓ Optimistic ingest UI with per-item toast lifecycle and client+server duplicate prevention -- v1.5

**Slide Intelligence v2** -- v1.5
- ✓ Rich AI-generated slide descriptions (purpose, visual composition, key content, use cases) via Gemini structured output -- v1.5
- ✓ Structured element map extraction from Google Slides pageElements with per-slide storage -- v1.5
- ✓ Backfill detection and automatic re-ingestion for slides missing descriptions or element maps -- v1.5

**Content Classification** -- v1.5
- ✓ Template/Example classification with touch type binding and Popover-based classify UI -- v1.5
- ✓ "Action Required" amber badge for ingested but unclassified presentations -- v1.5

**Deck Intelligence** -- v1.5
- ✓ Settings page with sidebar navigation and vertical tab sub-navigation -- v1.5
- ✓ AI-inferred deck structures per touch type with section flow, variations, and reference slides -- v1.5
- ✓ Confidence scoring based on classified example count (red/yellow/green tiers) -- v1.5
- ✓ Streaming chat refinement with LLM re-inference, diff highlights, and context summarization -- v1.5
- ✓ Cron-based auto-inference with SHA-256 change detection and active session protection -- v1.5

**Touch 4 Artifact Intelligence** -- v1.6
- ✓ Touch 4 Example classification includes artifact type (Proposal, Talk Track, FAQ) -- v1.6
- ✓ Touch 4 Settings shows separate Proposal, Talk Track, and FAQ deck structures with scoped confidence and chat refinement -- v1.6
- ✓ Production verification proves artifact-scoped settings chat behavior end to end -- v1.6
- ✓ Shared web and agent artifact contracts now use the canonical `ArtifactType` surface -- v1.6
- ✓ `pnpm --filter agent exec tsc --noEmit` passes at milestone closeout -- v1.6

**Deals & HITL Pipeline** -- v1.7
- ✓ Deal pipeline with status lifecycle, card/table view, assignment, and filtering -- v1.7
- ✓ Deal detail navigation with breadcrumbs, sidebar, overview dashboard, and briefing page -- v1.7
- ✓ Persistent AI chat bar with deal context, transcript upload, and knowledge base queries -- v1.7
- ✓ 3-stage HITL workflow (Skeleton → Low-fi → High-fi) for all 4 touches with stage revert -- v1.7
- ✓ Google Drive artifact integration with folder selection, org sharing, and archive-on-regen -- v1.7
- ✓ Named agent architecture with DB-backed versioned system prompts -- v1.7
- ✓ Agent management UI with draft/publish, version history, and rollback -- v1.7

### Active

- [ ] DeckStructure serves as generation blueprint for all touches
- [ ] Multi-source slide assembly from multiple source presentations
- [ ] Design-preserved slides (each retains original layout)
- [ ] Per-slide modification planning via element maps
- [ ] Context-aware section-to-slide matching
- [ ] 3-stage HITL: Skeleton (blueprint+selections), Low-fi (assembled deck), High-fi (surgical mods)

### Out of Scope

- Salesforce integration -- CRM integration is a v2 modular extension
- Real-time call feedback -- focus is pre-call and post-call; in-call AI coaching is future
- Mobile app -- web-first, browser-based interface only
- Video upload / Zoom integration -- sellers paste transcripts manually; direct API integration is v2
- Fine-tuning or custom model training -- all steering done via prompt engineering and few-shot examples
- Automated edit pattern analysis for prompt refinement -- deferred to v2
- Drag-and-drop slide reordering -- sellers reorder in Google Slides directly
- In-browser slide content editing -- link to Google Slides for editing
- Multi-tenant template libraries -- single-team tool for ~20 sellers
- Custom embedding model selection -- one model (text-embedding-005) for consistent vector spaces
- Token management admin UI -- health alerting via logs sufficient for ~20 users; UI deferred to v2
- Domain-wide delegation -- user-delegated approach avoids Google Workspace admin involvement
- Google service account removal -- service account remains as fallback for backward compatibility

## Context

**Current state:** v1.7 shipped. ~61,245 LOC TypeScript/TSX/Prisma. 49 phases, 123 plans across 8 milestones over 7 days (2026-03-03 -> 2026-03-09). Deployed to production (Vercel + Railway) with CI/CD automation (CircleCI).

**Tech stack (shipped):** pnpm/Turborepo monorepo, Next.js 15 (web on Vercel), Mastra AI 1.8 (agent on Railway), GPT-OSS 120b on Vertex AI (LLM), Gemini (slide classification fallback), Vertex AI text-embedding-005 (embeddings), Zod v4 (structured outputs), Prisma + Supabase PostgreSQL + pgvector (data + vectors), Mastra PostgresStore (workflow state), Google Workspace API (Slides + Docs + Drive), AtlusAI via Mastra MCP client (RAG + knowledge base + semantic search), Supabase Auth + Google OAuth (user auth), CircleCI (CI/CD), shadcn/ui (components), Sonner (toast notifications), @mastra/mcp (MCP SSE transport).

**Architecture:** Two-app monorepo — `apps/web` (Next.js 15 on Vercel with Server Actions) and `apps/agent` (Mastra Hono server on Railway). Shared `packages/schemas` for Zod types and constants. Mastra workflows use suspend/resume for HITL checkpoints. Google API access uses user-delegated OAuth credentials with service account fallback for background jobs. AtlusAI access via pooled token auth with 3-tier detection and MCP singleton client (agent-only, no MCP imports in web). Service-to-service auth via shared API key (Authorization: Bearer header). User auth via Supabase Google OAuth restricted to @lumenalta.com. pgvector HNSW index for cosine similarity search across slide embeddings.

**Content library status:** 38 slides ingested from 5 accessible presentations in AtlusAI. Brand guidelines ingested. Template management system enables registering additional Google Slides sources with AI classification. AtlusAI content now discoverable and ingestible via Discovery UI (MCP semantic search). 14/17 known Drive sources need Viewer access on target Shared Drives (shortcut container access is insufficient).

**Demo scenario:** Meridian Capital Group (Financial Services) — seeded company, deal, and Touch 1 interaction. 167-line transcript fixture covering all 6 extraction fields.

**Knowledge growth model:** Every interaction captures inputs, decisions, and outputs. Approved assets become positive examples in AtlusAI; overrides and edits become improvement signals that are re-ingested. Company history accumulates across touch points. Slide classification improves via human rating and tag correction.

## Constraints

- **Tech stack**: Mastra AI + GPT-OSS 120b (Vertex AI) + Zod v4 — architecture built around these
- **Output format**: Google Slides via API only — no static images, no export-only artifacts
- **Brand compliance**: AI may only assemble pre-approved Lumenalta building blocks — no generated layouts
- **HITL hard stop**: Zero slides generated until SME explicitly approves the structured brief
- **Content library dependency**: RAG quality depends on AtlusAI content coverage (currently partial)
- **Google Drive access**: 14/17 content sources need Viewer access granted on target Shared Drives
- **Embedding model**: text-embedding-005 at 768 dimensions — changing models requires re-embedding all slides
- **Prisma version**: Stay on 6.19.x — Prisma 7.x has vector migration regression (#28867)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| General LLM via API over fine-tuning | Large context window for noisy transcripts; prompt engineering steers behavior faster | ✓ Good — switched from Gemini to GPT-OSS 120b on Vertex AI for cost/performance |
| Mastra AI as agent orchestration | Structured output enforcement, native Zod v4 integration, suspend/resume for HITL | ✓ Good — suspend/resume pattern works well for both HITL checkpoints |
| AtlusAI as RAG + knowledge base | Already available as MCP-connected service; avoids building retrieval infra | ⚠️ Revisit — v1.4 replacing Drive fallback with direct Mastra MCP client |
| Service account for Google Drive | Shared Lumenalta Drive vs. per-seller OAuth; simpler for hackathon | ✓ Good — works for all output types (Slides, Docs, Drive folders) |
| Salesforce out of scope for v1 | Data hygiene requirements not met | ✓ Good — kept scope manageable |
| Transcript input by paste | Reduces integration surface; works with any meeting tool | ✓ Good — simple and universal |
| All 11 industries in scope | Hackathon requires full taxonomy demonstration | ✓ Good — all 11 covered via cross-industry classification |
| Touch 1 approve/override feedback loop | Enables continuous improvement without manual curation | ✓ Good — FeedbackSignal model captures decision signals |
| Interaction tracking across all touches | Every input/decision/output captured; company history across touches | ✓ Good — InteractionRecord model with full audit trail |
| Copy-and-prune for deck assembly | Copy entire source, delete unwanted slides, reorder remaining | ✓ Good — preserves original formatting perfectly |
| Separate Prisma models for Transcript/Brief | Self-contained querying without JSON blob parsing | ✓ Good — clean separation, enables structured queries |
| Mastra suspend/resume for HITL | Durable workflow state survives server restarts | ✓ Good — both HITL-1 (brief) and HITL-2 (assets) work correctly |
| Monotonic Set pattern for stepper progress | Prevents UI flicker during polling by only adding to completed set | ✓ Good — smooth progress display across all forms |
| Supabase PostgreSQL over SQLite | Durable cloud storage for team use; dev + prod instances | ✓ Good — schema isolation (public + mastra), seamless Prisma migration |
| Direct DB host over Supabase pooler | Pooler not ready for newly created projects (propagation delay) | ⚠️ Revisit — pooler should work now; test before scaling |
| SimpleAuth with API key | Service-to-service auth between web and agent | ✓ Good — simple, effective for single-tenant |
| Supabase Auth + Google OAuth | @lumenalta.com domain restriction, SSR cookie sessions | ✓ Good — server-side domain enforcement, middleware route protection |
| Route group (authenticated) layout | Nav bar only on authenticated pages, login page is standalone | ✓ Good — clean separation of auth vs public routes |
| Railway over Oracle Cloud VM | Platform-managed Docker deploys vs manual VM provisioning | ✓ Good — auto-deploy on push, auto-restart, managed HTTPS |
| Entrypoint credential injection | Writes inline JSON to temp file for GOOGLE_APPLICATION_CREDENTIALS | ✓ Good — zero code changes to application, works in any container runtime |
| CircleCI over GitHub Actions | CircleCI available for project; GHA initially built then migrated | ✓ Good — same pipeline (lint→migrate→deploy-agent→deploy-web) |
| pgvector with HNSW index | Cosine similarity for slide embeddings; HNSW for fast approximate search | ✓ Good — sub-millisecond similarity queries at current scale |
| Raw SQL for vector operations | Prisma doesn't natively support vector types; raw SQL for INSERT/SELECT | ✓ Good — full control over vector casts and distance operators |
| Gemini structured output for classification | 8-axis classification with confidence score via JSON schema enforcement | ✓ Good — consistent multi-value arrays across all slides |
| Content hash for idempotent re-ingestion | SHA-256 of slide text determines identity; smart merge handles add/change/archive | ✓ Good — re-ingestion preserves unchanged slides, re-classifies changed ones |
| Chip+dropdown hybrid for tag editing | shadcn Select only supports single-value; custom MultiTagField for multi-value categories | ✓ Good — intuitive UX for multi-value classification correction |
| User-delegated Google credentials | Service account can't access all org files; user OAuth tokens inherit org permissions | ✓ Good — transparent fallback chain (user token -> pool -> service account) |
| Vitest smoke tests for v1.3 verification | Mocked Google APIs verify auth path selection without real API calls | ✓ Good — permanent regression suite for auth priority chain |
| DEPLOY.md as environment setup reference | Practical new-environment guide vs. scattered env var notes | ✓ Good — single source of truth for all deployment config |
| Generic `encryptedToken` field for AtlusAI | Auth mechanism TBD at design time; flexible field name | ✓ Good — worked for OAuth tokens |
| Clone getPooledGoogleAuth for AtlusAI pool | Same ordering, fire-and-forget, health check pattern | ✓ Good — consistent pool behavior |
| Network errors treated as auth failure in AtlusAI probes | Safe default prevents false positives | ✓ Good — conservative approach |
| MCPClient singleton with lifecycle management | Health check, max lifetime, graceful shutdown | ✓ Good — handles SSE connection instability |
| Thin fetch callback for MCP auth injection | Fresh token per request without breaking connections | ✓ Good — token rotation transparent to MCP |
| LLM extraction always for MCP results | Consistency over cost savings (user decision) | ✓ Good — reliable structured output |
| Adaptive LLM prompt for MCP result shape | First call discovers shape, caches template for subsequent | ✓ Good — handles unknown MCP response formats |
| Module-level Map for batch ingestion state | Simple in-memory state sufficient for single-instance agent | ✓ Good — avoids DB complexity |
| slideId-based ingestion check over SHA-256 | Simpler dedup, avoids client-side hashing | ✓ Good — effective dedup |
| Chunked LLM extraction at 32K threshold | Array-level chunking with parallel Promise.all | ✓ Good — handles large MCP results without data loss |
| Fire-and-forget persistAtlusClientId | Avoids blocking MCP init for non-critical persistence | ✓ Good — fast startup |
| Fire-and-forget GCS cover thumbnail caching | First browse triggers cache, second browse serves; no blocking | ✓ Good — progressive loading UX |
| useRef<Set> for client-side duplicate prevention | Synchronous guard avoids React state delay on rapid clicks | ✓ Good — complements server-side guard |
| Gemini structured output for slide descriptions | 4-field JSON (purpose, visualComposition, keyContent, useCases) | ✓ Good — consistent narrative output |
| Non-fatal description generation | Failed LLM calls log warning, don't block ingestion pipeline | ✓ Good — resilient pipeline |
| Prisma CRUD for SlideElement (not raw SQL) | No vector column, standard Prisma operations sufficient | ✓ Good — simpler than raw SQL path |
| Popover for classify UI in template cards | Lightweight inline interaction, not full Dialog/Modal | ✓ Good — fast classification workflow |
| Forward-only migrations with manual SQL | Prisma migrate dev broken by 0_init drift; manual + resolve --applied | ✓ Good — per CLAUDE.md discipline |
| Dedicated pages per touch type | User feedback: accordion too dense; individual pages with nested sub-nav | ✓ Good — cleaner information architecture |
| Streaming chat with delimiter protocol | Text chunks then ---STRUCTURE_UPDATE--- then JSON payload | ✓ Good — simple parsing, no SSE complexity |
| SHA-256 data hash for cron change detection | Cron skips re-inference if examples haven't changed | ✓ Good — avoids redundant LLM calls |
| Active session protection (30-min window) | Cron skips re-inference during active chat sessions | ✓ Good — prevents overwriting user refinements |
| Shared `ArtifactType` contract across schema, web, and agent | Prevent Touch 4 artifact behavior from drifting between data, API, and UI layers | ✓ Good — kept Proposal / Talk Track / FAQ flows aligned end to end |
| Existing route family plus validated `artifactType` | Avoid endpoint sprawl while adding artifact-qualified deck structure operations | ✓ Good — fixed deployed route parity without creating a second API family |
| Production-locked live verification for Touch 4 settings chat | Milestone DoD required browser and backend proof on the same artifact-qualified flow | ✓ Good — closed `DECK-05` with durable post-fix evidence |
| Finish v1.6 on a green agent typecheck baseline | Artifact work should land on a clean compile target, not a broken repo baseline | ✓ Good — `pnpm --filter agent exec tsc --noEmit` passes at closeout |
| Maximum parallelization with 4-tier dependency map | v1.7 phases 41+43 concurrent, 42+44 concurrent, 45+46 concurrent, then 47 | ✓ Good — 9 phases completed in 2 days |
| Named agent architecture with DB-backed versioned prompts | All LLM calls route through governed agents with immutable version pinning | ✓ Good — 20+ agents migrated, execution seam + cache working |
| Forward-only SQL migrations for new models | Prisma migrate dev blocked by shared-db drift; manual SQL + resolve --applied | ✓ Good — consistent with CLAUDE.md discipline |
| Persistent deal chat with dock-first layout | Chat survives navigation; optional side-panel mode | ✓ Good — compact UX across all deal pages |
| Authorization: Bearer workaround for Mastra auth | Mastra framework doesn't support X-API-Key header correctly | ⚠️ Revisit — temporary workaround documented in AUTH-CONTRACT.md |
| 3-stage HITL workflow with stage revert | Skeleton → Low-fi → High-fi with ability to go back and regenerate | ✓ Good — revert route registered and wired E2E |
| Google Picker for Drive folder selection | Native Google UI for folder browsing vs custom file tree | ✓ Good — familiar UX, handles permissions natively |
| Archive-on-regeneration as non-blocking | try/catch around archive to avoid failing workflows on archive errors | ✓ Good — resilient workflow execution |

---
*Last updated: 2026-03-09 after v1.8 milestone start*
