# Phase 44: Agent Management UI - Research

**Researched:** 2026-03-08
**Domain:** Settings UI for agent prompt CRUD, draft/publish versioning, AI chat editing, version history with rollback
**Confidence:** HIGH

## Summary

Phase 44 builds a Settings > Agents management UI that lets users view, edit, version, and publish system prompts for the 19 named agents established in Phase 43. The data layer (Prisma models `AgentConfig` + `AgentConfigVersion`) and runtime resolution (`getPublishedAgentConfig`, `compileAgentInstructions`, prompt cache) already exist. This phase is purely additive: new API routes on the agent service, new `api-client` functions, new server actions, and new Next.js pages/components under `/settings/agents`.

The existing codebase provides strong patterns to follow: the deck-structures Settings section is a near-identical UI pattern (list page with sub-items, detail page with tabs, streaming chat panel, server actions wrapping api-client). The ChatBar component provides a reusable streaming chat pattern. All 19 agents are cataloged in `AGENT_CATALOG` with family groupings that map directly to the required collapsible list sections.

**Primary recommendation:** Follow the deck-structures pattern exactly -- agent-side CRUD routes registered via `registerApiRoute`, `api-client.ts` typed fetch functions, thin server action wrappers, client components for interactivity. Use `diff` npm package for text diffing in version comparison. No schema migrations needed -- models exist.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Agent list grouped by family (8 collapsible sections: Pre-Call, Touch 1, Touch 4, Deck Selection, Deck Intelligence, Ingestion, Knowledge Extraction, Validation)
- Each agent row shows: name, current published version number, and amber "Draft" badge if unpublished changes exist
- Dedicated "Shared Baseline" section at top of list page for editing the shared baseline prompt; individual agent detail pages show baseline read-only with link to edit globally
- New sidebar item "Agents" in Settings nav (alongside existing Deck Structures and Integrations)
- Clicking an agent row navigates to a dedicated page: /settings/agents/[agentId]
- Deep-linkable URL, back button returns to agent list
- Page has tabs: [Prompts] [History]
- Prompts tab: stacked layout -- baseline prompt (read-only, with "Edit Baseline" link) above role prompt (editable plain textarea with monospace font, auto-resize)
- Save creates a draft version; changes are not live until published
- Persistent AI chat panel at the bottom of the agent detail page, always visible
- Chat panel present wherever possible in the system -- not just a tab, but a persistent bottom bar
- AI suggests prompt changes; user can choose between two modes: auto-apply or review-and-approve-first (diff shown with Apply/Dismiss buttons)
- User toggles apply mode preference (auto vs review)
- Draft badge + publish bar: amber "Draft" badge on agent row in list; sticky bar at top of detail page showing "You have unpublished changes" with [Publish] and [Discard Draft] buttons
- Multiple agents can have independent drafts simultaneously
- Publishing requires confirmation dialog: shows diff summary, optional change note field (becomes changeSummary on version), and Confirm button
- Baseline prompt versioned independently -- publishing a new baseline recompiles all agents' compiled prompts without creating individual agent drafts
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MGMT-01 | User can view all formal agents and their current system prompts in Settings | Agent list page grouped by family with Accordion, agent detail page with Prompts tab showing baseline + role prompt |
| MGMT-02 | User can edit agent system prompts via direct text editing | Textarea with monospace font on detail page Prompts tab, save creates draft AgentConfigVersion |
| MGMT-03 | User can edit agent system prompts via conversational AI chat | Persistent bottom chat panel adapted from ChatBar, streaming proxy, AI suggests prompt changes with auto-apply/review toggle |
| MGMT-04 | Any prompt modification creates a draft version; changes are not live until published | Draft/publish workflow: save creates new version with isPublished=false, publish updates publishedVersionId pointer + invalidates cache |
| MGMT-05 | Each save creates a new version with full version history retained for review or rollback | History tab with timeline, diff view via `diff` library, rollback creates new version with prior content |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (existing) | Pages, routing, server actions | Already in project |
| React | 19.x (existing) | UI components | Already in project |
| Tailwind CSS | 4.x (existing) | Styling | Already in project |
| shadcn/ui | (existing) | Accordion, Tabs, Badge, Dialog, AlertDialog, Card | Already installed |
| react-hook-form + zod | (existing) | Form validation for change notes | Already in project |
| Lucide React | (existing) | Icons (Bot, ChevronRight, History, Edit, Undo2, Check, X, Send) | Already in project |
| Sonner | (existing) | Toast notifications for save/publish/rollback feedback | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `diff` | ^7.x | Text diff computation for version comparison | Version history Compare view and publish confirmation diff summary |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `diff` npm | Custom line-by-line comparison | `diff` handles word-level and line-level diffs properly, handles edge cases (whitespace, empty lines). Hand-rolling is error-prone. |
| Monaco editor for prompts | Plain textarea | CONTEXT.md specifies "editable plain textarea with monospace font, auto-resize" -- no need for a code editor |

