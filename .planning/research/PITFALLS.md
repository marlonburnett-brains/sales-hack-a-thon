# Pitfalls Research

**Domain:** Adding pgvector, CI/CD, slide intelligence, and HITL classification to existing Lumenalta sales platform
**Researched:** 2026-03-05
**Confidence:** HIGH (verified against official docs, GitHub issues, and existing codebase analysis)

## Critical Pitfalls

### Pitfall 1: Prisma Does Not Natively Support pgvector Types -- All Vector Operations Require Raw SQL

**What goes wrong:**
Prisma has no native `vector` type. You define the column as `Unsupported("vector(1536)")` in the schema, but then all reads and writes for that column must use raw SQL (`$queryRaw`, `$executeRaw`). Developers who expect to use standard Prisma CRUD for embeddings hit runtime errors or silently get null values. The generated Prisma Client TypeScript types exclude `Unsupported` fields entirely, so `prisma.slideEmbedding.create({ data: { embedding: [...] } })` does not even compile.

**Why it happens:**
Prisma treats pgvector's `vector` type as `Unsupported`, meaning it exists in the schema for migration purposes but is invisible to the generated TypeScript client. The project's CLAUDE.md mandates `prisma migrate dev --name <name>` for all schema changes (never `db push`), which means every vector column addition goes through the migration pipeline where extension creation must be handled manually.

**How to avoid:**
1. Use `--create-only` when adding vector columns. Edit the generated SQL to prepend `CREATE EXTENSION IF NOT EXISTS "vector"` before applying.
2. Define the model with `embedding Unsupported("vector(1536)")?` in schema.prisma.
3. Create a dedicated repository layer (e.g., `slide-embedding.repository.ts`) that wraps ALL vector operations in raw SQL. Never attempt Prisma client methods on vector columns.
4. Use `::text` casting when reading embeddings back: `SELECT embedding::text FROM ...`.
5. For similarity search, use raw SQL with pgvector operators: `ORDER BY embedding <=> $1::vector LIMIT $2`.
6. Create HNSW or IVFFlat indexes via raw SQL in the migration file -- Prisma cannot generate these index types.

**Warning signs:**
- `PrismaClientKnownRequestError` mentioning "unsupported" during CRUD operations
- Migration fails with `type "vector" does not exist`
- Vector columns return `null` when using `prisma.model.findMany()`
- TypeScript compilation errors when trying to set vector fields via Prisma Client

**Phase to address:**
Slide Ingestion Agent phase -- must be set up correctly before any embedding storage begins.

---

### Pitfall 2: Supabase Shadow Database and Extension Schema Conflicts Block Prisma Migrations

**What goes wrong:**
Prisma's `migrate dev` uses a shadow database to detect drift. Supabase enables extensions in a special `extensions` schema, but the shadow database does not have this schema. Running `prisma migrate dev` fails with `schema "extensions" does not exist` in the shadow database. Separately, if someone toggles pgvector on/off via the Supabase dashboard, Prisma detects schema drift and wants to recreate the extension, causing migration history conflicts.

**Why it happens:**
Supabase's architecture puts extensions in a separate schema (`extensions`) for security isolation. Prisma's shadow database is a vanilla Postgres instance that lacks this schema. The project already has a baseline migration (`0_init`) and adding extension management introduces a new class of drift. The project note about the direct DB host vs Supabase pooler ("pooler not ready for newly created projects") adds another variable.

**How to avoid:**
1. Enable pgvector via the Supabase dashboard first (Settings > Database > Extensions). Do NOT rely on Prisma migrations to create the extension.
2. In the migration SQL file, use `CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA public` (explicitly `public` schema, not `extensions`). This avoids the shadow database schema issue.
3. For the shadow database, either configure `shadowDatabaseUrl` in schema.prisma pointing to a second Supabase project, or accept that `migrate dev` may need `--create-only` followed by manual apply with `migrate deploy`.
4. Never toggle extensions on/off in the Supabase dashboard after initial setup -- this causes drift that Prisma cannot reconcile.
5. Both dev AND prod Supabase instances need pgvector enabled before running migrations.

