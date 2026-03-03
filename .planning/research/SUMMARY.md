# Project Research Summary

**Project:** Lumenalta Agentic Sales Orchestration Platform
**Domain:** Agentic AI — LLM orchestration with RAG, HITL approval flows, Google Workspace output
**Researched:** 2026-03-03
**Confidence:** MEDIUM (training data cutoff August 2025; web search unavailable during research; specific Mastra API details require verification)

## Executive Summary

This is a purpose-built agentic workflow platform for consultancy sales enablement, occupying a gap in the market that no existing tool covers end-to-end: pre-call briefing + post-call transcript processing, gated by human-in-the-loop approval, producing brand-compliant Google Slides decks, talk tracks, and buyer FAQs. The recommended approach is a workflow-first architecture using Mastra AI as the orchestration layer, Google Gemini Flash as the LLM (1M token context window handles noisy transcripts), Zod v4 for schema-enforced structured outputs, and the Google Workspace API for output artifacts — all within a Next.js monorepo. The pre-decided stack is well-suited to the problem. The primary engineering risk is not the AI layer but the Google Slides API integration complexity, specifically around placeholder ID management and batchUpdate ordering.

The most important architectural decision is also the most differentiating product decision: HITL approval is a hard stop, not optional scaffolding. No slides are generated until the structured brief is explicitly approved by a human. This design eliminates a category of errors (bad brief propagated into every slide) and makes the platform trustworthy for a consultancy where AI-generated client-facing output has real reputational stakes. The second most important decision is treating AtlusAI content library population as an engineering deliverable, not a data-entry task — retrieval quality at the slide-block level is the foundation all downstream generation depends on, and it must be operational before any integration testing begins.

The top risks in priority order: (1) Google Slides API pitfalls around placeholder IDs, batchUpdate ordering, image insertion via public URLs, and layout ID mismatches — all require validated integration spikes before building any abstraction on top; (2) Gemini structured output schema rejections for complex Zod v4 schemas — every schema must be validated against the live API in isolation; (3) Mastra HITL state loss if durable storage is not configured from day one; (4) AtlusAI content library bottleneck blocking all RAG-dependent testing if ingestion is deprioritized.

## Key Findings

### Recommended Stack

The core stack is pre-decided in PROJECT.md and well-supported by research: Mastra AI for workflow orchestration, Google Gemini Flash as the LLM, Zod v4 for schema validation, Next.js 15 (App Router) for the UI, and the `googleapis` Node.js client with service account auth for Google Workspace output. The recommended structure is a monorepo with two apps (`/apps/web` for Next.js, `/apps/agent` for Mastra) and a shared `/packages/schemas` package for Zod v4 schema definitions — this shared schema pattern eliminates the primary source of runtime type drift between frontend and backend.

Supporting libraries are well-established: `react-hook-form` + `@hookform/resolvers` for multi-step forms, `shadcn/ui` for the HITL approval UI, Prisma + SQLite for local state persistence (swap to PostgreSQL for production), and `@t3-oss/env-nextjs` for startup-time environment variable validation.

**Core technologies:**
- **Mastra AI (`@mastra/core`):** Workflow orchestration with suspend/resume at HITL checkpoints — purpose-built for this pipeline model
- **Google Gemini Flash:** LLM for all extraction and generation — 1M+ token context window handles long transcripts; structured output mode pairs with Zod schemas
- **Zod v4:** Runtime validation for all structured data contracts between LLM output and application logic — v4's ~14x faster parse speed and improved error messages are production-ready
- **Next.js 15 (App Router):** Full-stack framework for seller UI and API routes as BFF to Mastra — Server Components reduce boilerplate for HITL review pages
- **`googleapis` + `google-auth-library`:** Official Google Node.js clients for Slides, Docs, and Drive APIs via service account
- **Prisma + SQLite:** Durable workflow state persistence — zero infrastructure for hackathon, trivially upgradeable to PostgreSQL

**Version flags requiring verification before implementation:** Mastra current semver, Gemini provider package name for Mastra, `zod-to-json-schema` v4 compatibility, Tailwind v4 stability, `@hookform/resolvers` v3.9+ for Zod v4 support.

### Expected Features

