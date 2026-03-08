# Pitfalls Research

**Domain:** Adding deal management pipeline, persistent AI chat, HITL multi-stage generation, Google Drive folder/sharing, named agent systems, and agent management UI with versioning to an existing agentic sales platform (~50,876 LOC, 40 phases, Mastra workflows with suspend/resume, Prisma forward-only migrations)
**Researched:** 2026-03-08
**Confidence:** HIGH (based on direct codebase analysis of all affected code paths and existing patterns)

## Critical Pitfalls

### Pitfall 1: Workflow State Explosion From Multi-Touch HITL Parallelism

**What goes wrong:**
The existing Touch 4 workflow has 3 suspend/resume points in a single linear 17-step pipeline (field review, brief approval, asset review). Expanding HITL 3-stage generation to Touches 1-3 means up to 4 concurrent workflows per deal, each with their own suspend states stored in Mastra PostgresStore. When a seller starts Touch 1 and Touch 3 concurrently on the same deal, the resume handlers can race -- both may attempt to update the same `InteractionRecord` or `Deal.driveFolderId` simultaneously. The current `getOrCreateDealFolder` in `drive-folders.ts` is idempotent for a single caller but not for concurrent callers (two workflows could both pass the "does folder exist?" check on line 28-36 before either creates it, producing duplicate Drive folders).

**Why it happens:**
The existing system was built for one-workflow-at-a-time per deal. The new milestone allows multiple touch types to run in parallel on the same deal, but the data model and Drive folder logic assume sequential execution.

**How to avoid:**
- Add a database-level advisory lock or `SELECT ... FOR UPDATE` on the `Deal` row around `Deal.driveFolderId` assignment so the folder is created exactly once under concurrency.
- Ensure each workflow writes only to its own `InteractionRecord` row and never mutates shared Deal-level state without a transaction guard.
- Design the deal overview page to poll/subscribe to multiple in-flight workflow states, not assume a single active workflow.

**Warning signs:**
- Duplicate Drive folders appearing with the same name under the parent folder.
- `InteractionRecord.status` values flickering between states when viewed on the deal page.
- Mastra PostgresStore showing multiple suspended runs for the same dealId with conflicting states.

**Phase to address:**
Deal management foundation phase (schema + deal lifecycle) -- must define concurrency rules before any workflow integration begins.

---

### Pitfall 2: Chat Message Persistence Without Conversation Scoping

**What goes wrong:**
The "persistent AI chat bar across deal sub-pages" feature creates a scoping problem. Should chat context carry across touch pages? Should a seller's question on the Touch 2 page ("what slides did you pick?") have access to Touch 4 transcript data? If chat messages are stored globally per deal, the LLM context window fills with irrelevant cross-touch context. If stored per-page, navigation loses continuity and users repeat themselves.

**Why it happens:**
Developers build chat persistence first (store messages, show history) without defining the conversation boundary model. The existing `DeckChatMessage` pattern in the codebase is scoped to a single `DeckStructure` entity via FK -- clean and bounded. A deal-level chat has no single entity to anchor to.

**How to avoid:**
- Define explicit conversation scopes: one conversation per deal-touch combination (e.g., deal X + touch_3 = one thread), plus one "general" deal-level conversation for the overview/briefing pages.
- Each conversation gets its own system prompt that includes only relevant context (deal metadata + touch-specific interaction data), not the entire deal history.
- Store conversations in a new `ChatConversation` + `ChatMessage` table pair, with `dealId + touchType` as the natural composite key. The `touchType` column should be nullable (null = deal-level general chat).
- Cap context window by summarizing older messages, following the existing `chatContextJson` summarization pattern in `DeckStructure`.

**Warning signs:**
- LLM responses referencing Touch 4 transcript data when the user is on the Touch 1 page.
- Chat context growing unbounded (100+ messages with full content sent to LLM each time).
- Users confused about whether the chat "knows" about other touches.

**Phase to address:**
Persistent AI chat phase -- must define conversation scoping model before building the chat UI component.

---

### Pitfall 3: Deal Status Lifecycle Becoming an Implicit State Machine

**What goes wrong:**
The existing `InteractionRecord.status` already has 7+ possible values ("pending", "generating", "pending_review", "approved", "overridden", "edited", "pending_approval", "pending_asset_review"). The new deal pipeline needs a deal-level status (e.g., "new", "qualifying", "proposal_sent", "won", "lost") that synthesizes the states of child interactions. Without a formalized state machine, deal status becomes a derived value that different parts of the codebase compute differently -- the deals list page shows "In Progress" while the deal detail page shows "Proposal Ready" because they use different reduction logic over interactions.

