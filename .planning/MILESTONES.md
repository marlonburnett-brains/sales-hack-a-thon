# Milestones

## v1.6 Touch 4 Artifact Intelligence (Shipped: 2026-03-08)

**Phases:** 6 (35-40) | **Plans:** 20 | **Commits:** 110 | **Files changed:** 116 | **LOC:** ~50,876 TypeScript/TSX/Prisma (total)
**Timeline:** 2 days (2026-03-07 -> 2026-03-08)
**Git range:** `685c1ed..9527493`

**Key accomplishments:**
- Shared `ArtifactType` constants and forward-only Prisma schema changes now support Proposal, Talk Track, and FAQ classification for Touch 4 Examples
- Touch 4 inference, cron, routes, and chat refinement now operate on artifact-qualified deck structure keys instead of one generic row
- Classification flows and slide-viewer reloads persist and rehydrate saved artifact badges across both classify surfaces
- Settings now shows separate Touch 4 Proposal, Talk Track, and FAQ structures with per-artifact confidence and scoped chat refinement
- Production evidence now proves the artifact-scoped settings chat flow end to end after the route-parity and UI persistence fixes
- Web and agent artifact contracts were tightened to the shared type surface, and `pnpm --filter agent exec tsc --noEmit` is green again

**Tech debt (accepted):**
- `Touch4ArtifactTabs` and `TouchTypeDetailView` still double-fetch artifact detail on some tab changes
- Content-library breadth is still limited by missing Drive access on external source presentations

**Archives:** [v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) | [v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md) | [v1.6-MILESTONE-AUDIT.md](milestones/v1.6-MILESTONE-AUDIT.md)

---

## v1.5 Review Polish & Deck Intelligence (Shipped: 2026-03-07)

**Phases:** 3 (32-34) | **Plans:** 8 | **Commits:** 49 | **Files changed:** 83 | **LOC:** ~40,833 TypeScript/TSX (total)
**Timeline:** 1 day (2026-03-07)
**Git range:** `550b578..13a741b`

**Key accomplishments:**
- Gallery-style Discovery cards with GCS-cached thumbnails, file-type corner badges, and unified IngestionStatusBadge across Discovery and Templates pages
- Optimistic ingest UI with per-item toast lifecycle, ref-based client-side duplicate prevention, and server-side duplicate guard
- AI-generated rich slide descriptions (purpose, visual composition, key content, use cases) via Gemini 2.0 Flash structured output during ingestion
- Structured element map extraction from Google Slides pageElements with per-slide SlideElement storage and startup backfill detection
- Template/Example content classification with touch type binding, amber "Action Required" badges, and Popover-based classify UI
- AI-inferred deck structures per touch type with confidence scoring, section flow visualization, streaming chat refinement, and cron-based auto-inference with change detection

**Tech debt (accepted):**
- SUMMARY frontmatter `requirements_completed` entries incomplete across all v1.5 phases (metadata gap only)
- `DeckStructureView` accordion component orphaned after switch to per-touch-type pages (~127 lines dead code)
- `GET /deck-structures` returns `pre_call` entry but UI only displays 4 touch types (cosmetic, no user impact)
- Nyquist validation missing for phases 32-33, partial for phase 34

**Archives:** [v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) | [v1.5-REQUIREMENTS.md](milestones/v1.5-REQUIREMENTS.md) | [v1.5-MILESTONE-AUDIT.md](milestones/v1.5-MILESTONE-AUDIT.md)

---

## v1.4 AtlusAI Authentication & Discovery (Shipped: 2026-03-07)

**Phases:** 5 (27-31) | **Plans:** 12 | **Commits:** ~60 (feat/fix) | **Files changed:** 263 | **LOC:** ~35,315 TypeScript/TSX (total)
**Timeline:** 2 days (2026-03-06 -> 2026-03-07)
**Git range:** `5700873..f247482`

**Key accomplishments:**
- AtlusAI token storage with AES-256-GCM encryption, pool rotation with env var fallback, and 3-tier access detection cascade (account -> project -> full access)
- Mastra MCP client singleton with lifecycle management, OAuth refresh mutex, configurable max lifetime, and graceful SIGTERM shutdown
- MCP semantic search replacing Drive API fallback with adaptive LLM extraction adapter -- all 5 consumer files unchanged
- Discovery UI with browse (infinite scroll, card/list toggle) and search (debounced semantic search with relevance scoring and preview panel)
- Batch selective ingestion with floating toolbar, per-item progress polling, and dedup markers for already-ingested content
- Chunked LLM extraction for large MCP results (32K threshold), persisted OAuth client_id to skip re-registration

**Tech debt (accepted):**
- 8 mcp-client unit tests fail due to mock drift from Phase 31 changes (not production bugs)
- No discovery-specific unit test file created (verified via code inspection + VERIFICATION.md)
- SUMMARY.md frontmatter `requirements_completed` not populated across v1.4 plans (metadata gap)

**Archives:** [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md) | [v1.4-MILESTONE-AUDIT.md](milestones/v1.4-MILESTONE-AUDIT.md)

---

## v1.3 Google API Auth: User-Delegated Credentials (Shipped: 2026-03-06)

**Phases:** 5 (22-26) | **Plans:** 10 | **Commits:** 17 | **Files changed:** 82 | **LOC:** ~30,203 TypeScript/TSX (total)
**Timeline:** 1 day (2026-03-06)
**Git range:** `55eddd4..88a6eac`

