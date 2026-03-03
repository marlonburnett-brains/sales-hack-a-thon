# Feature Research

**Domain:** Agentic sales enablement / sales orchestration platform (consultancy context)
**Researched:** 2026-03-03
**Confidence:** MEDIUM — external tools unavailable; findings based on training knowledge of Highspot, Seismic, Showpad, Gong, Chorus, People.ai, Pitch, Tome, and emerging agentic sales platforms through August 2025. Confidence downgrades noted where recency matters.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that sales enablement users assume exist. Missing them makes the platform feel broken or incomplete. These are NOT competitive advantages — they are entry tickets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Transcript ingestion (paste or upload) | Every post-call tool in 2026 accepts transcripts as the primary input | LOW | PROJECT.md specifies paste input; this is correct for v1 |
| Structured brief extraction from transcript | Users expect AI to parse key fields (problem, stakeholders, timeline, budget) rather than doing it manually | MEDIUM | Zod v4 schemas provide validation; missing-field flagging is expected behavior |
| Brand-compliant output | Consultancy sellers expect outputs to look like Lumenalta, not generic AI artifacts | HIGH | Requires pre-loaded building block library in AtlusAI; cannot be skipped |
| Human review / approval checkpoint | In high-stakes consultancy sales, zero tolerance for unsanctioned AI output going to clients | MEDIUM | HITL hard stop is already in PROJECT.md; critical trust feature |
| Output to a standard format (Slides, Docs) | Sellers work in Google Workspace; they expect Slides, not PDFs or proprietary formats | MEDIUM | Google Slides API via service account — already decided |
| Content search / retrieval from library | "Find the case study for healthcare AI" is a basic expectation of any content system | MEDIUM | RAG over AtlusAI covers this; indexing by industry + solution pillar is required |
| Industry / vertical selection | Enterprise sales are vertical-specific; generic output is unacceptable | LOW | 11-industry taxonomy with 62 subsectors already defined |
| Missing field notification before proceeding | Users expect the system to tell them when transcript data is incomplete, not silently generate bad output | LOW | Already in PROJECT.md; Zod validation covers this |
| Pre-call company snapshot | Any account-based sales tool today provides prospect company context before a meeting | MEDIUM | Public source + AtlusAI query; part of the defined pre-call flow |
| Artifact persistence / storage | Sellers expect generated decks and docs to be saved and retrievable | LOW | Google Drive via service account covers this |
| Talk track alongside deck | A deck without a talk track forces sellers to improvise; they expect both | MEDIUM | Already in PROJECT.md as a required output |

### Differentiators (Competitive Advantage for a Consultancy)

These features go beyond what generic sales enablement platforms offer and are specifically valuable for a technology consultancy like Lumenalta selling complex, bespoke engagements.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-pillar solution mapping (primary + secondary) | Consultancies sell across multiple capability areas per deal; generic tools output one solution pitch. Identifying which Lumenalta pillars address the buyer's problem gives sellers a more nuanced and accurate proposal. | MEDIUM | Requires structured solution taxonomy in AtlusAI; pillar mapping logic in the brief generation agent |
| Buyer FAQ + objection handling doc | Sellers preparing for second meetings need to anticipate questions, not just present. This is rarely automated at this fidelity. | MEDIUM | Already in PROJECT.md; requires prompt engineering to generate role-specific objections |
| HITL at brief stage (before slides) | Most AI deck tools skip directly to output. Gating on brief approval catches strategic errors before wasted generation effort. The brief is also a forcing function for SME alignment. | LOW | Already a hard stop in PROJECT.md; the design decision is the differentiator, not the implementation |
| Feedback loop from human edits | Capturing what SMEs and marketing correct in the output creates a self-improving system. This is rare in early-stage enterprise AI tools. | HIGH | Requires structured diff capture, edit categorization, and routing to prompt/RAG refinement pipeline; significant complexity |
| 11-industry + 62-subsector taxonomy with content mapped to each | Deep vertical specificity in content retrieval means case studies and positioning match the buyer's actual industry, not a generic analog. Most tools offer 5-10 generic verticals. | HIGH | Requires all 11 industries populated in AtlusAI before go-live; the content loading phase is the bottleneck |
| Discovery question generation mapped to Lumenalta solutions | Pre-call question generation tied to specific solutions (not generic SPIN selling) makes Lumenalta sellers sound like domain experts before they've done their homework. | MEDIUM | Requires hypothesis templates per industry/solution; prompt engineering intensive |
| Role-specific hypotheses (by buyer persona) | A CTO and a CFO need different problem framings. Generating persona-specific hypotheses moves beyond one-size-fits-all briefing. | MEDIUM | Requires persona taxonomy in the system; adds branching logic to pre-call agent |
| Slide block assembly as structured JSON before rendering | Decoupling the "what slides in what order" decision from rendering allows SME review of structure before any pixel is painted. No other tool in this space works this way. | HIGH | Requires slide block schema, ordering logic, and JSON intermediate layer; already implied in PROJECT.md |
| ROI framing module | Producing 2-3 quantified business outcome statements per use case is differentiating for consultancy sales where CFO-level justification is required. | MEDIUM | Requires business outcome templates by industry; prompt engineering + structured output |