**Why it happens:**
The current `Deal` model in `schema.prisma` has no `status` column. Status is implicitly derived from the latest `InteractionRecord.status`. Adding a deal pipeline view requires an explicit pipeline stage, but developers often bolt it on as a derived value instead of a first-class field, leading to inconsistencies across views.

**How to avoid:**
- Add an explicit `Deal.status` column with a well-defined enum: "new" | "qualifying" | "engaged" | "proposal" | "review" | "won" | "lost" | "stale".
- Define explicit transitions (e.g., "new" -> "qualifying" only when first interaction starts; "proposal" -> "review" only when HITL-2 generates assets).
- Workflow steps should update `Deal.status` as a side effect within the same Prisma transaction that updates `InteractionRecord.status`.
- Never derive deal status by scanning interactions on the fly -- compute once on mutation, store as source of truth.

**Warning signs:**
- Pipeline view counts not matching deals list counts.
- Deals "stuck" in a stage because no workflow step triggered the status transition.
- Multiple places in the codebase computing deal status with subtly different logic.

**Phase to address:**
Deal management foundation phase -- the status enum and transition rules must exist before the pipeline view or deal detail pages can render correctly.

---

### Pitfall 4: Prisma Migration Drift From Batched New Models

**What goes wrong:**
The project has strict forward-only migration discipline (per CLAUDE.md: never `db push`, never `migrate reset`). Adding deal pipeline enhancements, chat tables, agent configuration tables, and versioning tables means 5-8 new models in `schema.prisma`. If a developer adds all models in one migration, a single failure (e.g., column type mismatch, index name collision with existing 14 models) blocks the entire migration and leaves the database in a partially-applied state that requires manual intervention to fix with `prisma migrate resolve --applied`.

**Why it happens:**
With 14 existing models and complex relationships, developers batch schema changes to minimize migration files. But forward-only discipline means a failed migration cannot be rolled back -- it must be fixed forward. Large migrations have higher failure probability, and the existing schema already has a history of drift (the `0_init` baseline required manual resolution).

**How to avoid:**
- One migration per model or logical unit (e.g., `ChatConversation` + `ChatMessage` together, but separate from `AgentConfig` + `AgentConfigVersion`).
- Use `--create-only` to inspect SQL before applying, especially for any migration that adds indexes or foreign keys to existing tables like `Deal` or `InteractionRecord`.
- Never add columns to existing models in the same migration as new model creation -- separate migrations for "alter existing" vs. "create new."
- Test each migration against a local copy of the prod schema before deploying.

**Warning signs:**
- Migration files with more than ~50 lines of SQL.
- `prisma migrate dev` failing with "relation already exists" or "column already exists" errors.
- Having to use `prisma migrate resolve --applied` more than once per milestone.

**Phase to address:**
Every phase that touches schema -- but most critically the foundation phase where the bulk of new models are introduced. Each plan should specify which migration(s) it creates.

---

### Pitfall 5: Agent System Prompt Versioning Without Run-Time Pinning

**What goes wrong:**
The "Settings agent management UI with versioning and draft system" introduces agent configuration as data (stored in DB) rather than code (hardcoded prompts). When a seller or admin edits an agent's system prompt in the UI, all subsequent workflow runs use the new prompt. If the edit degrades output quality, there is no way to revert except by manually editing again. Critically, in-flight workflows that were started with the old prompt may produce inconsistent results if they read the system prompt at resume time (after a suspend/resume cycle) rather than at start time. The existing Touch 4 workflow has 3 suspend points -- a prompt change during suspension means steps 1-7 used prompt v1 but steps 8-17 use prompt v2.

**Why it happens:**
Versioning is built for auditing ("we can see what changed") but not for operational pinning ("this workflow run uses version X forever"). The Mastra suspend/resume pattern stores workflow state in PostgresStore but does not capture external configuration like system prompts.

**How to avoid:**
- Store agent configurations with immutable version records: `AgentConfig` (current pointer) + `AgentConfigVersion` (immutable snapshots with incrementing version numbers).
- Each workflow run must capture the `agentConfigVersionId` it started with in its step context, and use that same version at every resume point -- never re-read the "current" config during a suspended workflow.
- The UI should have a one-click "revert to version N" action, not just a history viewer.
- Add a "draft" vs. "published" distinction so edits can be tested before going live.

