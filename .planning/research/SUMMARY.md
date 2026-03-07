# Project Research Summary

**Project:** AtlusAI Agentic Sales Orchestration -- v1.6 Touch 4 Artifact Intelligence
**Domain:** Artifact type sub-classification and per-artifact deck structures for existing sales intelligence platform
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

v1.6 extends the existing deck intelligence system to recognize that Touch 4 produces three distinct artifact types -- Proposal decks, Talk Tracks, and Buyer FAQs -- rather than treating all Touch 4 examples as a single undifferentiated pool. The core problem is simple: the current system infers one deck structure per touch type, but Touch 4's three output formats have fundamentally different section flows. Mixing them in a single inference produces incoherent structures. The fix requires zero new dependencies and builds entirely on existing infrastructure: two Prisma schema migrations (adding `artifactType` columns to `Template` and `DeckStructure`), logic changes to the inference engine/cron/chat refinement pipeline, and UI changes to the classify popover and Settings page.

The recommended approach is a composite key pattern: replace the single-column `touchType @unique` constraint on `DeckStructure` with `@@unique([touchType, artifactType])`. Touch 1-3 keep `artifactType = null` (unchanged behavior). Touch 4 gets up to three rows: one per artifact type. This is the minimal schema evolution that cleanly separates the three artifact structures while preserving backward compatibility. The same nullable `artifactType` column is added to `Template` for classification filtering.

The primary risk is the cascading impact of changing the `DeckStructure` unique constraint. At least 6 call sites use `findUnique({ where: { touchType } })`, and every one breaks after the schema change. The cron, inference engine, chat refinement, and all API routes must be updated atomically. The mitigation is clear phasing: land the schema migration first (including cleanup of the old mixed Touch 4 row), then update all backend consumers, then wire up the frontend. There are no ambiguous technical decisions -- all four research files converge on the same approach.

## Key Findings

### Recommended Stack

No new packages. No new infrastructure. No new API providers. Every capability needed for v1.6 is already installed in the monorepo. The work is purely schema evolution, logic changes, and UI extension.

**Core technologies (unchanged):**
- **Prisma 6.19.x**: ORM and migrations -- extended with `artifactType` columns and composite unique constraint
- **@google/genai 1.43.x**: Gemini structured output for deck inference -- only prompt text changes, schema unchanged
- **@radix-ui/react-tabs 1.1.x**: Already installed -- reused for Touch 4 artifact sub-tabs in Settings
- **@lumenalta/schemas**: Shared constants package -- extended with `ARTIFACT_TYPES` constant

**Critical version note:** Prisma `@@unique([touchType, artifactType])` with nullable columns works correctly in PostgreSQL 15 (`NULLS DISTINCT` is default). Use `--create-only` to verify Prisma does not generate `NULLS NOT DISTINCT`.

### Expected Features

**Must have (table stakes -- P1):**
- **F1: Artifact type selector in classify UI** -- conditional radio group when Touch 4 Example selected
- **F2: Artifact type persisted on Template model** -- nullable `artifactType` column, forward-only migration
- **F3: Artifact type visible on template cards** -- "Example (Touch 4+, Proposal)" labeling
- **F4: Three deck structure views for Touch 4** -- tabbed Settings page (Proposal / Talk Track / FAQ)
- **F5: Independent inference per artifact type** -- composite key upsert, filtered example queries
- **F7: Per-artifact chat refinement** -- chat scoped to specific artifact type structure
- **F8: Cron per artifact type** -- three separate inference runs for Touch 4 per cycle

**Should have (falls out naturally -- P1):**
- **F6: Per-artifact confidence scoring** -- no new logic, just filtered example counts

**Defer (v1.7+):**
- **F9: Template list artifact type filter** -- nice to have, not essential
- AI-suggested artifact type classification
- Cross-artifact structural comparison
- Custom artifact types beyond the fixed three

### Architecture Approach

