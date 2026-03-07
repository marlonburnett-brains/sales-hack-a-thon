# Project Research Summary

**Project:** AtlusAI v1.5 Review Polish & Deck Intelligence
**Domain:** Agentic sales platform -- UX polish, slide intelligence, content classification, AI-assisted deck structure management
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

AtlusAI v1.5 is a feature milestone that layers intelligence and polish onto an existing, working agentic sales platform. The milestone covers 7 features spanning three tiers: UX gap fixes (Discovery thumbnails, ingestion status consistency, optimistic ingest feedback), slide intelligence deepening (element map extraction, rich AI descriptions, template/example classification), and a new deck structure management capability (Settings page with AI chat). The critical finding across all research is that **zero new package dependencies are required** -- every feature builds on existing installed libraries (googleapis v144, React 19, Prisma 6.19, shadcn/ui, Mastra AI). This dramatically reduces integration risk and keeps the milestone focused on product value rather than infrastructure.

The recommended approach is a three-phase build ordered by dependency chains and risk profile. UX polish features (F1-F3) come first because they are independent, low-risk, and close visible gaps users have reported. Slide intelligence features (F4-F6) come second because they modify the ingestion pipeline -- a shared subsystem where changes must be coordinated. The deck structure capstone (F7) comes last because it depends on both element maps (F5) and content classification (F6) to produce meaningful AI analysis. This ordering also ensures the content library grows (more classified examples) before AI structural inference runs, mitigating the low-data reliability pitfall.

The primary risks are: (1) Google Drive thumbnailLink URLs expiring and CORS-blocking if not proxied through GCS, (2) optimistic UI state being overwritten by stale polling responses, (3) oversized Slides API responses bloating the database if element maps are not reduced before storage, and (4) Prisma migrations interacting badly with existing pgvector columns. All four have proven mitigation patterns already established in the codebase -- the key is applying them consistently rather than reinventing.

## Key Findings

### Recommended Stack

No new packages. All 7 features use existing dependencies. The only CLI action is potentially adding the `ScrollArea` shadcn/ui component for the chat interface and running 5 Prisma migrations (4 ALTER TABLE, 1 CREATE TABLE).

