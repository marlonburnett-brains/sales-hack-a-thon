# Architecture Research

**Domain:** Deal management pipeline with HITL artifact generation for agentic sales platform
**Researched:** 2026-03-08
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js 15)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Deal Pipeline │  │ Deal Detail  │  │ AI Chat Bar  │  │  Settings  │  │
│  │    Page       │  │  Sub-pages   │  │ (persistent) │  │  Agents UI │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                │         │
│  ┌──────┴─────────────────┴─────────────────┴────────────────┴──────┐  │
│  │               Server Actions + API Client Layer                  │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
├─────────────────────────────┼───────────────────────────────────────────┤
│                    Bearer Token Auth                                    │
├─────────────────────────────┼───────────────────────────────────────────┤
│                        apps/agent (Mastra Hono)                         │
├─────────────────────────────┼───────────────────────────────────────────┤
│  ┌──────────────┐  ┌───────┴──────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Named Agents │  │  Workflows   │  │  Custom API  │  │    MCP     │  │
│  │ (chat, gen)  │  │ (touch 1-4)  │  │   Routes     │  │  (AtlusAI) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                │         │
│  ┌──────┴─────────────────┴─────────────────┴────────────────┴──────┐  │
│  │         Prisma + PostgresStore + Google APIs + LLM               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                        Data Layer                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Supabase PG  │  │   pgvector   │  │ Google Drive │                   │
│  │  (Prisma)    │  │ (embeddings) │  │  (artifacts) │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## What Exists vs What Is New

### Existing (modify, do not rewrite)

| Component | Location | What Changes |
|-----------|----------|-------------|
| `Deal` model | `prisma/schema.prisma` | Add `status`, `assignedTo`, `stage`, `priority` fields |
| `InteractionRecord` model | `prisma/schema.prisma` | Add `artifactStage` field for 3-stage tracking |
| Deal detail page | `deals/[dealId]/page.tsx` | Content moves to overview sub-page; file becomes redirect |
| Deal list page | `deals/page.tsx` | Add pipeline view toggle, filters, status badges |
| `api-client.ts` | `apps/web/src/lib/api-client.ts` | Add agent chat endpoints, agent CRUD endpoints, deal PATCH |
| `touch-actions.ts` | `apps/web/src/lib/actions/touch-actions.ts` | Wire 3-stage generation flow per touch |
| `deal-actions.ts` | `apps/web/src/lib/actions/deal-actions.ts` | Add updateDeal, deal filtering |
| Touch workflows | `apps/agent/src/mastra/workflows/touch-*.ts` | Add artifact stage transitions, use named agents |
| `mastra/index.ts` | Agent route registration | Register named agents, add chat and agent management routes |
| `(authenticated)/layout.tsx` | Auth wrapper | No change -- chat bar lives inside deal layout, not here |

### New (create from scratch)

| Component | Location | Purpose |
|-----------|----------|---------|
| Named Mastra agents | `apps/agent/src/mastra/agents/` | Formalized agents with system prompts and tools |
| Agent config models | `prisma/schema.prisma` | `AgentConfig`, `AgentConfigVersion` for versioning |
| Deal layout with sub-nav | `deals/[dealId]/layout.tsx` | Breadcrumbs + sidebar for deal sub-pages |
| Deal overview sub-page | `deals/[dealId]/overview/page.tsx` | Dashboard with deal stats |
| Deal briefing sub-page | `deals/[dealId]/briefing/page.tsx` | Consolidated prep material |
| Touch sub-pages | `deals/[dealId]/touch-[1-4]/page.tsx` | HITL 3-stage artifact generation per touch |
| AI chat bar component | `apps/web/src/components/chat/` | Persistent sliding panel across deal sub-pages |
| Chat server actions | `apps/web/src/lib/actions/chat-actions.ts` | Send/receive messages, thread management |
| Agent management actions | `apps/web/src/lib/actions/agent-actions.ts` | CRUD for agent configs |
| Settings agents page | `settings/agents/page.tsx` | Agent listing, edit, version history |
| Pipeline view component | `apps/web/src/components/deals/pipeline-view.tsx` | Kanban-style deal board |
| Artifact stage stepper | `apps/web/src/components/touch/artifact-stage-stepper.tsx` | 3-stage progress UI |
| Deal context provider | `apps/web/src/components/deals/deal-context.tsx` | React context for deal data across sub-pages |

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Deal Pipeline Page | List/filter deals in table or pipeline view | Server actions -> agent API |
| Deal Detail Layout | Breadcrumb navigation, sub-page routing, chat bar host | Sub-pages, chat component |
| AI Chat Bar | Persistent chat panel, sends messages scoped to deal context | Chat actions -> agent chat endpoint |
| Touch Sub-pages | 3-stage artifact generation (Generate -> Review -> Save) | Touch actions -> workflows |
| Named Agents (agent-side) | LLM interactions with specific system prompts and tools | Mastra agent.generate(), workflows |
| Agent Management UI | View/edit agent system prompts, version drafts | Agent actions -> agent CRUD routes |
| Google Drive Saver | Save generated artifacts to deal folder in Drive | Drive API via agent routes (existing) |