The architecture adds a single new dimension (`artifactType`) threaded through four existing layers: data model (Prisma), inference engine (Gemini), API routes (Hono), and UI (Next.js). No new components or services. The composite key pattern on `DeckStructure` is the linchpin -- it enables per-artifact structures while preserving Touch 1-3 behavior unchanged. The UI uses tabs within the existing Touch 4 Settings page rather than new routes, keeping the information architecture clean.

**Major components modified:**
1. **Template model** -- adds `artifactType` column for classification storage
2. **DeckStructure model** -- adds `artifactType` column + composite unique constraint for per-artifact structures
3. **Inference engine** (`infer-deck-structure.ts`) -- accepts `artifactType` param, filters examples, uses composite key upsert
4. **Cron job** (`auto-infer-cron.ts`) -- expands Touch 4 loop to iterate three artifact types
5. **Chat refinement** (`chat-refinement.ts`) -- threads `artifactType` through entire chain
6. **API routes** (`mastra/index.ts`) -- adds `?artifactType=` query param to deck structure endpoints
7. **Classify UI** (`template-card.tsx`) -- conditional artifact type selector
8. **Settings UI** (`deck-structure-view.tsx`) -- tabbed Touch 4 page with per-artifact detail views

### Critical Pitfalls

1. **DeckStructure unique constraint breaks 6+ call sites** -- Every `findUnique({ where: { touchType } })` must be updated to use the composite key `{ touchType_artifactType: { touchType, artifactType } }`. Miss even one and you get runtime failures. Audit all consumers before shipping the migration.

2. **Cron treats Touch 4 as one unit instead of three** -- The cron loop iterates `DECK_TOUCH_TYPES` which has one "touch_4" entry. Must expand to iterate three artifact types for Touch 4. Without this, only one artifact type gets inferred.

3. **Data hash collision across artifact types** -- `computeDataHash` does not include artifact type, so all three Touch 4 types produce identical hashes. Cron skips re-inference or redundantly re-infers all three. Include `artifactType` in both the hash input and the example query filter.

4. **Inference conflates examples across artifact types** -- Without filtering by `artifactType`, Gemini sees all Touch 4 examples mixed together and produces incoherent structures. The query AND the prompt must be artifact-type-aware.

5. **Existing Touch 4 DeckStructure row becomes stale** -- The old mixed-data row must be deleted in the migration. Its chat context contains cross-artifact constraints that would pollute artifact-specific inference. Accept the one-time loss of Touch 4 chat history.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Schema + Constants Foundation

**Rationale:** Everything depends on the data model. The composite unique constraint on `DeckStructure` and the `artifactType` column on `Template` are prerequisites for all other work. Landing this first means all subsequent phases can build on stable schema.

**Delivers:**
- `ARTIFACT_TYPES` constant in `@lumenalta/schemas`
- `artifactType` column on `Template` model (migration 1)
- `artifactType` column on `DeckStructure` + composite `@@unique([touchType, artifactType])` (migration 2)
- Cleanup of existing Touch 4 DeckStructure row (in migration 2)

**Addresses:** F2 (artifact type on Template model)
**Avoids:** Pitfall 1 (unique constraint), Pitfall 3 (hash collision foundation), Pitfall 8 (stale Touch 4 data)

### Phase 2: Backend Engine + API Routes

**Rationale:** Backend must be ready before frontend can consume it. The inference engine, cron, chat refinement, and API routes form a tight cluster that should be updated together -- they all share the same `artifactType` parameter threading.

**Delivers:**
- `inferDeckStructure()` accepts and filters by `artifactType`
- `computeDataHash()` includes `artifactType` in hash
- `auto-infer-cron.ts` iterates artifact types for Touch 4
- `streamChatRefinement()` uses composite key
- `POST /templates/:id/classify` accepts `artifactType`
- All deck structure API routes accept `?artifactType=` query param
- `GET /deck-structures` returns 6 entries (3 for Touch 4)

