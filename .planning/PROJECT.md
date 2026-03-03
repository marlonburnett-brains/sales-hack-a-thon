# Lumenalta Agentic Sales Orchestration

## What This Is

An agentic AI platform for Lumenalta sellers that covers all four touch points in the 2026 GTM sales strategy — from first-contact pagers through intro decks and capability alignment decks to fully custom solution proposals. The system eliminates the 24-hour to 5-day bottleneck between discovery calls and second-meeting collateral. It operates multiple flows aligned to GTM touch points: Touch 1 (first-contact 1-2 pager), Touch 2 (Meet Lumenalta intro deck assembled from pre-made slides), Touch 3 (capability & use case alignment decks from AtlusAI and L2 decks), and Touch 4+ (custom solution proposals from raw transcripts with full HITL review). A pre-call briefing flow arms sellers with company research and discovery questions before any meeting.

## Core Value

Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Touch 1: First Contact (1-2 Pager)**
- [ ] Seller selects first-contact flow, inputs company name, industry, and key context
- [ ] System suggests a branded 1-2 slide Google Slides pager; seller can approve or override with a custom version
- [ ] Approved pagers recorded as success; overrides recorded as learning signals and ingested into AtlusAI for future retrieval
- [ ] Generated or overridden pager is saved to per-deal folder in shared Lumenalta Drive

**Touch 2: Intro Conversation (Meet Lumenalta Deck)**
- [ ] Seller selects intro deck flow, inputs company name, industry, salesperson name/photo, and optionally customer logo
- [ ] System AI-selects relevant "Meet Lumenalta" slides based on industry and client context
- [ ] System assembles selected slides into Google Slides deck with salesperson/customer customizations applied
- [ ] Generated intro deck is saved to shared Lumenalta Drive

**Touch 3: Capability & Use Case Alignment**
- [ ] Seller selects capability alignment flow, inputs company name, industry, and 1-2 capability areas
- [ ] System AI-selects relevant slides from AtlusAI deck and L2 capability decks
- [ ] System assembles selected slides into Google Slides deck with customizations
- [ ] Generated capability deck is saved to shared Lumenalta Drive

**Touch 4+: Solution & Proposal Development (Post-Call Transcript → Deck Flow)**
- [ ] Seller pastes raw transcript into web UI and selects industry + subsector (from 11 industries / 62 subsectors)
- [ ] AI extracts structured fields: Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget
- [ ] System flags missing critical inputs (e.g., budget not mentioned) and notifies seller before proceeding
- [ ] System generates Multi-Pillar Sales Brief (Primary + Secondary solution pillars identified)
- [ ] HITL Checkpoint 1: Seller and SME review/approve brief in web app before any slides are generated
- [ ] System queries AtlusAI content library for relevant slide blocks, case studies, and assets (matched by industry, solution pillar, funnel stage)
- [ ] System assembles custom slide order as structured JSON and generates bespoke copy for each block
- [ ] System creates Google Slides deck in shared Lumenalta Drive via Google Slides API (service account)
- [ ] System generates talk track (Google Doc) and buyer FAQ with objection handling (Google Doc)
- [ ] HITL Checkpoint 2: Seller, SME, Marketing, Solutions review final assets in web app
- [ ] Human edits to output are tracked for system refinement

**Pre-Call Briefing Flow**
- [ ] Seller inputs company name, buyer role, and meeting context into a web UI
- [ ] System queries AtlusAI and public sources to generate company snapshot (initiatives, news, financials)
- [ ] System generates role-specific hypotheses and 5–10 prioritized discovery questions mapped to Lumenalta solutions
- [ ] Briefing is delivered as a formatted one-pager in the web app and saved to Google Drive

**Content Library (AtlusAI)**
- [ ] All existing deck templates, case studies, brand guidelines, and image/icon library loaded into AtlusAI
- [ ] Content indexed by industry (all 11), subsector, solution pillar, persona, and funnel stage
- [ ] Slide chunks indexed as discrete retrievable units (deck ID + slide index + tags)
- [ ] Building Block Library established: approved layouts, capability descriptions, case study modules

**Data Capture & Knowledge Growth**
- [ ] Every interaction across all touch points captures inputs, decisions (approve/override/edit), and output references
- [ ] All transcripts, notes, and conversation context are stored and indexed for future retrieval
- [ ] Approved outputs become positive examples; overrides become improvement signals ingested into AtlusAI
- [ ] Company interaction history carries forward across touch points (e.g., Touch 2 can reference Touch 1 context)
- [ ] The knowledge base grows with each use, making future outputs increasingly relevant

**Quality & Governance**
- [ ] AI output restricted to assembling pre-approved building blocks — no hallucinated layouts or capabilities
- [ ] Zod v4 schema validation rejects incomplete transcript data and returns specific missing-field errors
- [ ] Generated output passes a quality checklist (client name present, problem restatement, 2–3 options, next steps)
- [ ] ROI framing module produces 2–3 business-outcome statements and 1 value hypothesis per use case

### Out of Scope

