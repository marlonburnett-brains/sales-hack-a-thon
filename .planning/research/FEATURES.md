# Feature Research

**Domain:** Agentic Sales Orchestration -- Deal Management & HITL Pipeline (v1.7)
**Researched:** 2026-03-08
**Confidence:** HIGH (existing codebase well-understood; patterns are established CRM/agentic UX)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete for a deal management platform.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Deal status lifecycle** | Every CRM shows deals moving through stages; sellers need pipeline health at a glance | LOW | Add `status` field to Deal model (Prospecting > Qualifying > Proposal > Closing > Won/Lost). InteractionRecord tracks per-touch progress but deal-level stage is missing. Forward-only migration required per CLAUDE.md |
| **Deal list with filtering and status indicators** | Sellers must quickly find deals by status, company, or assignee | LOW | Existing `DealDashboard` renders deals but lacks status column, filtering controls, or color-coded status badges. Builds directly on status lifecycle |
| **Pipeline view toggle (Board + List)** | CRMs universally offer kanban board view for visual pipeline management alongside list view for detail work | MEDIUM | Current deals page is list-only. Kanban requires column-per-stage layout with deal cards. Use native HTML drag or lightweight library. Depends on: Deal status lifecycle |
| **Deal detail overview page** | Clicking a deal must show a summary dashboard with company info, stage, recent activity, next actions | MEDIUM | Current `deals/[dealId]/page.tsx` shows touch cards and timeline vertically but lacks a proper dashboard layout with metrics, progress indicators, and quick-action buttons |
| **Breadcrumb navigation** | Users get lost in nested deal sub-pages (Overview > Briefing > Touch 1 > Review) | LOW | Not currently present. Standard Next.js pattern with `usePathname()` segment parsing. Essential for deal detail sub-page navigation |
| **Deal detail sidebar sub-navigation** | Sellers need direct access to deal sub-pages (Overview, Briefing, Touch 1-4) without going back to overview first | MEDIUM | Current deal detail is a single long page. v1.7 requires separate routed sub-pages with a left sidebar or horizontal tab navigation within the deal layout |
| **Per-touch artifact pages** | Each touch type needs a dedicated page with generation form, progress tracking, and output display | HIGH | Currently `TouchFlowCard` components handle Touch 1-4 inline on the deal page. v1.7 requires separate routed pages at `/deals/[dealId]/touch-1` through `/touch-4` with full multi-step HITL workflows |
| **3-stage HITL artifact generation** | Generate > Review > Approve is the expected workflow for AI-assisted content creation | HIGH | Mastra suspend/resume proven for Touch 4 (brief approval + asset review). Extend consistently to Touch 1-3: (1) Configure inputs + Generate, (2) Review AI output with edit capability, (3) Approve/Override final artifacts. Each stage needs clear status indicators |
| **Google Drive artifact saving with organized folders** | Generated decks/docs must land in organized Drive folders, not scattered across a flat directory | MEDIUM | `drive-folders.ts` already has `getOrCreateDealFolder` and `makePubliclyViewable`. Needs per-touch subfolder structure (e.g., "Meridian Capital - Q1 Pitch/Touch 1 - Pager/") and domain-scoped sharing |
| **AI chat for deal context** | Sellers expect to ask questions about their deal ("What did the prospect say about budget?", "Suggest a follow-up approach") | HIGH | No chat infrastructure exists yet. Needs persistent message history, streaming responses, and deal-scoped context injection from InteractionRecord history |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required by all CRMs, but valuable for this platform.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Persistent AI chat bar across deal sub-pages** | Chat context persists as seller navigates between Overview, Briefing, and Touch pages -- unlike CRMs where AI resets per page. Seller can ask about budget on the briefing page, then navigate to Touch 4 and the chat remembers | HIGH | Modern UX pattern: context side panel in deal detail layout, not a floating chat bubble. Use React context or layout-level state to preserve conversation across sub-page navigations. Mount in deal `[dealId]/layout.tsx`. Streaming via existing delimiter protocol |
| **Named agent architecture** | Dedicated agents (BriefingAgent, ProposalAgent, DealChatAgent) with specialized system prompts instead of one monolithic workflow. Each agent has domain expertise, consistent personality, and dedicated tool sets | MEDIUM | Mastra supports named agents with `instructions` as async functions. Currently only workflows exist (touch-1-workflow.ts through touch-4-workflow.ts) with no formal Agent definitions. Register agents in `mastra/index.ts`. Each agent wraps its corresponding workflow with a system prompt layer |
| **Agent management UI with versioning** | Non-technical users (sales managers, product owners) can view, edit, and version agent system prompts through Settings without code changes. Draft/publish workflow prevents accidental production prompt breakage | HIGH | No existing UI. Requires: AgentConfig + AgentConfigVersion DB models, prompt editor with markdown support, version history with diff view, draft/published state machine, rollback capability. Settings page already has sidebar nav -- add "Agents" section |
| **Cross-touch context carry-forward** | Chat and generation agents remember what happened in prior touches for the same deal. "In Touch 2, you used healthcare compliance slides -- reference those in the proposal" | MEDIUM | InteractionRecord already tracks per-touch history with inputs, decisions, and output references. ChatAgent queries prior interactions to provide contextual responses. Named agent architecture enables this by giving ChatAgent access to deal history tools |
| **Deal briefing consolidation page** | Single page aggregating all prep material: pre-call briefing output, company research, prior interaction summaries, discovery questions. One-stop meeting prep surface | MEDIUM | Pre-call data exists via `PreCallSection` component. Prior interactions tracked in `InteractionRecord`. Consolidating into one `/deals/[dealId]/briefing` sub-page with sections for each data source |
| **Domain-scoped Drive sharing** | Share generated artifacts with @lumenalta.com domain instead of public "anyone with link" access. Professional security posture for client-facing materials | LOW | Replace current `makePubliclyViewable` (type: "anyone") with `type: "domain", domain: "lumenalta.com"`. One-line permission change with significant security improvement |
| **Deal assignment with user linking** | Link deals to Supabase Auth users for "my deals" filtering and ownership tracking | LOW | `Deal.salespersonName` exists as freeform text. Add `assignedToUserId` field linking to Supabase Auth user ID. Enable "My Deals" vs "All Deals" filter toggle |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaborative editing of artifacts** | "Let multiple people edit the brief simultaneously" | Massive OT/CRDT complexity. Google Slides already handles collaborative editing natively. Building a parallel editing system is waste | Link to Google Slides/Docs for editing. Track edits via Drive API revision history comparison |
| **Custom pipeline stages** | "Let teams define their own deal stages" | Over-engineering for ~20 sellers. Custom stages require migration tooling, validation logic, and kanban column management UI. Fixed stages cover the actual sales process | Fixed 5-stage pipeline (Prospecting > Qualifying > Proposal > Closing > Won/Lost). Matches their GTM strategy |
| **Inline artifact content editing** | "Edit slide text directly in the web app" | Google Slides API content manipulation is fragile (EMU positioning, text run manipulation). Already explicitly out of scope in PROJECT.md | "Open in Google Slides" deep link button. Google provides superior editing UX |
| **Autonomous generation without approval gates** | "Just generate everything automatically and send to client" | Violates core HITL philosophy -- the platform's primary value is AI-assisted, human-approved output. Removing gates introduces brand/quality risk | Keep explicit 3-stage approval. Speed comes from parallel generation and smart defaults, not skipping review |
| **Per-agent model selection** | "Let each agent use a different LLM" | Increases cost, latency variance, testing surface, and prompt migration complexity. GPT-OSS 120b on Vertex AI handles all current needs adequately | Single model with agent-specific system prompts and tool configurations. Prompt engineering over model switching |
| **Chat history search across all deals** | "Search all my AI conversations globally" | Requires full-text indexing infrastructure, cross-deal privacy considerations, and query UI. Low value compared to deal-scoped chat | Scope chat to current deal. Cross-deal patterns emerge from InteractionRecord analytics in v2 |
| **Drag-and-drop slide reordering** | "Reorder generated slides before approving" | Already explicitly out of scope. Duplicates Google Slides native drag-and-drop. Building slide manipulation UI is months of work | "Open in Google Slides" for reordering, then return to approve final version |
| **Real-time notification system** | "Push notifications when a brief needs approval" | WebSocket/SSE infrastructure for ~20 users is over-engineering. Polling and email suffice | Email notification on HITL checkpoint (Supabase Edge Function or simple SMTP). In-app polling on deals page |

