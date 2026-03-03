# Lumenalta Agentic Sales Orchestration

## What This Is

An agentic AI platform for Lumenalta sellers that eliminates the 24-hour to 5-day bottleneck between discovery calls and second-meeting collateral. The system operates two parallel flows: a pre-call briefing flow that arms sellers with company research and discovery questions before a meeting, and a post-call deck generation flow that transforms raw transcripts into polished, on-brand Google Slides decks, talk tracks, and FAQs — with SME sign-off baked in as a hard checkpoint.

## Core Value

Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Pre-Call Briefing Flow**
- [ ] Seller inputs company name, buyer role, and meeting context into a web UI
- [ ] System queries AtlusAI and public sources to generate company snapshot (initiatives, news, financials)
- [ ] System generates role-specific hypotheses and 5–10 prioritized discovery questions mapped to Lumenalta solutions
- [ ] Briefing is delivered as a formatted one-pager in the web app and saved to Google Drive

**Post-Call Transcript → Deck Flow**
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

**Content Library (AtlusAI)**
- [ ] All existing deck templates, case studies, brand guidelines, and image/icon library loaded into AtlusAI
- [ ] Content indexed by industry (all 11), subsector, solution pillar, persona, and funnel stage
- [ ] Slide chunks indexed as discrete retrievable units (deck ID + slide index + tags)
- [ ] Building Block Library established: approved layouts, capability descriptions, case study modules

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

**The problem being solved:** Lumenalta's current collateral process requires sellers to start-stop with SMEs, produces generic positioning, and creates a 24h–5-day gap before a technically demanding second meeting. Sales leadership's question: "How do we turn early-stage sales conversations into polished, on-brand collateral quickly and consistently?"

**Hackathon context:** This is a hackathon submission — full working pipeline required, not just a prototype. The demo needs to run end-to-end: transcript paste → brief → HITL approval → Google Slides output.

**AtlusAI:** Available as an MCP-connected knowledge base with semantic search, structured search, and document discovery. All Lumenalta content (deck templates, case studies, brand guidelines, image/icon library) needs to be loaded and indexed in it before the RAG pipeline is functional.

**Tech stack (decided):** Mastra AI framework (Node.js/TypeScript), Gemini API (Gemini 3 Flash — large context window for noisy transcripts), Zod v4 schemas (structured outputs), Google Workspace API (Slides + Docs + Drive), AtlusAI (RAG + knowledge base).

**Industry taxonomy:** 11 industries (Consumer Products, Education, Financial Services & Insurance, Health Care, Industrial Goods, Private Equity, Public Sector, Technology, Media & Telecommunications, Transportation & Logistics, Travel & Tourism, Professional Services) with 62 subsectors. All 11 must be represented in the content library.

**Existing assets in hand:** Branded deck templates (Google Slides), written case studies, brand guidelines document, and approved image/icon library — all need to be loaded into AtlusAI.

**Feedback loop:** Human edits made during HITL review are captured and fed back into system prompt refinement, RAG retrieval accuracy improvements, and few-shot example updates. Google Drive serves as the persistent artifact store.

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

---
*Last updated: 2026-03-03 after initialization*