## Recommended New File Structure

```
apps/web/src/
├── app/(authenticated)/
│   ├── deals/
│   │   ├── page.tsx                           # Pipeline/list view (MODIFY)
│   │   └── [dealId]/
│   │       ├── layout.tsx                     # NEW: Sub-nav + chat bar host
│   │       ├── page.tsx                       # MODIFY: redirect to overview
│   │       ├── overview/page.tsx              # NEW: Deal dashboard
│   │       ├── briefing/page.tsx              # NEW: Prep material
│   │       ├── touch-1/page.tsx               # NEW: Touch 1 HITL flow
│   │       ├── touch-2/page.tsx               # NEW: Touch 2 HITL flow
│   │       ├── touch-3/page.tsx               # NEW: Touch 3 HITL flow
│   │       ├── touch-4/page.tsx               # NEW: Touch 4 HITL flow
│   │       ├── review/[briefId]/page.tsx      # EXISTS
│   │       └── asset-review/[interactionId]/  # EXISTS
│   └── settings/
│       ├── agents/
│       │   ├── page.tsx                       # NEW: Agent list
│       │   └── [agentId]/page.tsx             # NEW: Agent edit + versions
│       ├── deck-structures/                   # EXISTS
│       └── integrations/                      # EXISTS
├── components/
│   ├── chat/
│   │   ├── chat-bar.tsx                       # NEW: Sliding panel container
│   │   ├── chat-message-list.tsx              # NEW: Message rendering
│   │   ├── chat-input.tsx                     # NEW: Input with send
│   │   └── use-chat.ts                        # NEW: Hook for streaming chat
│   ├── deals/
│   │   ├── deal-dashboard.tsx                 # EXISTS (MODIFY for filters)
│   │   ├── pipeline-view.tsx                  # NEW: Kanban board
│   │   ├── deal-stage-badge.tsx               # NEW: Status visualization
│   │   └── deal-context.tsx                   # NEW: React context provider
│   └── touch/
│       ├── touch-flow-card.tsx                # EXISTS
│       └── artifact-stage-stepper.tsx         # NEW: 3-stage progress UI
├── lib/
│   ├── actions/
│   │   ├── chat-actions.ts                    # NEW
│   │   ├── agent-actions.ts                   # NEW
│   │   ├── deal-actions.ts                    # EXISTS (MODIFY)
│   │   └── touch-actions.ts                   # EXISTS (MODIFY)
│   └── api-client.ts                          # EXISTS (MODIFY)

apps/agent/src/
├── mastra/
│   ├── agents/
│   │   ├── deal-chat-agent.ts                 # NEW: Deal context chat
│   │   ├── brief-generation-agent.ts          # NEW: Brief generation
│   │   ├── content-selection-agent.ts         # NEW: Slide/content selection
│   │   ├── pager-generation-agent.ts          # NEW: Touch 1 pager content
│   │   └── index.ts                           # NEW: Agent registry export
│   ├── workflows/                             # EXISTS (all files MODIFY)
│   └── index.ts                               # EXISTS (MODIFY: register agents)
├── lib/
│   └── agent-config.ts                        # NEW: DB config loading + cache
```

