# Lumenalta Agentic Sales Orchestration

## What This Is

A shipped agentic AI platform for Lumenalta sellers covering all four touch points in the 2026 GTM sales strategy — from first-contact pagers through intro decks and capability alignment decks to fully custom solution proposals with human-in-the-loop review. The system runs end-to-end: transcript paste → structured extraction → brief generation → HITL approval → RAG retrieval → Google Slides deck + talk track + buyer FAQ → final asset review. A pre-call briefing flow arms sellers with company research and discovery questions before any meeting. All outputs are saved to shared Lumenalta Drive.

## Core Value

Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## Requirements

### Validated

**Touch 1: First Contact (1-2 Pager)** — v1.0
- ✓ Seller selects first-contact flow, inputs company name, industry, and key context
- ✓ System suggests a branded 1-2 slide Google Slides pager; seller can approve or override with a custom version
- ✓ Approved pagers recorded as success; overrides recorded as learning signals and ingested into AtlusAI for future retrieval
- ✓ Generated or overridden pager is saved to per-deal folder in shared Lumenalta Drive

**Touch 2: Intro Conversation (Meet Lumenalta Deck)** — v1.0
- ✓ Seller selects intro deck flow, inputs company name, industry, salesperson name/photo, and optionally customer logo
- ✓ System AI-selects relevant "Meet Lumenalta" slides based on industry and client context
- ✓ System assembles selected slides into Google Slides deck with salesperson/customer customizations applied
- ✓ Generated intro deck is saved to shared Lumenalta Drive

**Touch 3: Capability & Use Case Alignment** — v1.0
- ✓ Seller selects capability alignment flow, inputs company name, industry, and 1-2 capability areas
- ✓ System AI-selects relevant slides from AtlusAI deck and L2 capability decks
- ✓ System assembles selected slides into Google Slides deck with customizations
- ✓ Generated capability deck is saved to shared Lumenalta Drive

**Touch 4+: Solution & Proposal Development** — v1.0
- ✓ Seller pastes raw transcript into web UI and selects industry + subsector (from 11 industries / 62 subsectors)
- ✓ AI extracts structured fields: Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget
- ✓ System flags missing critical inputs (e.g., budget not mentioned) and notifies seller before proceeding
- ✓ System generates Multi-Pillar Sales Brief (Primary + Secondary solution pillars identified)
- ✓ HITL Checkpoint 1: Seller and SME review/approve brief in web app before any slides are generated
- ✓ System queries AtlusAI content library for relevant slide blocks, case studies, and assets
- ✓ System assembles custom slide order as structured JSON and generates bespoke copy for each block
- ✓ System creates Google Slides deck in shared Lumenalta Drive via Google Slides API (service account)
- ✓ System generates talk track (Google Doc) and buyer FAQ with objection handling (Google Doc)
- ✓ HITL Checkpoint 2: Seller, SME, Marketing, Solutions review final assets in web app
- ✓ Human edits to output are tracked for system refinement

**Pre-Call Briefing Flow** — v1.0
- ✓ Seller inputs company name, buyer role, and meeting context into a web UI
- ✓ System queries AtlusAI and public sources to generate company snapshot (initiatives, news, financials)
- ✓ System generates role-specific hypotheses and 5-10 prioritized discovery questions mapped to Lumenalta solutions
- ✓ Briefing is delivered as a formatted one-pager in the web app and saved to Google Drive

**Data Capture & Knowledge Growth** — v1.0
- ✓ Every interaction across all touch points captures inputs, decisions (approve/override/edit), and output references
- ✓ All transcripts, notes, and conversation context are stored and indexed for future retrieval
- ✓ Approved outputs become positive examples; overrides become improvement signals ingested into AtlusAI
- ✓ Company interaction history carries forward across touch points
- ✓ The knowledge base grows with each use, making future outputs increasingly relevant

**Quality & Governance** — v1.0
- ✓ AI output restricted to assembling pre-approved building blocks — no hallucinated layouts or capabilities
- ✓ Zod v4 schema validation rejects incomplete transcript data and returns specific missing-field errors
- ✓ Generated output passes a quality checklist (client name present, problem restatement, 2-3 options, next steps)
- ✓ ROI framing module produces 2-3 business-outcome statements and 1 value hypothesis per use case

**Content Library (AtlusAI)** — v1.0 (partial)
- ✓ Content indexed by industry (all 11), subsector, solution pillar, persona, and funnel stage
- ✓ Slide chunks indexed as discrete retrievable units (deck ID + slide index + tags)
- ⚠ Deck templates partially loaded (38 slides from 5 accessible presentations; 12+ presentations pending Drive access)
- ⚠ Case studies not yet ingested (source presentations among inaccessible Drive shortcuts)
- ⚠ Building Block Library incomplete pending case study and full template access
- ✓ Brand guidelines ingested as whole-reference document