**Warning signs:**
- `prisma migrate dev` fails mentioning "extensions" schema
- Migration history shows drift warnings about vector extension
- Dev and prod databases have different extension configurations
- CI/CD migration step fails but local `migrate dev` works

**Phase to address:**
CI/CD Pipeline phase -- must be resolved before automated migrations run in GitHub Actions.

---

### Pitfall 3: Running Prisma Migrations in CI/CD Against Production Without Guards

**What goes wrong:**
GitHub Actions runs `prisma migrate deploy` against the production Supabase database on every push to main. A bad migration (data-destructive column drop, wrong type change) applies instantly with no rollback. Preview deployments on Vercel with schema changes would mutate the production database if they share the same `DATABASE_URL`. Multiple concurrent deploys could race to apply the same migration.

**Why it happens:**
The project has a single `DATABASE_URL` env var per environment. CI/CD pipelines naturally run migrations as part of the deploy step. The project's constraint ("treat dev DB as production, forward-only migrations") is enforced by convention in CLAUDE.md but has no automated gate in CI.

**How to avoid:**
1. Run `prisma migrate deploy` (not `migrate dev`) in CI/CD -- it only applies pending migrations, never creates new ones, and does not use a shadow database.
2. Use separate `DATABASE_URL` values for preview vs production Vercel deployments.
3. Add a `prisma migrate status` check step in CI before applying migrations -- if no pending migrations, skip the step entirely.
4. Sequence the CI/CD pipeline: check migration status -> apply migrations -> deploy agent -> deploy web. Migrations must succeed before either app deploys.
5. Never run migrations from the Vercel build step. Use a dedicated GitHub Actions job that completes before deploy triggers.
6. Add a concurrency group in GitHub Actions to prevent parallel migration runs: `concurrency: { group: 'deploy-main', cancel-in-progress: false }`.

**Warning signs:**
- Preview deployments modifying production schema
- Multiple GitHub Actions runs racing to apply the same migration
- `prisma migrate deploy` failing mid-flight with partial schema changes
- Agent deploys with new code before migration has run

**Phase to address:**
CI/CD Pipeline phase -- this is the first thing to get right before any other automated deployment.

---

### Pitfall 4: Google Slides API 60-Request-Per-Minute Quota Exhaustion During Slide Ingestion

**What goes wrong:**
When ingesting templates, the slide agent needs to: (1) get presentation metadata, (2) get each slide's content for embedding, (3) optionally get thumbnails. With 12+ presentations of 20-40 slides each, you quickly exceed the 60 requests/minute/user quota. The API returns 429 errors, and without proper retry logic the ingestion job silently drops slides or crashes mid-way, leaving the database in an inconsistent state (some slides ingested, others missing).

**Why it happens:**
The Google Slides API has a hard 60 requests/minute/user limit. Each `presentations.get` is one request, but `presentations.pages.getThumbnail` per slide adds up fast. A 30-slide deck needing thumbnails requires 31 API calls (1 metadata + 30 thumbnails), consuming half the per-minute budget for a single presentation. The project already has 38 slides from 5 presentations and expects 12+ more presentations once Drive access is granted.