## Feature Dependencies

```
Deal Status Lifecycle
    |-- required by --> Pipeline View Toggle (Board/List)
    |-- required by --> Deal Assignment/Filtering
    |-- required by --> Deal Overview Dashboard (stage display)

Deal Detail Sub-Page Routing
    |-- requires --> Breadcrumb Navigation
    |-- required by --> Per-Touch Artifact Pages
    |-- required by --> Deal Overview Dashboard Page
    |-- required by --> Deal Briefing Page
    |-- required by --> Persistent AI Chat Bar (layout mounting point)

Named Agent Architecture
    |-- required by --> Per-Touch Artifact Pages (agents power generation)
    |-- required by --> Persistent AI Chat Bar (DealChatAgent)
    |-- required by --> Agent Management UI (must exist before managing)
    |-- required by --> Cross-Touch Context (agent queries history)

Per-Touch Artifact Pages
    |-- requires --> Deal Detail Sub-Page Routing
    |-- requires --> Named Agent Architecture
    |-- required by --> 3-Stage HITL Generation

3-Stage HITL Artifact Generation
    |-- requires --> Per-Touch Artifact Pages
    |-- requires --> Named Agent Architecture
    |-- requires --> Google Drive Artifact Saving (stage 3 saves to Drive)

Google Drive Artifact Saving
    |-- requires --> Drive Folder Structure (per-deal + per-touch subfolders)
    |-- requires --> Domain-Scoped Sharing
    |-- enhances --> 3-Stage HITL (completion saves to Drive)

Agent Management UI with Versioning
    |-- requires --> Named Agent Architecture
    |-- requires --> AgentConfig DB Models
    |-- enhances --> Named Agent Architecture (editable prompts)

Persistent AI Chat Bar
    |-- requires --> Named Agent Architecture (DealChatAgent)
    |-- requires --> Deal Detail Sub-Page Routing (layout-level mount)
    |-- requires --> DealChatMessage DB Model
    |-- enhances --> All Touch Pages (contextual AI during generation)
```