**Installation:**
```bash
cd apps/web && npm install diff @types/diff
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/mastra/index.ts          # Add agent config CRUD routes (registerApiRoute)
apps/web/src/lib/api-client.ts          # Add typed fetch functions for agent config API
apps/web/src/lib/actions/agent-config-actions.ts  # Server actions wrapping api-client
apps/web/src/app/(authenticated)/settings/layout.tsx  # Add "Agents" sidebar item
apps/web/src/app/(authenticated)/settings/agents/
  page.tsx                              # Agent list page (grouped by family)
  [agentId]/
    page.tsx                            # Agent detail page (tabs: Prompts, History)
apps/web/src/components/settings/
  agent-list.tsx                        # Client component: grouped agent list with accordion
  agent-detail.tsx                      # Client component: tabbed detail view
  agent-prompt-editor.tsx               # Client component: textarea prompt editing + save
  agent-chat-panel.tsx                  # Client component: persistent bottom chat (adapted from ChatBar)
  agent-version-timeline.tsx            # Client component: version history timeline
  agent-diff-view.tsx                   # Client component: side-by-side or inline diff rendering
  publish-dialog.tsx                    # Client component: publish confirmation with diff + change note
  rollback-dialog.tsx                   # Client component: rollback confirmation
  baseline-editor.tsx                   # Client component: baseline prompt editing (separate page/section)
apps/web/src/app/api/agents/chat/
  route.ts                             # Streaming proxy for agent prompt chat
```

### Pattern 1: API Route Registration (Agent Service)
**What:** CRUD routes for agent configs and versions registered in `apps/agent/src/mastra/index.ts`
**When to use:** All data operations on AgentConfig/AgentConfigVersion

Recommended route structure:
```
GET    /agent-configs                    # List all configs with published version info + draft status
GET    /agent-configs/:agentId           # Get single config with current published + latest draft version
GET    /agent-configs/:agentId/versions  # List all versions for an agent (ordered by version desc)
POST   /agent-configs/:agentId/draft     # Create draft version (save prompt edit)
POST   /agent-configs/:agentId/publish   # Publish latest draft (update publishedVersionId, set isPublished, invalidate cache)
POST   /agent-configs/:agentId/discard   # Discard draft (delete unpublished version)
POST   /agent-configs/:agentId/rollback  # Rollback to specified version (creates new version with that content)
POST   /agent-configs/:agentId/chat      # Streaming chat for prompt editing
POST   /agent-configs/baseline/draft     # Save baseline draft
POST   /agent-configs/baseline/publish   # Publish baseline (recompile all agents)
```

### Pattern 2: Server Actions as Thin Wrappers
**What:** Each server action calls the corresponding `api-client` function
**When to use:** All data fetching/mutation from Next.js components
**Example:**
```typescript
// Source: existing pattern in deck-structure-actions.ts
"use server";
import { listAgentConfigs, getAgentConfig } from "@/lib/api-client";

export async function getAgentConfigsAction() {
  return listAgentConfigs();
}

export async function getAgentConfigAction(agentId: string) {
  return getAgentConfig(agentId);
}
```

### Pattern 3: Streaming Chat Proxy
**What:** Next.js API route proxies streaming response from agent service
**When to use:** AI chat for prompt editing
**Example:**
```typescript
// Source: existing pattern in apps/web/src/app/api/deck-structures/chat/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const agentRes = await fetch(`${env.AGENT_SERVICE_URL}/agent-configs/${body.agentId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AGENT_API_KEY}`,
    },
    body: JSON.stringify({ message: body.message, currentPrompt: body.currentPrompt }),
  });
  return new Response(agentRes.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
```