**Warning signs:**
- Workflow outputs changing quality without any code deployment.
- Users confused about which version of the prompt is "active."
- In-flight workflows producing mixed-version outputs (brief uses prompt v3 from start, asset generation uses prompt v5 from after resume).

**Phase to address:**
Agent architecture phase -- must define the versioning and pinning model before the Settings UI is built. The UI is a view over the versioning model, not the other way around.

---

### Pitfall 6: Google Drive Folder/Sharing Permissions Cascading Incorrectly

**What goes wrong:**
The existing `getOrCreateDealFolder` creates a folder under a parent using service account credentials. The existing `makePubliclyViewable` function sets "anyone with link" access for iframe preview. The new milestone adds "folder/sharing controls" which implies per-deal permission management. Google Drive permissions inherit from parent by default, but if the system explicitly sets permissions on a child folder (e.g., sharing with a specific reviewer), those permissions may conflict with inherited permissions. If a deal folder is made publicly viewable (current pattern) but contains a confidential proposal, that is a data leak.

**Why it happens:**
Drive permission inheritance is invisible -- developers test with the service account (which has full access) and never notice that external users see different results. The existing system makes files publicly viewable for Google Slides iframe preview, which is a reasonable hack for demos but becomes dangerous when deal folders contain multiple sensitive artifacts.

**How to avoid:**
- Define a clear permission model: deal folders should be shared with specific @lumenalta.com users (the assigned seller + reviewers), not made publicly viewable.
- Replace `makePubliclyViewable` with a `shareWithUsers(fileId, emails[])` function for production use. If iframe preview needs public access, set it only on the specific presentation file, not the containing folder.
- Use the user-delegated OAuth credentials (already in place via `getPooledGoogleAuth`) for sharing operations so files appear in the correct user's Drive.
- Test sharing from a non-service-account perspective (incognito browser, different Google account).

**Warning signs:**
- Files accessible to anyone with the link that should be restricted to team members.
- Users unable to access files in "their" deal folder because the service account owns them and sharing was not set up.
- Google Drive sharing dialogs showing unexpected "anyone with the link" entries on confidential proposals.

**Phase to address:**
Google Drive integration phase -- must be addressed before artifacts are saved to deal folders in production.

---

### Pitfall 7: Named Agent Architecture Becoming a God Object Registry

**What goes wrong:**
"Formalized named agent architecture with dedicated system prompts" sounds like creating distinct agent personas (e.g., "Briefing Agent", "Proposal Agent", "Chat Agent"). The pitfall is making these agents too autonomous -- each with their own LLM client, tool set, and execution loop -- when the actual workflows need them to collaborate within a single Mastra pipeline. This leads to duplicated tool registrations in `mastra/index.ts` (already 47 lines of imports), inconsistent LLM configuration, and a "registry" pattern where agents are looked up by name at runtime, introducing string-based coupling.

**Why it happens:**
Developers model agents like microservices ("each agent is independent") when they should model them like roles within a workflow ("each step uses the right prompt for the job"). The Mastra framework already has the right abstraction -- `createStep` with per-step input/output schemas -- but developers add an indirection layer (agent registry) that adds complexity without value.

**How to avoid:**
- Named agents should be configuration objects (system prompt + model config + tool access list), not runtime entities with their own execution loops.
- Each `createStep` in a workflow references an agent config by ID to get its system prompt, but the step itself handles execution via the existing `GoogleGenAI` client pattern.
- The agent registry is a simple DB-backed lookup table, not a service locator pattern with `getAgent("briefing").execute()` methods.
- Avoid giving agents "memory" separate from the workflow context -- all state flows through Mastra workflow step inputs/outputs, which is the established pattern in all 5 existing workflows.

**Warning signs:**
- Agents having their own `execute()` method that duplicates `createStep` logic.
- Multiple `GoogleGenAI` client instantiations (one per agent) instead of a shared client with different prompts.
- String-based agent lookups (`getAgent("briefing")`) scattered throughout the codebase.
- Agent configurations storing tool lists that duplicate what is already registered in `Mastra` constructor.

**Phase to address:**
Agent architecture phase -- define the agent-as-configuration pattern before implementing individual agents.

---