### Dependency Notes

- **Deal Status Lifecycle is the foundation.** Pipeline views, filtering, and dashboard all depend on deals having a stage. Ship first.
- **Deal Detail Sub-Page Routing unlocks everything inside a deal.** Overview, Briefing, Touch pages, and Chat bar all need the sub-page layout structure. Ship second.
- **Named Agent Architecture enables all AI features.** Touch pages invoke agents, chat bar uses DealChatAgent, and the management UI configures agents. Define agents before building the features that use them.
- **3-Stage HITL depends on both touch pages and Drive saving.** The approval stage must save artifacts to Drive to complete the workflow loop.
- **Agent Management UI is downstream of everything.** It configures agents that must already exist and be working. Ship last.

## MVP Definition

### Launch With (v1.7 Core)

Minimum viable milestone -- what transforms the app from content-generation tool to deal-management platform.

- [ ] Deal status lifecycle with 5 fixed stages and DB migration
- [ ] Deals page with list/board view toggle and status filtering
- [ ] Deal detail navigation overhaul: breadcrumbs + sidebar sub-pages (Overview, Briefing, Touch 1-4)
- [ ] Deal overview dashboard page with company info, stage, activity summary, quick actions
- [ ] Deal briefing consolidation page aggregating pre-call output and prior interactions
- [ ] Named agent architecture: BriefingAgent, Touch1Agent, Touch2Agent, Touch3Agent, ProposalAgent, DealChatAgent with dedicated system prompts
- [ ] Per-touch artifact pages with 3-stage HITL workflow (Configure > Review > Approve)
- [ ] Google Drive artifact saving with per-deal/per-touch folder structure and @lumenalta.com domain sharing
- [ ] Persistent AI chat bar across deal sub-pages with streaming responses and deal context