### Pattern 4: Draft/Publish Version Lifecycle
**What:** Save creates unpublished version; publish updates pointer and invalidates cache
**When to use:** All prompt modifications

Draft creation logic (agent service):
```typescript
// 1. Find the next version number
const lastVersion = await prisma.agentConfigVersion.findFirst({
  where: { agentConfigId: config.id },
  orderBy: { version: "desc" },
});
const nextVersion = (lastVersion?.version ?? 0) + 1;

// 2. Create draft version (isPublished = false)
const draft = await prisma.agentConfigVersion.create({
  data: {
    agentConfigId: config.id,
    version: nextVersion,
    baselinePrompt: currentBaseline,
    rolePrompt: editedRolePrompt,
    compiledPrompt: compileAgentInstructions(currentBaseline, editedRolePrompt).compiledPrompt,
    isPublished: false,
  },
});

// 3. Publish: update pointer + set isPublished + invalidate cache
await prisma.agentConfigVersion.update({
  where: { id: draft.id },
  data: { isPublished: true, publishedAt: new Date(), publishedBy: userId, changeSummary },
});
await prisma.agentConfig.update({
  where: { id: config.id },
  data: { publishedVersionId: draft.id },
});
invalidateAgentPromptCache({ agentId: config.agentId });
```

### Pattern 5: Auto-Apply vs Review Toggle for Chat
**What:** User preference stored in component state (localStorage for persistence across sessions)
**When to use:** Chat panel prompt suggestions

Implementation approach:
- Store preference in `localStorage` key `agent-chat-apply-mode` ("auto" | "review")
- Toggle button in chat panel header
- When AI suggests a change, parse the response for a prompt update delimiter (similar to `---STRUCTURE_UPDATE---` in deck chat)
- Auto mode: apply change to textarea immediately
- Review mode: show diff overlay with Apply/Dismiss buttons

### Anti-Patterns to Avoid
- **Mutating published versions in place:** Always create new versions. Published versions are immutable snapshots.
- **Bypassing cache invalidation:** Every publish must call `invalidateAgentPromptCache`. Forgetting this means stale prompts in runtime.
- **Resetting the database:** Per CLAUDE.md, never use `prisma migrate reset` or `prisma db push`. No schema changes needed for this phase anyway.
- **Building a rich text editor:** User decided on plain textarea with monospace font. Keep it simple.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diffing | Line-by-line string comparison | `diff` npm package (`diffLines`, `diffWords`) | Handles whitespace normalization, word boundaries, produces structured change objects for rendering |
| Collapsible sections | Custom toggle visibility | shadcn/ui `Accordion` component | Already in project, handles animation, accessibility, keyboard nav |
| Tab navigation | Custom tab state management | shadcn/ui `Tabs` component | Already in project, ARIA-compliant |
| Confirmation dialogs | Custom modal logic | shadcn/ui `AlertDialog` component | Already in project, handles focus trap, escape key, overlay |
| Toast notifications | Custom notification system | Sonner (already installed) | Already in project, used throughout codebase |
| Streaming response parsing | Custom fetch + reader | Adapt existing ChatBar pattern | Proven pattern with delimiter-based structure extraction |

**Key insight:** This phase is primarily a UI assembly task. All data models exist, all UI primitives exist, all patterns are established. The risk is in getting the draft/publish lifecycle logic right on the API side and the chat-to-prompt integration on the UI side.

## Common Pitfalls

### Pitfall 1: Stale Cache After Baseline Publish
**What goes wrong:** Publishing a new baseline updates all agents' compiled prompts but forgets to invalidate the prompt cache for ALL agents, not just the baseline.
**Why it happens:** The cache is keyed by `agentId:versionId`. Baseline publish creates new versions for all agents, but the cache entries for old versionIds persist.
**How to avoid:** When publishing baseline, call `invalidateAgentPromptCache()` with no arguments (clears entire cache), or iterate all agents and invalidate each.
**Warning signs:** Agents use old baseline text after baseline publish until service restart.

