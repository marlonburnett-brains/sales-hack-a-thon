# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.6 — Touch 4 Artifact Intelligence

**Shipped:** 2026-03-08
**Phases:** 6 | **Plans:** 20 | **Commits:** 110

### What Was Built
- Shared `ArtifactType` schema contract plus forward-only Prisma support for Touch 4 artifact typing
- Artifact-qualified Touch 4 inference, cron, routes, and chat refinement paths
- Shared classify controls and saved badge hydration for Proposal / Talk Track / FAQ across both classify surfaces
- Separate Touch 4 Settings tabs with per-artifact confidence, detail views, and scoped chat refinement
- Production-verified artifact-scoped settings chat flow after route-parity and UI persistence fixes
- Shared type-contract hardening and a restored green `agent` no-emit TypeScript baseline

### What Worked
- **Audit-driven gap closure:** The stale `gaps_found` audit created a tight follow-up loop; Phases 38-40 closed live proof, contract, and compile-baseline gaps cleanly.
- **Shared contract first:** Publishing `ArtifactType` once in `@lumenalta/schemas` prevented schema, proxy, and UI drift while the milestone expanded.
- **Focused production evidence:** Locking verification to one Vercel and Railway pair kept every live proof tied to the same deploy reality.
- **Regression-before-fix discipline:** Failing tests around route parity, typed seams, and streamed state persistence made the final fixes low risk.

### What Was Inefficient
- **Audit staleness:** The milestone audit became outdated within hours; the final closeout needed a rerun before archival.
- **Roadmap drift:** `.planning/ROADMAP.md` still showed `38-06` and `39-03` as incomplete even after their summaries and verifications existed.
- **Double-fetch debt remains:** Touch 4 artifact tabs still trigger redundant detail fetches on some tab transitions.

### Patterns Established
- **Artifact-qualified keying:** Touch 4 data identity is `touchType + artifactType`, not touchType alone.
- **Validated route extension:** Reusing the existing route family with typed `artifactType` payloads scaled better than spinning up parallel endpoints.
- **Production proof pairing:** Final live verification should pair browser-visible success with backend persistence on the exact same request window.
- **Closeout compile gate:** Milestone-level feature work should finish on a passing typecheck baseline, not just passing targeted tests.

### Key Lessons
1. **Artifact subtypes become architecture quickly:** What starts as UI metadata quickly touches schema, inference, transport, and verification.
2. **Production verification needs a single locked target:** Mixing localhost, preview, and production evidence obscures the real blocker.
3. **Live chat fixes need UI-state verification too:** A repaired backend stream is not enough if the client still drops the visible update.
4. **Audit reruns should be part of milestone closeout:** A stale audit can be directionally wrong even when the workspace is already green.
5. **Repo-health cleanup can be the right milestone-end phase:** Finishing on a clean compile target reduced risk for the next milestone immediately.

### Cost Observations
- Model mix: ~65% sonnet (executors, verifiers), ~20% haiku (researchers, explorers), ~15% opus (audit and orchestration)
- Sessions: ~6 sessions across 2 days
- Notable: This milestone spent more effort on live-proof closure and contract hardening than raw feature breadth, but it materially improved release confidence.

---

## Milestone: v1.5 — Review Polish & Deck Intelligence

**Shipped:** 2026-03-07
**Phases:** 3 | **Plans:** 8 | **Commits:** 49

### What Was Built
- Gallery-style Discovery cards with GCS-cached thumbnails, file-type corner badges, and unified status components
- Optimistic ingest UI with per-item toast lifecycle and dual client+server duplicate prevention
- AI-generated rich slide descriptions (4-field structured output) wired into ingestion pipeline with startup backfill
- Structured element map extraction from Google Slides pageElements with per-slide SlideElement storage
- Template/Example content classification with touch type binding, amber badges, and Popover classify UI
- Settings page with vertical tab sub-navigation, integration status cards, and per-touch-type deck structure pages
- AI-inferred deck structures with section flow visualization, confidence badges, streaming chat refinement, and cron auto-inference

### What Worked
- **Wave-based parallel execution:** Plans 33-01/33-02 and 34-01/34-02 executed in parallel — independent data layer and UI shell plans don't need sequencing
- **Streaming chat protocol:** Simple delimiter (---STRUCTURE_UPDATE---) separating text from JSON avoids SSE complexity while enabling real-time structure updates
- **Shared UI components:** IngestionStatusBadge and IngestionProgress created in 32-01, consumed across Discovery and Templates immediately in 32-02
- **Cron change detection:** SHA-256 data hash + 30-min active session protection window prevents both redundant LLM calls and overwriting user refinements
- **Classification -> Deck inference pipeline:** Clean cross-phase data flow (Phase 33 writes contentClassification, Phase 34 reads it for inference)
- **User checkpoint feedback:** Phase 34-03 checkpoint caught accordion vs dedicated pages preference — immediate pivot improved UX

