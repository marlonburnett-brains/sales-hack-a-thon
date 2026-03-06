# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — Templates & Slide Intelligence

**Shipped:** 2026-03-06
**Phases:** 4 | **Plans:** 10 | **Commits:** 37

### What Was Built
- CI/CD pipeline (CircleCI) automating lint, build, migrate, and deploy on every push to main
- pgvector-enabled Supabase with SlideEmbedding table and HNSW cosine index for vector similarity
- Collapsible sidebar navigation with Deals, Templates, and Slide Library sections
- Full template management CRUD with Google Slides URL validation, Drive access awareness, touch type assignment, and staleness detection
- AI-powered slide ingestion pipeline: Google Slides API extraction, Vertex AI embedding (768-dim), Gemini 8-axis classification with confidence, content hash for smart merge
- Real-time ingestion progress UI with auto-trigger on template add and background staleness polling
- Per-template slide viewer with keyboard navigation, thumbnail strip, classification panel, thumbs-up/down rating, inline tag correction
- Cross-template Slide Library with filtering, pagination, and vector similarity search

### What Worked
- **Rapid v1.2 execution:** 4 phases, 10 plans completed in 2 days — each plan averaged ~5 minutes execution
- **pgvector for similarity search:** HNSW cosine index provides sub-millisecond similarity queries at current scale
- **Smart merge for re-ingestion:** Content hash approach preserves unchanged slides, only re-classifies modified ones — clean idempotency
- **Server Actions proxy pattern (continued):** Consistent web→agent communication via typed api-client + server actions, established in v1.0 and extended smoothly
- **Gemini structured output for classification:** JSON schema enforcement produces consistent multi-value arrays across all slides
- **db execute + migrate resolve pattern:** Repeatedly successful for handling 0_init migration drift across 4 separate migrations

### What Was Inefficient
- **GitHub Actions → CircleCI pivot:** Phase 18 built deploy.yml for GitHub Actions; later disabled and replaced with CircleCI config — wasted effort on initial GHA implementation
- **SUMMARY.md frontmatter gaps (recurring):** `requirements_completed` and `one_liner` fields empty for all 10 plans — same issue from v1.0 and v1.1, tooling gap still unresolved
- **Confidence score bug:** Classification panel multiplied already-percentage confidence by 100 (displayed "7500%" for 75%) — caught in audit, fixed in gap closure commit
- **0_init migration drift:** Every new migration required `db execute` + `migrate resolve` workaround — root cause is the baseline migration not matching actual DB state

### Patterns Established
- **Raw SQL for pgvector operations:** Prisma doesn't natively support vector types; raw SQL with `::vector` casts and `<=>` cosine operator is the reliable pattern
- **Content hash for identity:** SHA-256 of slide text (truncated to 40 chars) determines slide identity for merge operations
- **Chip+dropdown hybrid for multi-value editing:** shadcn Select is single-value only; custom MultiTagField component handles multi-value categories
- **Background polling for staleness:** 5-minute interval checks Drive modifiedTime vs lastIngestedAt, auto-queues re-ingestion
- **Ingestion queue for sequential processing:** Deduplicating queue processes templates one-at-a-time to avoid overwhelming external APIs
- **db execute + migrate resolve:** Standard pattern for applying migrations when baseline doesn't match actual DB

### Key Lessons
1. **Choose CI/CD platform upfront:** The GHA→CircleCI pivot wasted a plan's worth of effort. Decide CI platform before building pipeline.
2. **pgvector + Prisma requires raw SQL workarounds:** Accept this and design around it rather than fighting Prisma's type system.
3. **Classification confidence should be stored as 0-100 integer:** Treat as percentage directly, never multiply. UI layer should display raw value.
4. **Migration drift compounds:** Each new migration requiring `db execute + migrate resolve` adds friction. Consider re-baselining before next milestone.
5. **Background polling is good enough for staleness:** Real-time Drive webhooks (TMPL-08) deferred correctly — 5-minute polling interval handles the use case without webhook complexity.

### Cost Observations
- Model mix: ~75% sonnet (executors, verifiers), ~15% haiku (researchers, explorers), ~10% opus (orchestration, audit)
- Sessions: ~10 sessions across 2 days
- Notable: Quality profile with yolo mode delivered strong verification scores (25/25 observable truths across 4 phases)

---

## Milestone: v1.0 — Agentic Sales MVP

**Shipped:** 2026-03-05
**Phases:** 13 | **Plans:** 27 | **Commits:** 169

