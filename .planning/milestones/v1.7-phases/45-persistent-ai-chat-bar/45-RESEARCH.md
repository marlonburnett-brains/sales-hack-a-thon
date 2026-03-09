# Phase 45: Persistent AI Chat Bar - Research

**Researched:** 2026-03-08
**Domain:** Deal-scoped persistent chat UX, chat persistence, transcript/note binding, and grounded retrieval for deal pages
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-01 | User can access a persistent AI chat bar on any deal sub-page | Mount a client chat shell in `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx`, keep UI state in the shared layout tree, and derive live page context in a client child with Next navigation hooks |
| CHAT-02 | User can add context or notes to the deal via chat | Add a generic persisted deal-context source model for notes/transcripts instead of overloading the existing Touch 4 `Transcript` row; return inline confirmation metadata in the chat response |
| CHAT-03 | User can upload/paste call transcripts and bind them to a specific touch step via chat | Use best-guess binding based on current route + recent messages + existing `InteractionRecord`s, but require explicit confirmation before save; store origin touch clearly and allow general deal-note binding |
| CHAT-04 | User can ask questions about the deal's data and history via chat | Build one deal-chat agent/orchestrator that grounds answers in deal, interaction, transcript/note-source, and current page context; answer short-first, then bullets, then next steps |
| CHAT-05 | User can query similar cases/use cases from the knowledge base via chat | Reuse existing AtlusAI search via `searchSlides()` / `knowledge-result-extractor`, and render top matches with why-fit explanations instead of a single synthesized blob |
</phase_requirements>

## Summary

The safest plan is to treat Phase 45 as a persistent deal-level shell plus a new deal-chat persistence layer, not as a thin reskin of `BriefingChatPanel` and not as an extension of the existing deck-structure chat. The shared deal layout is already the correct mount point for persistence across Overview, Briefing, and Touch pages, and Next.js layouts are cached across client navigation. But the layout itself will not re-render with fresh child route context, so the live page/touch cue must come from a client component inside that layout using navigation hooks rather than from the async server layout alone.

The biggest data-model trap is transcript storage. The current `Transcript` model is tightly coupled to `InteractionRecord`, is one-to-one, requires `subsector`, and is still wired to the Touch 4 workflow. That makes it a poor fit for generic pasted content from Overview, Briefing, or early touch pages. Plan for a new generic deal-context source record for pasted notes/transcripts and keep `Transcript` as the later Touch 4 workflow artifact. This avoids schema collisions and keeps Phase 46 free to consume confirmed chat-ingested sources instead of retrofitting the current Touch 4 pipeline.

For runtime behavior, reuse the repo's existing streaming proxy pattern and named-agent governance from Phase 43. Add one seller-facing deal-chat agent/orchestrator, let it call or compose existing named-agent responsibilities where needed, and keep the chat protocol simple: stream assistant text, then append one final structured payload containing suggestions, binding confirmations, and knowledge-match cards. Do not adopt Mastra memory as the primary persistence mechanism in this phase; the current runtime path talks directly to `@google/genai`, and the domain needs explicit deal artifacts, origin-touch metadata, and binding confirmations that generic thread storage does not model well by itself.