### Structure Rationale

- **Deal sub-pages under `[dealId]/`:** The current deal detail is a single 181-line page with touch cards, timeline, and alerts. v1.7 adds overview dashboard, briefing page, 4 touch flows, and persistent chat. A single page would become 1000+ lines. Break into sub-pages with a shared layout that hosts the chat bar.
- **Named agents in `mastra/agents/`:** Currently, LLM calls are inline in workflow steps (e.g., `touch-1-workflow.ts` line 46 creates a `GoogleGenAI` client directly). Extracting to named Mastra agents enables system prompt management via Settings UI and makes each agent independently testable and configurable.
- **Chat components isolated in `components/chat/`:** Chat is cross-cutting within the deal context -- it appears on every deal sub-page. Keep it self-contained with its own hook and components.
- **`deal-context.tsx` provider:** Multiple sub-pages need the deal data, company info, and interaction list. Fetching in the layout and providing via context avoids redundant fetches in each sub-page.

## Architectural Patterns

### Pattern 1: Deal Detail Layout with Persistent Chat Bar

**What:** A Next.js layout at `deals/[dealId]/layout.tsx` wraps all deal sub-pages. It fetches deal data, provides breadcrumb navigation + sidebar sub-nav, and hosts the chat bar component as a persistent sliding panel.

**When to use:** Any time a UI element must survive sub-page navigation within a deal context.

**Trade-offs:** Layout components in Next.js 15 do NOT re-render on sub-page navigation (they preserve state). The chat bar's state naturally persists because the layout component is not unmounted when navigating between /overview, /touch-1, etc. The deal data fetch in the layout runs once and is cached.

```typescript
// apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx
import { notFound } from "next/navigation";
import { getDealAction } from "@/lib/actions/deal-actions";
import { DealContextProvider } from "@/components/deals/deal-context";
import { DealSidebar } from "@/components/deals/deal-sidebar";
import { ChatBar } from "@/components/chat/chat-bar";

export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDealAction(dealId);
  if (!deal) notFound();

  return (
    <DealContextProvider deal={deal}>
      <div className="flex h-full">
        <DealSidebar dealId={dealId} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <ChatBar dealId={dealId} companyName={deal.company?.name ?? ""} />
    </DealContextProvider>
  );
}
```

### Pattern 2: HITL 3-Stage Artifact Generation

**What:** Each touch page follows a 3-stage flow: **Generate** (LLM produces content) -> **Review** (seller reviews/edits with HITL suspend) -> **Save** (approved artifact saved to Google Drive). This unifies all four touches under the same UX pattern.

**When to use:** All touch 1-4 sub-pages.

**Trade-offs:** Adds an explicit review step to touches 1-3 (they currently auto-save some outputs on generation). This is intentional -- v1.7 wants seller review before anything hits Drive. Touch 4 already has 2 HITL checkpoints; the 3-stage model maps naturally: Stage 1 = transcript extraction + brief generation, Stage 2 = brief approval, Stage 3 = asset generation + Drive save.

**Data flow:**

```
User clicks "Generate" on Touch sub-page
    |
    v
Server Action -> Agent workflow starts
    |
    v
Workflow Step 1: Named agent generates content
  InteractionRecord.artifactStage = "generating"
    |
    v
Workflow suspends at "review" step
  InteractionRecord.artifactStage = "reviewing"
    |
    v
UI polls workflow status, shows generated content for review
    |
    v
User approves/edits -> Server Action resumes workflow
    |
    v
Workflow Step 2: Save to Google Drive
  InteractionRecord.artifactStage = "saving"
  getOrCreateDealFolder(dealId) -- existing function
  Google Slides/Docs API creates artifact
  Record outputRefs on InteractionRecord
    |
    v
Workflow completes
  InteractionRecord.artifactStage = "complete"
    |
    v
UI shows Drive link + completion status
```

**Shared schema addition:**

```typescript
// packages/schemas/constants.ts
export const ARTIFACT_STAGES = [
  "generating",
  "reviewing",
  "saving",
  "complete",
] as const;
export type ArtifactStage = typeof ARTIFACT_STAGES[number];
```