### What Was Built
- Complete 5-flow sales orchestration platform (Touch 1-4 + Pre-call) with Google Workspace output
- Two HITL checkpoints (brief approval + asset review) using Mastra suspend/resume
- RAG retrieval from AtlusAI with multi-pass fallback and brand-constrained copy generation
- Pipeline progress indicators with named step tracking across all forms
- Content library ingestion pipeline with drive discovery, slide extraction, and Gemini classification
- Demo seed scenario (Meridian Capital Group, Financial Services)

### What Worked
- **GSD workflow velocity:** 13 phases, 27 plans executed in 2 days — structured planning kept execution fast
- **Mastra suspend/resume:** Both HITL checkpoints work correctly; workflow state survives server restarts
- **Copy-and-prune deck assembly:** Copying entire source presentations and pruning unwanted slides preserves all original formatting
- **Shared assembly engine:** Built once in Phase 4, reused without modification for Touch 2, 3, and 4
- **Monotonic Set pattern:** Prevents stepper flicker during polling — established in Phase 11, reused in Phase 13
- **Three-state form pattern:** input/review/result state machine established in Phase 4, extended to 9 states for Touch 4
- **Parallel phase execution:** Phases 2/3 ran in parallel, Phase 10 independent of Phases 5-9

### What Was Inefficient
- **Content library access:** 14/17 Drive shortcut targets inaccessible — discovered in Phase 2, not fully resolved until Phase 12, still blocked on external permissions
- **ROADMAP progress table drift:** Several phases showed incorrect plan counts and statuses (e.g., Phase 2 showing "1/3" and "In progress" despite all plans complete)
- **Phase 2 multiple attempts:** Content ingestion required 3 plans in Phase 2 + 2 plans in Phase 12 due to evolving understanding of Drive access model
- **Verification scores inconsistent with summaries:** Some SUMMARY.md frontmatter had empty `requirements_completed` despite phase actually satisfying requirements

### Patterns Established
- **Mastra workflow JSON serialization:** Compound objects passed between steps as JSON strings to avoid nested schema storage issues
- **Server Actions proxy pattern:** Next.js Server Actions proxy all API calls to Mastra agent service via typed api-client
- **Sequential Gemini calls for quality:** Per-slide copy generation uses sequential `for...of` (not Promise.all) for quality and rate limit safety
- **Functional updater for polling state:** `setCompletedSteps(prev => ...)` avoids stale closure issues in poll loops
- **Brand voice as constant:** Hardcoded in module rather than AtlusAI-retrieved for simplicity and reliability
- **Idempotent upsert for seed data:** Company.upsert by name, existence checks before Deal/Interaction create

### Key Lessons
1. **Drive shortcut access != target access:** Having a shortcut in an accessible folder doesn't grant access to the shortcut target. The service account needs explicit Viewer access on each target Shared Drive.
2. **Mastra steps can't access runId:** workflowRunId must be set after workflow starts, not during step execution. Design approval flows accordingly.
3. **AtlusAI MCP requires Claude Code auth:** Standalone scripts can't use MCP tools directly — use Drive API as fallback for batch operations.
4. **Gemini prefers strings over enums:** Priority fields use string type (not Zod enum) for safer Gemini structured output extraction.
5. **Google Slides objectIds are opaque:** Always read from presentations.get response; never hardcode. Template uses generic shapes (placeholder.type = none), not TITLE/BODY placeholders.

### Cost Observations
- Model mix: ~70% sonnet (executors, verifiers), ~20% haiku (explorers, researchers), ~10% opus (orchestration)
- Sessions: ~15 sessions across 2 days
- Notable: yolo mode + quality profile delivered fast execution with high verification scores (10/10 and 5/5 on integration phases)

---

## Milestone: v1.1 — Infrastructure & Access Control

**Shipped:** 2026-03-05
**Phases:** 4 | **Plans:** 6 | **Commits:** 55

### What Was Built
- SQLite → Supabase PostgreSQL migration with Prisma provider switch and Mastra PostgresStore schema isolation
- Service-to-service API key auth via Mastra SimpleAuth middleware
- Google OAuth login wall with @lumenalta.com domain restriction via Supabase Auth
- Login page with Google branding, UserNav avatar dropdown with sign-out
- Production deployment: web on Vercel (auto-deploy), agent on Railway (Docker + auto-restart)
- Credential injection pattern for containerized Vertex AI deployments