**Primary recommendation:** Mount a client `PersistentDealChat` in the deal layout, persist one server-side thread per deal in new Prisma tables, store pasted notes/transcripts in a generic deal-context model rather than `Transcript`, and reuse the existing streaming proxy + named-agent execution pattern for answers and structured side effects.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `^15.5.12` in repo | Shared App Router layout for persistent deal shell | Official layout behavior matches the requirement: shared UI can persist across sub-page navigation when mounted above child pages |
| `react` / `react-dom` | `^19.0.0` in repo | Client chat shell, streaming state, route-aware suggestions | Required for a client child that can observe route changes while the layout remains mounted |
| `prisma` / `@prisma/client` | `^6.3.1` in repo; stay on Prisma 6.x per project state | Persist deal chat thread, messages, summaries, and source bindings | Fits project migration discipline and keeps deal-chat data in the app schema, not a framework-owned store |
| `@google/genai` + Phase 43 named-agent executor | `^1.43.0` in repo | Stream governed deal-chat responses through published prompts | This is the repo's active LLM execution path today, and Phase 43 requires new prompt-bearing behavior to be formalized as named agents |
| `zod` + `@lumenalta/schemas` | `^4.3.6` + workspace | Validate chat request/response payloads and structured side-effect metadata | Matches existing route and workflow contracts across web and agent apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-dialog` | `^1.1.15` in repo | Mobile-safe side-panel / drawer presentation | Use for the side-panel mode, especially on smaller screens where a fixed desktop side rail would crowd the page |
| `sonner` | `^2.0.7` in repo | Non-blocking error feedback for failed sends or save retries | Use for transient failures; keep successful note/transcript binding confirmations inline in the chat stream per user decision |
| `vitest` | `^4.0.18` in repo | Route, reducer, and persistence tests in both apps | Use for web proxy parsing and agent-side persistence/heuristic coverage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New Prisma deal-chat models | Mastra Memory threads/messages | Mastra now supports threads and message recall, but the current repo runtime bypasses agent memory APIs, and generic thread storage does not by itself model transcript binding, origin touch, or inline save confirmations |
| Generic deal-context source table | Reuse `Transcript` directly | `Transcript` is one-to-one with `InteractionRecord`, requires `subsector`, and is still coupled to Touch 4 workflow semantics |
| Existing `text/plain` stream + final delimiter payload | SSE/AI SDK event protocol | A richer protocol is possible, but the repo already has a working streaming proxy/client parser pattern; changing protocols would add risk without solving the core product problem |

**Installation:**
```bash
# Recommended Phase 45 path uses existing repo dependencies.
# If new tables are added, inspect and apply a forward-only migration.
pnpm --filter agent exec prisma migrate dev --name persistent-ai-chat-bar --create-only
pnpm --filter agent exec prisma migrate dev
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/web/src/
├── app/(authenticated)/deals/[dealId]/layout.tsx        # mount persistent chat shell here
├── app/api/deals/[dealId]/chat/route.ts                 # streaming web proxy for browser fetch
├── components/deals/persistent-deal-chat.tsx            # route-aware shell, dock/side-panel modes
├── components/deals/deal-chat-thread.tsx                # message list, inline chips, suggestions
└── lib/actions/deal-chat-actions.ts                     # history load + note/transcript mutations

apps/agent/src/
├── deal-chat/assistant.ts                               # orchestration, answer shaping, tool selection
├── deal-chat/context.ts                                 # load deal, interactions, current route context
├── deal-chat/bindings.ts                                # note/transcript binding heuristics + save flow
└── deal-chat/summary.ts                                 # prompt-summary generation without deleting UI history

apps/agent/prisma/
└── schema.prisma                                        # DealChatThread, DealChatMessage, DealContextSource (or equivalent)
```

### Pattern 1: Mount the Persistent Shell in the Shared Deal Layout
**What:** Put a single client chat shell under the shared deal layout so it survives sub-page navigation within a deal.
**When to use:** Always for CHAT-01; do not mount separate chat roots in `overview/page.tsx`, `briefing/page.tsx`, or Touch pages.
**Example:**
```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/layout
'use client'

import { useSelectedLayoutSegments } from 'next/navigation'

export function DealRouteContextCue() {
  const segments = useSelectedLayoutSegments()
  const [section, touch] = segments

  const label = section === 'touch'
    ? `Touch ${touch}`
    : section === 'briefing'
      ? 'Briefing'
      : 'Overview'

  return <span>{label}</span>
}
```

### Pattern 2: Keep One Deal Thread, but Stamp Every Turn with Route Context
**What:** Persist one conversation thread per deal, but attach the active page/touch context to each user turn and reflect the current context in the header and suggestion set.
**When to use:** Every send, every initial greeting, and every page-entry suggestion refresh.
**Example:**
```ts
// Source: project pattern adapted from apps/web/src/lib/api-client.ts and apps/agent/src/mastra/index.ts
type DealRouteContext = {
  section: 'overview' | 'briefing' | 'touch'
  touchType: 'touch_1' | 'touch_2' | 'touch_3' | 'touch_4' | null
  pathname: string
}

