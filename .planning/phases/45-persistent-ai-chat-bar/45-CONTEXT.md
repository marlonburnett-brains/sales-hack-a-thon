# Phase 45: Persistent AI Chat Bar - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can interact with a deal-scoped AI assistant on any deal sub-page for notes, transcripts, deal-history questions, and knowledge-base queries. The assistant should persist across navigation within a deal and stay aware of the page or touch the user is currently viewing. This phase covers the persistent chat experience around the deal; Touch 1-4 HITL artifact generation flows remain in Phase 46.

</domain>

<decisions>
## Implementation Decisions

### Conversation scope
- Use one deal-wide conversation thread, not separate per-page or per-touch threads
- The thread must keep awareness of the current page or touch the seller is viewing so answers stay grounded in visible context
- Notes or transcripts attached to one touch can be reused later across the whole deal conversation, but their originating touch should remain clear
- A brand-new deal chat should open with a short assistant greeting plus a few suggested first actions

### Chat visibility
- Default presentation is a collapsed bottom dock with a clear teaser that keeps the assistant visibly available without dominating the page
- Users should be able to switch the chat between a bottom dock and a side-panel layout, and use either mode within the same deal experience
- The chat should visibly show current page/touch context in the header or similar subtle UI cue
- On entry to a page, the assistant should offer 2-3 relevant page-aware suggestions rather than auto-posting a message

### Transcript and notes binding
- When a seller pastes transcript content or meeting notes, the assistant should make a smart best guess about the target touch using current page and recent conversation, then ask for quick confirmation before binding
- If the seller is on Overview or Briefing, the assistant should ask whether the content belongs to a specific touch or should be saved as general deal notes
- Successful binding should appear inline in the chat as a lightweight confirmation chip or equivalent lightweight confirmation UI
- If pasted content looks partial, ambiguous, or messy, the assistant should ask for a quick review before saving and offer AI help to refine the input first

### Answer style
- For deal-history questions, answers should lead with a short direct answer followed by bullets or concise supporting detail
- For knowledge-base queries, show the top matches and explain why each one fits this deal rather than returning a raw result list or a single long synthesis
- When deal data is incomplete, still answer with the best available guidance but explicitly call out missing information or assumptions
- When helpful, end with 2-3 concrete next steps the seller can take from the current context

### Claude's Discretion
- Exact UI controls for switching between dock and side-panel modes
- Exact copy for greeting text, suggestions, inline transcript-binding confirmations, and gap/assumption language
- Exact visual treatment and density of response cards, match explanations, and page-context cues
- Exact heuristics for when pasted content is ambiguous enough to require confirmation or refinement before saving

</decisions>

<specifics>
## Specific Ideas

- The assistant should feel continuous across the deal, but what the user is currently looking at must always matter
- Bottom dock is the default, but sellers should be able to move the assistant into a side panel and back
- On non-touch pages, pasted content may belong either to a touch or to general deal notes, so the assistant should ask instead of assuming
- If transcript content is messy, the assistant should help refine it before binding rather than rejecting it outright

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx`: shared deal layout is the natural mount point for a chat surface that survives sub-page navigation
- `apps/web/src/components/deals/briefing-chat-panel.tsx`: existing deal-scoped assistant shell already has greeting, suggestions, input, and send affordances that can seed the new experience
- `apps/web/src/components/settings/chat-bar.tsx`: existing streaming chat UI already handles local history, streaming output, and input ergonomics that can be adapted for deal chat
- `apps/agent/src/deck-intelligence/chat-refinement.ts`: existing persisted chat pattern shows how to store scoped messages, summarized context, and trimmed history over time
- `apps/agent/prisma/schema.prisma`: existing `InteractionRecord`, `Transcript`, and `Brief` models provide the current deal artifacts and touch-linked context sources the assistant can reference

### Established Patterns
- Deal pages already use a shared layout shell plus nested routes, which supports mounting one persistent assistant for all deal sub-pages
- Web actions follow a server-action to typed API-client to agent-route flow, so chat should likely follow the same integration style as other deal features
- Streaming proxy behavior already exists for deck-structure chat in `apps/web/src/app/api/deck-structures/chat/route.ts`
- Named-agent execution is already the required LLM path from Phase 43, so deal chat should route through that same governed runtime surface

### Integration Points
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx`: primary insertion point for persistence across Overview, Briefing, and Touch pages
- `apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx`: current assistant-like briefing experience should align with the new persistent chat rather than diverge from it
- `apps/web/src/lib/actions/deal-actions.ts` and `apps/web/src/lib/actions/touch-actions.ts`: existing action layer can be extended for deal-chat reads, writes, and transcript/note binding actions
- `apps/agent/src/mastra/index.ts`: existing deal routes and deck-chat route patterns are the likely backend entry points to mirror for new deal-chat APIs
- `packages/schemas/agent-catalog.ts`: named-agent catalog already includes relevant responsibilities such as company research, discovery questions, transcript extraction, and knowledge-result extraction that Phase 45 can compose into the chat experience

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 45-persistent-ai-chat-bar*
*Context gathered: 2026-03-08*