### What Was Inefficient
- **SUMMARY frontmatter still empty:** 6th milestone with `requirements_completed` not populated — recurring tooling gap
- **Orphaned DeckStructureView component:** Built accordion view in 34-03 Task 2, replaced with dedicated pages in Task 3 — ~127 lines of dead code shipped
- **pre_call touch type inconsistency:** Agent returns 5 touch types (including pre_call), UI displays 4 — cosmetic but indicates schema/UI mismatch
- **Nyquist validation gaps:** Phases 32-33 missing VALIDATION.md entirely, Phase 34 has only a draft — validation discipline slipped for this milestone
- **Migration drift continues:** Forward-only migrations with manual SQL + resolve --applied used 3 more times across v1.5

### Patterns Established
- **Fire-and-forget GCS caching:** First browse triggers background cache write, second browse serves cached URL — progressive UX
- **useRef<Set> for synchronous guards:** Prevents React state delay on rapid clicks — complementary to server-side guards
- **Gemini structured output for narrative generation:** 4-field JSON schema (purpose, visualComposition, keyContent, useCases) works well for slide descriptions
- **Non-fatal LLM pipeline stages:** Description generation failures log warning but don't block ingestion — resilient pipeline design
- **Streaming delimiter protocol:** Text chunks then ---STRUCTURE_UPDATE--- then JSON — simple, no SSE infrastructure needed
- **Per-entity routing with slug mapping:** URL dashes (touch-1) mapped to internal underscores (touch_1)

### Key Lessons
1. **Dedicated pages > accordion for complex data:** User checkpoint feedback confirmed that per-touch-type pages with sub-navigation are cleaner than collapsing everything into one accordion page.
2. **Classification is a foundation feature:** Template/Example classification enables deck structure inference, future similarity enhancements, and assembly pipeline improvements — high leverage.
3. **Cron + change detection is cost-effective:** 10-min interval with data hash comparison avoids expensive LLM calls while keeping structures fresh.
4. **Dead code from checkpoint pivots is acceptable tech debt:** Building the initial approach (accordion) and pivoting (dedicated pages) is faster than getting the UX right upfront — clean up later.
5. **Nyquist validation needs enforcement, not reminders:** 3 phases without VALIDATION.md despite it being part of the workflow — needs gating, not optional.

### Cost Observations
- Model mix: ~60% sonnet (executors, verifiers), ~25% haiku (researchers), ~15% opus (orchestration, audit)
- Sessions: ~4 sessions in 1 day
- Notable: Smallest milestone by phase count (3) but highest feature density — classification + inference + chat is 3 interconnected features

---

## Milestone: v1.4 — AtlusAI Authentication & Discovery

**Shipped:** 2026-03-07
**Phases:** 5 | **Plans:** 12 | **Commits:** ~60 (feat/fix)

### What Was Built
- AtlusAI token storage with AES-256-GCM encryption, pool rotation, env var fallback, and 3-tier access detection cascade
- Mastra MCP client singleton with lifecycle management, OAuth refresh mutex, max lifetime recycling, and graceful SIGTERM shutdown
- MCP semantic search adapter replacing Drive API fallback with LLM extraction -- all 5 consumer files unchanged
- Discovery UI with browse (infinite scroll, card/list toggle), search (debounced semantic, relevance scoring, preview panel), and batch selective ingestion
- ActionRequired integration for AtlusAI account/project access with silence, dimming, and resolution guidance
- Chunked LLM extraction for large MCP results (32K threshold with array-level chunking)

### What Worked
- **Pattern reuse across auth milestones:** v1.3 Google token patterns (pool rotation, AES-256-GCM, ActionRequired) cloned directly for AtlusAI tokens — reduced design time significantly
- **MCP adapter pattern:** Mapping MCP results to existing SlideSearchResult interface meant zero changes to 5 consumer files — clean separation of concerns
- **Adaptive LLM prompt caching:** First MCP call discovers result shape, caches extraction template — handles unknown MCP response formats gracefully
- **Server-side access gating:** Discovery page checks AtlusAI access before rendering content — prevents confusing UI states
- **Gap closure phases worked:** Phases 30-31 (audit-driven) efficiently closed verification and tech debt gaps without scope creep

### What Was Inefficient
- **SUMMARY frontmatter still empty:** `requirements_completed` and `one_liner` not populated across any v1.4 SUMMARY files — 4th milestone with same tooling gap
- **Mock drift from Phase 31:** Phase 31 tech debt changes broke 8 mcp-client unit tests via mock export mismatch — should have updated tests in same commit
- **No discovery unit tests:** Phase 29 verified via code inspection + VERIFICATION.md only — no test file created despite wave 0 validation strategy
- **Phase 29-03 absorbed:** Plan 29-03 scope was absorbed into 29-01 and 29-02 — plan scoping was too granular for the feature

