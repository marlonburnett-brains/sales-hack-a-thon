# Phase 34: Deck Intelligence - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view AI-inferred deck structures per touch type and refine them via conversational chat. Includes a new Settings page with nested sub-navigation (Deck Structures + Integrations). Requirements: DKI-01 through DKI-07.

</domain>

<decisions>
## Implementation Decisions

### Settings page layout
- Settings link added at bottom of sidebar nav list (above collapse button), using a Cog/Settings icon -- conventional placement
- Two sub-sections: Deck Structures and Integrations
- Left vertical tabs for sub-navigation (narrow left column with tab links, content fills right side) -- standard settings pattern (GitHub, Linear)
- Integrations section shows connection status cards for Google Workspace and AtlusAI with connected/disconnected status, account info, and reconnect actions (read-only for now)

### Deck structure display
- Collapsible accordion sections, one per touch type (Touch 1-4, Pre-Call), all visible on one scrollable page
- Vertical flow list for section visualization within each touch: numbered sections with connecting lines, each showing name, purpose, variation count, and mapped reference slides as small thumbnails
- Confidence score displayed as percentage + example count with progress bar: color-coded green (>75%), yellow (50-75%), red (<50%), with tooltip explaining calculation
- Empty state for touch types with no examples: Claude's discretion on treatment

### Chat refinement UX
- Fixed bottom bar pinned to Deck Structures content area -- messages appear above input, pushing structure content up (Copilot/assistant panel style)
- Chat history persisted per touch type with smart context optimization -- system should NOT resend all past conversation context to the LLM every time; summarize/compress resolved topics and only include relevant active context
- Streaming responses: AI response streams token-by-token in the chat, structure updates once full response is received (needs SSE or fetch streaming from agent -- no existing streaming infra)
- Inline diff highlights on structure update: green pulse for added sections, yellow for modified, with AI response summarizing changes

### AI inference approach
- Auto-inference with periodic cron job: structure auto-generates and re-generates when data changes (new examples classified), without manual trigger
- Maximum data utilization: AI receives slide descriptions (purpose, content, use cases), element maps (layout structure), classification metadata, slide position in source deck, and natural/logical sequence reasoning behind complete decks
- Examples are primary (drive the section flow pattern), templates are secondary (expand the slide options/variation pool per section) -- both contribute but with different weight
- Chat history used as system context during re-inference: summarized chat refinements become constraints for the new structure, preventing loss of human feedback when auto re-inferring after new examples are added
- Structure should be a self-reinforcing feedback loop: system retro-feeds itself + human interactions to continuously improve

### Claude's Discretion
- Exact LLM prompt engineering for deck structure inference
- Structured output schema design for deck structure data
- Chat context summarization/compression strategy
- Cron job frequency and change detection logic
- Streaming implementation details (SSE vs fetch streaming)
- Empty state treatment for touch types without examples
- Integrations page data fetching and display details

</decisions>

<specifics>
## Specific Ideas

- The system should be "as smart and efficient as possible" -- avoid redundant LLM calls, cache aggressively, and optimize context windows
- Inference should borrow from templates to broaden options: "borrowing for templates in terms of broadening the options" for slide variations per section
- All possible insights should be extracted from examples: "natural/logical sequence/reasoning behind a complete deck" -- not just what slides exist, but WHY they're in that order
- The feedback loop is critical: classification -> inference -> chat refinement -> re-inference with human context -> better structures over time

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/sidebar.tsx`: Sidebar with 5 nav items and collapse/mobile support -- add Settings as 6th item at bottom
- `apps/agent/src/ingestion/classify-metadata.ts`: LLM structured output pattern via Google GenAI -- reuse for deck structure inference
- `packages/schemas/constants.ts`: TOUCH_TYPES constant (touch_1-4, pre_call) -- use for touch type tabs/accordions
- `SlideElement` model and `SlideEmbedding.description`: Phase 33 data that feeds inference (element maps + AI descriptions)
- `contentClassification` field on Template model: Classification status for filtering examples vs templates
- shadcn/ui components: Accordion, Card, Progress, Badge all available

### Established Patterns
- Server Actions for web-to-agent communication (no direct DB access from web)
- API key auth (Authorization: Bearer) for web-to-agent calls
- Polling pattern for async operations (ingestion progress)
- JSON structured output via Google GenAI `responseSchema`
- Prisma for all non-vector DB operations
- Mastra workflows for complex multi-step agent operations

### Integration Points
- New `/settings` route under `(authenticated)` route group
- New Settings layout with left vertical tabs sub-navigation
- Sidebar navItems array: add Settings entry
- Agent: new deck structure inference endpoint(s)
- Agent: new chat refinement endpoint with streaming response
- New DB model(s) for persisted deck structures and chat history
- Cron/background job for auto re-inference on data changes

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 34-deck-intelligence*
*Context gathered: 2026-03-07*