### Pitfall 8: HITL 3-Stage Generation for Touches 1-3 Without Handling Simpler Flows

**What goes wrong:**
Touch 4's 17-step workflow with 3 suspend/resume points makes sense because it involves transcript parsing, brief generation, approval, RAG retrieval, deck assembly, and asset review. Touches 1-3 are fundamentally simpler flows (select slides, assemble deck, save to Drive). Applying the same 3-stage HITL pattern (generate -> review -> approve) to Touch 1 (a 1-2 page pager) creates unnecessary friction -- sellers must approve a brief and review assets for a document that takes 30 seconds to scan. The workflow becomes the bottleneck instead of the enabler.

**Why it happens:**
Developers apply a uniform pattern ("every touch gets 3 HITL stages") for consistency, but the user need varies by touch complexity. Touch 1 might only need one approval gate (review final pager), while Touch 4 legitimately needs three.

**How to avoid:**
- Define HITL stages per touch type, not uniformly:
  - Touch 1: 1 stage (review generated pager, approve or override)
  - Touch 2: 1 stage (review selected slides, approve or reorder)
  - Touch 3: 1-2 stages (optionally review capability selection, then review deck)
  - Touch 4: 3 stages (field review, brief approval, asset review) -- existing pattern
- Each touch workflow should have a configurable number of suspend points, not a hardcoded three.
- The UI should adapt: Touch 1 shows a simple approve/override flow, Touch 4 shows the full multi-step stepper.

**Warning signs:**
- Sellers skipping approval steps on Touches 1-2 because they always click "Approve" without reading.
- Touch 1 taking 3 clicks to complete what should take 1.
- Workflow code for Touch 1 having empty/passthrough suspend points that exist only for "consistency."

**Phase to address:**
HITL workflow phase -- design per-touch HITL stages before implementing any new workflows.

---

### Pitfall 9: Deal Detail Navigation Overhaul Breaking Existing Review Flows

**What goes wrong:**
The existing app has working routes for brief review (`/deals/[dealId]/review/[briefId]`) and asset review (`/deals/[dealId]/asset-review/[interactionId]`). The new milestone introduces "Deal detail navigation overhaul with breadcrumbs and sidebar sub-pages" which restructures the deal detail into Overview, Briefing, Touch 1-4, and Assets sub-pages. If the new navigation replaces the existing routes without maintaining backward compatibility, active deals with pending approvals (which have URLs stored in notifications, emails, or bookmarks) break. The existing `Alert` components on the deal page link to these exact routes.

**Why it happens:**
Navigation refactors feel like pure UI work, but URLs are API contracts. The existing `InteractionTimeline` component, `Alert` banners, and any stored links all encode the current URL structure.

**How to avoid:**
- Keep existing `/deals/[dealId]/review/[briefId]` and `/deals/[dealId]/asset-review/[interactionId]` routes as redirects to the new structure, or keep them as-is within the new layout.
- Design the new sub-page structure to include the review flows rather than replace them.
- Audit all `Link` components and `router.push()` calls that reference deal routes before restructuring.

**Warning signs:**
- 404 errors on previously-working review URLs.
- Alert banners in the deal page linking to nonexistent routes.
- Users bookmarking deal pages and getting 404s after deployment.