### Pitfall 2: Concurrent Draft Conflicts
**What goes wrong:** User opens two tabs editing the same agent, saves in both -- second save creates a version based on stale state.
**Why it happens:** No optimistic locking on version creation.
**How to avoid:** Use the `version` number as an optimistic lock. The save-draft endpoint should accept the expected current version and reject if it has changed. A simple `findFirst` + version check before create is sufficient.
**Warning signs:** Version numbers skip or content gets silently overwritten.

### Pitfall 3: Baseline Publish Blast Radius Not Communicated
**What goes wrong:** User edits shared baseline, publishes, and is surprised that all 19 agents are affected.
**Why it happens:** UI does not clearly communicate the impact.
**How to avoid:** Baseline publish confirmation dialog should explicitly state "This will update the compiled prompt for all 19 agents" with a list of affected agents.
**Warning signs:** User publishes baseline and wonders why unrelated agent behavior changed.

### Pitfall 4: Chat Panel Conflicts with Textarea Edits
**What goes wrong:** User manually edits textarea, then AI chat suggests a change based on the pre-edit version.
**Why it happens:** Chat sends the prompt text at message-send time, but user has since edited the textarea.
**How to avoid:** Always send the current textarea content with each chat message so the AI works with the latest version.
**Warning signs:** AI suggestions undo recent manual edits.

### Pitfall 5: Rollback to Wrong Version
**What goes wrong:** User rolls back to a version that had a different baseline, but the current baseline is different.
**Why it happens:** Old versions store the baseline that was active at that time. Rolling back the rolePrompt is fine, but the baselinePrompt in the old version may be outdated.
**How to avoid:** Rollback should only restore the `rolePrompt` from the target version, using the current published baseline for the new version's `baselinePrompt`. The compiled prompt is recomputed.
**Warning signs:** Rollback reverts baseline changes unintentionally.

## Code Examples

### Diff Rendering Pattern
```typescript
// Source: diff npm package API
import { diffLines, type Change } from "diff";

function renderDiff(oldText: string, newText: string): Change[] {
  return diffLines(oldText, newText);
}

// In JSX:
// changes.map((change, i) => (
//   <span key={i} className={cn(
//     change.added && "bg-green-50 text-green-800",
//     change.removed && "bg-red-50 text-red-800",
//   )}>
//     {change.value}
//   </span>
// ))
```

### Agent List API Response Shape
```typescript
// Recommended response shape for GET /agent-configs
interface AgentConfigListItem {
  agentId: string;
  name: string;
  responsibility: string;
  family: string;
  isShared: boolean;
  publishedVersion: number | null;
  hasDraft: boolean;           // true if latest version.isPublished === false
  draftVersion: number | null; // version number of unpublished draft, if exists
}
```

### Draft Detection Query
```typescript
// Check if agent has unpublished draft
const latestVersion = await prisma.agentConfigVersion.findFirst({
  where: { agentConfigId: config.id },
  orderBy: { version: "desc" },
});
const hasDraft = latestVersion && !latestVersion.isPublished;
```

### Baseline Publish Recompilation
```typescript
// When baseline is published, recompile all agents
async function publishBaseline(newBaselinePrompt: string, changeSummary: string, userId: string) {
  const allConfigs = await prisma.agentConfig.findMany({
    include: { publishedVersion: true },
  });

  for (const config of allConfigs) {
    if (!config.publishedVersion) continue;

    const nextVersion = await getNextVersion(config.id);
    const compiled = compileAgentInstructions(newBaselinePrompt, config.publishedVersion.rolePrompt);

    const newVersion = await prisma.agentConfigVersion.create({
      data: {
        agentConfigId: config.id,
        version: nextVersion,
        baselinePrompt: newBaselinePrompt,
        rolePrompt: config.publishedVersion.rolePrompt,
        compiledPrompt: compiled.compiledPrompt,
        changeSummary: `Baseline updated: ${changeSummary}`,
        isPublished: true,
        publishedAt: new Date(),
        publishedBy: userId,
      },
    });

    await prisma.agentConfig.update({
      where: { id: config.id },
      data: { publishedVersionId: newVersion.id },
    });
  }

  invalidateAgentPromptCache(); // Clear entire cache
}
```