### Pattern 3: Named Agents with DB-Backed System Prompts

**What:** Replace inline LLM calls in workflows with formalized Mastra `Agent` instances. Each agent has a name, system prompt, and tool set. System prompts are stored in the database (`AgentConfig` model) so the Settings UI can edit them without redeploying. Code-level defaults serve as fallbacks.

**When to use:** Any LLM interaction that has a distinct persona or behavioral pattern.

**Trade-offs:** Adds a DB lookup on agent initialization. Mitigate with in-memory caching (cache prompt on first load, invalidate on Settings publish). The Mastra `Agent` constructor accepts `instructions` as an async function, which enables runtime prompt resolution from DB.

```typescript
// apps/agent/src/mastra/agents/deal-chat-agent.ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { getAgentConfig } from "../../lib/agent-config";

const DEFAULT_PROMPT = `You are a sales assistant for Lumenalta...`;

export const dealChatAgent = new Agent({
  id: "deal-chat",
  name: "Deal Chat Assistant",
  instructions: async () => {
    const config = await getAgentConfig("deal-chat");
    return config?.systemPrompt ?? DEFAULT_PROMPT;
  },
  model: "vertex-ai/gpt-oss-120b",
  memory: new Memory({
    options: { lastMessages: 20 },
  }),
  tools: {
    // Deal context tools registered here
  },
});
```

**Agent registry for v1.7:**

| Agent ID | Purpose | Tools Needed |
|----------|---------|-------------|
| `deal-chat` | Persistent deal-scoped chat assistant | Deal/company/interaction lookup, company research |
| `brief-generator` | Generate sales briefs from transcripts | Transcript extraction, pillar mapping, ROI framing |
| `content-selector` | Select slides/content for deck assembly | AtlusAI MCP search, pgvector similarity |
| `pager-generator` | Generate Touch 1 pager content | Company research, brand guidelines lookup |
| `deck-assembler` | Coordinate deck assembly from selected content | Slide assembly tools, Drive folder creation |

**Registration in Mastra instance:**

```typescript
// apps/agent/src/mastra/index.ts (MODIFY)
import { dealChatAgent, briefGeneratorAgent, ... } from "./agents";

const mastra = new Mastra({
  agents: {
    dealChatAgent,
    briefGeneratorAgent,
    contentSelectorAgent,
    pagerGeneratorAgent,
    deckAssemblerAgent,
  },
  workflows: { /* existing */ },
  storage: postgresStore, // existing PostgresStore
});
```

### Pattern 4: Persistent Chat via Mastra Memory

**What:** Use Mastra's built-in agent memory system (thread-based, with `resourceId` and `threadId`) backed by the existing PostgresStore. Each deal gets a chat thread per user. The chat bar streams responses using the agent's `generate()` method with streaming.

**When to use:** The AI chat bar on deal sub-pages.

**Trade-offs:** Mastra Memory handles message history automatically (configurable, default last 10 messages in context). For deal-specific context, the agent's tools query the deal's interactions, briefs, and company data on demand. Using Mastra's memory system avoids building custom chat persistence -- the PostgresStore already handles it.

**Key decision: Use Mastra Memory, skip custom ChatThread/ChatMessage models.** Mastra's PostgresStore already persists threads in the `mastra` schema. Adding custom models duplicates storage and creates sync issues. If chat history display in the UI is needed, query Mastra's storage tables directly via raw SQL or the Mastra client SDK.

```typescript
// Agent-side: chat endpoint handler
registerApiRoute(mastra, {
  path: "/api/chat",
  method: "POST",
  handler: async (req) => {
    const { dealId, userId, message } = await req.json();
    const agent = mastra.getAgent("dealChatAgent");

    const response = await agent.generate(message, {
      memory: {
        resource: userId,
        thread: `deal-${dealId}`,
      },
      stream: true,
    });

    return new Response(response.toReadableStream(), {
      headers: { "Content-Type": "text/event-stream" },
    });
  },
});
```