**Phase to address:**
Deal detail navigation phase -- audit existing routes before restructuring; implement redirects for any changed URLs.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing chat messages as JSON blob in InteractionRecord | No migration needed, fast to ship | Cannot query individual messages, no pagination, blob grows unbounded | Never -- chat is a first-class feature requiring proper tables |
| Deriving deal status from interactions on every render | No new column or migration needed | N+1 queries on deals list, inconsistent status across views | Only for initial prototype within first plan; must add explicit column before pipeline view |
| Hardcoding agent system prompts during initial development | Faster iteration without settings UI dependency | Prompts diverge between dev and prod, no version history | Acceptable during initial agent phase if migration to DB-backed config is planned in same milestone |
| Using module-level Map for chat session state (existing pattern) | Avoids DB writes for ephemeral state | Lost on Railway server restart, fails with horizontal scaling | Acceptable for single-instance Railway deployment; document as known limitation |
| Sharing Google Drive files via `makePubliclyViewable` (existing pattern) | Simple, works for iframe preview | All deal artifacts publicly accessible to anyone with link | Only acceptable during demo/hackathon phase; must replace with scoped sharing for production |
| Copy-pasting Touch 4 workflow as template for Touches 1-3 | Fast to get started | 4 workflows with duplicated utility code diverging over time | Never -- extract shared steps (folder creation, Drive saving, interaction recording) into reusable step factories |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Mastra suspend/resume + Deal.status | Updating `Deal.status` after workflow step completes but outside the step's Prisma transaction, causing status to be "generating" even though the step already finished | Update `Deal.status` inside the workflow step's `execute()` function, in the same `prisma.$transaction` that updates `InteractionRecord.status` |
| Google Drive folder creation + concurrent workflows | Calling `getOrCreateDealFolder` from multiple workflows without locking -- both pass the "folder exists?" check before either creates | Use `Deal.driveFolderId` as a cached result; if null, acquire a row-level lock on the Deal row (`SELECT FOR UPDATE`) before calling Drive API, then update the column |
| Mastra PostgresStore + workflow step schema changes | Changing workflow step schemas between deployments while suspended workflows exist in the store -- resume fails with Zod validation errors | Never change the schema of a step that has active suspended instances; add new steps instead; migrate old runs via a one-time cleanup script |
| Google Slides iframe + Drive sharing model change | Using `makePubliclyViewable` for preview in current code, then switching to restricted sharing in the same milestone, breaking all existing previews | Decide the sharing model once at the start of the milestone; if restricted, use a server-side proxy endpoint for previews instead of direct iframe |
| Next.js Server Actions + streaming chat | Using Server Actions for chat message send/receive, which creates a new HTTP request per action and does not support streaming responses | Use a dedicated API route with `ReadableStream` for chat responses (following the existing `/deck-structures/:touchType/chat` streaming pattern); Server Actions are fine for loading history |
| Prisma + new FKs to existing tables | Adding `agentConfigVersionId` FK to `InteractionRecord` in a migration, but existing rows have null values and the FK is non-nullable | Always make new FK columns nullable with no default; backfill in a separate migration or application-level script |
| Agent config versioning + existing workflow runs | Workflow reads "current" agent config on resume instead of the version it started with | Store `agentConfigVersionId` in workflow step context at start time; read from context (not DB) at resume time |
| Deal assignment + user auth | Assuming `userId` from Supabase Auth is stable across sessions; using email as identifier instead | Use `userId` (stable UUID) for ownership/assignment; email is for display only. The existing `UserGoogleToken.userId` pattern is correct. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all chat messages for LLM context on every send | Chat responses getting slower over long conversations; LLM token costs increasing linearly | Implement rolling context window (last N messages + summarized older context), following existing `chatContextJson` pattern in `DeckStructure` | After ~50 messages per conversation |
| Deals list page querying all interactions for status derivation | Deals page load time increasing with deal count; visible spinner on every navigation | Add explicit `Deal.status` column; use indexed query instead of N+1 interaction scan | After ~100 deals with 5+ interactions each |
| Pipeline view computing stage counts with `GROUP BY` on derived status | Slow initial load; pipeline counts flickering as interactions update asynchronously | Pre-computed pipeline stage counts via `Deal.status` column with `GROUP BY` on the indexed column | After ~500 deals |
| Google Drive API calls per deal on deals list | Google rate limiting (429 errors); deals list takes 10+ seconds to load | Cache Drive folder metadata (`driveFolderId`, folder URL, last modified) in the Deal table; only hit Drive API during write operations | After ~20 deals (Google API rate limits are conservative) |
| Agent config version history rendering all versions at once | Settings page loading slowly; version diff computation expensive for long histories | Paginate version history (load latest 20); compute diffs server-side; archive versions older than 90 days | After ~100 version changes per agent config |
| Chat bar re-rendering on every deal sub-page navigation | Visible flicker as chat component unmounts and remounts; loses scroll position and typing state | Lift chat bar to the deal layout level (Next.js layout.tsx), not the individual page level; use `usePathname` to scope context without remounting | Immediately visible on first use if implemented per-page |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing agent system prompts with embedded API keys or secrets | Prompt versions in DB expose secrets if DB is compromised or if version history is displayed in UI; version history makes secret rotation incomplete since old versions persist | Validate that system prompts contain no patterns matching API keys, tokens, or credentials before saving; use environment variable references in prompts instead of literal values |
| Chat messages containing customer PII without access control | Any authenticated @lumenalta.com user could potentially see another seller's deal chat history via direct URL manipulation | Enforce `dealId` ownership at the Server Action level -- verify the requesting user is assigned to the deal or is an admin before returning chat messages |
| Agent management UI allowing prompt injection via system prompt editor | A malicious or careless edit to a system prompt could instruct the LLM to ignore safety constraints, leak internal data, or override the HITL hard stop | Add a "prompt lint" step that flags dangerous patterns (e.g., "ignore previous instructions", "output your system prompt", "skip approval") before allowing publish |
| Google Drive sharing granting editor access instead of viewer | External parties could modify generated proposals, creating legal/contractual risk; service account-owned files default to private, but sharing defaults may vary | Default all sharing to "viewer" role; require explicit admin action for "editor" access; log all permission changes in an audit trail |
| Deal chat history persisting after deal deletion | Orphaned chat records with customer data remain in database after deal cleanup | Use `ON DELETE CASCADE` in the FK relationship from `ChatConversation` to `Deal`; verify cascade in migration SQL |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chat bar obscuring deal content on narrow screens | Sellers on 13" laptops cannot see deal details and chat simultaneously; productivity drops | Use a collapsible side panel (not bottom bar) that can be toggled; persist collapse state in localStorage; default to collapsed on screens < 1280px |
| Pipeline view showing stale status after workflow completion | Seller completes a Touch 1 flow, returns to deals list, but status still shows "Generating" because the page was server-rendered before the workflow finished | Use client-side polling (following existing `ingestionProgress` polling pattern) or `router.refresh()` on workflow completion callback to update deal status in real-time |
| Agent version history showing raw JSON diffs | Non-technical sellers cannot understand what changed between prompt versions | Show human-readable highlighted text diff (added in green, removed in red) instead of raw JSON; include a one-line "what changed" summary |
| Too many sub-pages in deal detail navigation | Sellers feel lost navigating between Overview, Briefing, Touch 1, Touch 2, Touch 3, Touch 4, Chat -- 7+ pages per deal with deep nesting | Group touches under a single "Engagement" tab with a touch type selector; keep top-level deal navigation to 3-4 items (Overview, Prep, Engagement, Assets) |
| HITL approval steps without clear "what am I approving?" context | Reviewer clicks "Approve" without understanding consequences; approvals become rubber stamps that defeat the purpose of HITL | Show explicit consequence text before each approval button: "Approving this brief will start slide generation (~5 minutes)" or "Approving will save the final deck to Google Drive and share with the prospect" |
| Chat bar losing state on sub-page navigation | User types a long message, navigates to a different deal sub-page, and their draft message disappears | Lift chat to deal-level layout; use `useRef` or localStorage to persist draft messages across navigations within the same deal |