### Patterns Established
- **MCP singleton with lifecycle:** Health check via listTools(), max lifetime recycling, graceful SIGTERM shutdown — reusable for any MCP integration
- **Token refresh mutex:** refreshPromise serializes concurrent 401 recovery — prevents thundering herd on token refresh
- **Module-level Map for batch state:** In-memory Map sufficient for single-instance agent; avoids DB complexity for transient state
- **slideId-based dedup:** Simpler than SHA-256 content hashing; effective for preventing duplicate ingestion

### Key Lessons
1. **MCP client lifecycle needs active management:** SSE connections are fragile — health checks, max lifetime, and graceful shutdown are essential, not optional.
2. **LLM extraction is viable for unknown schemas:** Adaptive prompting can handle MCP results without knowing the response shape upfront — flexible but adds latency.
3. **Chunking at array level preserves structure:** Splitting arrays (not raw text) for LLM extraction maintains JSON validity and allows parallel processing.
4. **Gap closure phases should update tests:** When tech debt changes affect existing test mocks, test updates must be in the same commit — otherwise mock drift accumulates.
5. **Absorbed plans indicate over-scoping:** If a plan's scope fits naturally into adjacent plans, the original plan was probably too granular.

### Cost Observations
- Model mix: ~65% sonnet (executors, verifiers), ~20% haiku (researchers), ~15% opus (orchestration, audit)
- Sessions: ~8 sessions across 2 days
- Notable: Two audit rounds (gaps_found → tech_debt) — second audit confirmed all 35 requirements satisfied with verified evidence

---

## Milestone: v1.3 — Google API Auth: User-Delegated Credentials

**Shipped:** 2026-03-06
**Phases:** 5 | **Plans:** 10 | **Commits:** 17

### What Was Built
- AES-256-GCM encrypted refresh token storage per user (UserGoogleToken model with isValid/lastUsedAt/revokedAt)
- OAuth scope expansion with Drive, Slides, Docs read-only scopes and offline access for refresh tokens
- Dual-mode Google API client factories (user OAuth2Client token or service account fallback)
- Web-to-agent token passthrough via X-Google-Access-Token header with in-memory token cache (50min TTL)
- Middleware re-consent detection with 1h cookie cache and conditional consent prompt
- Background job token pool with ordered fallback, automatic invalidation, and health alerting
- ActionRequired model and API for re-authentication notifications
- 52-test regression suite verifying auth priority chain across 4 test files

### What Worked
- **Single-day milestone:** 5 phases, 10 plans completed in one day — strong familiarity with codebase enabled rapid execution
- **Dual-mode factory pattern:** GoogleAuthOptions interface cleanly separates user token vs service account paths without breaking any existing callers (14+ files backward compatible)
- **Token cache with TTL:** In-memory cache avoids redundant refresh-to-access-token exchanges; 50min TTL matches Google's access token lifetime
- **Fire-and-forget DB updates:** lastUsedAt/isValid updates don't block the API response — async DB writes for non-critical metadata
- **Vitest mock patterns matured:** vi.mock class syntax for PrismaClient/OAuth2Client constructors, vi.resetModules for singleton isolation — pattern now well-established
- **Phase 26 gap closure:** Audit identified httpOnly cookie bug and SUMMARY frontmatter gaps; single phase resolved both efficiently

### What Was Inefficient
- **Workflow token passthrough deferred:** Phase 23 explicitly deferred passing user tokens through workflow steps — fetchWithGoogleAuth headers are sent but never forwarded to step context. Low impact but creates a design asymmetry.
- **checkGoogleToken unused code:** api-client.ts exports a function that middleware doesn't use (Edge runtime requires direct fetch) — should have been caught during implementation, not audit
- **Migration drift continues:** Two more `db execute + migrate resolve` workarounds in Phases 22 and 24 — the 0_init baseline drift remains unresolved

### Patterns Established
- **Dual-mode Google API factory:** Accept optional GoogleAuthOptions; use OAuth2Client with user token when present, fall back to service account
- **Token cache with Map:** In-memory Map with TTL for caching refresh-to-access-token exchanges
- **extractGoogleAuth request helper:** Pulls X-Google-Access-Token + X-User-Id headers from request context into typed object
- **Token pool iteration:** getPooledGoogleAuth iterates ALL valid tokens ordered by lastUsedAt DESC, marks failed tokens invalid
- **ActionRequired model:** Generic action-needed pattern (type + entityId + metadata) for prompting user re-authentication