```typescript
// Web-side: streaming chat hook
// apps/web/src/components/chat/use-chat.ts
export function useChat(dealId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (content: string) => {
    // Optimistic UI: add user message immediately
    setMessages(prev => [...prev, { role: "user", content }]);
    setIsStreaming(true);

    // Stream response from agent
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ dealId, message: content }),
    });

    // Read SSE stream, accumulate assistant response
    const reader = response.body?.getReader();
    // ... stream reading logic (similar to existing deck-structures/chat)
  };

  return { messages, sendMessage, isStreaming };
}
```

### Pattern 5: Agent Management with Draft/Publish Versioning

**What:** Settings UI shows all registered agents. Each agent's system prompt can be edited in a "draft" mode. Publishing a draft creates a new version record, updates the live agent config, and invalidates the runtime cache. Old versions are preserved for rollback.

**When to use:** The Settings > Agents page.

**Trade-offs:** Simple CRUD with version history. The agent runtime reads from DB via `getAgentConfig()` which caches in a `Map<string, AgentConfig>`. On publish, the Settings action calls an agent endpoint that clears the cache entry.

### Pattern 6: Pipeline View with Stage Grouping

**What:** The deals page supports two views: table (existing, enhanced with filters) and pipeline (new kanban-style board). Pipeline groups deals by `stage` column. Both views share the same data source.

**When to use:** The deals list page.

**Trade-offs:** Client-side rendering for view toggle (avoid re-fetch on toggle). Pipeline view uses CSS grid or flexbox columns for stage lanes. Drag-and-drop is out of scope for v1.7 -- stage changes happen via deal detail page.

```
┌──────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐  ┌────────┐
│ Prospect │  │ Qualifying │  │ Proposal │  │ Negotiation │  │ Closed │
├──────────┤  ├────────────┤  ├──────────┤  ├─────────────┤  ├────────┤
│ Deal A   │  │ Deal C     │  │ Deal E   │  │             │  │ Deal G │
│ Deal B   │  │ Deal D     │  │ Deal F   │  │             │  │        │
└──────────┘  └────────────┘  └──────────┘  └─────────────┘  └────────┘
```

## Data Model Changes

All schema changes require forward-only migrations per CLAUDE.md discipline (`prisma migrate dev --name <descriptive-name>`, never `db push` or `migrate reset`).

### Deal Model Additions (MODIFY existing)

```prisma
model Deal {
  // ... existing fields ...
  status        String   @default("active")    // "active" | "won" | "lost" | "paused"
  stage         String   @default("prospect")  // "prospect" | "qualifying" | "proposal" | "negotiation" | "closed"
  assignedTo    String?                         // User email
  priority      String   @default("medium")    // "low" | "medium" | "high"
  // ... existing relations ...

  @@index([status])
  @@index([stage])
  @@index([assignedTo])
}
```

### InteractionRecord Addition (MODIFY existing)

```prisma
model InteractionRecord {
  // ... existing fields ...
  artifactStage String?  // "generating" | "reviewing" | "saving" | "complete"
}
```

### Agent Config Models (NEW)

```prisma
model AgentConfig {
  id            String               @id @default(cuid())
  agentId       String               @unique  // Matches Mastra agent ID
  displayName   String
  description   String?
  systemPrompt  String               // Current live prompt
  draftPrompt   String?              // In-progress edit (null = no draft)
  toolIds       String               @default("[]") // JSON array
  isActive      Boolean              @default(true)
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  versions      AgentConfigVersion[]
}

model AgentConfigVersion {
  id            String      @id @default(cuid())
  agentConfigId String
  agentConfig   AgentConfig @relation(fields: [agentConfigId], references: [id], onDelete: Cascade)
  version       Int
  systemPrompt  String
  publishedBy   String?     // User email
  publishedAt   DateTime    @default(now())
  changelog     String?

  @@unique([agentConfigId, version])
  @@index([agentConfigId])
}
```

**Decision: No custom ChatThread/ChatMessage models.** Mastra Memory with PostgresStore handles chat persistence automatically. Thread ID = `deal-${dealId}`, resource ID = Supabase user ID. This avoids a parallel persistence layer and keeps chat data in Mastra's managed schema.

## Data Flow

### Chat Message Flow