### Anti-Features (Deliberately NOT Build)

Features that appear useful but create real problems for a consultancy internal tool at this scale. Being explicit about what to exclude prevents scope creep and avoids known failure modes.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CRM (Salesforce) integration | Sellers want deal context auto-populated from Salesforce records | Data hygiene at Lumenalta is not ready; inconsistent field completeness makes AI outputs unreliable. Adds significant integration surface for v1. Already explicitly out of scope in PROJECT.md. | Seller provides context via manual form input; revisit in v2 after data hygiene standards are established |
| In-call / real-time AI coaching | "Coach me live during the call" sounds powerful | Requires low-latency audio pipeline, very different architecture from transcript-batch processing. Distracts from the core value prop. Zoom/Teams integration adds compliance surface. | Pre-call briefing provides the preparation that in-call coaching would otherwise provide |
| AI-generated slide layouts (hallucinated) | "Make it look better" or "generate a custom layout" | Produces off-brand output, violates Lumenalta brand guidelines, creates legal/brand review burden, and undermines trust in the system. Pre-approved building blocks are the constraint for a reason. | Use only pre-approved Lumenalta building block library assembled by AI; if a layout doesn't exist, flag it as a content gap |
| Per-seller Google OAuth / personal Drive output | Sellers want output in their personal Drive | Multiple OAuth tokens, per-user credential management, token refresh complexity, data ownership ambiguity. Not worth the overhead for v1. | Service account to shared Lumenalta Drive; sellers access via Drive sharing |
| Video upload / Zoom/Firefly API integration | "Can't I just upload the recording?" | Adds video transcription pipeline, storage costs, Zoom API rate limits, and GDPR/recording-consent complexity. Not core to the hackathon demo. | Manual transcript paste works with any meeting tool; Granola/Zoom/Firefly integration is a named v2 item |
| Fine-tuning or custom model training | "We want our own model" | Fine-tuning requires labeled training data (which doesn't exist yet), is expensive to maintain, and is slower to iterate than prompt engineering. Prompt engineering + few-shot examples achieve 90% of the benefit. | All steering via prompt engineering + few-shot examples in Gemini API calls |
| Custom analytics dashboard (usage/engagement tracking) | Sales leaders want to see "how many decks were generated" | Adds significant frontend complexity, a database schema for event tracking, and a whole reporting surface. Low value for hackathon; premature optimization. | Google Drive modification timestamps and file counts provide basic tracking; formal analytics is v2 |
| Mobile app | Sellers want to use the tool on their phones | Web-first is the right call for a tool used at a desk before/after calls. Mobile adds responsive UI complexity that doesn't serve the core workflow. | Responsive web UI that works on mobile without being optimized for it |
| Automatic email drafting / outreach generation | "While you're at it, draft the follow-up email" | Scope creep. Email sequencing is a different workflow, different compliance considerations (CAN-SPAM, personalization at scale), and would require an entirely separate review/approval flow. | Focus on second-meeting collateral; email copy is seller's responsibility |
| Real-time collaborative editing of the AI brief | "I want multiple SMEs to edit simultaneously like Google Docs" | Adds operational transform / CRDT complexity, conflict resolution, and session management. Far exceeds hackathon scope. | Sequential HITL review (seller approves → SME approves → marketing signs off); async is acceptable for this workflow |
| Competitive intelligence auto-generation | "Tell me how Lumenalta compares to Accenture/McKinsey for this deal" | Requires curated, up-to-date competitive content. AI hallucination risk is high. Compliance risk if inaccurate competitive claims reach client-facing materials. | Competitive positioning is a human input; sellers provide their read on competitive context |

---

## Feature Dependencies

```
[AtlusAI Content Library — Loaded + Indexed]
    └──required-by──> [RAG Retrieval (industry/pillar/stage matching)]
                          └──required-by──> [Slide Block Assembly (JSON)]
                                                └──required-by──> [Google Slides Deck Generation]
                                                └──required-by──> [Talk Track Generation]
                                                └──required-by──> [Buyer FAQ Generation]

[Transcript Ingestion]
    └──required-by──> [Structured Brief Extraction (Zod)]
                          └──required-by──> [Missing Field Notification]
                          └──required-by──> [Multi-Pillar Solution Mapping]
                                                └──required-by──> [HITL Checkpoint 1: Brief Approval]
                                                                      └──required-by──> [RAG Retrieval]

[HITL Checkpoint 1: Brief Approval]
    └──gates──> [All slide/doc generation — hard stop]

[HITL Checkpoint 2: Final Asset Review]
    └──enables──> [Feedback Loop / Edit Capture]
                      └──improves──> [Prompt Engineering Refinement]
                      └──improves──> [RAG Retrieval Accuracy]

[Industry + Subsector Taxonomy (11/62)]
    └──required-by──> [Transcript Ingestion UI (selector)]
    └──required-by──> [RAG Retrieval (content matching)]
    └──required-by──> [Pre-Call Briefing (role + industry context)]

[Pre-Call Briefing Flow]
    ──independent-of──> [Post-Call Transcript Flow]
    (parallel flows; share AtlusAI and taxonomy but do not depend on each other)

[ROI Framing Module]
    └──enhances──> [Structured Brief Extraction]
    └──required-by──> [Slide Block Assembly — value hypothesis section]

[Feedback Loop — Edit Capture]
    └──enhances──> [All AI generation over time]
    (deferred complexity; not required for v1 demo)
```

### Dependency Notes

- **AtlusAI Content Library gates everything downstream:** No RAG retrieval, no slide assembly, no deck generation until the library is loaded and indexed. This is the single highest-risk dependency for the hackathon timeline. Content loading must happen before any integration testing of the post-call flow.

- **HITL Checkpoint 1 gates all generation:** The hard stop design means the brief approval UI must be fully functional before any deck output can be tested end-to-end. The brief approval flow is not optional scaffolding — it is on the critical path.

- **Industry taxonomy must be settled before content loading:** The 11-industry / 62-subsector taxonomy defines the indexing scheme for AtlusAI. If the taxonomy changes after content is loaded, re-indexing is required. Finalize taxonomy first.

- **Pre-call and post-call flows are independent:** They share AtlusAI and the industry taxonomy but do not depend on each other. They can be developed in parallel. For the hackathon demo, post-call flow is higher priority (it ends with visible output: a Google Slides deck).

- **Feedback loop is deferred complexity:** Edit capture and refinement pipeline add significant complexity without changing the demo outcome. Build the capture mechanism (log human edits) in v1, but full refinement automation is v1.x.

- **ROI framing module depends on business outcome templates per industry:** If templates aren't in AtlusAI or in prompts, the module degrades to generic statements. Templates should be built during content library phase.

---

## MVP Definition

### Launch With (v1 — Hackathon Demo)

The minimum that demonstrates the full pipeline end-to-end.

- [ ] **Pre-call briefing flow** — company research snapshot + discovery questions generated from seller input; required to show the full platform scope
- [ ] **Transcript ingestion UI** — paste input with industry/subsector selector; the entry point for all post-call value
- [ ] **Structured brief extraction with Zod validation** — the intelligence layer that justifies HITL; without it, the HITL checkpoint has nothing to show
- [ ] **Missing-field notification** — required for seller trust; silently proceeding on incomplete data destroys credibility
- [ ] **Multi-pillar solution mapping** — the core analytical output that differentiates from generic AI tools
- [ ] **HITL Checkpoint 1 (brief approval UI)** — non-negotiable hard stop; required by design, required for demo
- [ ] **AtlusAI RAG retrieval (industry + pillar + stage matching)** — required before any slide assembly; depends on library being loaded
- [ ] **Slide block assembly as structured JSON** — the intermediate step that makes assembly transparent and reviewable
- [ ] **Google Slides deck generation via API** — the visible, shareable deliverable; this is what the demo lands on
- [ ] **Talk track (Google Doc)** — expected alongside the deck; demonstrates completeness
- [ ] **Buyer FAQ with objection handling (Google Doc)** — differentiating output; third artifact in the package
- [ ] **HITL Checkpoint 2 (final asset review UI)** — closes the approval loop; required for brand governance story
- [ ] **AtlusAI content library loaded for 11 industries** — pipeline cannot function without this; must be done before integration testing

### Add After Validation (v1.x)

Add once the core pipeline is working and used in real sales cycles.

- [ ] **Feedback loop — structured edit capture** — trigger: sellers are actively using the tool; first edit patterns will reveal what the AI consistently gets wrong
- [ ] **Prompt refinement from edit history** — trigger: enough edit volume to identify patterns (50+ decks generated)
- [ ] **ROI framing module** — trigger: sellers report that CFO-level justification is a recurring gap in generated content
- [ ] **Salesforce integration (read-only)** — trigger: data hygiene standards established; adds deal context without manual form input
- [ ] **Video/transcript API integration (Granola, Zoom, Firefly)** — trigger: sellers find paste friction is causing them to skip the tool

### Future Consideration (v2+)

Defer until product-market fit is established and the platform is embedded in Lumenalta's sales process.

- [ ] **In-call coaching** — defer: fundamentally different architecture; pre-call briefing is a better investment for the same outcome
- [ ] **Usage analytics dashboard** — defer: Google Drive telemetry sufficient for early stage; formal analytics justified only after consistent adoption
- [ ] **Competitive intelligence module** — defer: high hallucination risk; requires curated, maintained competitive content
- [ ] **Mobile-optimized UI** — defer: web-first serves the workflow; mobile is not where pre/post-call work happens
- [ ] **Multi-user collaborative brief editing** — defer: async HITL is adequate; real-time editing adds complexity without proportional value

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pre-call briefing (company snapshot + discovery questions) | HIGH | MEDIUM | P1 |
| Transcript ingestion + industry selector | HIGH | LOW | P1 |
| Structured brief extraction (Zod validation) | HIGH | MEDIUM | P1 |
| Missing-field notification | HIGH | LOW | P1 |
| Multi-pillar solution mapping | HIGH | MEDIUM | P1 |
| HITL Checkpoint 1 (brief approval) | HIGH | MEDIUM | P1 |
| AtlusAI content library loading (all 11 industries) | HIGH | HIGH | P1 |
| RAG retrieval (industry + pillar + stage) | HIGH | MEDIUM | P1 |
| Slide block JSON assembly | HIGH | HIGH | P1 |
| Google Slides deck generation via API | HIGH | HIGH | P1 |
| Talk track (Google Doc) | HIGH | MEDIUM | P1 |
| Buyer FAQ + objection handling (Google Doc) | MEDIUM | MEDIUM | P1 |
| HITL Checkpoint 2 (final asset review) | HIGH | MEDIUM | P1 |
| ROI framing module | MEDIUM | MEDIUM | P2 |
| Feedback loop — edit capture | MEDIUM | HIGH | P2 |
| Prompt refinement from edits | MEDIUM | HIGH | P2 |
| Salesforce integration | LOW | HIGH | P3 |
| Usage analytics dashboard | LOW | HIGH | P3 |
| In-call coaching | LOW | HIGH | P3 |
| Competitive intelligence module | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for hackathon demo (v1)
- P2: Should have, add post-validation (v1.x)
- P3: Future consideration only (v2+)

---

## Competitor Feature Analysis

| Feature | Highspot / Seismic (Enterprise Sales Enablement) | Gong / Chorus (Revenue Intelligence) | Tome / Pitch / Beautiful.ai (AI Deck Tools) | Lumenalta Platform (Our Approach) |
|---------|------|------|------|------|
| Pre-call company research | Yes — account intelligence panels, Salesforce-linked | Yes — deal intelligence from CRM + call history | No | Yes — public sources + AtlusAI; no CRM dependency |
| Transcript ingestion | No (content management focus) | Yes — native call recording and transcription | No | Yes — manual paste; avoids recording-consent complexity |
| Structured brief from transcript | No | Partial — deal summaries, not proposal briefs | No | Yes — Zod-validated structured output with specific field extraction |
| HITL approval before output | No — output is immediate | No | No | Yes — hard stop at brief stage; differentiating design choice |
| Brand-compliant slide assembly | Yes — content templates and content blocks | No | Partial — templates, but AI can deviate | Yes — pre-approved building blocks only; no generated layouts |
| RAG over internal content library | Yes — content management with semantic search | No | No | Yes — AtlusAI with industry + pillar + stage indexing |
| Industry vertical specificity | 5-8 generic verticals | Deal-level, not vertical-specific | No | 11 industries + 62 subsectors; deepest taxonomy in this space |
| Talk track + FAQ as standard output | No | No | No | Yes — three-artifact output package (deck + talk track + FAQ) |
| Feedback loop from human edits | Partial — content performance analytics | Partial — call coaching feedback | No | Yes — edit capture for prompt and RAG refinement (v1.x) |
| CRM integration | Yes — core feature | Yes — core feature | No | Explicitly out of scope for v1 |
| In-call coaching | No (Highspot); No (Seismic) | Yes — core Gong feature | No | Out of scope; pre-call briefing serves the same preparation need |

**Key competitive insight:** No existing tool covers the full workflow: pre-call briefing + post-call transcript → HITL-gated → brand-compliant deck + talk track + FAQ. Gong owns revenue intelligence. Highspot/Seismic own content management. AI deck tools (Tome, Pitch) own visual generation but ignore the sales intelligence layer. This platform occupies the gap between those categories and is purpose-built for consultancy sales motions. Confidence: MEDIUM (competitor analysis based on training data through August 2025; specific feature sets may have changed).

---

## Sources

- Training knowledge: Highspot feature set (platform documentation, G2 reviews, product marketing — through August 2025)
- Training knowledge: Seismic platform features (documentation, analyst reports — through August 2025)
- Training knowledge: Gong / Chorus revenue intelligence platform capabilities (through August 2025)
- Training knowledge: Tome, Pitch, Beautiful.ai AI presentation tools (through August 2025)
- Training knowledge: Emerging agentic sales platforms (Clay, 11x, Amplemarket, AiSDR — through August 2025)
- PROJECT.md: Lumenalta-specific requirements, constraints, and decisions (authoritative — read directly)
- Note: External web search tools were unavailable during this research session. All competitor and market claims carry MEDIUM confidence. Verification against current platform documentation is recommended before finalizing roadmap decisions.

---

*Feature research for: Lumenalta Agentic Sales Orchestration Platform*
*Researched: 2026-03-03*