Research confirms this platform occupies a genuine gap between revenue intelligence tools (Gong), content management platforms (Highspot/Seismic), and AI deck generators (Tome/Pitch). No existing tool delivers the full pipeline with HITL gating and brand-compliant output. The feature set in PROJECT.md is well-scoped for v1.

**Must have (table stakes — required for any sales enablement tool):**
- Transcript ingestion with paste input — users expect any post-call tool to accept transcripts
- Structured brief extraction with Zod validation — justifies the HITL checkpoint; without structured output, there is nothing meaningful to review
- Missing-field notification before proceeding — silently generating on incomplete data destroys seller trust
- Brand-compliant output via pre-approved building blocks — non-negotiable for a consultancy
- HITL approval checkpoint (brief + final assets) — the core design constraint; makes the platform trustworthy
- Output to Google Slides + Docs — sellers work in Google Workspace; other formats are unacceptable
- Industry / vertical selection (11 industries, 62 subsectors) — enterprise sales are vertical-specific
- Talk track alongside the deck — sellers expect both; a deck without a talk track forces improvisation
- Content library with RAG retrieval — "find the relevant case study" is a basic expectation

**Should have (differentiators — make this platform genuinely better than alternatives):**
- Multi-pillar solution mapping (primary + secondary) — consultancies sell across multiple capability areas per deal
- Buyer FAQ + objection handling doc — third artifact in the output package; rare at this fidelity
- Slide block assembly as structured JSON before rendering — transparent, reviewable intermediate step; no other tool works this way
- Role-specific hypotheses by buyer persona — CTO and CFO need different problem framings
- Discovery question generation mapped to Lumenalta solutions (pre-call flow)
- ROI framing module (2-3 quantified business outcome statements per use case)
- Feedback loop — edit capture for prompt and RAG refinement (v1.x, after initial adoption)

**Defer (v2+):**
- In-call coaching — fundamentally different architecture; pre-call briefing provides the same preparation value
- Usage analytics dashboard — Google Drive telemetry sufficient for early stage
- Competitive intelligence module — high hallucination risk; requires curated, maintained content
- CRM (Salesforce) integration — data hygiene prerequisites not met; adds significant integration surface
- Video/transcript API integration (Granola, Zoom, Firefly) — manual paste works with any tool; revisit when paste friction causes adoption drop-off
- Multi-user collaborative brief editing — async HITL is adequate; real-time editing complexity not justified

**Critical dependency:** The AtlusAI content library gates everything downstream. No RAG retrieval, no slide assembly, no deck generation until the library is loaded and indexed at the slide-block level. This is the single highest-risk dependency for a hackathon timeline.

### Architecture Approach

The recommended architecture is a five-layer system: Presentation Layer (Next.js seller UI + HITL review panels) → API Gateway Layer (Next.js API routes as BFF) → Mastra AI Orchestration Layer (stateful workflows with suspend/resume, agent definitions) → Knowledge Layer (AtlusAI MCP for RAG) + LLM Layer (Gemini Flash) → Output Layer (Google Slides/Docs/Drive). The two workflows (pre-call briefing and post-call transcript-to-deck) are independent flows that share AtlusAI and the industry taxonomy but do not depend on each other — they can be built in parallel.

The four key patterns the architecture must follow: (1) Workflow-as-State-Machine with durable suspend/resume at HITL checkpoints; (2) Agent-per-Concern — one scoped agent per role (research, transcript parsing, content retrieval, copywriting) with no cross-contamination of concerns; (3) RAG as an explicit workflow step, not implicit agent intelligence — retrieval is deterministic and auditable; (4) Schema-First Output Contract — every LLM call is constrained by a Zod v4 schema passed to Gemini's structured output mode.

**Major components:**
1. **Mastra Workflows** — stateful step-by-step orchestration with suspend/resume at HITL-1 (brief approval) and HITL-2 (final asset review)
2. **Mastra Agents (4)** — ResearchAgent, TranscriptAgent, ContentAgent, CopywritingAgent — each scoped to one concern with its own system prompt and tools
3. **Zod v4 Schema Layer** — centralized in `/schemas`; single source of truth for data contracts between LLM output and application logic
4. **AtlusAI MCP Integration** — RAG retrieval via structured filter search (industry + solution pillar + funnel stage) + semantic search; called as an explicit workflow step
5. **Google API Integration Layer** — `googleapis` client for Slides, Docs, Drive; called only from explicit workflow steps, never from agent tools
6. **Next.js UI + API Routes** — seller input forms, workflow status polling (3s interval), HITL review panels
7. **Workflow State Store (Prisma + SQLite/PostgreSQL)** — durable persistence of workflow state across suspend/resume cycles

