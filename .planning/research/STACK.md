# Stack Research

**Domain:** Deal management pipeline, HITL artifact generation, AI chat, agent management for agentic sales platform
**Researched:** 2026-03-08
**Confidence:** HIGH

## Scope

This covers only NEW additions/changes for v1.7 (Deals and HITL Pipeline). The existing stack (Next.js 15, Mastra 1.8, Prisma 6.x, shadcn/ui, Supabase, googleapis, etc.) is validated and unchanged. See v1.6 STACK.md history for prior research.

**Focus areas:**
1. Deal pipeline views (kanban + table toggle with drag-and-drop)
2. Persistent AI chat bar across deal sub-pages
3. HITL 3-stage artifact generation workflow
4. Google Drive folder/sharing integration enhancements
5. Formalized named agent architecture
6. Settings agent management UI with versioning and draft system

---

## Executive Summary

v1.7 requires **3 new npm packages** in `apps/web` and **1 new npm package** in `apps/agent`, plus several new shadcn/ui component files. The additions are:

- **`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** in web for kanban drag-and-drop
- **`@mastra/editor@^0.7.0`** in agent for agent config versioning and persistence

Everything else -- persistent chat, HITL workflows, Drive folder management, named agents -- uses existing installed packages and established patterns (Mastra workflows, googleapis, Server Actions with streaming, Prisma models).

---

## Recommended Stack (New Additions Only)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop for deal pipeline kanban board | The standard React DnD library for 2025-2026. Accessible (keyboard + screen reader), lightweight (~10KB gzip), works with React 19, proven with shadcn/ui + Tailwind. Replaces deprecated react-beautiful-dnd. |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable deal cards within pipeline stage columns | Companion to @dnd-kit/core. Handles reordering within columns and moving between columns (stage changes). |
| `@dnd-kit/utilities` | ^3.2.2 | CSS transform utilities for smooth drag animations | Required for visual drag feedback. Tiny dependency. |
| `@mastra/editor` | ^0.7.0 | Agent config versioning, persistence, and activation in DB | First-party Mastra package purpose-built for exactly the "settings agent management with versioning" requirement. Stores complete agent configs (instructions, model, tools) with version management and activation. Peer-compatible with our @mastra/core ^1.8.0 and zod ^4.x. Uses the same @mastra/pg PostgresStore we already run. |

### New shadcn/ui Components

These are added via `npx shadcn@latest add [name]`. No new npm dependencies -- they install as local component files using already-installed Radix primitives.

| Component | Radix Dependency | Purpose | Feature Area |
|-----------|-----------------|---------|--------------|
| `breadcrumb` | None (HTML nav) | Deal detail navigation: Deals > Company > Deal > Touch | Deal detail navigation overhaul |
| `tooltip` | `@radix-ui/react-tooltip` (new) | Pipeline card hover previews, action button labels, agent status hints | Pipeline view, agent management |
| `scroll-area` | `@radix-ui/react-scroll-area` (new) | Chat message history scrolling, kanban column overflow | Persistent chat bar, pipeline columns |
| `sheet` | Already installed as dialog variant | Slide-out panel for deal quick-view from pipeline, agent config editing | Pipeline actions, settings panels |
| `switch` | `@radix-ui/react-switch` (new) | Toggle agent active/inactive, draft/published | Agent management UI |
| `table` | None (HTML table + styling) | Deal listing table view, agent version history | Deals table view, agent versions |
| `command` | `cmdk` (new) | Deal search/filter, agent prompt search | Deal filtering, agent management |
| `resizable` | `react-resizable-panels` (new) | Chat bar height adjustment | Persistent chat bar resize |

### Prisma Schema Additions

New models and field additions (forward-only migrations per CLAUDE.md):

**Extend existing `Deal` model:**

| Field | Type | Purpose |
|-------|------|---------|
| `stage` | `String @default("discovery")` | Pipeline stage: "discovery" / "qualification" / "proposal" / "negotiation" / "closed_won" / "closed_lost" |
| `priority` | `String @default("medium")` | Deal priority for sorting: "low" / "medium" / "high" |
| `assignedTo` | `String?` | Supabase user ID of assigned seller |
| `expectedCloseDate` | `DateTime?` | For pipeline forecasting display |
| `stageChangedAt` | `DateTime?` | Track when deal moved to current stage |

**New `ChatMessage` model:**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `String @id @default(cuid())` | Primary key |
| `dealId` | `String` | FK to Deal -- scopes chat to a deal |
| `role` | `String` | "user" / "assistant" / "system" |
| `content` | `String` | Message text |
| `touchContext` | `String?` | Which touch page the message was sent from (for context) |
| `metadata` | `String?` | JSON: tool calls, citations, agent name, etc. |
| `createdAt` | `DateTime @default(now())` | Ordering |

**New `Artifact` model:**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `String @id @default(cuid())` | Primary key |
| `interactionId` | `String` | FK to InteractionRecord |
| `artifactType` | `String` | "proposal" / "talk_track" / "faq" / "briefing" / "pager" / "deck" |
| `stage` | `String @default("generating")` | HITL stage: "generating" / "draft" / "review" / "approved" / "rejected" / "revision" |
| `title` | `String` | Display name for the artifact |
| `content` | `String?` | JSON: structured content before Drive rendering |
| `driveFileId` | `String?` | Google Drive file ID once generated |
| `driveUrl` | `String?` | Direct link to Drive file |
| `reviewerName` | `String?` | Who reviewed this artifact |
| `reviewedAt` | `DateTime?` | When review completed |
| `reviewNotes` | `String?` | Reviewer feedback |
| `version` | `Int @default(1)` | Artifact revision number |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Why separate `Artifact` model instead of extending `InteractionRecord`:**
- A single Touch 4 interaction produces 3 artifacts (Proposal + Talk Track + FAQ), each with independent HITL stages
- Touch 1-3 interactions produce 1 artifact each, but the stage tracking pattern is the same
- Separating artifacts from interactions allows per-artifact review without JSON blob parsing
- Consistent with the existing decision to separate Transcript and Brief from InteractionRecord

---

## Installation

```bash
# In apps/web -- drag-and-drop for kanban pipeline
cd apps/web
pnpm add @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2