### Key Lessons
1. **User-delegated credentials are the right approach for org-wide file access:** Service account has limited visibility; user OAuth tokens inherit the user's org-wide permissions naturally.
2. **Cookie httpOnly must be false for client-side JavaScript access:** Learned that `httpOnly: true` prevents `document.cookie` reads needed for client-side token status checks. Safe when cookie contains only status strings, not actual tokens.
3. **Edge runtime compatibility matters for middleware:** Next.js middleware runs in Edge runtime — can't import Node.js-only packages. Use direct `fetch` instead of Node.js HTTP clients.
4. **Token pool health alerting is low-cost insurance:** Console warning at <3 valid tokens costs nothing to implement but catches silent pool exhaustion before it becomes an outage.
5. **Regression test suite should be a mandatory milestone deliverable:** Phase 25's 52-test suite caught integration issues and now serves as permanent regression protection.

### Cost Observations
- Model mix: ~70% sonnet (executors, verifiers), ~20% haiku (researchers), ~10% opus (orchestration, audit)
- Sessions: ~6 sessions in 1 day
- Notable: Quality profile + yolo mode continued to deliver strong verification (28/28 requirements, Nyquist compliant across all 5 phases)

---

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
| v1.3 | 17 | 5 | User-delegated Google OAuth — token storage, passthrough, pool |
| v1.4 | ~60 | 5 | AtlusAI MCP integration — token pool, semantic search, discovery UI |
| v1.5 | 49 | 3 | UX polish, slide intelligence v2, content classification, deck intelligence |
| v1.6 | 110 | 6 | Touch 4 artifact intelligence, live proof closure, contract hardening, and agent baseline cleanup |

### Cumulative Quality

| Milestone | Verifications | Passed | Human Needed |
|-----------|--------------|--------|--------------|
| v1.0 | 13 | 10 | 3 (phases 4, 11, 12) |
| v1.1 | 4 | 2 | 2 (phases 14, 16 — runtime auth flows) |
| v1.2 | 4 | 4 | 0 (all passed automated verification) |
| v1.3 | 5 | 5 | 0 (52 tests, Nyquist compliant) |
| v1.4 | 5 | 5 | 0 (35 requirements, partial Nyquist — meta-phases exempt) |
| v1.5 | 3 | 1 | 2 (phases 32, 33 — UI-heavy, human verification) |
| v1.6 | 6 | 6 | 0 (all in-scope verifications passed after audit rerun) |

### Cumulative Stats

| Metric | v1.0 | v1.1 | v1.2 | v1.3 | v1.4 | v1.5 | v1.6 | Total |
|--------|------|------|------|------|------|------|------|-------|
| Phases | 13 | 4 | 4 | 5 | 5 | 3 | 6 | 40 |
| Plans | 27 | 6 | 10 | 10 | 12 | 8 | 20 | 93 |
| Commits | 169 | 55 | 37 | 17 | ~60 | 49 | 110 | ~497 |
| LOC (TypeScript) | ~20,000 | ~20,665 | ~28,472 | ~30,203 | ~35,315 | ~40,833 | ~50,876 | ~50,876 |
| Days | 2 | 1 | 2 | 1 | 2 | 1 | 2 | 6 |

### Top Lessons (Verified Across Milestones)

1. Google Drive permissions are the #1 external blocker — budget time for access requests
2. Mastra suspend/resume is reliable for HITL patterns — design around it confidently
3. Platform services (Vercel, Railway, CircleCI) beat manual VMs for small-team deployments
4. Container deployment requires iteration even with working local builds — budget for debugging
5. Design auth strategy holistically across phases to avoid mid-milestone header switches
6. Choose CI/CD platform before building the pipeline — avoid mid-milestone migrations
7. SUMMARY.md frontmatter gap is a recurring tooling issue — fix the executor, not the auditor (v1.0-v1.4, 5 milestones)
8. Prisma + pgvector requires raw SQL escape hatches — accept and design around it
9. User-delegated OAuth tokens solve org-wide file access without domain-wide delegation
10. Regression test suites should be a mandatory deliverable for auth/security milestones
11. MCP client lifecycle needs active management — SSE connections are fragile, health checks and recycling are essential
12. Pattern reuse across auth milestones accelerates delivery — v1.3 patterns directly applicable to v1.4
13. Gap closure phases after audit are efficient — targeted scope, no creep, closes verification and tech debt quickly
14. Dedicated pages beat accordions for complex data views — user checkpoint feedback confirmed this for deck structures (v1.5)
15. Classification is a high-leverage foundation feature — enables downstream inference, assembly, and similarity improvements (v1.5)
16. Streaming delimiter protocol is simpler than SSE for chat — text + ---DELIMITER--- + JSON is easy to parse, no infrastructure needed (v1.5)
17. Audit reruns belong in milestone closeout when gap-closure phases land late — stale audit status can lag the real workspace state (v1.6)
18. Artifact-qualified features need proof across schema, transport, UI, and production evidence — UI-only or backend-only verification is not enough (v1.6)