type DealChatRequest = {
  message: string
  context: DealRouteContext
}
```

### Pattern 3: Separate Visible History from Prompt Memory
**What:** Keep full chat history visible to the seller in the database, but maintain a separate summarized memory field for prompt compaction.
**When to use:** Once the deal thread grows beyond the prompt budget.
**Example:**
```ts
// Source: project pattern from apps/agent/src/deck-intelligence/chat-refinement.ts
const recentMessages = allMessages.slice(-8)
const summary = await summarizeOldMessages(allMessages.slice(0, -8))

await prisma.dealChatThread.update({
  where: { id: threadId },
  data: { promptSummary: summary },
})

// Keep historical messages for UI; only the prompt input is compacted.
```

### Pattern 4: Stream Text First, Then a Final Structured Side-Effect Payload
**What:** Send plain assistant text as the stream body, then append one final JSON payload for chips, suggested actions, and knowledge-match cards.
**When to use:** For all assistant replies that may produce UI affordances or save confirmations.
**Example:**
```ts
// Source: project pattern from apps/agent/src/mastra/index.ts and apps/web/src/components/settings/chat-bar.tsx
controller.enqueue(encoder.encode(chunk))
controller.enqueue(encoder.encode('\n---DEAL_CHAT_META---\n'))
controller.enqueue(
  encoder.encode(JSON.stringify({
    chips: [{ kind: 'binding-confirmed', label: 'Saved to Touch 2 transcript' }],
    suggestions: ['Ask what changed since last touch'],
  })),
)
```

### Pattern 5: Store Pasted Notes/Transcripts as Generic Deal Sources
**What:** Save pasted content into a generic deal-context source table with nullable touch binding and clear provenance, then let later workflows consume it.
**When to use:** CHAT-02 and CHAT-03, especially from Overview and Briefing where a touch may be unknown at first.
**Example schema shape:**
```prisma
// Source: recommendation derived from apps/agent/prisma/schema.prisma Transcript constraints
model DealContextSource {
  id             String   @id @default(cuid())
  dealId         String
  sourceType     String   // "note" | "transcript"
  touchType      String?  // null for general deal notes
  interactionId  String?  // nullable until a concrete InteractionRecord exists
  rawText        String
  refinedText    String?
  originPage     String
  status         String   // "pending_confirmation" | "saved"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### Anti-Patterns to Avoid
- **Page-local chat roots:** mounting separate chat instances in Overview, Briefing, and Touch pages breaks persistence and duplicates state.
- **Reading live pathname in the server layout:** Next.js layouts do not re-render on navigation, so route context will go stale.
- **Reusing `Transcript` for generic pasted content:** its Touch 4 coupling will force bogus `InteractionRecord` and `subsector` requirements.
- **Deleting old seller-visible messages during compaction:** acceptable for deck-refinement tooling, but wrong for a persistent seller conversation.
- **Auto-saving ambiguous pasted content:** the user explicitly decided confirmation is required when the target touch is uncertain or the input is messy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deal knowledge retrieval | New ad-hoc search engine or fuzzy keyword matching | Existing `searchSlides()` pipeline plus `knowledge-result-extractor` | It already handles MCP semantic search, Drive fallback, and normalized result extraction |
| Chat streaming transport | New websocket stack | Existing `fetch()` + `ReadableStream` proxy pattern | The repo already ships and tests this pattern end-to-end |
| Side-panel modal behavior | Custom focus trap / portal logic | Existing Radix dialog wrapper in `apps/web/src/components/ui/dialog.tsx` | Accessibility and keyboard/focus handling are already solved |
| Long-history prompt memory | Raw full-history replay every turn | Separate prompt summary field plus recent-turn window | Keeps context grounded without destroying user-visible history or relying on experimental cross-thread memory |
| Transcript persistence | Forcing generic notes into Touch 4 `Transcript` rows | New generic deal-context source model | Avoids invalid schema coupling and preserves a clean handoff into Phase 46 |

**Key insight:** the hard part is not rendering a docked chat box; it is separating three concerns cleanly: persistent UI state, persistent conversation history, and persisted deal artifacts like notes/transcripts that must outlive the chat itself.

## Common Pitfalls

### Pitfall 1: Stale Page Context in the Layout
**What goes wrong:** The chat header or suggestions stay on "Overview" after the user navigates to Briefing or a Touch page.
**Why it happens:** Next.js layouts are cached and do not re-render during client navigation.
**How to avoid:** Derive the active page/touch inside a client child with `useSelectedLayoutSegments()` or `usePathname()`.
**Warning signs:** Suggestions feel one page behind; route cue only changes on full refresh.

### Pitfall 2: Backing CHAT-03 with the Existing `Transcript` Model
**What goes wrong:** Saving pasted content requires creating fake interactions, fake subsectors, or Touch 4-only assumptions.
**Why it happens:** `Transcript` is one-to-one with `InteractionRecord` and currently serves the Touch 4 workflow.
**How to avoid:** Add a generic deal-context source model now; let Phase 46 convert confirmed sources into workflow-specific artifacts later.
**Warning signs:** Planner tasks mention creating placeholder `InteractionRecord`s just to store pasted text.

### Pitfall 3: Using Deck-Refinement Compaction Rules for Seller Chat
**What goes wrong:** Older messages disappear from the UI because prompt summarization deletes them from storage.
**Why it happens:** `chat-refinement.ts` is optimized for a settings tool, not a persistent seller-facing thread.
**How to avoid:** Summarize for prompt input only; keep the full seller-visible transcript unless the product explicitly introduces archive rules later.
**Warning signs:** A long-running deal chat appears to "forget" earlier visible turns even though the user expects continuity.

### Pitfall 4: Over-Synthesizing Knowledge Queries
**What goes wrong:** The assistant returns one long generic answer instead of top matches with why-fit reasoning.
**Why it happens:** The agent answers from retrieved text without preserving result structure.
**How to avoid:** Keep retrieval results structured in the final payload and render them as cards with title, excerpt, relevance, and deal-fit explanation.
**Warning signs:** CHAT-05 implementation lacks any result card or match explanation type in its response contract.

### Pitfall 5: Silent Misbinding of Notes or Transcripts
**What goes wrong:** Notes get attached to the wrong touch and later answers cite the wrong origin.
**Why it happens:** Heuristics are treated as final truth instead of a best guess.
**How to avoid:** Use heuristics only to preselect the likely target, then require a quick confirmation step before save.
**Warning signs:** Successful save flows contain no confirmation chip, no origin label, and no place for the seller to correct the guessed touch.

## Code Examples

Verified patterns from official sources and current project code:

### Route-aware persistent shell
```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/layout
'use client'

import { useSelectedLayoutSegments } from 'next/navigation'

export function DealChatContextBadge() {
  const segments = useSelectedLayoutSegments()
  const page = segments[0] ?? 'overview'
  return <span>{page}</span>
}
```

### Manual thread/message querying in Mastra
```ts
// Source: https://mastra.ai/docs/memory/message-history
const memory = await agent.getMemory()

const result = await memory.listThreads({
  filter: { resourceId: 'user-123' },
  perPage: false,
})

const { messages } = await memory.recall({
  threadId: 'thread-123',
  perPage: false,
})
```

### Existing repo streaming proxy pattern
```ts
// Source: apps/web/src/app/api/deck-structures/chat/route.ts
const agentRes = await fetch(agentUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.AGENT_API_KEY}`,
  },
  body: JSON.stringify({ message: body.data.message.trim() }),
})