**How to avoid:**
1. Use `presentations.get` WITHOUT field masks to get ALL slide data (including page elements, text content) in a single request per presentation. This is one call per deck, not one per slide.
2. Extract text content for embeddings from the presentation response object server-side -- do not make per-slide API calls for content.
3. For thumbnails, batch with deliberate delays: process ~40 thumbnails/minute to leave headroom for other API calls.
4. Implement exponential backoff with jitter on 429 responses (Google's recommended pattern).
5. Process presentations sequentially, not in parallel.
6. Cache the full presentation JSON in the database so re-ingestion or re-classification does not require re-fetching from Google.
7. Make ingestion idempotent -- if interrupted, it should resume from the last successfully processed slide, not restart from scratch.

**Warning signs:**
- 429 HTTP responses from Google APIs
- Ingestion jobs that process some slides but not all
- Inconsistent slide counts between source presentations and database records
- Ingestion completes "successfully" but some slides have no embeddings

**Phase to address:**
Slide Ingestion Agent phase -- rate limiting must be built into the agent from day one.

---

### Pitfall 5: batchUpdate Atomicity Means One Bad Object ID Kills an Entire Slide Assembly Operation

**What goes wrong:**
Google Slides `batchUpdate` is atomic -- if any single sub-request in the batch is invalid, the entire batch fails and nothing is applied. When building slide assembly operations (copy, reorder, delete unwanted slides), one stale object ID or malformed request kills the entire operation, including all valid changes. The project's copy-and-prune pattern (copy entire source, delete unwanted slides, reorder remaining) is particularly vulnerable because object IDs from the source presentation do not carry over to the copy.

**Why it happens:**
Object IDs change when presentations are copied via the Drive API. Shape and element IDs can change when slides are manually edited in the Google Slides UI. The batchUpdate API validates all requests atomically before applying any, so there is no partial success.

**How to avoid:**
1. After copying a presentation via Drive API, ALWAYS re-fetch the new presentation to get fresh object IDs. Never assume IDs carry over from the source.
2. Break large batch operations into smaller, independent batches. Each batch should be self-contained (e.g., all deletes in one batch, all text replacements in another).
3. Validate that referenced objectIds exist in the current presentation state before building the batchUpdate request.
4. Implement retry logic that re-fetches presentation state and rebuilds the request on failure.
5. Log the full batchUpdate request payload on failure for debugging -- the error message from Google often only identifies the first invalid request.

**Warning signs:**
- `batchUpdate` calls failing with "The object (objectId) could not be found"
- Slides that work in dev but fail in production (different source presentations with different IDs)
- Partial deck assembly where the entire operation failed and no slides were modified

**Phase to address:**
Slide Ingestion Agent phase and Templates Management phase -- any phase that modifies Google Slides programmatically.

---

### Pitfall 6: Embedding Model Dimension Mismatch Silently Corrupts Similarity Search

**What goes wrong:**
The vector column is created with a fixed dimension (e.g., `vector(1536)` for OpenAI `text-embedding-3-small`, or `vector(768)` for Vertex AI `text-embedding-004`). If the embedding model changes, or if different parts of the system use different models, dimensions do not match. Postgres throws a dimension mismatch error on insert, or if the column is defined without dimensions (`vector` instead of `vector(768)`), stores vectors of inconsistent dimensions where cosine similarity produces meaningless results.

**Why it happens:**
The project uses GPT-OSS 120b on Vertex AI as the LLM, but LLMs and embedding models are separate services. The project may need a dedicated embedding endpoint. Different embedding models produce different dimensions: OpenAI text-embedding-3-small (1536), Vertex AI text-embedding-004 (768), Cohere embed-v3 (1024). Choosing wrong or changing later requires re-embedding all stored content.

**How to avoid:**
1. Choose the embedding model BEFORE creating the vector column. Document the model name, version, and output dimension as a SQL comment in the migration file.
2. Specify explicit dimensions in the column definition: `vector(768)` not `vector`. This catches mismatches at insert time rather than producing garbage similarity results.
3. Store the embedding model identifier alongside each vector (an `embedding_model` text column) so you can detect and handle model changes.
4. Use a consistent embedding model across ALL content types. Do not mix models.
5. Since the project already uses Vertex AI, `text-embedding-004` (768 dims) is the natural choice -- same platform, same auth, lower storage cost than 1536-dim alternatives.
6. Create an abstraction layer for embedding generation so the model can be swapped later (with a re-embedding migration).

**Warning signs:**
- Similarity search returns irrelevant results for clearly related slides
- Insert errors mentioning dimension mismatch
- Different embedding dimensions in code vs database column definition
- Mixing embedding calls to different providers in the same codebase

**Phase to address:**
Slide Ingestion Agent phase -- must be decided before the first embedding is stored.

---

### Pitfall 7: Side Panel Navigation Breaks Existing Authenticated Layout and Deal Pages

**What goes wrong:**
The current authenticated layout (`apps/web/src/app/(authenticated)/layout.tsx`) renders a sticky top nav bar and a `max-w-7xl` centered content area. Adding a persistent side panel (with Deals and Templates sections) requires restructuring this layout. If done naively: existing deal pages shift right and shrink, the `max-w-7xl` container interacts badly with a fixed-width sidebar, mobile layout breaks entirely, and the sidebar remounts on every page navigation if implemented as a per-page component instead of a layout-level component.

**Why it happens:**
The existing layout is a simple top-nav-only pattern. The sidebar is a fundamentally different layout paradigm. The content area currently uses `mx-auto max-w-7xl` which centers content -- adding a sidebar means the "center" shifts. All existing deal pages (list, detail, interaction forms) were designed for full-width content and will need responsive adjustments.

**How to avoid:**
1. Implement the sidebar in the `(authenticated)/layout.tsx` file -- NOT as a per-page component. This prevents remounting on navigation.
2. Replace the `max-w-7xl mx-auto` pattern with a flex layout: `flex` container with sidebar (fixed width) and content area (flex-1).
3. Keep the sidebar state (expanded/collapsed) in a cookie so it persists across navigations and survives SSR hydration without flicker.
4. Use `@media` breakpoints to auto-collapse the sidebar into a hamburger/drawer on screens below 1024px.
5. Test ALL existing deal pages (deals list, deal detail, all touch interaction forms, briefing flow) with the sidebar present before shipping.
6. Consider a "mini sidebar" (icons only, ~60px) as the collapsed state rather than fully hiding it.

**Warning signs:**
- Existing deal page layouts break or shift when sidebar is added
- Sidebar remounts/flickers on every page navigation
- Mobile layout completely breaks (content hidden behind sidebar)
- Content area width changes cause form elements to reflow unexpectedly

**Phase to address:**
Side Panel Navigation phase -- should be done early as Templates page and all subsequent features depend on the navigation structure.

---

### Pitfall 8: Vercel Git Integration Conflicts With GitHub Actions Deploy

**What goes wrong:**
Vercel's default git integration automatically deploys on push. If you also set up GitHub Actions to deploy (using `vercel deploy --prebuilt`), both systems trigger simultaneously on the same push, creating duplicate deployments. Worse, the Vercel git integration does not understand monorepo watch paths the same way GitHub Actions does, so it may rebuild apps that have not changed.

**Why it happens:**
The project currently deploys via Vercel's automatic git integration (push to main triggers deploy). Adding GitHub Actions CI/CD creates a second deployment trigger. Both compete for the same Vercel project, and the last one to finish "wins" as the production deployment.

**How to avoid:**
1. Disable Vercel's automatic git integration for BOTH projects (web and agent) when switching to GitHub Actions: `vercel project settings > Git > Disable GitHub integration`.
2. Use `vercel deploy --prebuilt --prod` from GitHub Actions as the sole deployment mechanism.
3. For Railway, use `railway up` from GitHub Actions or Railway's own GitHub integration (not both).
4. If keeping Vercel git integration, do NOT add a GitHub Actions Vercel deploy step -- use GitHub Actions only for linting, testing, and migration steps.

**Warning signs:**
- Duplicate deployments appearing in Vercel dashboard for the same commit
- Race conditions where migrations run after one deploy but before another
- Deployments triggered for apps whose code did not change

**Phase to address:**
CI/CD Pipeline phase -- decide on ONE deployment mechanism before writing any CI config.

---

### Pitfall 9: HITL Classification Feedback Stored But Never Actually Used to Improve Results

**What goes wrong:**
The human rating system collects slider ratings and approve/reject signals for slide classifications, stores them in the database, but the classification algorithm never reads them back. The feedback loop is "open" -- data goes in but never comes out. Sellers rate dozens of classifications, see no improvement, and stop providing feedback. The system has all the UX for HITL but none of the actual learning.

**Why it happens:**
Building the feedback UI is straightforward (form, API endpoint, database table). Building the feedback integration is harder: you need to either (a) fine-tune the classification prompt with few-shot examples drawn from approved classifications, (b) adjust similarity thresholds based on rating data, or (c) maintain a "corrections" table that overrides low-confidence classifications. Developers ship the UI first and plan to "add the learning later," but "later" never comes.

**How to avoid:**
1. Design the feedback data model with the consumption path in mind FIRST: how will ratings change future classifications?
2. Simplest effective approach: maintain a "verified classifications" table. When classifying a new slide, first check for exact or near-exact matches in verified classifications (using embedding similarity). If a verified match exists with high similarity (>0.95), use the verified label directly.
3. For prompt-based classification: build a few-shot example retriever that pulls the N most relevant verified examples and includes them in the classification prompt.
4. Define a measurable metric: "% of classifications accepted without changes" tracked over time. If this does not improve after 50+ ratings, the feedback loop is broken.
5. Show users the impact: "Based on your feedback, X classifications were auto-corrected this week."

**Warning signs:**
- Feedback table grows but classification accuracy stays flat
- No code path reads from the feedback/ratings table
- Users stop providing ratings (feedback fatigue from seeing no impact)
- Classification prompt does not reference any historical feedback data

**Phase to address:**
Preview and Rating Engine phase -- the feedback consumption mechanism must ship in the SAME phase as the feedback collection UI, not a future phase.

---

### Pitfall 10: Access Awareness Check Runs Once on Template Save But Files Become Unshared Later

**What goes wrong:**
When a user saves a Google Slides template link, the system checks if the service account has access to the presentation. It shows a green checkmark. Three days later, the file owner changes sharing settings, and the service account loses access. The template still shows as "accessible" in the UI, but slide ingestion fails silently or with cryptic Google API errors. Sellers trust the green checkmark and do not understand why their template is not working.

**Why it happens:**
Access checks are point-in-time. Google Drive sharing permissions are mutable. The existing `ContentSource` model has `accessStatus` and `lastCheckedAt` fields, which shows this problem was anticipated in v1.0 but the periodic re-check may not be implemented. Users do not proactively monitor sharing settings.

**How to avoid:**
1. Re-check access on every ingestion attempt, not just on template save. Update `accessStatus` and `lastCheckedAt` on each check.
2. Show `lastCheckedAt` in the UI so users know when the access was last verified.
3. Add a "re-check access" button per template that forces a fresh check.
4. When ingestion fails due to access, immediately update the template status to "not_accessible" and show an actionable error: "This file is no longer shared with [service-account-email@project.iam.gserviceaccount.com]. Click to copy the email address."
5. Consider a scheduled job (hourly or daily) that re-checks access for all templates.

**Warning signs:**
- Templates showing "accessible" status with `lastCheckedAt` from days ago
- Ingestion failures with 403/404 Google API errors for templates marked accessible
- Sellers reporting "it was working yesterday"

**Phase to address:**
Access Awareness phase -- must include periodic re-check mechanism, not just point-in-time validation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing embeddings via raw SQL without a repository layer | Faster to implement | Raw SQL scattered across codebase, hard to change embedding model, no type safety | Never -- always wrap in a typed repository |
| Skipping rate limiting on Google API calls | Faster ingestion during dev | Production ingestion failures, dropped slides, 429 cascade | Never -- rate limiting from day one |
| Using `prisma db push` for vector columns | Avoids migration complexity | Violates CLAUDE.md project rules, no migration history, schema drift | Never (CLAUDE.md explicitly forbids it) |
| Hardcoding embedding dimensions | One less config value | Model change requires migration + full re-embedding of all content | Only if embedding model choice is absolutely final |
| Running migrations in Vercel build step | Simpler CI/CD setup | Race conditions with preview deploys, production schema mutations | Never -- use dedicated GitHub Actions migration job |
| Putting sidebar state in React state only | Quick to implement | Flickers on SSR hydration, resets on every navigation | Only during initial prototyping |
| Collecting feedback without consuming it | Ships the HITL UI faster | Users lose trust, stop providing feedback, feature becomes dead code | Never -- ship feedback collection and consumption together |
| One-time access check on template save | Simpler implementation | Stale access status, silent ingestion failures | Only for initial MVP; add periodic re-check in same milestone |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prisma + pgvector | Using `prisma.model.create()` for vector columns | Use `$executeRaw` with explicit `::vector` casting for all vector operations |
| Prisma + pgvector | Putting `CREATE EXTENSION` in Prisma schema `extensions` array | Enable via Supabase dashboard; add `CREATE EXTENSION IF NOT EXISTS` in migration SQL with `--create-only` |
| Prisma + pgvector | Creating HNSW index via Prisma schema `@@index` | HNSW/IVFFlat indexes must be raw SQL in migration file: `CREATE INDEX ON ... USING hnsw (embedding vector_cosine_ops)` |
| Supabase + Prisma migrate | Running `migrate dev` in CI without shadow database config | Use `migrate deploy` in CI (no shadow database needed); reserve `migrate dev` for local development only |
| Vercel + GitHub Actions | Using Vercel git integration AND GitHub Actions deploy | Disable Vercel git integration; deploy exclusively via `vercel deploy --prebuilt` from GitHub Actions |
| Railway + GitHub Actions | Not configuring watch paths for monorepo | Set watch paths to `apps/agent/**` and `packages/**` to prevent unnecessary rebuilds |
| Google Slides API + Copy | Assuming object IDs survive presentation copy | Always re-fetch the copied presentation to get new object IDs |
| Google Slides API + Thumbnails | Fetching thumbnails one-by-one without rate limiting | Batch with 1-2 second delays between calls; cache results in database |
| Embedding model + Vertex AI | Assuming the LLM (GPT-OSS 120b) handles embeddings | LLMs and embedding models are separate; need a dedicated embedding model endpoint (e.g., text-embedding-004) |
| HITL feedback | Storing ratings without a read-back path | Design the consumption path (few-shot retrieval, threshold adjustment) before building the storage |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded vector similarity search without index | Queries take 500ms+ as embeddings table grows | Add HNSW index on vector column via raw SQL migration; note: Prisma cannot create these | > 5,000 embeddings |
| Fetching full presentation JSON from Google API on every template list page | Template list page loads 2-5 seconds | Cache presentation metadata in DB; only fetch from Google API on explicit refresh or ingestion | > 10 templates |
| Re-generating embeddings on every classification review | Unnecessary API calls, latency, and cost | Store embeddings once at ingestion; only regenerate if source slide content changes | Any scale |
| Loading all slides for a presentation in a single query including embedding vectors | Memory spikes (768+ floats per row * hundreds of rows) | Exclude embedding column from list queries; only fetch embeddings for similarity operations | > 100 slides |
| Sidebar re-rendering on every Next.js route change | UI jank, flash of content shift | Put sidebar in layout.tsx (not page), use Server Components for static nav items | Immediately noticeable |
| GitHub Actions running full monorepo build on every push | 5-10 minute CI runs for single-file changes | Use path filters in workflow triggers; leverage Turborepo cache with remote caching | First week of CI/CD setup |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `DATABASE_URL` with direct connection string in preview deployment env vars | Preview deploys from forks could read/write production database | Use separate Supabase project for preview environments; production DATABASE_URL only in production env |
| Not validating Google Slides presentation IDs before API calls | User-supplied presentation IDs could probe files the service account has access to but the user should not see | Validate presentation ID format; confirm the service account has access AND the template belongs to the user's organization |
| Storing embedding vectors without access control inheritance | Any authenticated user can query all slide embeddings including from templates they should not access | Embeddings should include a `template_id` foreign key; filter similarity queries by accessible templates |
| Leaking API keys or DATABASE_URL in GitHub Actions logs | Credential exposure in CI logs | Use GitHub Secrets exclusively; add `--silent` flags; never `echo` env vars; use `add-mask` step |
| GitHub Actions workflow file editable by contributors | PR from fork could modify workflow to exfiltrate secrets | Use `pull_request_target` carefully; restrict workflow permissions; require approval for fork PRs |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw ML classification labels (e.g., "capability_overview_enterprise") | Sellers do not understand taxonomy terms | Display with plain-English descriptions and a representative slide thumbnail |
| Requiring sellers to rate EVERY slide classification | Review fatigue after 10+ slides leads to random ratings or abandonment | Show only low-confidence classifications for review; auto-accept high-confidence ones (>0.85 threshold) |
| No progress indicator during slide ingestion | Seller submits template link, sees nothing for 30+ seconds while slides are processed | Stream ingestion progress: "Processing slide X of Y... Classifying... Done" via polling or SSE |
| Side panel that cannot be collapsed | Reduces content area on smaller laptop screens (13" MacBook) | Collapsible sidebar with keyboard shortcut (Cmd+B), remembers preference via cookie |
| Showing access errors for unshared files without actionable fix | Seller sees "access denied" but has no idea what to do | Show the specific service account email with a copy button and instructions: "Share your Google Slides file with this email address" |
| Templates page loads full list without search or filtering | 20+ templates become unmanageable | Add search by name, filter by touch type, sort by last ingested date |

## "Looks Done But Isn't" Checklist

- [ ] **pgvector setup:** Extension enabled in Supabase AND vector column created via migration AND HNSW index created via raw SQL AND similarity search tested with real embeddings returning relevant results -- all four steps, not just the first
- [ ] **CI/CD pipeline:** Migrations run before deploy AND preview deploys use separate DB AND concurrency group prevents parallel migration runs AND rollback plan documented for bad migrations
- [ ] **Slide ingestion:** Rate limiting implemented AND exponential backoff on 429s AND slide count in DB matches source presentation AND ingestion is idempotent (can be re-run without duplicates)
- [ ] **Template CRUD:** Access check runs on save AND on ingestion AND unshared files show actionable error with service account email AND touch assignment validates against known touch types
- [ ] **Classification feedback:** Low-confidence threshold defined AND feedback actually changes future classification behavior (not just stored) AND improvement metric is tracked and visible
- [ ] **Side panel:** Works on mobile (hamburger drawer) AND persists collapsed/expanded state via cookie AND does not break ANY existing deal pages AND active state highlights correct section AND keyboard shortcut works
- [ ] **Embedding model:** Model name and dimension documented in migration SQL AND dimension matches column definition AND test embeddings produce meaningful similarity scores (not random)
- [ ] **GitHub Actions:** Workflow uses concurrency groups AND path filters limit unnecessary runs AND secrets are masked AND deploy steps are sequenced (migrate -> deploy agent -> deploy web)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong embedding dimensions in vector column | HIGH | Create new column with correct dimensions via migration, re-embed all content (API cost + time), update all queries, drop old column via migration |
| Migration applied to prod with breaking change | HIGH | Write a corrective forward-only migration (never rollback per CLAUDE.md), deploy hotfix, verify data integrity manually |
| Google API quota exhaustion during ingestion | LOW | Wait for quota reset (1 minute); resume from last successful slide if ingestion is idempotent; if not, delete partial data and restart |
| Sidebar breaks existing deal pages | MEDIUM | Revert layout.tsx change, fix responsive breakpoints, re-deploy; keep old top-nav-only layout as fallback via feature flag |
| Shadow database extension conflict | LOW | Configure `shadowDatabaseUrl` in schema.prisma pointing to second Supabase project; or switch to `--create-only` + `migrate deploy` workflow |
| batchUpdate failure during slide assembly | MEDIUM | Delete the partially created presentation via Drive API, re-fetch source IDs, rebuild batch request with validated IDs, retry |
| Feedback collected but never consumed | MEDIUM | Implement few-shot retriever that queries verified classifications table; integrate into classification prompt; backfill from existing ratings |
| Stale access status on templates | LOW | Run bulk access re-check on all templates; update statuses; add periodic scheduled re-check |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Prisma pgvector type handling | Slide Ingestion Agent | Vector column exists, raw SQL repository works, embeddings insert and query correctly via `$queryRaw` |
| Shadow database + extension conflicts | CI/CD Pipeline | `prisma migrate deploy` succeeds in GitHub Actions without shadow DB or extension schema errors |
| Production migration safety | CI/CD Pipeline | Migrations run in isolated job with concurrency group; preview deploys use separate DB; sequence verified |
| Google API rate limiting | Slide Ingestion Agent | Ingestion of 30+ slide deck completes without 429 errors; rate limiter logs show throttling |
| batchUpdate atomicity | Templates Management | Deck assembly succeeds with re-fetched object IDs; retry logic handles stale ID gracefully |
| Embedding dimension mismatch | Slide Ingestion Agent | Embedding model documented in migration; dimension matches column; similarity search returns relevant results |
| Side panel layout regression | Side Panel Navigation | All existing deal pages render correctly with sidebar; mobile drawer works; no layout shift on navigation |
| Feedback loop is open (store but never consume) | Preview & Rating Engine | Human ratings stored AND classification prompt includes few-shot examples from verified ratings; accuracy metric tracked |
| Stale access status | Access Awareness | Periodic re-check runs; templates update status on ingestion failure; actionable error shown in UI |
| Vercel + GitHub Actions conflict | CI/CD Pipeline | Only one deployment mechanism active; no duplicate deploys in Vercel dashboard |

## Sources

- [Prisma pgvector support issue #18442](https://github.com/prisma/prisma/issues/18442) -- confirms `Unsupported` type is required
- [Prisma first-class vector support issue #26546](https://github.com/prisma/prisma/issues/26546) -- ongoing, no native support yet
- [Prisma HNSW index dimension error #21850](https://github.com/prisma/prisma/issues/21850) -- HNSW indexes cannot be created via Prisma schema
- [Prisma shadow database extensions schema issue #26231](https://github.com/prisma/prisma/issues/26231) -- shadow DB lacks `extensions` schema
- [Supabase extension toggle causes Prisma drift #33047](https://github.com/supabase/supabase/issues/33047) -- dashboard toggle breaks migration history
- [Supabase pgvector documentation](https://supabase.com/docs/guides/database/extensions/pgvector) -- extension setup and usage
- [Supabase Prisma troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) -- known integration issues
- [Prisma deployment with migrations](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) -- `migrate deploy` vs `migrate dev`
- [Google Slides API usage limits](https://developers.google.com/workspace/slides/api/limits) -- 60 requests/minute/user
- [Google Slides API batch requests](https://developers.google.com/workspace/slides/api/guides/batch) -- atomic batch behavior
- [Google Slides API slide operations](https://developers.google.com/workspace/slides/api/samples/slides) -- slide-level operation examples
- [Railway monorepo deployment docs](https://docs.railway.com/guides/monorepo) -- watch paths configuration
- [Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) -- `vercel deploy --prebuilt` pattern
- [HITL best practices and pitfalls](https://parseur.com/blog/hitl-best-practices) -- feedback loop closure importance
- [Prisma migrate dev vs deploy in CI](https://github.com/prisma/prisma/discussions/11131) -- community discussion on CI migration patterns

---
*Pitfalls research for: Lumenalta v1.2 Templates & Slide Intelligence*
*Researched: 2026-03-05*