### Critical Pitfalls

1. **Google Slides placeholder ID blindness** — Placeholder `objectId` values are reassigned on every slide duplication; never hardcode them. Build `getPlaceholderIdByType(slide, 'TITLE')` utility that reads live presentation state after every `duplicateObject` call. Address this in the first Slides API integration spike before any abstraction is built.

2. **Gemini structured output schema rejections** — Gemini supports a constrained subset of JSON Schema; `anyOf`/`oneOf` unions, recursive schemas, `z.default()`, and `z.transform()` on fields sent to the API all cause runtime rejections. Validate every Zod v4 schema against the live Gemini API in isolation before integrating into agent logic. Keep "LLM schemas" (raw, flat, no transforms) separate from "application schemas" (post-processing transforms).

3. **Mastra HITL state not persisted by default** — Workflow suspension state is in-memory unless a durable storage backend is explicitly configured. A server restart between HITL approval and deck generation silently orphans the workflow. Configure Prisma + SQLite as Mastra's storage adapter from the project start, and test suspend/resume across a server restart before demo day.

4. **RAG chunking at deck level instead of slide block level** — Indexing whole decks into AtlusAI produces unusable retrieval results. The correct granularity is one retrievable unit per slide, tagged with `{ industry, subsector, solutionPillar, funnelStage, slideCategory }`. Wrong chunking strategy requires full re-indexing to fix — define and validate the chunk schema with 2-3 sample decks before any bulk ingestion.

5. **AtlusAI content library bottleneck** — All RAG-dependent pipeline testing is blocked until AtlusAI is populated. If content ingestion is treated as a prerequisite to be done before the demo, the team has no ability to test the full pipeline until the last hours. Treat content ingestion as a day-one engineering deliverable with its own idempotent ingestion script and content inventory manifest.

6. **Google Slides image insertion requires public URLs** — `createImage` requests use URLs that Google's servers must be able to fetch publicly; Drive file URLs do not work here even with a service account. Host brand image assets in a public GCS bucket during content library setup and store those URLs in AtlusAI.