- Salesforce integration — v1 relies on transcripts, notes, AtlusAI, and public data only; CRM integration is a v2 modular extension once data hygiene standards are established
- Real-time call feedback — focus is pre-call and post-call; in-call AI coaching is a future phase
- Mobile app — web-first, browser-based interface only
- OAuth / per-seller Google accounts — service account to shared Lumenalta Drive
- Video upload / Zoom integration — sellers paste transcripts manually; direct API integration with Granola/Zoom/Firefly is v2
- Fine-tuning or custom model training — all steering done via prompt engineering and few-shot examples

## Context

**The problem being solved:** Lumenalta's current collateral process requires sellers to start-stop with SMEs, produces generic positioning, and creates gaps at every stage of the sales funnel. The 2026 GTM strategy defines four touch points — First Contact, Intro Conversation, Capability & Use Case Alignment, and Solution & Proposal Development — each requiring specific assets. Sales leadership's question: "How do we turn early-stage sales conversations into polished, on-brand collateral quickly and consistently at every touch point?"

**GTM Touch Points:** The system covers all four sales stages: Touch 1 (1-2 pager for first contact), Touch 2 (Meet Lumenalta intro deck from pre-made slides), Touch 3 (AtlusAI + L2 capability decks for use case alignment), Touch 4+ (custom solution proposals with full HITL review). Touches 1-3 use AI-driven slide selection from pre-made content with light customization (salesperson name/photo, customer name/logo). Touch 4+ is the heavy pipeline with transcript processing, brief generation, and bespoke copy.

**Hackathon context:** This is a hackathon submission — full working pipeline required, not just a prototype. The demo needs to run end-to-end: transcript paste → brief → HITL approval → Google Slides output.

**AtlusAI:** Available as an MCP-connected knowledge base with semantic search, structured search, and document discovery. All Lumenalta content (deck templates, case studies, brand guidelines, image/icon library) needs to be loaded and indexed in it before the RAG pipeline is functional.

**Tech stack (decided):** Mastra AI framework (Node.js/TypeScript), Gemini API (Gemini 3 Flash — large context window for noisy transcripts), Zod v4 schemas (structured outputs), Google Workspace API (Slides + Docs + Drive), AtlusAI (RAG + knowledge base).

**Industry taxonomy:** 11 industries (Consumer Products, Education, Financial Services & Insurance, Health Care, Industrial Goods, Private Equity, Public Sector, Technology, Media & Telecommunications, Transportation & Logistics, Travel & Tourism, Professional Services) with 62 subsectors. All 11 must be represented in the content library.

**Existing assets in hand:** Branded deck templates (Google Slides), written case studies, brand guidelines document, and approved image/icon library — all need to be loaded into AtlusAI.

**Knowledge growth model:** The system is designed as a continuously learning platform. Every interaction captures inputs, decisions, and outputs. Approved assets become positive examples in AtlusAI; overrides and edits become improvement signals that are re-ingested into the knowledge base. Company interaction history accumulates across touch points so that later touches build on earlier context. Over time, the system's output quality improves as the knowledge base grows with real-world usage data. Automated analysis of edit patterns for prompt refinement is deferred to v2.

## Constraints

- **Tech stack**: Mastra AI + Gemini API + Zod v4 — architecture built around these, no substitutes
- **Output format**: Google Slides via API only — no static images, no export-only artifacts
- **Brand compliance**: AI may only assemble pre-approved Lumenalta building blocks — no generated layouts
- **HITL hard stop**: Zero slides generated until SME explicitly approves the structured brief (Phase 2)
- **Content library dependency**: RAG pipeline cannot function until AtlusAI is populated with indexed content
- **Hackathon timeline**: Full working pipeline must be demo-ready; this is not a spec document

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| General LLM via API (Gemini 3 Flash) over fine-tuning | Massive context window for noisy transcripts; prompt engineering steers behavior faster than fine-tuning | — Pending |
| Mastra AI as agent orchestration framework | Structured output enforcement, native Zod v4 integration, Node.js ecosystem | — Pending |
| AtlusAI as RAG + knowledge base | Already available as MCP-connected service; avoids building retrieval infrastructure | — Pending |
| Service account for Google Drive output | Shared Lumenalta Drive vs. per-seller OAuth; simpler for hackathon, meets real use case | — Pending |
| Salesforce out of scope for v1 | Data hygiene requirements not met; CRM integration would require separate data quality work | — Pending |
| Transcript input by paste (not API integration) | Reduces integration surface; works with any meeting tool the seller uses | — Pending |
| All 11 industries in scope | Hackathon requires demonstrating the full taxonomy, not just a subset | — Pending |
| Touch 1 approve/override as feedback loop | Sellers approve AI suggestions (success) or override with custom versions (failure signal + ingested into knowledge base); enables continuous improvement without manual curation | — Pending |
| Interaction tracking across all touch points | Every input, decision, and output is captured; company history carries across touches; knowledge base grows with each use; automated analysis deferred to v2 | — Pending |

---
*Last updated: 2026-03-03 — Touch 1-3, data capture, and knowledge growth requirements added*
