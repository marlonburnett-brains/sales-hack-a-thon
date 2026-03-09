# Phase 43: Named Agent Architecture - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Formalize every LLM interaction in the system as a named agent with a dedicated, versioned system prompt. This phase defines the agent catalog shape, responsibility boundaries, and prompt-layering rules that downstream planning and the later agent-management UI will build on.

</domain>

<decisions>
## Implementation Decisions

### Agent roster scope
- All current LLM touchpoints become first-class named agents in this phase, not just seller-facing runtime flows
- Background jobs such as slide classification, slide description, and template auto-classification should be formalized as equal members of the agent catalog
- Deck-structure inference and deck-structure chat refinement should be separate named agents, not one shared deck-intelligence agent
- When the same responsibility appears across touches, prefer a shared job-based agent instead of duplicating agents per touch

### Agent granularity
- Default to one clear responsibility per agent
- If two prompts mostly differ by output shape or mode but serve the same job, keep them in the same agent family rather than creating a whole new agent
- Touch 4 should keep explicit sub-roles where the work is already clearly distinct today, including extraction, briefing, ROI framing, slide selection, and FAQ generation
- When in doubt, prefer cleaner responsibility boundaries over keeping the total agent count small

### Naming style
- Use role-based names for the formal agent catalog
- Names should be plain-language and understandable to product/admin users, not just engineers
- Names should emphasize business function over model mechanics
- Shared agents should keep touch-agnostic names unless the responsibility is truly touch-specific

### Shared prompt baseline
- Use a shared Lumenalta baseline prompt layer plus a focused role-specific prompt layer for each named agent
- The shared baseline should carry brand and governance rules, especially approved-building-block limits and HITL expectations
- Specialist behavior should be expressed by overriding within the role-specific prompt, not by abandoning the shared baseline
- Keep consistency high across the roster so the full catalog feels like one governed system

### Claude's Discretion
- Exact agent IDs and storage keys behind the user-facing names
- Exact catalog membership for borderline cases where research finds two current prompts should stay together as one family
- Exact caching and prompt-loading mechanics, as long as published versions remain the source of truth

</decisions>

<specifics>
## Specific Ideas

- The catalog should read like a product-facing role roster, not a list of workflow IDs or internal step names
- Shared agents should stay reusable across touches whenever the underlying job is the same
- Background and maintenance prompts should be treated as real agents, not second-class internals
- The prompt system should have one consistent Lumenalta baseline rather than many fully standalone prompt documents

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts`, `apps/agent/src/mastra/workflows/touch-4-workflow.ts`, `apps/agent/src/mastra/workflows/pre-call-workflow.ts`: existing workflow prompt sites that define several natural first-pass agent roles
- `apps/agent/src/lib/slide-selection.ts`, `apps/agent/src/lib/proposal-assembly.ts`, `apps/agent/src/lib/atlusai-search.ts`: shared LLM utilities that already map to reusable job-based agent families
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` and `apps/agent/src/deck-intelligence/chat-refinement.ts`: existing split between inference and refinement supports separate named deck agents
- `apps/agent/prisma/schema.prisma`: existing `DeckStructure` and `DeckChatMessage` models provide a precedent for DB-backed AI configuration/history patterns

### Established Patterns
- Prompts are currently defined close to their execution sites rather than centralized, so planning should account for extracting inline prompt text into a formal agent layer without losing call-site clarity
- The agent service already routes most backend behavior through `apps/agent/src/mastra/index.ts`, which is the current integration hub for workflows and custom API routes
- Existing AI features already distinguish clear job types such as extraction, generation, selection, inference, refinement, and classification; this supports a responsibility-first catalog rather than a small set of broad generalists
- Current Settings surfaces use plain-language navigation and role-readable labels, which supports a product-facing naming scheme for the future management UI

### Integration Points
- `apps/agent/src/mastra/index.ts`: runtime workflows and API routes will need prompt resolution to flow through the named-agent layer
- `apps/agent/src/mastra/workflows/*.ts`: current inline workflow prompts are prime migration targets for named agent adoption
- `apps/agent/src/ingestion/*.ts`, `apps/agent/src/lib/*.ts`, and `apps/agent/src/deck-intelligence/*.ts`: non-workflow LLM helpers must also be included so the catalog truly covers all LLM interactions
- `apps/web/src/app/(authenticated)/settings/layout.tsx` and future Phase 44 work: user-facing naming and version semantics chosen here will directly shape the management UI

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 43-named-agent-architecture*
*Context gathered: 2026-03-08*
