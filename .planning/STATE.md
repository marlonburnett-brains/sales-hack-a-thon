---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: AtlusAI Authentication & Discovery
status: executing
stopped_at: "Completed quick-8: add gpt-oss-120b as primary classification"
last_updated: "2026-03-07T02:33:50.101Z"
last_activity: "2026-03-07 - Completed quick task 7: ingestion failed templates should have the re-ingest option available"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 10
  completed_plans: 9
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** Phase 28 -- MCP Integration

## Current Position

Phase: 29 of 29 (Discovery UI)
Plan: 2 of 3 in current phase
Status: In Progress
Last activity: 2026-03-07 - Completed quick task 9: Cache Google Slides thumbnails in GCS

Progress: [██████████] 95%

## Performance Metrics

**Velocity:**
- Total plans completed: 53 (v1.0: 27, v1.1: 6, v1.2: 10, v1.3: 10)
- Total project time: ~4 days (2026-03-03 -> 2026-03-06)
- Total LOC: ~30,203 TypeScript/TSX

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table (28 decisions total).

- Phase 27-01: Used generic `encryptedToken` field name (not `encryptedRefresh`) since AtlusAI auth mechanism is TBD
- Phase 27-01: Manual migration with `resolve --applied` due to 0_init checksum drift (never reset per project rules)
- Phase 27-02: Cloned getPooledGoogleAuth pattern for AtlusAI -- same ordering, fire-and-forget, health check approach
- Phase 27-02: No ActionRequired on pool failure -- deferred to Plan 27-03 per spec
- Phase 27-03: Network errors in AtlusAI probes treated as auth failure (safe default)
- Phase 27-03: Missing ATLUS_PROJECT_ID skips project check (avoids false positives in dev)
- Phase 27-03: detectAtlusAccess fires fire-and-forget on POST /tokens to avoid delaying login
- Phase 27-04: Re-check Access button disabled with TODO for phase-28 -- Google OAuth provider_token not available from Supabase session
- Phase 27-04: Silenced items kept visible with opacity-50 dimming rather than filtered out
- Phase 27-04: Optimistic UI update on silence with revert on error
- Phase 28-01: Thin fetch callback for MCPClient -- only injects Bearer header, refresh/rotate in wrapper
- Phase 28-01: Token refresh mutex (refreshPromise) serializes concurrent 401 recovery
- Phase 28-01: Used `{} as never` for tool.execute() second arg -- MastraToolInvocationOptions internal type
- Phase 28-02: LLM extraction always used for MCP results (consistency over cost savings per user decision)
- Phase 28-02: Multi-pass searchForProposal() preserved unchanged -- semantic search improves individual passes but multi-pass provides topic diversity
- Phase 28-02: Adaptive prompt: first call discovers MCP result shape, caches template for subsequent calls
- Phase 28-02: On LLM extraction failure: return empty array (graceful degradation)
- Phase 29-01: Module-level Map for batch ingestion state (simple, in-memory, sufficient for single-instance agent)
- Phase 29-01: templateId='atlus-discovery' synthetic marker for discovery-originated SlideEmbedding records
- Phase 29-01: Skipped LLM classification in discovery ingest (stores raw metadata, can be enriched later)
- [Phase 29]: Used slideId-based ingestion check instead of client-side SHA-256 hashing
- [Phase quick-8]: Fresh OpenAI client per call for gpt-oss (Vertex AI access tokens are short-lived, google-auth-library caches internally)

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2 | Prisma Client Singleton Tech Debt | 2026-03-06 | c9fcacc | [2-prisma-client-singleton-tech-debt](./quick/2-prisma-client-singleton-tech-debt/) |
| 3 | Auto-populate Template Name from Google Slides | 2026-03-06 | ce26721 | [3-auto-populate-template-name-from-google-](./quick/3-auto-populate-template-name-from-google-/) |
| 4 | Make Touch Type Selection Optional | 2026-03-06 | bb4803c | [4-make-touch-type-selection-optional-when-](./quick/4-make-touch-type-selection-optional-when-/) |
| 5 | Rewrite All Gemini References to LLM-Agnostic | 2026-03-06 | 0da192b | [5-rewrite-all-gemini-references-and-relate](./quick/5-rewrite-all-gemini-references-and-relate/) |
| 6 | Fix Template Re-ingest Auto-Navigation & Add Breadcrumbs | 2026-03-07 | 75256c4 | [6-fix-template-re-ingest-auto-navigation-a](./quick/6-fix-template-re-ingest-auto-navigation-a/) |
| 7 | Add Re-ingest Option for Failed Templates | 2026-03-07 | 8e900b0 | [7-ingestion-failed-templates-should-have-t](./quick/7-ingestion-failed-templates-should-have-t/) |
| 8 | Add gpt-oss-120b as Primary Classification | 2026-03-07 | 80f7e1a | [8-add-gpt-oss-120b-as-primary-classificati](./quick/8-add-gpt-oss-120b-as-primary-classificati/) |
| 9 | Cache Google Slides Thumbnails in GCS | 2026-03-07 | 40fc6d6 | [9-cache-google-slides-thumbnails-in-gcs](./quick/9-cache-google-slides-thumbnails-in-gcs/) |
| Phase 28 P02 | 9min | 2 tasks | 2 files |
| Phase 29 P02 | 4min | 2 tasks | 1 files |

### Blockers/Concerns

- **BLOCKING:** AtlusAI SSE endpoint auth mechanism unknown -- Phase 27 Plan 1 must discover this first
- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking)
- Prisma version constraint: Stay on 6.19.x -- Prisma 7.x has vector migration regression (#28867)
- MCPClient must live ONLY on agent (Railway) -- Vercel serverless kills SSE connections
- Drive fallback must be retained behind env flag during MCP cutover

## Session Continuity

Last session: 2026-03-07T02:33:46.023Z
Stopped at: Completed quick-9: cache google slides thumbnails in GCS
Next action: Execute 29-02-PLAN.md (Browse/Search UI)