### Add After Validation (v1.7.x)

Features to add once core pipeline is working and agents are stable.

- [ ] Agent management UI with versioning and draft/publish system -- add when prompt iteration becomes a bottleneck
- [ ] Deal assignment with Supabase Auth user linking and "My Deals" filter -- add when team filtering is requested
- [ ] Cross-touch context carry-forward in chat -- add after chat bar is proven useful and context quality can be validated
- [ ] Pipeline analytics (stage distribution, average time per stage) -- add when enough deals exist

### Future Consideration (v2+)

- [ ] Custom pipeline stages per team -- defer until multi-team usage demands it
- [ ] Chat history search across deals -- defer until interaction volume warrants full-text indexing
- [ ] Automated stage transitions based on interaction completion -- defer until transition patterns are understood
- [ ] A/B testing for agent prompts via management UI -- defer until prompt versioning is stable
- [ ] Email notifications on HITL checkpoints -- defer until polling UX proves insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Deal status lifecycle | HIGH | LOW | P1 |
| Deals list/board view toggle | HIGH | MEDIUM | P1 |
| Deal detail sub-page routing + breadcrumbs | HIGH | MEDIUM | P1 |
| Deal overview dashboard | MEDIUM | MEDIUM | P1 |
| Deal briefing page | MEDIUM | MEDIUM | P1 |
| Named agent architecture | HIGH | MEDIUM | P1 |
| Per-touch artifact pages (4 pages) | HIGH | HIGH | P1 |
| 3-stage HITL generation workflow | HIGH | HIGH | P1 |
| Google Drive folder structure + domain sharing | HIGH | MEDIUM | P1 |
| Persistent AI chat bar | HIGH | HIGH | P1 |
| Agent management UI with versioning | MEDIUM | HIGH | P2 |
| Deal assignment + "My Deals" filter | MEDIUM | LOW | P2 |
| Cross-touch context in chat | MEDIUM | MEDIUM | P2 |
| Pipeline analytics | LOW | MEDIUM | P3 |
| Chat history search | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.7 milestone completion
- P2: Should have, add in v1.7.x if time permits
- P3: Nice to have, defer to v2+

## Existing Infrastructure to Leverage

What already exists and how new features build on it.

| Existing Asset | New Feature It Enables | Gap to Fill |
|----------------|----------------------|-------------|
| `Deal` model with `Company` relation | Deal status lifecycle | Add `status` field (String), `assignedToUserId` (String, nullable), status transition timestamps |
| `InteractionRecord` with per-touch status | 3-stage HITL pages | Expand status enum to cover Configure/Review/Approve stages or add HITL stage tracking |
| `TouchFlowCard` component | Per-touch artifact pages | Extract generation logic from cards into full page components with multi-step forms |
| `drive-folders.ts` (`getOrCreateDealFolder`) | Drive folder structure | Add per-touch subfolder creation, organize by artifact type |
| `makePubliclyViewable` | Domain-scoped sharing | Replace `type: "anyone"` with `type: "domain", domain: "lumenalta.com"` |
| Mastra workflows (touch-1 through touch-4) | Named agent architecture | Wrap workflows in formal Mastra Agent definitions with `instructions` system prompts |
| `DeckChatMessage` model | Persistent AI chat bar | Separate model needed: `DealChatMessage` for deal-scoped chat (distinct from deck structure chat) |
| Streaming chat delimiter protocol | Chat bar streaming | Reuse `---STRUCTURE_UPDATE---` delimiter pattern for chat responses with structured payloads |
| Sidebar component with nav items | Deal detail sub-navigation | Add nested sub-sidebar or tab navigation within `[dealId]/layout.tsx` |
| Supabase Auth user ID | Deal assignment | Link `Deal.assignedToUserId` to Supabase Auth user ID for ownership |
| `PreCallSection` component | Briefing consolidation page | Lift into dedicated briefing page alongside interaction history summaries |
| Settings page with sidebar nav | Agent management UI | Add "Agents" nav section to existing Settings sidebar |
| `Brief.approvalStatus` + `workflowRunId` | 3-stage HITL | Proven suspend/resume pattern for Touch 4; replicate for Touch 1-3 |