7. **batchUpdate request ordering** — Operations that depend on each other (duplicate a slide, then insert text into the new slide's placeholder) cannot be batched into a single `batchUpdate` call. Separate dependent operations into sequential API calls; batch only truly independent operations.

## Implications for Roadmap

The architecture's dependency chain in ARCHITECTURE.md, cross-referenced with the FEATURES.md feature dependency graph, produces a clear phase structure. The key forcing constraints are: (1) AtlusAI must be populated before any RAG-dependent step can be tested; (2) Zod schemas and Google API auth must be validated before any workflow step can be built on top of them; (3) HITL workflow wiring must be complete before the UI can be tested end-to-end; (4) pre-call and post-call flows are independent and can proceed in parallel after foundations are laid.

### Phase 1: Foundations and Content Infrastructure

**Rationale:** Nothing else can be built or tested without validated foundations. Google service account auth, Zod schema definitions, and AtlusAI content ingestion are all blocking dependencies for every downstream phase. This phase has the longest lead time (content ingestion) and the highest risk (Google Slides API integration quirks). It must start on day one.

**Delivers:** Working Google Workspace credentials, validated Zod schemas for all data contracts, AtlusAI populated with slide-block-level content for all 11 industries, Mastra framework configured with durable SQLite state storage, monorepo scaffold with shared schema package.

**Addresses:** AtlusAI content library (table stakes), industry/subsector taxonomy (62 subsectors), service account authentication for Google Drive output.

**Avoids:** AtlusAI content library bottleneck (Pitfall 9), wrong RAG chunking strategy (Pitfall 5), Gemini schema rejection (Pitfall 3 — validate all schemas here), hardcoded placeholder IDs (Pitfall 1 — build the utility function here), image URL public access requirement (Pitfall 6 — configure GCS here), service account scope too broad (security mistake — scope to AI-Generated folder only).

### Phase 2: Core Pipeline — Transcript Extraction and Brief Generation

**Rationale:** The post-call flow is the primary value delivery mechanism and the demo centerpiece. Transcript parsing and brief generation are the intelligence layer that makes the HITL checkpoint meaningful — without them, the approval checkpoint has nothing to show. These steps are also the most LLM-intensive and require careful schema engineering.

**Delivers:** Working ParseTranscript step (Gemini Flash + Zod schema), ValidateTranscript step with missing-field notification surfaced to the UI, GenerateBrief step producing a structured SalesBrief with primary + secondary solution pillar mapping, and a working post-call workflow entry point.

**Addresses:** Transcript ingestion with industry/subsector selector, structured brief extraction, missing-field notification, multi-pillar solution mapping.

**Uses:** Mastra TranscriptAgent, Zod TranscriptFieldsSchema + SalesBriefSchema, Gemini Flash structured output mode, Next.js post-call input form.

**Avoids:** Zod `.transform()` on LLM schemas (Pitfall 8 — keep raw LLM schemas separate from application schemas), monolithic super-agent anti-pattern (one scoped agent per concern), storing full transcript in every step's context (pass typed schema output downstream, not raw text).

### Phase 3: HITL Workflow Wiring

**Rationale:** HITL Checkpoint 1 (brief approval) is on the critical path — zero slides are generated until it is functional. The suspend/resume mechanism, durable state persistence, and the brief approval UI must all be working together before the RAG and slide assembly phases can be tested end-to-end.

**Delivers:** Post-call workflow with suspend at HITL-1, Prisma workflow state table with full lifecycle tracking (`created → notified → viewed → approved/rejected/expired`), resume API endpoint, brief approval UI rendering the SalesBrief as formatted card UI (not raw JSON), and workflow status polling in the seller UI.

**Addresses:** HITL Checkpoint 1 (brief approval), workflow status display, seller/SME notification.

**Uses:** Mastra workflow suspend/resume, Prisma + SQLite, Next.js API routes (`/api/workflow/[id]/status`, `/api/workflow/[id]/resume`), shadcn/ui card components for brief review panel.

**Avoids:** In-memory HITL state loss (Pitfall 4 — durable storage is configured in Phase 1 but verified here), HITL browser-close ambiguity (Pitfall 7 — implement `viewedAt`, expiry, and re-notification in this phase), HITL approval UI showing raw JSON (UX pitfall — render formatted brief cards).

### Phase 4: RAG Retrieval and Slide Block Assembly

**Rationale:** With an approved brief in hand and AtlusAI populated (Phase 1), RAG retrieval and the slide assembly intermediate layer can be built and tested. This phase produces the SlideJSON — the auditable, reviewable intermediate representation before any pixel is painted in Google Slides.

**Delivers:** Working RAGRetrieval step (AtlusAI MCP semantic + metadata filter search), AssembleSlideJSON step producing an ordered array of slide block specs, GenerateCopy step populating each block with bespoke copy via CopywritingAgent, and verified retrieval quality for at least 3 different industries.

**Addresses:** AtlusAI RAG retrieval (industry + pillar + stage matching), slide block assembly as structured JSON, multi-pillar content retrieval, ROI framing module integration point.

**Uses:** Mastra ContentAgent (AtlusAI tool), Mastra CopywritingAgent (copywriting agent, scoped to copy-only), SlideAssemblySchema, retrieved content chunks from AtlusAI.

**Avoids:** RAG as agent intelligence rather than explicit workflow step (Pattern 3 — retrieval is a deterministic step, not implicit agent behavior), unthrottled AtlusAI queries (batch pre-fetch all needed blocks before slide creation), deck-level RAG chunking already addressed in Phase 1.

### Phase 5: Google Workspace Output Generation

**Rationale:** With validated slide JSON from Phase 4, the Google API integration can be built against a known, stable input contract. This is the phase that produces the visible demo deliverable — a Google Slides deck in the shared Lumenalta Drive.

**Delivers:** CreateGoogleSlides step (Drive template copy → sequential batchUpdate calls), CreateTalkTrack step (Google Docs), CreateBuyerFAQ step (Google Docs), auto-named output files (`[CompanyName] - [PrimaryPillar] - [Date]`), per-deal folder in shared Lumenalta Drive, and HITL Checkpoint 2 (final asset review with Drive links).

**Addresses:** Google Slides deck generation, talk track (Google Doc), buyer FAQ with objection handling (Google Doc), HITL Checkpoint 2 (final asset review), artifact persistence in Google Drive.

**Uses:** `googleapis` Node.js client, Google Slides API `files.copy` + `batchUpdate`, Google Docs API, Google Drive API, service account credentials.

**Avoids:** Placeholder ID blindness (Pitfall 1 — use `getPlaceholderIdByType()` utility from Phase 1), batchUpdate ordering errors (Pitfall 2 — separate create and insert into sequential calls), image insertion via Drive URLs (Pitfall 6 — GCS URLs from Phase 1), layout ID mismatch (Pitfall 10 — copy template first, then modify), inline Google API calls inside agent tools (Anti-Pattern 3 — all Google API calls are in workflow steps only).

### Phase 6: Pre-Call Briefing Flow

**Rationale:** Pre-call briefing is independent of the post-call flow and can be built in parallel after Phase 2 foundations are established. It has a lighter dependency graph (no HITL suspend, no slide assembly) and demonstrates the full platform scope in the demo.

**Delivers:** Pre-call input form (company name, buyer role, meeting context), ResearchCompany step (public source research + AtlusAI solution matching), GenerateHypotheses step (discovery questions mapped to Lumenalta solutions, role-specific framing), BuildBriefingDoc step, SaveToDrive step, and pre-call UI displaying the formatted briefing with Drive link.

**Addresses:** Pre-call company snapshot, discovery question generation, role-specific hypotheses by buyer persona, pre-call Google Doc output.

**Uses:** Mastra ResearchAgent, AtlusAI MCP, Gemini Flash, Google Drive API, CompanyResearchSchema, pre-call UI form.

### Phase 7: Feedback Loop and Polish

**Rationale:** After the full end-to-end pipeline is working, the feedback capture mechanism and UX polish can be layered on. The CaptureEdits step is low-complexity compared to building it; the primary value is establishing the data capture pattern early enough that real usage generates training signal.

**Delivers:** CaptureEdits step (structured diff of human edits at HITL-2 approval), feedback logger, progress indicators for the 2-3 minute deck generation pipeline (step-by-step status), inline missing-field warnings on transcript paste (debounced analysis), Slack webhook for HITL notification, and end-to-end demo scenario validation.

**Addresses:** Feedback loop (edit capture for prompt and RAG refinement), UX polish (progress indicators, inline warnings, named Drive files).

**Avoids:** No progress indicator during long generation (UX pitfall), missing fields surfaced only after submission (UX pitfall — debounced analysis while typing).

### Phase Ordering Rationale

- **Content ingestion before everything:** RAG retrieval gates all downstream generation. Wrong order means a full re-index penalty.
- **Schema validation before agent logic:** Gemini schema rejection is a blocking error that must be discovered in isolation, not mid-pipeline.
- **HITL wiring before slide generation:** The hard stop design means the approval UI must be functional before any deck output can be tested end-to-end.
- **Google API spike in Phase 1, production integration in Phase 5:** The placeholder ID and batchUpdate pitfalls must be discovered and solved in a low-stakes spike before the full slide assembly pipeline is built on top of them.
- **Pre-call flow in Phase 6:** It is independent and lighter; deferring it prevents it from blocking post-call flow development without delaying the overall demo.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (AtlusAI content ingestion):** The MCP chunking schema for slide-level content and AtlusAI's specific ingestion API are not fully documented in training data. Verify AtlusAI's actual ingestion endpoint, supported metadata fields, and semantic search filter syntax against live AtlusAI documentation before designing the ingestion script.
- **Phase 3 (Mastra suspend/resume specifics):** Mastra is actively developed and its exact suspend/resume API, storage adapter configuration, and `.afterEvent()` syntax require verification against current Mastra docs (post-August 2025). This is the highest-risk API surface in the entire stack.
- **Phase 4 (AtlusAI MCP query interface):** Hybrid search (semantic + structured filter) query syntax and the specific tool call format for AtlusAI via Mastra's MCP client are uncertain. Verify before building the RAGRetrieval step.
- **Phase 5 (Google Slides template copy pattern):** The exact `files.copy` parameters for Shared Drives with a service account (including `supportsAllDrives: true` and Drive folder targeting) should be verified against Google Drive API docs before the deck assembly implementation begins.

Phases with standard patterns (skip or reduce research-phase):

- **Phase 2 (Gemini structured output + Zod):** Pattern is well-documented; primary risk is schema-specific rejection, which is caught by the Phase 1 schema validation spike.
- **Phase 6 (Pre-call briefing flow):** Standard LLM call pattern with no HITL or Google API complexity; well-covered by existing Mastra and Gemini documentation.
- **Phase 7 (Feedback loop + UX polish):** Standard UI patterns and simple database logging; no novel integration challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core stack is pre-decided and appropriate. Supporting library versions (Mastra semver, Gemini provider package name, zod-to-json-schema v4 compat) need npm verification before pinning. |
| Features | MEDIUM | Feature set is well-scoped; competitor analysis based on training data through August 2025 — specific competitor capabilities may have evolved. The feature dependencies and MVP definition are high-confidence. |
| Architecture | MEDIUM | Core patterns (workflow-as-state-machine, agent-per-concern, RAG as explicit step, schema-first contract) are HIGH confidence from established literature. Mastra-specific API details (suspend/resume syntax, storage adapter config) are MEDIUM — actively developed framework. |
| Pitfalls | MEDIUM-HIGH | Google Slides API pitfalls (placeholder IDs, batchUpdate ordering, image URLs, layout IDs) are HIGH confidence from stable official API documentation. Gemini schema constraints are MEDIUM. Mastra-specific pitfalls (HITL state persistence) are LOW — verify against current Mastra GitHub/docs. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Mastra current API surface:** Suspend/resume syntax, storage adapter configuration, and `.afterEvent()` semantics must be verified against current Mastra documentation (post-August 2025) before Phase 3 planning. This is the highest-uncertainty surface in the stack.
- **AtlusAI MCP query interface:** The exact MCP tool call format, semantic search filter parameters, and ingestion API for AtlusAI are not in training data. Verify against AtlusAI documentation or API before designing the RAGRetrieval step and ingestion script.
- **Gemini model ID naming:** `gemini-2.5-flash` model ID string may have changed post-August 2025. Verify against Google AI Studio before any LLM call configuration.
- **Mastra Gemini provider package:** The official Mastra provider adapter for Gemini (`@mastra/google` or similar) — package name and API are uncertain. Verify on npmjs.com to determine whether to use the adapter or raw `@google/generative-ai`.
- **Tailwind v4 stability:** Research flags this as uncertain (was in beta as of August 2025). Default to Tailwind v3.4 unless team confirms v4 is stable and the team is comfortable with its CSS-first config model.
- **Zod v4 + `@hookform/resolvers` compatibility:** Resolvers v3.9+ adds Zod v4 support; earlier versions fail silently. Pin to `^3.9` minimum and verify.

## Sources

### Primary (HIGH confidence)
- `PROJECT.md` — pre-decided stack constraints, feature scope, Lumenalta-specific requirements (authoritative)
- Google Slides API reference (batchUpdate, placeholder types, image insertion constraints) — stable official documentation
- Google Drive API service account + Shared Drive permission model — stable official documentation
- Next.js 15 official documentation — stable; GA released October 2024

### Secondary (MEDIUM confidence)
- Mastra AI documentation (training data, cutoff August 2025) — framework actively evolving; verify current API
- Zod v4 release notes (May 2025) — some API details may have shifted in stable release
- Gemini API structured output documentation (supported JSON Schema subset) — verify schema constraints against current API
- Competitor analysis: Highspot, Seismic, Gong, Chorus, Tome, Pitch, Beautiful.ai (training data through August 2025)
- RAG pipeline architecture patterns (LangChain, LlamaIndex documentation) — HIGH on principles; MEDIUM on Mastra-specific implementation

### Tertiary (LOW confidence, requires verification)
- `@mastra/google` or `@mastra/google-ai` Gemini provider package — name and existence uncertain; verify on npmjs.com
- `zod-to-json-schema` v4 compatibility — verify current release supports Zod v4 stable
- Tailwind v4 stability and shadcn/ui compatibility — was in beta as of August 2025
- Mastra-specific HITL edge cases (state persistence behavior, storage adapter config) — verify against current Mastra GitHub

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
