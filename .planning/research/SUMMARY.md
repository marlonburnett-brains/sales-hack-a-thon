# Project Research Summary

**Project:** Lumenalta Agentic Sales Orchestration v1.7 -- Deals & HITL Pipeline
**Domain:** Deal management pipeline with AI-powered artifact generation for agentic sales platform
**Researched:** 2026-03-08
**Confidence:** HIGH

## Executive Summary

v1.7 transforms the platform from a content-generation tool into a deal-management platform. The core addition is a deal pipeline with stage lifecycle, sub-page navigation within each deal, persistent AI chat, and a 3-stage HITL artifact generation workflow (Generate > Review > Approve) across all four touch types. The existing Mastra workflow infrastructure with suspend/resume, Google Drive integration, and Prisma data layer provide a solid foundation -- the work is primarily about extending established patterns rather than introducing new architectural paradigms.

The recommended approach centers on three pillars: (1) add explicit deal lifecycle state to the database as a first-class field (not derived from interactions), (2) restructure the deal detail view from a single page into a layout with routed sub-pages hosting a persistent chat bar, and (3) formalize the currently-inline LLM calls into named Mastra Agent instances with DB-backed system prompts. The stack additions are minimal -- `@dnd-kit` for kanban drag-and-drop, `@mastra/editor` for agent config versioning, and several shadcn/ui components. No new databases, no new infrastructure services, no WebSocket layer.

The primary risks are: concurrent workflow execution on the same deal causing race conditions in Drive folder creation and status updates; Prisma migration failures from batching too many schema changes; and agent prompt versioning without runtime pinning causing inconsistent outputs across workflow suspend/resume boundaries. All three are preventable with well-scoped migrations, transactional state updates, and capturing the agent config version at workflow start time.

## Key Findings

### Recommended Stack

The existing stack (Next.js 15, Mastra 1.8, Prisma 6.x, Supabase PostgreSQL, googleapis) is unchanged. Only 4 new npm packages are needed: `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` for kanban drag-and-drop in the pipeline view, plus `@mastra/editor` for agent config versioning and persistence. Eight new shadcn/ui components (breadcrumb, tooltip, scroll-area, sheet, switch, table, command, resizable) provide UI primitives with no additional npm dependencies beyond auto-installed Radix primitives.

**Core new technologies:**
- `@dnd-kit/core` + `sortable` + `utilities`: Kanban board drag-and-drop -- standard React DnD library for 2025-2026, accessible, lightweight, React 19 compatible
- `@mastra/editor@^0.7.0`: Agent config versioning and persistence -- first-party Mastra package, uses existing PostgresStore, peer-compatible with current stack
- Prisma new models (Artifact, AgentConfig, AgentConfigVersion): Deal pipeline fields, HITL artifact tracking, and agent versioning -- forward-only migrations per CLAUDE.md