## Competitor Feature Analysis

| Feature | HubSpot | Salesforce | Pipedrive | Our Approach |
|---------|---------|------------|-----------|--------------|
| Pipeline view | Kanban + list + forecast | Kanban + list + path view | Kanban + list + timeline | Kanban + list (two views sufficient for ~20 sellers) |
| Deal stages | Fully customizable | Fully customizable | Customizable with defaults | Fixed 5-stage pipeline (avoids config complexity for small team) |
| AI chat | ChatSpot (separate tool, not deal-scoped) | Einstein Copilot (inline, general-purpose) | AI Sales Assistant (sidebar, email-focused) | Persistent context bar in deal detail layout, scoped to deal history and touch interactions |
| Artifact generation | Template-based docs (no HITL) | CPQ for proposals (complex config) | Smart Docs with templates (basic merge) | 3-stage HITL with AI assembly from pre-approved slide blocks + Mastra suspend/resume |
| HITL approval | Basic approval workflows | Multi-step approval chains | No formal approval flow | Mastra durable workflows with explicit suspend/resume gates per stage |
| Drive integration | HubSpot Docs or GDrive sync | Salesforce Files (proprietary) | Google Drive sync (flat) | Native Google Workspace API with structured folder hierarchy per deal/touch |
| Agent management | No user-facing prompt config | Einstein prompt builder (admin only) | No agent config | Settings UI with version history, draft/publish, and diff view |
| Briefing prep | No consolidated prep view | Einstein account insights (separate) | No briefing feature | Dedicated briefing page with pre-call output + prior interaction history |

## Sources

- Existing codebase analysis (HIGH confidence): `apps/web/src/app/(authenticated)/deals/`, `apps/agent/src/mastra/`, `apps/agent/prisma/schema.prisma`, `apps/agent/src/lib/drive-folders.ts`, `apps/web/src/app/(authenticated)/layout.tsx`
- [Pipedrive Pipeline Management](https://www.pipedrive.com/en/features/pipeline-management) -- kanban/list view patterns
- [Pipeline CRM Kanban Board](https://help.pipelinecrm.com/articles/238265-kanban-board) -- deal card and drag patterns
- [monday.com Sales Pipeline](https://support.monday.com/hc/en-us/articles/360013348719-Sales-pipeline-management-with-monday-CRM) -- view toggle patterns
- [Mastra Agents Overview](https://mastra.ai/docs/agents/overview) -- named agent registration
- [Mastra System Prompt Examples](https://mastra.ai/en/examples/agents/system-prompt) -- instructions as async functions
- [Mastra HITL Workflows](https://mastra.ai/docs/workflows/human-in-the-loop) -- suspend/resume patterns
- [Google Drive API Permissions](https://developers.google.com/drive/api/guides/manage-sharing) -- domain-scoped sharing
- [Google Drive Permissions.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create) -- permission types
- [Prompt Versioning Best Practices 2025](https://www.getmaxim.ai/articles/prompt-versioning-and-its-best-practices-2025/) -- draft/publish patterns
- [Conversational AI UI Comparison 2025](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025) -- chat sidebar patterns
- [HITL AI Design Patterns 2025](https://blog.ideafloats.com/human-in-the-loop-ai-in-2025/) -- multi-stage approval UX
- [AI UX Design for SaaS](https://userpilot.com/blog/ai-ux-design/) -- context panel patterns
- [Agentic AI Workflow Patterns 2025](https://skywork.ai/blog/agentic-ai-examples-workflow-patterns-2025/) -- multi-stage generation patterns

---
*Feature research for: Agentic Sales Orchestration -- Deal Management & HITL Pipeline (v1.7)*
*Researched: 2026-03-08*