### What Worked
- **Rapid infrastructure phases:** 4 phases completed in a single day (44 min total execution time)
- **Supabase SSR cookie pattern:** getAll/setAll with middleware token refresh — clean, no deprecated API usage
- **Route group layout split:** (authenticated) group cleanly separates nav bar from login page
- **Railway pivot:** Switching from Oracle Cloud VM to Railway eliminated manual provisioning and gave auto-deploy, managed HTTPS, and restart policies for free
- **Entrypoint credential injection:** Zero application code changes to support GOOGLE_APPLICATION_CREDENTIALS in containers

### What Was Inefficient
- **Oracle VM → Railway pivot:** Phase 17 was originally planned for Oracle Cloud Ampere A1 VM with Caddy reverse proxy. Mid-execution pivot to Railway left obsolete deploy/ artifacts (Caddyfile, docker-compose.yml, deploy.sh)
- **Deployment debugging:** 10+ fix commits for Railway deployment (CRLF line endings, Prisma client path resolution, healthcheck timeouts, 0.0.0.0 binding)
- **X-API-Key → Authorization: Bearer switch:** Phase 15 chose X-API-Key to avoid collision with user auth, but post-Phase 16 the web switched to Authorization: Bearer — left vestigial SimpleAuth config
- **SUMMARY frontmatter gaps:** requirements-completed field missing from 3 of 4 phase SUMMARYs (only 15-01 had it initially)

### Patterns Established
- **Supabase SSR client pattern:** Browser client via createBrowserClient, server client via createServerClient with cookie proxy
- **Server-side domain enforcement:** OAuth callback validates email domain on server (hd parameter is UX-only)
- **Credential injection via entrypoint:** Write inline JSON env var to temp file for SDKs that only accept file paths
- **Schema isolation:** Prisma uses 'public' schema, Mastra uses 'mastra' schema in same database
- **Connection string pattern:** DIRECT_URL for migrations and Mastra, DATABASE_URL for Prisma runtime

### Key Lessons
1. **Platform services > manual VMs for small teams:** Railway auto-deploy + managed HTTPS + restart policies eliminated an entire class of operational complexity that Oracle VM required
2. **Supabase pooler has propagation delay:** New projects may return "Tenant or user not found" via pooler for hours — use direct DB connection initially
3. **Container deployment requires iteration:** Even with working local Docker builds, production container platforms have unique constraints (path resolution, networking, health checks)
4. **Auth header strategy needs upfront design:** Choosing X-API-Key in Phase 15 to "avoid collision" with Phase 16 led to a post-hoc switch to Authorization: Bearer — should have designed both phases together

### Cost Observations
- Model mix: ~80% sonnet (executors), ~15% haiku (researchers), ~5% opus (orchestration)
- Sessions: ~8 sessions in 1 day
- Notable: yolo mode + fine granularity enabled extremely fast phase execution (4min avg per plan)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 169 | 13 | Initial milestone — established GSD workflow patterns |
| v1.1 | 55 | 4 | Infrastructure hardening — platform deploy, auth, Postgres |
| v1.2 | 37 | 4 | Template intelligence — pgvector, AI classification, HITL rating |

### Cumulative Quality

| Milestone | Verifications | Passed | Human Needed |
|-----------|--------------|--------|--------------|
| v1.0 | 13 | 10 | 3 (phases 4, 11, 12) |
| v1.1 | 4 | 2 | 2 (phases 14, 16 — runtime auth flows) |
| v1.2 | 4 | 4 | 0 (all passed automated verification) |

### Cumulative Stats

| Metric | v1.0 | v1.1 | v1.2 | Total |
|--------|------|------|------|-------|
| Phases | 13 | 4 | 4 | 21 |
| Plans | 27 | 6 | 10 | 43 |
| Commits | 169 | 55 | 37 | 261 |
| LOC (TypeScript) | ~20,000 | ~20,665 | ~28,472 | ~28,472 |
| Days | 2 | 1 | 2 | 4 |

### Top Lessons (Verified Across Milestones)

1. Google Drive permissions are the #1 external blocker — budget time for access requests
2. Mastra suspend/resume is reliable for HITL patterns — design around it confidently
3. Platform services (Vercel, Railway, CircleCI) beat manual VMs for small-team deployments
4. Container deployment requires iteration even with working local builds — budget for debugging
5. Design auth strategy holistically across phases to avoid mid-milestone header switches
6. Choose CI/CD platform before building the pipeline — avoid mid-milestone migrations
7. SUMMARY.md frontmatter gap is a recurring tooling issue — fix the executor, not the auditor
8. Prisma + pgvector requires raw SQL escape hatches — accept and design around it