**Addresses:** F5 (independent inference), F7 (per-artifact chat), F8 (cron per artifact type)
**Avoids:** Pitfall 2 (cron single unit), Pitfall 3 (hash collision), Pitfall 4 (mixed inference), Pitfall 5 (chat wrong scope)

### Phase 3: Frontend UI

**Rationale:** Frontend is the final layer that consumes all backend changes. The classify UI and Settings UI changes depend on the API endpoints being ready.

**Delivers:**
- Artifact type selector in classify popover (conditional on Touch 4 Example)
- Updated classification labels ("Example (Touch 4+, Proposal)")
- `api-client.ts` updated with `artifactType` on all deck structure functions
- Touch 4 Settings page with Proposal / Talk Track / FAQ tabs
- Each tab has independent structure display, confidence badge, and chat bar
- `deck-structure-actions.ts` passes `artifactType` through

**Addresses:** F1 (classify UI), F3 (labels), F4 (Settings views), F6 (per-artifact confidence)
**Avoids:** Pitfall 6 (missing artifact type UI), Pitfall 7 (Settings routing assumes 1:1)

### Phase Ordering Rationale

- **Schema first** because every subsequent change depends on the `artifactType` column existing and the composite unique constraint being in place. Attempting backend changes before the migration causes compile errors.
- **Backend second** because the inference engine, cron, and API routes form a dependency cluster. The cron calls inference, inference uses the composite key, chat uses the composite key, and API routes wire it all to HTTP. They must be updated together.
- **Frontend last** because it is pure consumer of backend APIs. No frontend change is meaningful without the backend endpoints accepting `artifactType`.
- **All three phases avoid the biggest pitfall** (unique constraint breakage) by sequencing the migration before any code that depends on the new schema.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Schema):** Needs `/gsd:research-phase` to verify Prisma generates correct `NULLS DISTINCT` behavior on the composite unique index. Use `--create-only` and inspect SQL. PostgreSQL 15 default is correct, but Prisma 6.19.x behavior should be confirmed.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Backend):** All changes are parameter threading through existing functions. Well-understood patterns, direct codebase analogs exist for every change.
- **Phase 3 (Frontend):** Conditional UI rendering, tab components, and API client updates are all established patterns in this codebase. No novel work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All packages already installed and verified in production. |
| Features | HIGH | All features build directly on v1.5 infrastructure. Clear implementation paths with existing code analogs. |
| Architecture | HIGH | Every affected file was read directly. All integration points documented with line numbers. |
| Pitfalls | HIGH | Based on direct codebase analysis of all 13+ affected files. Every pitfall maps to specific code paths. |

**Overall confidence:** HIGH

### Gaps to Address

- **PostgreSQL NULLS DISTINCT verification:** Must confirm Prisma 6.19.x migration output. Low risk (PG 15 default is correct) but must be verified with `--create-only` before applying.
- **Auto-classify vs manual artifact type:** ARCHITECTURE.md suggests extending `auto-classify-templates.ts` to include `artifactType` in LLM classification. FEATURES.md lists AI-suggested artifact type as an anti-feature. Recommendation: do NOT auto-classify artifact type in v1.6 -- keep it manual. If auto-classify is extended later, treat it as a separate enhancement.
- **Touch 4 Settings empty state UX:** When no Touch 4 examples are classified with artifact types, the tabbed view shows three empty tabs. Consider a single helpful message instead of three empty states. Handle during Phase 3 UI implementation.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all affected files: `schema.prisma`, `infer-deck-structure.ts`, `chat-refinement.ts`, `auto-infer-cron.ts`, `template-card.tsx`, `deck-structure-view.tsx`, `touch-type-detail-view.tsx`, `api-client.ts`, `template-utils.ts`, `deck-structure-actions.ts`, `constants.ts`, `mastra/index.ts`, `auto-classify-templates.ts`
- PostgreSQL 15 documentation on NULLS DISTINCT in unique indexes
- Prisma 6.x documentation on compound unique constraints
- PROJECT.md milestone definitions

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