## "Looks Done But Isn't" Checklist

- [ ] **Deal Pipeline View:** Often missing pipeline stage transitions on edge cases -- verify that deals move from "qualifying" to "engaged" when the first touch interaction starts AND that they don't move backward when a second touch starts
- [ ] **Persistent Chat:** Often missing conversation cleanup on deal deletion -- verify that deleting a deal cascades to delete all associated chat conversations and messages via `ON DELETE CASCADE`
- [ ] **HITL 3-Stage Generation for Touches 1-3:** Often missing the "cancel" path -- verify that a seller can abandon a touch generation mid-workflow without leaving orphaned suspended runs in Mastra PostgresStore
- [ ] **Google Drive Folder Sharing:** Often missing the "user already has access" check -- verify that sharing a folder with a user who already has access doesn't throw a Google API error or create duplicate permission entries
- [ ] **Agent Versioning:** Often missing the "no published version" edge case -- verify that the system handles an agent config with only draft versions (no published version yet) without crashing workflows
- [ ] **Agent Management UI:** Often missing optimistic UI rollback on save failure -- verify that if the API call to save a draft fails, the UI reverts to the previous state instead of showing the unsaved draft as current
- [ ] **Deal Detail Breadcrumbs:** Often missing dynamic segment resolution -- verify that breadcrumbs show "Meridian Capital Group > Q1 Pitch > Touch 2" not "deals > cuid123 > touch_2"
- [ ] **Chat Bar Across Pages:** Often missing message ordering guarantees -- verify that rapidly sent messages appear in send order, not arrival order, especially when streaming responses are in flight
- [ ] **Deal Assignment:** Often missing the "unassigned deal" state -- verify that deals without a `salespersonName` are visible in the pipeline and can have workflows started
- [ ] **Touch 1-3 HITL workflows:** Often missing interaction history continuity -- verify that starting a new Touch 1 flow on a deal that already has a completed Touch 1 creates a new InteractionRecord, not overwrites the old one

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate Drive folders | LOW | Query Drive API for duplicate-named folders under parent; merge contents into the older folder; update `Deal.driveFolderId`; delete duplicate |
| Chat context window overflow | LOW | Add summarization step to conversation; truncate messages older than threshold; re-summarize context for next LLM call |
| Deal status inconsistency between views | MEDIUM | Write a one-time migration script that scans all deals, computes correct status from interactions, updates explicit `Deal.status` column; add constraint to prevent future drift |
| Agent prompt version causing quality regression | LOW | Revert to previous published version via Settings UI one-click action; re-run affected workflows if needed |
| Workflow schema change breaking suspended runs | HIGH | Write a data migration to transform suspended workflow payloads in Mastra PostgresStore to match new schema; or force-complete old runs with error status and notify users to restart |
| Migration failure on production database | HIGH | Inspect failed migration SQL; write corrective forward-only migration; apply with `prisma migrate resolve --applied`; never reset. Test future migrations against schema clone first |
| Existing review route URLs breaking after navigation refactor | LOW | Add Next.js redirect rules in `next.config.ts` mapping old routes to new structure; keep as permanent redirects |
| Chat bar losing state on navigation | LOW | Move chat component to deal layout level; restore from localStorage on remount |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Workflow state explosion from concurrent touches | Deal management foundation (schema + lifecycle) | Create two Touch workflows on the same deal simultaneously; verify no duplicate folders and no status races |
| Chat scoping confusion | Persistent AI chat | Send a message on Touch 2 page, navigate to Touch 4 page; verify chat context is scoped correctly and does not leak cross-touch |
| Deal status as implicit state machine | Deal management foundation (schema + lifecycle) | Run a deal through full lifecycle (new -> qualifying -> proposal -> won); verify pipeline view counts match deals list at every stage |
| Prisma migration drift from batched models | Every phase (enforce in each plan) | Each plan specifies exact migration name(s); CI runs `prisma migrate deploy` against test DB clone before production |
| Agent prompt versioning without run-time pinning | Agent architecture | Create version 1, publish, create version 2, publish, start a Touch 4 workflow, change prompt mid-suspension, resume; verify resumed steps use version from start |
| Drive folder permissions cascading | Google Drive integration | Create a deal folder, share with specific user; verify non-shared user cannot access; verify shared user can view but not edit |
| Named agents becoming god objects | Agent architecture | Verify each "agent" is a configuration record (DB row); grep for `agent.execute()` or `new Agent()` patterns -- they should not exist |
| HITL stage count mismatch per touch type | HITL workflow design | Touch 1 has 1 approval gate; Touch 4 has 3; verify no empty passthrough suspend points |
| Navigation refactor breaking existing routes | Deal detail navigation | Visit all existing deal routes (`/review/[briefId]`, `/asset-review/[id]`); verify they still resolve correctly after restructure |

