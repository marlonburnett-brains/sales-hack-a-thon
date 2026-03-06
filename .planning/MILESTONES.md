# Milestones

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