return new Response(agentRes.body, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Page-local helper panel (`BriefingChatPanel`) | Layout-mounted persistent deal chat shell | Current Next App Router guidance + Phase 45 scope | Keeps one assistant alive across all deal sub-pages |
| Inline prompt strings / ungoverned chat logic | Named-agent governed runtime from Phase 43 | 2026-03-08 / Phase 43 completed | New deal chat must be a named agent or named-agent composition point |
| Touch 4-only transcript persistence | Generic deal-context source intake, then later workflow-specific consumption | Recommended for Phase 45 | Supports chat-based note/transcript capture without distorting Touch 4 workflow models |

**Deprecated/outdated:**
- `BriefingChatPanel` as the long-term primary assistant surface: keep it only as a source of reusable greeting/suggestion UX, not as the architecture for persistent chat.
- Mastra observational memory in `resource` scope for this phase: official docs mark it experimental and warn about cross-thread mixing and performance on existing apps.

## Open Questions

1. **What exact schema should bridge chat-ingested sources into Phase 46 workflows?**
   - What we know: `Transcript` is too Touch 4-specific, and chat needs note/transcript storage before HITL generation.
   - What's unclear: whether Phase 46 should consume generic source rows directly or copy them into workflow-specific tables at start time.
   - Recommendation: plan Phase 45 around a generic `DealContextSource` with optional `interactionId`; let Phase 46 choose copy-vs-reference explicitly.

2. **Do we need more than one new named agent?**
   - What we know: Phase 43 requires prompt-bearing work to be formalized as named agents, and this phase introduces a seller-facing assistant prompt.
   - What's unclear: whether transcript-refinement wording is distinct enough to justify a second specialist agent.
   - Recommendation: start with one `deal-chat-assistant` orchestrator and reuse existing named agents for retrieval/extraction; add a second specialist only if transcript cleanup prompts become materially different.

3. **How aggressively should prompt memory be compacted?**
   - What we know: the repo already summarizes old chat in deck refinement after 10 messages, but that tool also deletes old messages.
   - What's unclear: the right summary threshold for a seller-facing deal thread with longer-lived history.
   - Recommendation: keep all UI-visible messages, summarize only for prompt memory, and defer aggressive archival/deletion rules out of this phase.

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/api-reference/file-conventions/layout` - verified layout caching behavior, route-segment access caveats, and client-hook guidance for child segment state
- `https://mastra.ai/docs/memory/message-history` - verified current Mastra thread/message APIs, manual recall/listThreads access, and access-control caveat
- `https://mastra.ai/docs/memory/observational-memory` - verified current OM scopes, storage support, and the experimental status of resource scope
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` - confirmed the existing shared deal layout is the correct persistent mount point
- `apps/web/src/components/deals/briefing-chat-panel.tsx` - confirmed reusable greeting/suggestion/input UX exists but is page-local today
- `apps/web/src/components/settings/chat-bar.tsx` - confirmed current streaming client parser and local history handling pattern
- `apps/web/src/app/api/deck-structures/chat/route.ts` - confirmed the existing web streaming proxy pattern
- `apps/agent/src/mastra/index.ts` - confirmed the existing agent-side `ReadableStream` response pattern
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - confirmed current summarization and message-trimming approach that should be adapted, not copied literally
- `apps/agent/prisma/schema.prisma` - confirmed current `Transcript`/`InteractionRecord` coupling and absence of generic deal-chat persistence tables
- `packages/schemas/agent-catalog.ts` - confirmed current named-agent roster and likely reuse points for knowledge/transcript responsibilities

### Secondary (MEDIUM confidence)
- `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` - informed recommended CHAT-05 result-card presentation based on existing search-result UI patterns
- `apps/web/src/components/touch/touch-4-form.tsx` - confirmed Touch 4 transcript flow assumptions that make direct `Transcript` reuse risky for this phase

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - repo dependencies and framework/runtime patterns are already present, and Next/Mastra docs verify the critical behavior claims.
- Architecture: MEDIUM - layout persistence and route-context handling are clear, but the exact new schema boundary between Phase 45 and Phase 46 still needs planner judgment.
- Pitfalls: HIGH - the major risks come directly from current repo constraints (`Transcript` coupling, layout caching, existing summary deletion pattern) and current official docs.

**Research date:** 2026-03-08
**Valid until:** 2026-03-22