### Active

(Fresh for next milestone — define via `/gsd:new-milestone`)

### Out of Scope

- Salesforce integration — v1 relies on transcripts, notes, AtlusAI, and public data only; CRM integration is a v2 modular extension
- Real-time call feedback — focus is pre-call and post-call; in-call AI coaching is a future phase
- Mobile app — web-first, browser-based interface only
- OAuth / per-seller Google accounts — service account to shared Lumenalta Drive
- Video upload / Zoom integration — sellers paste transcripts manually; direct API integration is v2
- Fine-tuning or custom model training — all steering done via prompt engineering and few-shot examples
- Automated edit pattern analysis for prompt refinement — deferred to v2

## Context

**Current state:** v1.0 shipped. ~20,000 LOC TypeScript/TSX across 439 files. 13 phases, 27 plans, 169 commits in 2 days.

**Tech stack (shipped):** pnpm/Turborepo monorepo, Next.js 15 (web), Mastra AI 1.8 (agent orchestration), GPT-OSS 120b on Vertex AI (LLM), Zod v4 (structured outputs), Prisma + SQLite (data), Google Workspace API (Slides + Docs + Drive), AtlusAI (RAG + knowledge base), shadcn/ui (components), Sonner (toast notifications).

**Architecture:** Two-app monorepo — `apps/web` (Next.js 15 with Server Actions) and `apps/agent` (Mastra Hono server). Shared `packages/schemas` for Zod types and constants. Mastra workflows use suspend/resume for HITL checkpoints. All Google output via service account to shared Lumenalta Drive.

**Content library status:** 38 slides ingested from 5 accessible presentations. Brand guidelines ingested. 14/17 known Drive sources need Viewer access on target Shared Drives (shortcut container access is insufficient). Case studies and full template set blocked on Drive permissions.

**Demo scenario:** Meridian Capital Group (Financial Services) — seeded company, deal, and Touch 1 interaction. 167-line transcript fixture covering all 6 extraction fields.

**Knowledge growth model:** Every interaction captures inputs, decisions, and outputs. Approved assets become positive examples in AtlusAI; overrides and edits become improvement signals that are re-ingested. Company history accumulates across touch points.

## Constraints

- **Tech stack**: Mastra AI + GPT-OSS 120b (Vertex AI) + Zod v4 — architecture built around these
- **Output format**: Google Slides via API only — no static images, no export-only artifacts
- **Brand compliance**: AI may only assemble pre-approved Lumenalta building blocks — no generated layouts
- **HITL hard stop**: Zero slides generated until SME explicitly approves the structured brief
- **Content library dependency**: RAG quality depends on AtlusAI content coverage (currently partial)
- **Google Drive access**: 14/17 content sources need Viewer access granted on target Shared Drives

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| General LLM via API over fine-tuning | Large context window for noisy transcripts; prompt engineering steers behavior faster | ✓ Good — switched from Gemini to GPT-OSS 120b on Vertex AI for cost/performance |
| Mastra AI as agent orchestration | Structured output enforcement, native Zod v4 integration, suspend/resume for HITL | ✓ Good — suspend/resume pattern works well for both HITL checkpoints |
| AtlusAI as RAG + knowledge base | Already available as MCP-connected service; avoids building retrieval infra | ⚠️ Revisit — MCP auth requires Claude Code; used Drive API fallback for standalone scripts |
| Service account for Google Drive | Shared Lumenalta Drive vs. per-seller OAuth; simpler for hackathon | ✓ Good — works for all output types (Slides, Docs, Drive folders) |
| Salesforce out of scope for v1 | Data hygiene requirements not met | ✓ Good — kept scope manageable |
| Transcript input by paste | Reduces integration surface; works with any meeting tool | ✓ Good — simple and universal |
| All 11 industries in scope | Hackathon requires full taxonomy demonstration | ✓ Good — all 11 covered via cross-industry classification |
| Touch 1 approve/override feedback loop | Enables continuous improvement without manual curation | ✓ Good — FeedbackSignal model captures decision signals |
| Interaction tracking across all touches | Every input/decision/output captured; company history across touches | ✓ Good — InteractionRecord model with full audit trail |
| Copy-and-prune for deck assembly | Copy entire source, delete unwanted slides, reorder remaining | ✓ Good — preserves original formatting perfectly |
| Separate Prisma models for Transcript/Brief | Self-contained querying without JSON blob parsing | ✓ Good — clean separation, enables structured queries |
| Mastra suspend/resume for HITL | Durable workflow state survives server restarts | ✓ Good — both HITL-1 (brief) and HITL-2 (assets) work correctly |
| Monotonic Set pattern for stepper progress | Prevents UI flicker during polling by only adding to completed set | ✓ Good — smooth progress display across all forms |

---
*Last updated: 2026-03-05 after v1.0 milestone*