**Key accomplishments:**
- AES-256-GCM encrypted refresh token storage per user (UserGoogleToken Prisma model with lastUsedAt/isValid/revokedAt tracking)
- OAuth scope expansion with Drive, Slides, Docs read-only scopes and offline access for refresh tokens
- Dual-mode Google API client factories accepting optional accessToken — user OAuth2Client or service account fallback
- Web-to-agent token passthrough via X-Google-Access-Token header with middleware re-consent detection and cookie caching
- Background job token pool with ordered fallback, automatic token invalidation, health alerting at <3 valid tokens
- 52-test regression suite verifying auth priority chain (user token > pool > service account)

**Tech debt (accepted):**
- `checkGoogleToken` api-client function unused by middleware (Edge runtime uses direct fetch)
- Workflow steps don't consume user Google tokens (design deferral — service account fallback is intended)

**Archives:** [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) | [v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md) | [v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md)

---

## v1.2 Templates & Slide Intelligence (Shipped: 2026-03-06)

**Phases:** 4 | **Plans:** 10 | **Commits:** 37 | **Files changed:** 201 | **LOC:** ~28,472 TypeScript/TSX (total)
**Timeline:** 2 days (2026-03-05 → 2026-03-06)
**Git range:** `62e84c7..6b273f8`

**Key accomplishments:**
- Added CI/CD pipeline (CircleCI) with automated lint, build, migrate, and deploy to Vercel + Railway on every push to main
- Enabled pgvector in Supabase with SlideEmbedding table and HNSW cosine index for vector similarity search
- Built collapsible sidebar navigation with Deals, Templates, and Slide Library sections plus mobile hamburger drawer
- Created full template management CRUD with Google Slides URL validation, Drive access awareness, touch type assignment, and staleness detection
- Built AI-powered slide ingestion pipeline: Google Slides extraction, Vertex AI embedding (768-dim), Gemini classification (8 axes + confidence), smart merge for re-ingestion
- Shipped preview and review engine: per-template slide viewer with keyboard navigation, classification display, thumbs-up/down rating, inline tag correction, and cross-template similarity search

**Tech debt (accepted):**
- CI/CD requirement text references "GitHub Actions" but implementation uses CircleCI (functionally equivalent)
- SUMMARY.md frontmatter `requirements_completed` not populated by executors (tooling gap)

**Archives:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) | [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)

---

## v1.1 Infrastructure & Access Control (Shipped: 2026-03-05)

**Phases:** 4 | **Plans:** 6 | **Commits:** 55 | **Files changed:** 59 | **LOC:** ~20,665 TypeScript/TSX (total)
**Timeline:** 1 day (2026-03-05)
**Git range:** `v1.0..0d61f7b`

**Key accomplishments:**
- Migrated from SQLite to Supabase PostgreSQL with Prisma provider switch, fresh baseline migration, and Mastra durable PostgresStore with schema isolation
- Added service-to-service API key authentication (SimpleAuth middleware on agent, X-API-Key header injection on web)
- Implemented Google OAuth login wall via Supabase Auth with @lumenalta.com domain restriction, middleware route protection, and UserNav avatar dropdown
- Deployed web app to Vercel (auto-deploy from main, preview from branches) and agent server to Railway with Docker + auto-restart
- Established credential injection pattern for containerized Vertex AI deployments (entrypoint script writes inline JSON to file)

**Tech debt (accepted):**
- Stale SQLite comments in schema.prisma (cosmetic)
- Vestigial X-API-Key header config in SimpleAuth (web switched to Authorization: Bearer)
- Obsolete Oracle VM artifacts in deploy/ (Caddyfile, docker-compose.yml, deploy.sh)
- PostgresStore uses DATABASE_URL (pooled) -- may need DIRECT_URL with pgbouncer

**Archives:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) | [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

---

## v1.0 Agentic Sales MVP (Shipped: 2026-03-05)

**Phases:** 13 | **Plans:** 27 | **Commits:** 169 | **Files:** 439 | **LOC:** ~20,000 TypeScript/TSX
**Timeline:** 2 days (2026-03-03 → 2026-03-04)
**Git range:** `1c5b7d3..8d55936`

**Key accomplishments:**
- Full-stack monorepo (Next.js 15 + Mastra AI + Prisma + Google Workspace API) with pnpm/Turborepo
- Touch 1-3 asset generation: AI-driven slide selection and assembly for pagers, intro decks, and capability decks with approve/override feedback and knowledge base growth
- Touch 4 end-to-end pipeline: transcript → extraction → field review → sales brief → HITL-1 → RAG retrieval → Google Slides deck + talk track + buyer FAQ → HITL-2 asset review
- Pre-call briefing flow: company research, role-specific hypotheses, prioritized discovery questions, Google Doc output
- Step-by-step pipeline progress indicators, friendly error handling, demo seed scenario (Meridian Capital Group)
- Content library ingestion: 38 slides + brand guidelines in AtlusAI with coverage across all 11 industries

**Known Gaps (accepted):**
- CONT-01 (partial): Content library populated with accessible sources only — 14/17 shortcut targets need Viewer access on target Shared Drives
- CONT-02 (unsatisfied): Case studies not ingested — source presentations among inaccessible Drive shortcuts
- CONT-03 (partial): Slide chunks indexed from 5 accessible presentations (38 slides); 12+ presentations pending access
- CONT-04 (unsatisfied): Building Block Library incomplete — no case study modules until CONT-02 resolved
- Touch 4 standalone brief review page has workflowRunId null before approval (chicken-and-egg; inline flow works correctly)

**Archives:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) | [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---