**Critical version note:** Stay on Prisma 6.x. Prisma 7.x has a vector migration regression (#28867).

### Expected Features

**Must have (table stakes):**
- Deal status lifecycle with 5 fixed pipeline stages
- Deal list with filtering, status indicators, and board/list view toggle
- Deal detail navigation overhaul with breadcrumbs and sidebar sub-pages
- Per-touch artifact pages with 3-stage HITL workflow (Configure > Review > Approve)
- Google Drive artifact saving with per-deal/per-touch folder structure and domain-scoped sharing
- AI chat for deal context with persistent message history and streaming responses

**Should have (differentiators):**
- Persistent AI chat bar surviving sub-page navigation within a deal (not just per-page chat)
- Named agent architecture with dedicated system prompts per agent type
- Agent management UI with versioning and draft/publish system
- Cross-touch context carry-forward in chat responses
- Deal briefing consolidation page

**Defer (v2+):**
- Custom pipeline stages per team
- Chat history search across deals
- Automated stage transitions based on interaction completion
- A/B testing for agent prompts
- Email notifications on HITL checkpoints

### Architecture Approach

The architecture extends the existing monorepo (apps/web + apps/agent) without introducing new services. The deal detail view becomes a Next.js layout at `deals/[dealId]/layout.tsx` hosting breadcrumb navigation, sidebar sub-nav, and a persistent chat bar -- all sub-pages (overview, briefing, touch-1 through touch-4) render within this layout, preserving chat state across navigation. Named Mastra agents replace inline LLM calls in workflows, with DB-backed system prompts loaded via async `instructions` functions with in-memory caching. Chat persistence uses Mastra Memory with PostgresStore (thread per deal, no custom ChatMessage model needed). The HITL 3-stage flow reuses the proven suspend/resume pattern from Touch 4, extended to Touches 1-3 with per-touch stage counts (Touch 1-2 need 1 gate, Touch 3 needs 1-2, Touch 4 keeps 3).

**Major components:**
1. Deal Pipeline Page -- list/board view toggle with filtering, stage badges, drag-and-drop stage changes
2. Deal Detail Layout -- sub-page routing, breadcrumbs, DealContextProvider, persistent chat bar host
3. Named Agent System -- 5 agents (deal-chat, brief-generator, content-selector, pager-generator, deck-assembler) with DB-backed versioned prompts
4. HITL Touch Sub-pages -- per-touch artifact generation with configurable suspend/resume gates
5. Agent Management Settings -- prompt editor with draft/publish versioning and rollback

### Critical Pitfalls

1. **Concurrent workflow race conditions** -- Multiple touch workflows running on the same deal can race on Drive folder creation and Deal status updates. Prevent with `SELECT FOR UPDATE` on the Deal row around shared state mutations and per-workflow InteractionRecord isolation.

2. **Deal status as implicit state machine** -- Without an explicit `Deal.status` column, different views compute status differently from InteractionRecord scans. Add the column in the foundation phase, update it transactionally within workflow steps.

3. **Agent prompt versioning without runtime pinning** -- Editing a prompt mid-workflow causes steps before and after a suspend point to use different prompt versions. Capture `agentConfigVersionId` at workflow start; read from context at resume, never from "current" DB record.

4. **Prisma migration drift from batched models** -- Adding 5-8 models in one migration risks partial-apply failures with no rollback. One migration per logical unit, `--create-only` to inspect SQL, separate "alter existing" from "create new" migrations.

5. **Navigation refactor breaking existing review routes** -- Existing `/deals/[dealId]/review/[briefId]` and `/asset-review/[interactionId]` routes are URL contracts (stored in alerts, bookmarks). Keep them as routes within the new layout or add permanent redirects.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Deal Model Extensions + Pipeline View
**Rationale:** Deal status lifecycle is the dependency root -- pipeline views, filtering, dashboard, and HITL stages all require deals to have explicit stage and status fields. Ship first to unblock everything else.
**Delivers:** Explicit `Deal.status` and `Deal.stage` columns, pipeline constants in shared schemas, deals list page with table/board view toggle and filtering, PATCH endpoint for deal updates.
**Addresses:** Deal status lifecycle, deal list with filtering, pipeline view toggle (table stakes).
**Avoids:** Pitfall 3 (implicit state machine) by establishing explicit status from day one.

### Phase 2: Deal Detail Layout + Sub-Page Restructure
**Rationale:** Every feature inside a deal (overview, briefing, touch pages, chat bar) requires the sub-page routing structure to exist. This is the mounting point for everything that follows.
**Delivers:** `[dealId]/layout.tsx` with sidebar nav + breadcrumbs, DealContextProvider, overview sub-page (migrated from current page), briefing page placeholder, touch-1 through touch-4 placeholders.
**Addresses:** Breadcrumb navigation, deal detail sidebar sub-navigation, deal overview dashboard, deal briefing page (table stakes).
**Avoids:** Pitfall 9 (breaking existing review routes) by keeping existing routes within the new layout.

### Phase 3: Named Agent Architecture + Agent Config Models
**Rationale:** Chat bar, touch pages, and agent management UI all depend on named agents existing. Define agents before building features that use them. This also establishes the DB-backed prompt versioning model that the Settings UI will later expose.
**Delivers:** Named Mastra Agent definitions (5 agents), AgentConfig + AgentConfigVersion Prisma models, agent-config.ts with DB loading + caching, agent registration in Mastra instance, seed data for default prompts.
**Addresses:** Named agent architecture (differentiator), foundation for agent management UI.
**Avoids:** Pitfall 7 (god object registry) by defining agents as configuration objects, not runtime entities. Pitfall 5 (prompt versioning without pinning) by establishing immutable version records from the start.

### Phase 4: Persistent AI Chat Bar
**Rationale:** High-visibility differentiator. With the layout and agents in place, the chat bar can be mounted and connected. Delivers immediate user value while touch pages are still being built.
**Delivers:** Chat components (bar, message list, input, useChat hook), POST /api/chat streaming endpoint, chat history retrieval, Mastra Memory integration with PostgresStore.
**Addresses:** AI chat for deal context (table stakes), persistent chat bar across sub-pages (differentiator).
**Avoids:** Pitfall 2 (chat scoping confusion) by using Mastra Memory thread-per-deal with touch context from URL segment.

### Phase 5: Touch 1-4 Sub-Pages with 3-Stage HITL
**Rationale:** Core product value -- this is what makes v1.7 a deal-management platform rather than a content-generation tool. Depends on agents (Phase 3) and sub-page routing (Phase 2).
**Delivers:** Four touch sub-pages with artifact-stage-stepper UI, modified touch workflows using named agents, suspend/resume gates with per-touch stage counts (1 gate for Touch 1-2, 1-2 for Touch 3, 3 for Touch 4).
**Addresses:** Per-touch artifact pages, 3-stage HITL generation workflow (table stakes).
**Avoids:** Pitfall 8 (uniform HITL stages for simple flows) by designing per-touch stage counts. Pitfall 1 (concurrent workflow races) by isolating per-workflow state.

### Phase 6: Google Drive Artifact Saving + Sharing
**Rationale:** Completes the HITL loop -- the "Save" stage in Phase 5 needs Drive integration to function. Extend existing `drive-folders.ts` rather than building new infrastructure.
**Delivers:** Per-deal/per-touch subfolder creation, domain-scoped sharing (@lumenalta.com), Drive links in completion UI, replacement of `makePubliclyViewable` with scoped permissions.
**Addresses:** Google Drive artifact saving with organized folders, domain-scoped sharing (table stakes + differentiator).
**Avoids:** Pitfall 6 (permissions cascading incorrectly) by defining a clear sharing model upfront.

### Phase 7: Settings Agent Management UI
**Rationale:** Downstream of everything -- configures agents that must already exist and be working. Can be built in parallel with Phases 5-6 if resources allow.
**Delivers:** Settings > Agents page with agent list, prompt editor with markdown support, version history with text diff, draft/publish workflow, cache invalidation on publish.
**Addresses:** Agent management UI with versioning (differentiator).
**Avoids:** Pitfall 5 (versioning without pinning) by building on the immutable version records established in Phase 3.

### Phase Ordering Rationale

- **Dependency-driven:** Deal status (Phase 1) -> Sub-page routing (Phase 2) -> Named agents (Phase 3) follows the strict dependency chain identified in FEATURES.md. Each phase unblocks the next.
- **Value-first:** Chat bar (Phase 4) ships before touch pages (Phase 5) because it delivers immediate visible value to sellers while the more complex HITL workflows are being built.
- **Risk-front-loaded:** The highest-risk items (schema migrations, architectural patterns, agent definitions) ship in Phases 1-3 before the high-complexity integration work in Phases 5-6.
- **Pitfall-aware:** Concurrent workflow races (Pitfall 1) are addressed in Phase 1's schema design before any workflows are modified. Navigation breakage (Pitfall 9) is handled in Phase 2 before sub-pages are added.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Named Agents):** `@mastra/editor` integration with existing PostgresStore is not fully documented. Verify during planning whether the editor can share a PostgresStore instance and whether it ships its own React components or is API-only.
- **Phase 4 (Chat Bar):** Mastra Memory thread management API surface needs validation -- confirm thread listing, message retrieval for UI display, and context window behavior with the PostgresStore backend.
- **Phase 5 (HITL Touch Pages):** Per-touch HITL stage design requires examining each existing workflow's suspend/resume points to determine which can be simplified vs. extended.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Deal Model + Pipeline):** Well-documented Prisma migration patterns + shadcn table/kanban components. Standard CRM patterns.
- **Phase 2 (Deal Detail Layout):** Standard Next.js App Router layout patterns. Well-established in existing codebase.
- **Phase 6 (Drive Integration):** Extends existing `drive-folders.ts` with documented Google Drive API calls. Existing credential chain handles auth.
- **Phase 7 (Agent Management UI):** Standard CRUD settings page with version history. shadcn components cover all UI needs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm registry. Version compatibility confirmed. Minimal new dependencies. |
| Features | HIGH | Feature landscape well-understood from existing codebase analysis and established CRM patterns. Clear dependency chain. |
| Architecture | HIGH | Extends proven patterns (Next.js layouts, Mastra workflows, Prisma models). No new architectural paradigms. |
| Pitfalls | HIGH | Identified from direct codebase analysis of all affected code paths. Concrete line-number references to existing issues. |

**Overall confidence:** HIGH

### Gaps to Address

- **@mastra/editor API surface:** Documentation is sparse on whether it ships React components or is API-only, and whether it can share an existing PostgresStore instance. Validate during Phase 3 planning; fallback is custom AgentConfig + AgentConfigVersion Prisma models (design already in ARCHITECTURE.md).
- **Mastra Memory thread retrieval for UI:** Unclear whether Mastra Memory exposes a client-friendly API for listing threads and retrieving message history for display (vs. just feeding context to the LLM). If not, may need raw SQL queries against the `mastra` schema or a thin wrapper. Validate during Phase 4 planning.
- **Touch 1-3 workflow complexity assessment:** The research recommends per-touch HITL stage counts (1 gate for Touch 1-2, 1-2 for Touch 3) but the exact workflow modifications need per-workflow analysis during Phase 5 planning.
- **Google Drive sharing model decision:** Research flags the need to replace `makePubliclyViewable` with domain-scoped sharing, but the impact on existing iframe previews needs testing. If restricted sharing breaks previews, a server-side proxy endpoint may be needed. Decide during Phase 6 planning.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `prisma/schema.prisma` (14 models), `drive-folders.ts`, `touch-4-workflow.ts` (17 steps, 3 suspend points), `mastra/index.ts`, `api-client.ts`, deal pages, settings pages
- npm registry verification: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@mastra/editor@0.7.0`
- CLAUDE.md: Prisma migration discipline constraints
- PROJECT.md: v1.7 milestone scope and constraints

### Secondary (MEDIUM confidence)
- [Mastra Agent docs](https://mastra.ai/docs/agents/overview) -- named agent registration and async instructions
- [Mastra Agent Memory](https://mastra.ai/docs/agents/agent-memory) -- thread-based memory with PostgresStore
- [Mastra HITL Workflows](https://mastra.ai/docs/workflows/human-in-the-loop) -- suspend/resume patterns
- [@dnd-kit](https://dndkit.com/) -- React 19 compatibility, accessibility
- [Google Drive Permissions API](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) -- domain-scoped sharing
- CRM feature analysis: Pipedrive, HubSpot, monday.com pipeline patterns

### Tertiary (LOW confidence)
- `@mastra/editor` integration with shared PostgresStore -- needs validation during implementation
- `@mastra/editor` UI component surface -- unclear if API-only or ships React components
- Mastra Memory message retrieval API for UI display -- needs validation

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