**Core technologies (all existing):**
- **googleapis v144** -- Google Slides API element extraction + Drive API thumbnail fetching. Already called in `slide-extractor.ts` and `mastra/index.ts`; just parse more of the response.
- **React 19 useOptimistic** -- Instant ingest feedback. Already used in `actions-client.tsx`; extend to Discovery and Template cards.
- **Gemini 2.0 Flash via Mastra AI** -- Rich slide descriptions. Add `description` field to the existing classification prompt -- single LLM call, zero additional API cost.
- **shadcn/ui primitives** -- AI chat interface built from existing Card, Input, Button, Avatar components. No Vercel AI SDK (conflicts with Mastra route architecture).
- **Prisma 6.19 + PostgreSQL** -- Schema additions (5 migrations). Stay on 6.19.x; Prisma 7.x has vector regression (#28867).

**Explicitly rejected:** `@ai-sdk/react` (conflicts with Mastra), `@google-cloud/storage` (redundant with googleapis), `socket.io` (overkill for ~20 users), `@tanstack/react-query` (conflicts with Next.js server-first architecture).

### Expected Features

**Must have (table stakes -- closes UX gaps):**
- **F1: Discovery document card thumbnails** -- Grid cards are indistinguishable without visual previews. Reuse GCS caching pattern from v1.4.
- **F2: Consistent ingestion status across pages** -- Discovery and Templates show contradictory states. Fix: both pages read from Template.ingestionStatus as single source of truth.
- **F3: Immediate feedback on ingest click** -- 2-5 second delay feels broken. Fix: useOptimistic + immediate toast + button disable.

**Should have (differentiators -- builds intelligence layer):**
- **F4: Rich AI-generated slide descriptions** -- Browsable slide library without opening each slide. Generated alongside classification in single Gemini call.
- **F5: Structured element map extraction** -- Foundation for intelligent deck assembly. Parses 8 element types from existing presentations.get response. Novel -- no competitor analyzes existing Google Slides for structure.
- **F6: Template vs Example classification** -- Distinguishes reusable skeletons from real deliverables. Enables filtered retrieval and feeds deck structure inference.

**Capstone (depends on differentiators):**
- **F7: Settings page with deck structures + AI chat** -- Per-touch-type deck section ordering with AI inference from classified examples. Must come last.

**Defer to v1.6+:** Element map visual editor, drag-and-drop slide reordering, in-browser content editing, auto-classification, streaming AI chat, WebSocket status updates.

### Architecture Approach

Two-app monorepo (Next.js 15 web + Mastra Hono agent) with strict separation: web has zero direct database access, all data flows through api-client.ts to agent REST routes. v1.5 maintains this pattern with no architectural changes. All 7 features integrate into existing code paths -- ingestion pipeline extension (element maps + descriptions), Drive metadata enrichment extension (thumbnails), CRUD route additions (classification, deck structures), and client-side UX improvements (optimistic UI, polling fixes).

**Major components affected:**
1. **Ingestion pipeline** (`slide-extractor.ts`, `classify-metadata.ts`, `ingest-template.ts`) -- Extend to extract element maps from same presentations.get response and generate descriptions in same Gemini call
2. **Discovery enrichment** (`mastra/index.ts` browse/search routes) -- Add thumbnail caching via existing GCS pattern, include ingestion status from Template model
3. **Settings subsystem** (new) -- DeckStructure model, CRUD routes, AI refinement endpoint, Settings page with touch-type tabs and chat UI
4. **Client state management** (`discovery-client.tsx`, `template-card.tsx`) -- Replace in-memory status tracking with server-sourced polling, add optimistic guards with monotonic state transitions

### Critical Pitfalls

1. **Drive thumbnailLink expiration + CORS** -- URLs expire in hours and are CORS-blocked. Always proxy through GCS using existing `uploadThumbnailToGCS()`. Never store raw thumbnailLink as display URL. Verify thumbnails survive 24hr+ gap.

2. **Optimistic UI overwritten by stale polls** -- Background polling returns stale "idle" status that overwrites optimistic "queued" state, causing flickering. Fix: monotonic status transitions (status can only move forward), timestamp-based stale rejection, disable button immediately on click.

3. **Slides API response bloat** -- Full presentations.get for a 50-slide deck can be 5-15MB. Use `fields` parameter to mask response (60-80% reduction). Store reduced element maps only (objectId, type, placeholder, bounds), not full text runs or styles.

4. **Prisma + pgvector migration drift** -- Adding columns to tables with `Unsupported("vector(768)")` can trigger schema drift. Always use `--create-only` first, inspect SQL, never modify SlideEmbedding in same migration as new models.

5. **Deck structure AI unreliable with few examples** -- With only 5 presentations across 4 touch types, AI will present N=1 patterns as authoritative. Show "Based on N examples" prominently, warn when N < 3, graceful empty state when N = 0. Build classification (F6) before deck structures (F7) so examples accumulate.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: UX Polish
**Rationale:** Independent features with no cross-dependencies. Closes the most visible user-reported gaps. Low risk, high impact. Can ship and validate while Phase 2 is built.
**Delivers:** Visual Discovery cards, consistent cross-page ingestion status, instant ingest feedback.
**Addresses:** F3 (immediate feedback), F1 (Discovery thumbnails), F2 (ingestion status consistency)
**Avoids:** Pitfall 1 (thumbnailLink expiration -- use GCS caching), Pitfall 2 (optimistic UI race -- monotonic transitions), Pitfall 4 (status inconsistency -- single source of truth)
**Schema changes:** 1 migration (DiscoveryDocCache.thumbnailUrl)
**Estimated scope:** Small-medium. F3 is a 30-minute fix. F1 reuses existing GCS pattern. F2 requires polling refactor on Discovery page.

### Phase 2: Slide Intelligence Foundation
**Rationale:** F4 and F5 both modify the ingestion pipeline -- implement together to avoid double-migration and double-deployment. F6 is a prerequisite for F7 and low complexity. All three extend existing data models with additive columns.
**Delivers:** Structured element maps per slide, rich AI descriptions, template/example classification with touch binding.
**Addresses:** F5 (element map extraction), F4 (rich descriptions), F6 (classification)
**Avoids:** Pitfall 3 (response bloat -- field masking), Pitfall 5 (migration drift -- separate migrations, --create-only), Pitfall 6 (rate limits -- single presentations.get call), Pitfall 8 (LLM cost -- combine description with classification in single call)
**Schema changes:** 3 migrations (SlideEmbedding.description, SlideEmbedding.elementMap, Template.contentRole)
**Estimated scope:** Medium-high. Element map extraction (F5) is the largest single feature. Classification (F6) is straightforward.

### Phase 3: Deck Intelligence Capstone
**Rationale:** Depends on Phase 2 completion -- deck structure AI needs element maps (F5) and touch-bound examples (F6) to produce meaningful results. Building this last also gives users time to classify more examples, improving AI reliability.
**Delivers:** Settings page with per-touch deck structure CRUD, AI inference from classified examples, chat-based refinement.
**Addresses:** F7 (Settings + deck structures + AI chat)
**Avoids:** Pitfall 7 (insufficient data -- show confidence indicators, require 2+ examples, graceful empty states)
**Schema changes:** 1 migration (CREATE TABLE DeckStructure)
**Estimated scope:** High. New page, new model, new agent routes, AI chat component.

### Phase Ordering Rationale

- **F3 before F1/F2:** Immediate feedback is the quickest win (pure frontend, no backend changes). Establishes the optimistic UI pattern used by F1/F2.
- **F1 before F2:** Thumbnails are independent and visually impactful. Status consistency requires the polling refactor which is more complex.
- **F4+F5 together:** Both modify the ingestion pipeline. F5 provides element map data that enriches F4's description prompts. Single deployment of pipeline changes.
- **F6 before F7:** Classification is a prerequisite -- deck structures query examples by touch type. F6 also lets users start classifying content while F7 is built.
- **F7 last:** Highest complexity, most dependencies, and benefits from accumulated classified examples.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (element map extraction):** Google Slides API `fields` parameter syntax for masking pageElements is not trivial. Test field masks against real presentation responses to confirm correct syntax before implementation. Also audit rate budget across thumbnails + element extraction combined.
- **Phase 3 (deck structure AI):** LLM prompt engineering for structured deck outline responses needs iteration. The "refine" endpoint's system prompt must be carefully designed to produce valid DeckSection[] JSON consistently.

Phases with standard patterns (skip research-phase):
- **Phase 1 (UX polish):** All three features use well-documented, established patterns already proven in the codebase (GCS thumbnail caching, useOptimistic, server-side polling). No research needed.
- **Phase 2 (descriptions + classification):** Rich descriptions extend existing Gemini classification prompt. Classification is a standard Prisma column + UI dropdown. Standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All features verified against existing installed packages and codebase. |
| Features | HIGH | All 7 features mapped from milestone spec with clear implementation paths. Dependency chain validated. Competitor analysis confirms element map approach is novel. |
| Architecture | HIGH | Deep codebase analysis of all affected files (~15 source files reviewed). Integration points are precise (file + line references). Build order accounts for all dependencies. |
| Pitfalls | HIGH | 8 pitfalls identified with codebase-verified root causes. Google API limitations confirmed via official docs and issue tracker. Prisma vector constraint confirmed via GitHub issue. |

**Overall confidence:** HIGH

### Gaps to Address

- **Element map field masking syntax:** The exact `fields` parameter string for presentations.get that returns only needed pageElement properties needs to be tested against a real Google Slides API response. Documentation shows the pattern but complex nested field masks can be tricky.
- **Backfill strategy for existing slides:** 38 slides ingested before v1.5 will lack descriptions and element maps. Need a backfill approach (background re-ingestion job vs on-demand re-classification). Not yet designed.
- **Deck structure prompt engineering:** The system prompt for deck structure AI inference and chat refinement needs iteration with real examples. Cannot be fully designed until classified examples exist.
- **Multiple browser tab polling:** If users have Discovery and Templates open simultaneously, polling doubles. Consider using Page Visibility API to pause polling in background tabs. Not yet implemented.

## Sources

### Primary (HIGH confidence)
- [Google Slides API -- Page Elements](https://developers.google.com/workspace/slides/api/concepts/page-elements) -- 8 element types, properties, placeholder types
- [Google Slides API -- Pages Resource](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages) -- full response schema
- [Google Drive API -- File Metadata](https://developers.google.com/workspace/drive/api/guides/file-metadata) -- thumbnailLink behavior, hasThumbnail, iconLink
- [Google Slides API Usage Limits](https://developers.google.com/workspace/slides/api/limits) -- 60/min expensive reads, 600/min regular reads
- [React 19 useOptimistic](https://react.dev/reference/react/useOptimistic) -- official hook documentation
- [Prisma 7.x vector regression](https://github.com/prisma/prisma/issues/28867) -- confirmed breaking change
- Codebase: `slide-extractor.ts`, `gcs-thumbnails.ts`, `classify-metadata.ts`, `ingest-template.ts`, `api-client.ts`, `discovery-client.tsx`, `template-card.tsx`, `schema.prisma`

### Secondary (MEDIUM confidence)
- [Drive API thumbnailLink 404 issues](https://issuetracker.google.com/issues/229184403) -- known instability with short-lived URLs
- [RTK Query polling race condition](https://github.com/reduxjs/redux-toolkit/issues/1512) -- documented pattern matching optimistic UI pitfall
- [Beautiful.ai Smart Slides](https://www.beautiful.ai/smart-slides) -- competitor structure approach (predefined, not inferred)
- [Optimistic UI Architecture Patterns](https://javascript.plainenglish.io/optimistic-ui-in-frontend-architecture-do-it-right-avoid-pitfalls-7507d713c19c) -- rollback and idempotency patterns

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