```
User types in Chat Bar
    |
    v
ChatInput -> useChat hook -> sendMessage()
    |
    v
chatActions.ts (Server Action)
  -> fetchWithGoogleAuth("/api/chat", { method: "POST", body: { dealId, message } })
    |
    v
Agent Hono route handler
  -> dealChatAgent.generate(message, {
       memory: { resource: userId, thread: `deal-${dealId}` },
       stream: true,
     })
    |
    v
Mastra Memory loads last 20 messages from PostgresStore
    |
    v
Agent calls tools if needed (deal context, interaction history, company data)
    |
    v
LLM streams response -> SSE back to web
    |
    v
Mastra Memory auto-persists user message + assistant response to PostgresStore
    |
    v
ChatBar renders streamed tokens via useChat hook
```

### Deal Pipeline Data Flow

```
DealsPage (server component)
    |
    v
listDealsAction() -> fetchJSON("/api/deals?include=company,latestInteraction")
    |
    v
Agent returns Deal[] with company + latest interaction status + stage
    |
    v
Client renders:
  Table View: Sortable list with status badges, stage tags, filters
  Pipeline View: Kanban columns grouped by deal.stage
  Toggle is client-side only (no re-fetch)
```

### Agent Config Management Flow

```
Settings > Agents page
    |
    v
listAgentsAction() -> GET /api/agents
    |
    v
Shows all registered agents with current prompt preview

User clicks "Edit" on an agent
    |
    v
/settings/agents/[agentId] loads agent config + version history
    |
    v
User edits system prompt (saved as draftPrompt on blur/save)
    |
    v
User clicks "Publish"
    |
    v
publishAgentAction() -> PATCH /api/agents/:agentId { action: "publish" }
    |
    v
Agent handler:
  1. Copies draftPrompt to systemPrompt
  2. Creates AgentConfigVersion record (version = max + 1)
  3. Clears draftPrompt to null
  4. Invalidates runtime cache for this agentId
    |
    v
Next agent.generate() call re-reads prompt from DB
```

## Integration Points

### Web -> Agent API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/deals` | GET | List deals with filters and includes | MODIFY (add query params for stage, status, assignedTo) |
| `/api/deals/:id` | GET | Deal detail with interactions | EXISTS |
| `/api/deals/:id` | PATCH | Update deal status/stage/assignee/priority | NEW |
| `/api/chat` | POST | Send chat message (streaming SSE response) | NEW |
| `/api/chat/history` | GET | Retrieve chat history for deal thread | NEW |
| `/api/agents` | GET | List all agent configs | NEW |
| `/api/agents/:agentId` | GET | Get agent config + version history | NEW |
| `/api/agents/:agentId` | PATCH | Update draft, publish, toggle active | NEW |
| `/api/agents/:agentId/versions` | GET | List version history | NEW |
| `/api/workflows/touch-*/start` | POST | Start touch workflow | EXISTS |
| `/api/workflows/touch-*/status` | GET | Poll workflow status | EXISTS |
| `/api/workflows/touch-*/resume` | POST | Resume suspended workflow | EXISTS |

### Agent -> External Services (existing, no changes)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Drive | `getOrCreateDealFolder()` + Slides/Docs API | Existing; used during artifact save stage |
| Google Slides | `assembleFromTemplate()` / `proposal-assembly.ts` | Existing; no changes |
| AtlusAI (MCP) | `callMcpTool()` via MCP singleton | Existing; wire as agent tool |
| Vertex AI LLM | `GoogleGenAI` client | Existing; agents use same model config |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Deal sub-pages <-> Chat bar | React Context (DealContextProvider) | Chat bar reads deal context; layout provides it |
| Touch pages <-> Workflows | Server actions -> API client -> Mastra workflow | Existing pattern; add artifactStage transitions |
| Settings agents <-> Agent runtime | DB write -> cache invalidation endpoint | Publish action triggers cache clear |
| Pipeline view <-> Table view | Client-side state toggle | Same data, different rendering; no re-fetch |
| Named agents <-> Workflows | Workflow steps call `agent.generate()` | Replace inline LLM calls with agent invocations |