# shadcn components (these install Radix primitives as needed)
npx shadcn@latest add breadcrumb tooltip scroll-area sheet switch table command resizable

# In apps/agent -- agent config versioning
cd apps/agent
pnpm add @mastra/editor@^0.7.0

# Prisma migrations (after schema changes)
cd apps/agent
pnpm exec prisma migrate dev --create-only --name add-deal-pipeline-fields
# Inspect SQL, then apply
pnpm exec prisma migrate dev --name add-deal-pipeline-fields

pnpm exec prisma migrate dev --create-only --name add-chat-message-model
pnpm exec prisma migrate dev --name add-chat-message-model

pnpm exec prisma migrate dev --create-only --name add-artifact-model
pnpm exec prisma migrate dev --name add-artifact-model
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@dnd-kit/core` for kanban DnD | No DnD (click-to-move stage selector) | If kanban board is descoped to table-only view. Pipeline without DnD is functional; DnD is polish, not blocker. Can ship table-only first and add DnD later. |
| `@dnd-kit/core` | `react-beautiful-dnd` | Never -- deprecated since 2024, no React 19 support. |
| `@dnd-kit/core` | `react-dnd` | Never -- lower-level API, more boilerplate, weaker accessibility story. |
| `@mastra/editor` for agent versioning | Custom Prisma `AgentConfig` + `AgentVersion` models | If @mastra/editor proves too opinionated about storage schema or too tightly coupled to its own UI components. Custom models give full control but require building version diffing, activation logic, and dependency resolution manually. **Validate during phase research.** |
| `@mastra/editor` for agent versioning | JSON files in repo with deploy-time loading | Never for this project -- need runtime editing via Settings UI without redeployment. |
| Next.js App Router layout for persistent chat | React portal-based chat overlay | If chat needs to float over content rather than be docked to the layout. Layout approach is simpler and preserves state across sub-page navigation naturally via Next.js layout caching. |
| Prisma `ChatMessage` model for chat history | `@mastra/memory` package | If we later need sliding context windows, token counting, or conversation summarization for the agent. For now, `ChatMessage` is a UI chat log -- simple CRUD is sufficient. @mastra/memory adds unnecessary dependency complexity. |
| `cmdk` (via shadcn `command`) for search/filter | `@tanstack/react-table` for deal filtering | If deal list grows beyond ~100 rows with complex column sorting. For ~20 sellers with <50 active deals, shadcn table + command palette is simpler. |
| URL search params for filter/view state | Zustand/Jotai for global state | Never -- URL params are shareable, bookmarkable, and work with Next.js Server Components. No client state library needed. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Deprecated 2024, no React 19 support, unmaintained | `@dnd-kit/core` |
| `@mastra/memory` for chat persistence | Agent memory package for context windows, not UI chat logs. Adds complexity for simple message storage. | Prisma `ChatMessage` model |
| `react-dnd` | More boilerplate, weaker accessibility than @dnd-kit | `@dnd-kit/core` |
| Socket.io / Pusher for chat | Chat is user-to-AI, not multi-user real-time. Server Actions + streaming is sufficient and already proven. | Next.js Server Actions with streaming (same pattern as deck chat refinement) |
| `@tanstack/react-table` | Over-engineered for ~20 sellers. shadcn Table handles our scale. | shadcn `table` component |
| Zustand / Jotai / Redux | React Server Components + Server Actions + useState/useContext handle all patterns. URL params for shareable state. | React built-in state + URL search params |
| New database (Redis, etc.) for chat | PostgreSQL handles chat message storage at our scale. No need for a cache layer. | Prisma + existing Supabase PostgreSQL |
| Custom DnD implementation | Accessibility (ARIA, keyboard nav), touch support, and edge cases (scroll containers, overflow) are extremely hard to get right | `@dnd-kit/core` |
| Separate API service for agents | Agent management is part of the existing Mastra server. Adding a service adds deployment complexity for no benefit. | @mastra/editor integrated into existing agent server |

---

## Stack Patterns by Feature

### 1. Deal Pipeline View (Kanban + Table Toggle)

**Pattern:** URL-driven view toggle with @dnd-kit kanban

- Toggle between kanban and table via URL param: `?view=kanban` or `?view=table`
- Kanban uses `@dnd-kit/core` `DndContext` with `DragOverlay` for smooth cross-column dragging
- Each pipeline stage is a `SortableContext` column; deal cards are `useSortable` items
- Dropping a card into a different column triggers a Server Action to update `Deal.stage`
- Table view uses shadcn `table` with sortable column headers
- Filter state (stage, assignee, priority) stored in URL search params
- Deal stage stored as String column on Deal model (not separate table -- stages are fixed, not user-configurable)

### 2. Persistent AI Chat Bar

**Pattern:** Next.js nested layout with streaming Server Actions

- Chat bar lives in `/deals/[dealId]/layout.tsx` -- shared across all deal sub-pages (overview, briefing, touch-1, touch-2, etc.)
- Layout renders: `<DealSidebar />` + `<main>{children}</main>` + `<ChatBar dealId={dealId} />`
- ChatBar is a Client Component with `useState` for messages + `useRef` for scroll position
- Messages stored in Prisma `ChatMessage` model, loaded on mount, appended on send
- Streaming uses the same delimiter protocol as existing deck chat: text chunks then `---STRUCTURE_UPDATE---` then JSON
- Chat bar includes `touchContext` from current URL segment so the agent knows what page the user is on
- shadcn `scroll-area` for message history, `resizable` panel for height control
- No WebSocket needed -- POST Server Action streams response, same as deck intelligence chat

### 3. HITL 3-Stage Artifact Generation

**Pattern:** Extend existing Mastra suspend/resume workflow

- Reuses the proven `suspend/resume` pattern from Touch 4 workflow
- Three stages per artifact: Generate (AI produces draft) -> Review (human reviews) -> Approve/Reject
- New `Artifact` model tracks per-artifact stage independently
- A single Touch 4 interaction creates 3 Artifact rows (proposal, talk_track, faq)
- Touch 1-3 interactions create 1 Artifact row each
- Stage transitions happen via Server Actions that call agent API endpoints
- Workflow `suspend` at review stage; `resume` with approval/rejection decision
- Existing `InteractionRecord.status` becomes a computed rollup of its artifacts' stages

### 4. Google Drive Folder/Sharing Integration

**Pattern:** Extend existing drive-folders.ts

- No new packages -- `googleapis@^144.0.0` already installed with Drive v3 API
- Extend `getOrCreateDealFolder` to create sub-folders per touch type
- Folder hierarchy: `{Parent} / {Company - Deal} / Touch 1 / artifact.pptx`
- Add domain-scoped sharing: `permissions.create` with `type: "domain"`, `domain: "lumenalta.com"`, `role: "reader"`
- This replaces the current `makePubliclyViewable` (anyone with link) with org-scoped access
- Store `driveFolderId` on each `Artifact` row for direct linking
- Existing user-delegated OAuth credential chain handles auth (user token -> pool -> service account fallback)

### 5. Formalized Named Agent Architecture

**Pattern:** Mastra Agent class instances with @mastra/editor for runtime config

- Define named agents as Mastra `Agent` instances in `apps/agent/src/agents/`:
  - `briefing-agent` -- pre-call research and discovery question generation
  - `extraction-agent` -- transcript field extraction
  - `proposal-agent` -- brief generation, slide selection, deck assembly
  - `chat-agent` -- persistent deal chat (context-aware based on touch page)
  - `classification-agent` -- slide classification and deck structure inference
- Each agent has a dedicated system prompt, model config, and tool set
- Agents are registered in `apps/agent/src/mastra/index.ts` via the `agents` config
- `@mastra/editor` overlays runtime config on top of code-defined agents: edit system prompts, toggle models, version changes -- all persisted in PostgresStore
- Code defines the baseline; @mastra/editor enables runtime tuning without redeployment

### 6. Settings Agent Management UI

**Pattern:** @mastra/editor API + shadcn components

- New Settings sub-page: `/settings/agents`
- Lists all named agents with current version, status (active/draft), model
- Click agent to open shadcn `sheet` with system prompt editor (textarea)
- Version history displayed in shadcn `table` with diff indicators
- `switch` component for activate/deactivate toggle
- Draft system: edit creates a new draft version; explicit "Publish" action activates it
- API calls go to @mastra/editor's storage methods via agent server routes
- System prompt changes take effect immediately on publish (no server restart needed because @mastra/editor resolves configs at runtime)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@mastra/editor@^0.7.0` | `@mastra/core@^1.8.0`, `zod@^4.3.6`, `@mastra/pg@^1.7.1` | Peer deps: `@mastra/core >=1.7.1`, `zod ^3.25 \|\| ^4.0`, `@mastra/mcp >=1.0.0`. All satisfied by current stack. |
| `@dnd-kit/core@^6.3.1` | `react@^19.0.0`, `react-dom@^19.0.0` | Supports React 16.8+ including 19. No peer dep conflicts. |
| `@dnd-kit/sortable@^10.0.0` | `@dnd-kit/core@^6.3.1` | Must install together. sortable 10.x requires core 6.x. |
| `prisma@^6.3.1` | All new models | Stay on 6.x. Prisma 7.x has vector migration regression (#28867). |
| `next@^15.5.12` | All new packages | App Router layouts are the recommended pattern for persistent chat. No conflicts. |
| shadcn `command` | `cmdk@^1.0.0` (auto-installed) | cmdk is a React 19 compatible command palette. |
| shadcn `resizable` | `react-resizable-panels@^2.x` (auto-installed) | Mature, maintained by bvaughn (React core team). |

---

## Integration Points with Existing Code

### Extend (Not Replace)

| Existing Module | Extension | Notes |
|----------------|-----------|-------|
| `apps/agent/src/lib/drive-folders.ts` | Add touch-type sub-folders, domain-scoped sharing | Has `getOrCreateDealFolder` and `makePubliclyViewable` already |
| `apps/agent/src/mastra/workflows/` | Each workflow becomes a named agent's tool/capability | Workflows remain; agents orchestrate them |
| `apps/agent/src/mastra/index.ts` | Register named agents, add agent CRUD routes, chat endpoint | Already registers workflows and custom API routes |
| `apps/web/src/app/(authenticated)/deals/` | Expand from simple list to pipeline + detail sub-pages | Has `page.tsx`, `[dealId]/page.tsx`, `loading.tsx` |
| `apps/web/src/app/(authenticated)/settings/` | Add agent management sub-page | Already has sidebar navigation with vertical tabs |
| `apps/agent/prisma/schema.prisma` | Add Deal fields, ChatMessage, Artifact models | Forward-only migrations per CLAUDE.md |
| `packages/schemas/` | Add deal stage constants, artifact stage constants, chat types | Shared types between web and agent |
| `apps/web/src/app/(authenticated)/deals/[dealId]/` | Add layout.tsx (persistent chat), sub-page routes | Currently has page.tsx only |

### New Files to Create

| File/Directory | Purpose |
|----------------|---------|
| `apps/agent/src/agents/` | Named agent definitions (one file per agent) |
| `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` | Persistent chat bar + deal sub-nav |
| `apps/web/src/app/(authenticated)/deals/[dealId]/overview/page.tsx` | Deal overview dashboard |
| `apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx` | Pre-call briefing page |
| `apps/web/src/app/(authenticated)/deals/[dealId]/touch-[1-4]/page.tsx` | Touch-specific artifact generation pages |
| `apps/web/src/app/(authenticated)/settings/agents/page.tsx` | Agent management UI |
| `apps/web/src/components/pipeline/` | Kanban board, pipeline column, deal card components |
| `apps/web/src/components/chat/` | ChatBar, ChatMessage, ChatInput components |
| `apps/web/src/components/artifacts/` | ArtifactCard, ArtifactReview, StageIndicator components |

### @mastra/editor Integration with Existing PostgresStore

The `@mastra/editor` package uses `@mastra/pg` for persistence. We already configure `PostgresStore` in `index.ts`:

```typescript
const store = new PostgresStore({ connectionString: env.DATABASE_URL });
```

The editor should be initialized with the same store instance to share the database connection and keep agent configs alongside workflow state in the same database. This avoids a second connection pool and keeps all Mastra state co-located.

---

## Sources

### HIGH Confidence (npm registry verified)
- `@mastra/editor@0.7.0` -- verified via `npm view @mastra/editor version` (peer deps: @mastra/core >=1.7.1, zod ^3.25 || ^4.0, @mastra/mcp >=1.0.0)
- `@dnd-kit/core@6.3.1` -- verified via `npm view @dnd-kit/core version`
- `@dnd-kit/sortable@10.0.0` -- verified via `npm view @dnd-kit/sortable version`
- Existing codebase analysis -- `schema.prisma`, `drive-folders.ts`, `index.ts`, `package.json` files

### MEDIUM Confidence (official docs + web search)
- [Mastra agent docs](https://mastra.ai/docs/agents/overview) -- named agent instructions format
- [Mastra changelog 2026-02-04](https://mastra.ai/blog/changelog-2026-02-04) -- @mastra/editor announcement
- [Mastra changelog 2026-03-04](https://mastra.ai/blog/changelog-2026-03-04) -- latest Mastra release info
- [@dnd-kit official site](https://dndkit.com/) -- React 19 compatibility confirmed
- [dnd-kit + shadcn + Tailwind kanban example](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui) -- proven pattern
- [shadcn/ui Breadcrumb](https://ui.shadcn.com/docs/components/radix/breadcrumb) -- component API
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) -- composable sidebar for deal nav
- [Google Drive permissions API](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) -- domain-scoped sharing

### LOW Confidence (needs phase-specific validation)
- @mastra/editor integration with existing PostgresStore -- API surface not fully documented; verify during implementation that editor can share a PostgresStore instance
- @mastra/editor UI requirements -- unclear whether it ships its own React components or is API-only; may affect Settings agent management UI approach

---
*Stack research for: Lumenalta Agentic Sales Orchestration v1.7 Deals and HITL Pipeline*
*Researched: 2026-03-08*
