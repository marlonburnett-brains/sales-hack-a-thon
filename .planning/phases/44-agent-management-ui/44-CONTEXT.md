# Phase 44: Agent Management UI - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Settings page for viewing, editing, versioning, and publishing agent system prompts. Users can browse all 19 named agents, edit their role prompts (and the shared baseline), manage draft/publish lifecycle, and review full version history with rollback. AI chat is available for conversational prompt editing alongside direct text editing.

</domain>

<decisions>
## Implementation Decisions

### Agent list presentation
- Grouped by family (8 collapsible sections: Pre-Call, Touch 1, Touch 4, Deck Selection, Deck Intelligence, Ingestion, Knowledge Extraction, Validation)
- Each agent row shows: name, current published version number, and amber "Draft" badge if unpublished changes exist
- Dedicated "Shared Baseline" section at top of list page for editing the shared baseline prompt; individual agent detail pages show baseline read-only with link to edit globally
- New sidebar item "Agents" in Settings nav (alongside existing Deck Structures and Integrations)

### Agent detail page
- Clicking an agent row navigates to a dedicated page: /settings/agents/[agentId]
- Deep-linkable URL, back button returns to agent list
- Page has tabs: [Prompts] [History]
- Prompts tab: stacked layout — baseline prompt (read-only, with "Edit Baseline →" link) above role prompt (editable plain textarea with monospace font, auto-resize)
- Save creates a draft version; changes are not live until published

### AI chat editing
- Persistent AI chat panel at the bottom of the agent detail page, always visible (similar to ChatGPT/Claude input area layout)
- Chat panel present wherever possible in the system — not just a tab, but a persistent bottom bar
- AI suggests prompt changes; user can choose between two modes: auto-apply or review-and-approve-first (diff shown with Apply/Dismiss buttons)
- User toggles apply mode preference (auto vs review)
- Reuses streaming chat pattern from existing ChatBar component

### Draft/publish workflow
- Draft badge + publish bar: amber "Draft" badge on agent row in list; sticky bar at top of detail page showing "You have unpublished changes" with [Publish] and [Discard Draft] buttons
- Multiple agents can have independent drafts simultaneously
- Publishing requires confirmation dialog: shows diff summary, optional change note field (becomes changeSummary on version), and Confirm button
- Baseline prompt versioned independently — publishing a new baseline recompiles all agents' compiled prompts without creating individual agent drafts

### Version history & rollback
- Timeline list in History tab: vertical timeline with each version showing version number, date, change note, published-by user, and action buttons
- Published version marked with filled dot; others with hollow dots
- Inline diff view: click "Compare" on any version to see additions (green) and removals (red) against current published version
- Rollback creates a new version (append-only history): rolling back to v2 creates v4 with v2's content, auto-noted "Rollback to v2"
- Rollback requires confirmation dialog: shows current live version, target version, and Rollback & Publish button

### Claude's Discretion
- Exact API route structure for CRUD operations on agent configs and versions
- How to implement the user-toggleable auto-apply vs review mode for chat suggestions
- Prompt cache invalidation strategy when publishing
- Diff algorithm choice for version comparison
- Chat message persistence model for agent prompt editing conversations

</decisions>

<specifics>
## Specific Ideas

- AI chat panel should be persistent at the bottom, similar to ChatGPT/Claude/web GPTs — not hidden behind a tab
- The chat panel pattern should be designed for reuse across the system (aligns with Phase 45 persistent chat bar)
- Agent list should feel like a product admin panel, not a developer config page — product-facing names from Phase 43 catalog
- Baseline editing is a power feature — affects all 19 agents, so the UI should make the blast radius clear

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatBar` component (`apps/web/src/components/settings/chat-bar.tsx`): streaming chat with message list, role distinction, delete per message — adapt for prompt editing chat
- `AgentConfig` / `AgentConfigVersion` Prisma models: already exist with published version pointer, baseline/role/compiled prompt fields, changeSummary, publishedBy
- `getPublishedAgentConfig()` / `compileAgentInstructions()` in `apps/agent/src/lib/agent-config.ts`: runtime prompt resolution with caching
- `AGENT_CATALOG` in `packages/schemas/agent-catalog.ts`: 19 agents with agentId, name, responsibility, family metadata
- `seedPublishedAgentCatalog()` in `apps/agent/src/lib/agent-catalog-defaults.ts`: baseline + role prompt defaults for all agents
- `invalidateAgentPromptCache()` in `apps/agent/src/lib/agent-prompt-cache.ts`: cache invalidation for prompt changes
- Settings layout (`apps/web/src/app/(authenticated)/settings/layout.tsx`): left sidebar nav with icon links
- `fetchJSON` API client (`apps/web/src/lib/api-client.ts`): Bearer token auth wrapper for agent API calls
- Form component with react-hook-form + zod integration (`apps/web/src/components/ui/form.tsx`)
- Dialog, AlertDialog, Accordion, Tabs, Badge, Card components from shadcn/ui

### Established Patterns
- Server Actions as thin wrappers around `api-client` functions (see `deck-structure-actions.ts`)
- `registerApiRoute()` pattern in `apps/agent/src/mastra/index.ts` for agent-side API endpoints
- Streaming responses with delimiter protocol for chat refinement
- Sonner toast notifications for success/error feedback
- URL-based state for navigation (Settings uses path-based routing)

### Integration Points
- Settings sidebar nav: add "Agents" item with Bot/Brain icon
- Agent API routes: register new CRUD routes in `apps/agent/src/mastra/index.ts`
- Prompt cache: call `invalidateAgentPromptCache()` after publish
- Auth: SimpleAuth (Bearer token) for web→agent API calls; Supabase session for publishedBy user identity

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 44-agent-management-ui*
*Context gathered: 2026-03-08*