## Anti-Patterns

### Anti-Pattern 1: Building Custom Chat Persistence Instead of Using Mastra Memory

**What people do:** Create ChatThread/ChatMessage Prisma models and manually manage message history, context window trimming, and thread lifecycle.
**Why it's wrong:** Mastra Memory with PostgresStore already handles all of this. The PostgresStore is already configured and running. Duplicating storage creates sync issues and doubles the migration surface.
**Do this instead:** Use Mastra Memory with `resource: userId, thread: deal-${dealId}`. If chat history display in the UI is needed, query Mastra's storage tables directly (they use the `mastra` schema in the same PostgreSQL instance).

### Anti-Pattern 2: Putting Chat Bar in the Top-Level Authenticated Layout

**What people do:** Mount the chat bar at `(authenticated)/layout.tsx` so it appears everywhere.
**Why it's wrong:** Chat is deal-scoped. It requires a `dealId` to function. Mounting at the top level means it appears on Templates, Discovery, and Settings pages where it has no context. It also re-mounts (losing conversation state) when navigating between different deals.
**Do this instead:** Mount the chat bar in `deals/[dealId]/layout.tsx`. It persists across deal sub-pages (Next.js layouts preserve state on sub-route navigation) but unmounts when leaving the deal context. This matches the mental model: chat is about this deal.

### Anti-Pattern 3: Separate API Routes per Artifact Stage

**What people do:** Create `/api/touch-1/generate`, `/api/touch-1/review`, `/api/touch-1/save` as separate endpoints for each stage.
**Why it's wrong:** The 3-stage flow is a single Mastra workflow with suspend/resume points. Adding separate endpoints duplicates state management and breaks the workflow's transactional guarantees. The existing pattern already handles this correctly.
**Do this instead:** Use the existing workflow pattern: `start` -> `poll status` -> `resume`. The `artifactStage` field on `InteractionRecord` tracks progress. The workflow steps handle transitions internally. The UI polls and renders based on the current stage.

### Anti-Pattern 4: Storing Agent System Prompts Only in Code

**What people do:** Hardcode system prompts in agent definition files with no database backing.
**Why it's wrong:** v1.7 explicitly requires a Settings UI for editing agent prompts with versioning and a draft/publish cycle. Code-only prompts require a deploy to change and have no version history.
**Do this instead:** Use DB-backed prompts (AgentConfig model) with code-level fallback constants. The Mastra Agent constructor accepts `instructions` as an async function that loads from DB. Fall back to the code constant when no DB record exists (first run / seeding).

### Anti-Pattern 5: Keeping Deal Detail as a Single Page

**What people do:** Keep adding sections to `deals/[dealId]/page.tsx` for overview, briefing, touch flows, and timeline.
**Why it's wrong:** v1.7 adds overview dashboard, briefing page, 4 touch flows, and persistent chat bar. A single page would exceed 1000 lines and mix unrelated concerns. Navigation between sections would require scroll anchors instead of proper routing.
**Do this instead:** Convert to a layout + sub-page structure. Move the current page content (touch cards, timeline, alerts) into the overview sub-page. The layout provides the persistent chrome (nav, breadcrumbs, chat bar).

### Anti-Pattern 6: Inline LLM Calls in Workflow Steps

**What people do:** Keep `new GoogleGenAI()` calls directly in workflow step `execute` functions (current v1.6 pattern).
**Why it's wrong:** Cannot change system prompts via Settings UI. Cannot share prompt management or tool configurations across similar tasks. Each workflow step becomes a standalone LLM integration with no reuse.
**Do this instead:** Create named Mastra Agent instances. Workflow steps call `agent.generate()` instead of raw LLM API calls. The agent handles system prompt loading, tool execution, and memory management.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~20 sellers) | Single Mastra instance on Railway. In-memory Map for agent config cache. No changes needed. |
| 50-100 sellers | Consider connection pooling for PostgreSQL (revisit Supabase pooler). Add Redis for agent config cache invalidation if running multiple Railway instances. |
| 100+ sellers | Not in scope. This is a single-team tool for ~20 sellers. |

### First Bottleneck: Concurrent Chat SSE Connections