### Settings Sidebar Addition
```typescript
// Add to apps/web/src/app/(authenticated)/settings/layout.tsx
import { Bot } from "lucide-react";

// In nav, after Integrations:
<Link
  href="/settings/agents"
  className={cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150",
    isAgents
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  )}
>
  <Bot className="h-4 w-4 shrink-0" />
  <span>Agents</span>
</Link>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline prompt strings in code | Named agents with DB-stored versioned prompts | Phase 43 (current) | Prompts are now managed data, not code |
| Single system prompt per agent | Baseline + role prompt composition | Phase 43 (current) | Shared baseline enables org-wide policy changes |

**Already available (no migration needed):**
- `AgentConfig` model with `publishedVersionId` pointer
- `AgentConfigVersion` model with `baselinePrompt`, `rolePrompt`, `compiledPrompt`, `changeSummary`, `isPublished`, `publishedAt`, `publishedBy`
- `@@unique([agentConfigId, version])` constraint prevents duplicate versions
- `compileAgentInstructions()` for prompt composition
- `invalidateAgentPromptCache()` for cache clearing
- `AGENT_CATALOG` with all 19 agents, families, and metadata
- All 19 agents seeded with published v1 via `seedPublishedAgentCatalog()`

## Open Questions

1. **Chat message persistence for prompt editing conversations**
   - What we know: Deck structure chat uses `DeckChatMessage` model linked to `DeckStructure`. Agent prompt chat could use a similar model linked to `AgentConfig`.
   - What's unclear: Whether conversations should persist across sessions or be ephemeral per editing session.
   - Recommendation: Start ephemeral (client-side state only, no DB persistence). If persistence becomes needed, add an `AgentPromptChatMessage` model in a future iteration. This avoids a migration in this phase and keeps scope tight.

2. **Baseline prompt has no separate AgentConfig row**
   - What we know: The baseline prompt is stored in every `AgentConfigVersion` row. There is no dedicated "baseline" `AgentConfig` entity.
   - What's unclear: How to track baseline version history independently.
   - Recommendation: Create a virtual "baseline" agent config with `agentId: "shared-baseline"` in the seed data. This gives it its own version history, and baseline publish recompiles all other agents. Alternatively, use the first agent's baseline as source of truth and derive from there. The virtual entity approach is cleaner.

3. **User identity for publishedBy field**
   - What we know: Auth uses SimpleAuth (API key), but the user session comes from Supabase. The `publishedBy` field is a string.
   - What's unclear: How to pass the user's identity from the web app to the agent service for the publishedBy field.
   - Recommendation: Send user email/name in the request body (from Supabase session), stored as `publishedBy` string. Same pattern used for deal ownership.

## Sources

### Primary (HIGH confidence)
- Prisma schema: `apps/agent/prisma/schema.prisma` lines 338-375 -- AgentConfig and AgentConfigVersion models
- Agent config runtime: `apps/agent/src/lib/agent-config.ts` -- resolution, compilation, caching
- Agent catalog: `packages/schemas/agent-catalog.ts` -- 19 agents with families
- Prompt cache: `apps/agent/src/lib/agent-prompt-cache.ts` -- cache implementation
- Seed defaults: `apps/agent/src/lib/agent-catalog-defaults.ts` -- baseline prompt and role prompt generation
- Settings layout: `apps/web/src/app/(authenticated)/settings/layout.tsx` -- sidebar pattern
- ChatBar component: `apps/web/src/components/settings/chat-bar.tsx` -- streaming chat pattern
- Deck structure actions: `apps/web/src/lib/actions/deck-structure-actions.ts` -- server action pattern
- API client: `apps/web/src/lib/api-client.ts` -- fetchJSON pattern
- Streaming proxy: `apps/web/src/app/api/deck-structures/chat/route.ts` -- proxy pattern
- Route registration: `apps/agent/src/mastra/index.ts` -- registerApiRoute pattern

### Secondary (MEDIUM confidence)
- `diff` npm package -- standard text diffing library, well-established (18M+ weekly downloads)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project except `diff` (well-known, stable)
- Architecture: HIGH -- all patterns directly observable in existing codebase
- Pitfalls: HIGH -- derived from understanding the data model and existing cache behavior

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependency changes expected)