## Sources

- Direct codebase analysis of `/Users/marlonburnett/source/lumenalta-hackathon` (50,876 LOC across 40 phases)
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts`: 17-step pipeline with 3 suspend points (field review, brief approval, asset review)
- `apps/agent/src/lib/drive-folders.ts`: `getOrCreateDealFolder()` idempotent pattern, `makePubliclyViewable()` public sharing
- `apps/agent/prisma/schema.prisma`: 14 existing models including Deal (no status column), InteractionRecord (7+ status values), DeckStructure/DeckChatMessage (scoped chat pattern)
- `apps/web/src/app/(authenticated)/deals/[dealId]/page.tsx`: current deal detail with Alert banners linking to review routes
- `apps/web/src/app/(authenticated)/deals/page.tsx`: current deals list with `listDealsAction`
- `apps/agent/src/mastra/index.ts`: 47 lines of imports, route registrations, existing API structure
- `apps/agent/src/deck-intelligence/chat-refinement.ts`: existing streaming chat pattern with context summarization
- CLAUDE.md: Prisma migration discipline (no `db push`, no reset, forward-only migrations)
- PROJECT.md: v1.7 milestone scope, constraints, and key decisions

---
*Pitfalls research for: v1.7 Deals & HITL Pipeline milestone on Lumenalta Agentic Sales Orchestration*
*Researched: 2026-03-08*