Each open deal page maintains an SSE connection for chat streaming. At 20 concurrent users with 1-2 deals each, this is ~20-40 persistent connections. Railway handles this without issue. No action needed for v1.7.

### Second Bottleneck: Agent Config DB Lookups

Every `agent.generate()` call triggers a prompt lookup. At ~20 concurrent users, this is negligible. The in-memory cache with TTL (or invalidation on publish) reduces it to near-zero DB load. No action needed for v1.7.

## Suggested Build Order

Build order follows dependency chains and maximizes incremental value at each step:

### Phase 1: Deal Model Extensions + Pipeline View
- Add `status`, `stage`, `assignedTo`, `priority` to Deal model (migration)
- Add `artifactStage` to InteractionRecord model (migration)
- Add shared constants (`DEAL_STAGES`, `ARTIFACT_STAGES`) to packages/schemas
- Modify deals list page with table/pipeline view toggle
- Add PATCH /api/deals/:id for status/stage updates
- **Value:** Sellers can see and manage deals in a pipeline view immediately.

### Phase 2: Deal Detail Layout + Sub-Page Restructure
- Create `deals/[dealId]/layout.tsx` with sidebar nav + breadcrumbs
- Create DealContextProvider
- Move current page.tsx content to `overview/page.tsx`
- Create `briefing/page.tsx` placeholder
- Create touch-1 through touch-4 sub-page placeholders
- **Value:** Navigation framework in place. Existing functionality preserved.

### Phase 3: Named Agent Architecture + Agent Config Models
- Create AgentConfig + AgentConfigVersion models (migration)
- Create named agents (deal-chat, brief-generator, content-selector, pager-generator)
- Create `agent-config.ts` with DB loading + in-memory cache
- Register agents in Mastra instance
- Seed initial AgentConfig records with default prompts
- **Value:** Agents are formalized. Ready for chat and Settings UI.

### Phase 4: Persistent AI Chat Bar
- Create chat components (chat-bar, chat-message-list, chat-input, use-chat hook)
- Add POST /api/chat route with streaming
- Add GET /api/chat/history route
- Mount chat bar in deal layout
- Wire Mastra Memory with PostgresStore
- **Value:** High-visibility feature. Sellers can chat with AI about any deal.

### Phase 5: Touch 1-4 Sub-Pages with 3-Stage HITL
- Build touch sub-page components with artifact-stage-stepper
- Modify touch workflows to use named agents + artifactStage transitions
- Add suspend/resume points for review stage (touches 1-3 gain review step)
- Integrate existing brief review and asset review flows for touch 4
- **Value:** Full HITL artifact generation across all touches.

### Phase 6: Google Drive Artifact Saving
- Extend stage 3 (save) in workflows to save to deal's Drive folder
- Add folder sharing controls (existing `getOrCreateDealFolder` + sharing API)
- Show Drive links in completion UI
- **Value:** Generated artifacts are saved and shareable.

### Phase 7: Settings Agent Management UI
- Create Settings > Agents page with agent list
- Create agent detail page with prompt editor + version history
- Add draft/publish flow with cache invalidation
- **Value:** Non-technical users can adjust agent behavior. Can build in parallel with phases 5-6.

## Sources

- Mastra Agent API: [Using Agents | Mastra Docs](https://mastra.ai/docs/agents/overview)
- Mastra Agent Memory: [Agent Memory | Mastra Docs](https://mastra.ai/docs/agents/agent-memory)
- Mastra Memory Overview: [Memory Overview | Mastra Docs](https://mastra.ai/docs/memory/overview)
- Mastra Message History: [Message History | Mastra Docs](https://mastra.ai/docs/memory/message-history)
- Existing codebase: `apps/agent/src/mastra/index.ts`, `apps/agent/prisma/schema.prisma`, `apps/web/src/lib/api-client.ts`, `apps/web/src/app/(authenticated)/deals/[dealId]/page.tsx`
- Project context: `.planning/PROJECT.md`

---
*Architecture research for: v1.7 Deals & HITL Pipeline integration with existing Next.js + Mastra + Prisma architecture*
*Researched: 2026-03-08*
