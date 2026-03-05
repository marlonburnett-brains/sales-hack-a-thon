# Phase 10: Pre-Call Briefing Flow - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the pre-call briefing flow: a seller enters a company name, buyer role, and meeting context on the deal page, and receives a formatted one-pager with a company snapshot, role-specific hypotheses, prioritized discovery questions, and relevant case studies — displayed in the web app and saved as a Google Doc to shared Lumenalta Drive. The flow lives on the deal page as a "Prep" section above the existing touch flow cards and creates InteractionRecords for full tracking.

Building new touch flows, modifying existing Touch 1-4 pipelines, or adding end-to-end integration polish is out of scope — this phase delivers the pre-call briefing generation pipeline and its UI only.

</domain>

<decisions>
## Implementation Decisions

### Flow location & deal association
- Pre-call briefing lives on the deal page in a separate "Prep" section above the touch flow cards (Touch 1-4)
- Visual hierarchy: Prep section (pre-call) above Engagement section (Touch 1-4) to signal different stages
- Full interaction tracking: each briefing creates an InteractionRecord with touchType='pre_call'
- Briefing output saved to per-deal Drive folder via getOrCreateDealFolder()
- Multiple briefings per deal supported — each run creates its own InteractionRecord and Google Doc (useful for multi-stakeholder deals with different buyer roles)

### Company research sources
- Gemini generates company snapshot from its training data — no external web search API
- AtlusAI queried for relevant case studies matching the company's industry — 1-2 case study references included in the briefing as concrete proof points
- AtlusAI also provides Lumenalta solution mapping context for hypothesis and question generation
- Confident professional analyst tone — no data freshness disclaimers or hedging

### Meeting context input
- Free-text textarea for meeting context (agenda, goals, previous conversations, concerns)
- Low friction: seller types what they know, Gemini extracts relevant context for generation
- Form fields: company name (from deal), industry (from deal), buyer role (dropdown), meeting context (textarea)

### Briefing output structure
- Section order: Company Snapshot → Value Hypotheses → Discovery Questions → Relevant Case Studies
- Same structure in web app and Google Doc — identical content, different styling
- Web app: shadcn/ui cards and badges (consistent with existing deal page components)
- Google Doc: headings and body text via doc-builder.ts (consistent with Phase 8 talk track and FAQ patterns)
- Doc naming: "[CompanyName] - Pre-Call Briefing - [BuyerRole] - [Date]"

### Hypotheses
- 3-5 role-specific hypotheses per briefing
- Each hypothesis includes: hypothesis statement, supporting evidence, mapped Lumenalta solution
- HypothesesLlmSchema already defined and Gemini-validated (Phase 3)

### Discovery questions
- 5-10 prioritized questions per briefing (per requirements BRIEF-04)
- Each question displays its mapped Lumenalta solution area as a visible badge/tag
- Priority levels shown (high/medium/low) to help seller focus
- DiscoveryQuestionsLlmSchema already defined and Gemini-validated (Phase 3)

### Buyer role handling
- Single buyer role per briefing from the full BUYER_PERSONAS list (9 options: CIO, CTO, CFO, VP Engineering, VP Data, VP Product, VP Operations, CEO, General)
- Full tailoring: buyer role influences all sections — company snapshot emphasis, hypothesis framing, question prioritization
- "General" persona serves as fallback when seller doesn't know the buyer's exact role — covers broad business themes without persona-specific framing
- Multiple briefings per deal (already decided above) handles multi-stakeholder meetings — one briefing per role

### Claude's Discretion
- Mastra workflow step composition (how many steps, sequential vs parallel)
- Gemini prompt engineering for company research generation quality
- Exact shadcn/ui component choices for the briefing display cards
- Error handling for Gemini or AtlusAI failures during generation
- Loading states and progress indicators during pipeline execution
- How to surface prior pre-call briefings for the same deal in the Prep section
- Google Doc styling details (font sizes, spacing, heading levels)
- Whether industry dropdown pre-fills from deal record or allows override

</decisions>

<specifics>
## Specific Ideas

- "Prep" section above touch cards creates a natural workflow narrative: prepare before the meeting, then generate engagement assets after
- Deal page company name and industry pre-fill the form — seller only needs to pick buyer role and type meeting context
- Solution badges on discovery questions help the seller understand what to pivot to if the prospect shows interest
- Case studies from AtlusAI give sellers concrete "we did this for a similar company" proof points
- Multiple briefings per deal means a seller meeting a CIO on Tuesday and a CFO on Thursday gets role-appropriate prep for each

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/llm/company-research.ts`: CompanyResearchLlmSchema — company snapshot structure (companyName, keyInitiatives, recentNews, financialHighlights, industryPosition, relevantLumenaltaSolutions)
- `packages/schemas/llm/hypotheses.ts`: HypothesesLlmSchema — role-specific hypotheses (buyerRole, hypotheses[].hypothesis/evidence/lumenaltaSolution)
- `packages/schemas/llm/discovery-questions.ts`: DiscoveryQuestionsLlmSchema — prioritized questions (questions[].question/priority/rationale/mappedSolution)
- `packages/schemas/constants.ts`: BUYER_PERSONAS (9 roles), INDUSTRIES (11), SOLUTION_PILLARS (6 categories)
- `apps/agent/src/lib/doc-builder.ts`: buildDocRequests() — section-based Google Docs creation with headings, body text, bold ranges
- `apps/agent/src/lib/drive-folders.ts`: getOrCreateDealFolder(), makePubliclyViewable()
- `apps/agent/src/lib/google-auth.ts`: getDocsClient(), getDriveClient() — API client factories
- `packages/schemas/gemini-schema.ts`: zodToGeminiSchema() — Gemini structured output helper
- `apps/web/src/components/touch/touch-flow-card.tsx`: TouchFlowCard component pattern for deal page flow cards
- `apps/web/src/components/deals/deal-card.tsx`: DealCard component for the dashboard
- `apps/web/src/components/timeline/interaction-timeline.tsx`: Timeline component for InteractionRecord display

### Established Patterns
- Three-state client form pattern (input/review/result) from Phase 4
- Server Actions → api-client → agent service proxy for all web-to-agent communication
- Gemini 2.5 Flash structured output: zodToGeminiSchema + JSON parse + Zod .parse() round-trip
- Mastra workflow steps: createStep with input/output schemas, sequential .then() chaining
- InteractionRecord with touchType enum, inputs JSON, decision, outputRefs for tracking
- Google Docs via doc-builder.ts: build sections → batchUpdate → move to folder → make publicly viewable
- shadcn/ui component library (Card, Badge, Button, Select, Textarea, Tabs, Accordion, etc.)

### Integration Points
- `apps/web/src/app/deals/[dealId]/page.tsx` — deal page needs new "Prep" section above existing touch flow cards
- `apps/agent/src/mastra/index.ts` — new pre-call workflow registration
- `apps/agent/prisma/schema.prisma` — TOUCH_TYPES enum needs 'pre_call' value added
- `packages/schemas/constants.ts` — TOUCH_TYPES array needs 'pre_call' entry
- `apps/web/src/lib/api-client.ts` — new pre-call API endpoints
- `apps/web/src/lib/actions.ts` — new server actions for pre-call flow
- Per-deal Drive folder — reuse existing getOrCreateDealFolder() infrastructure
- AtlusAI MCP tools: knowledge_base_search_semantic — for case study retrieval by industry

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-pre-call-briefing-flow*
*Context gathered: 2026-03-04*
