# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-03
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## v1 Requirements

### Pre-Call Briefing

- [x] **BRIEF-01**: Seller can input company name, buyer role, and meeting context into a web form to initiate a briefing
- [x] **BRIEF-02**: System generates a company snapshot (key initiatives, recent news, financial highlights) from public sources and AtlusAI
- [x] **BRIEF-03**: System generates role-specific hypotheses tailored to the buyer's persona (e.g., CIO, CFO, VP Eng, VP Data)
- [x] **BRIEF-04**: System generates 5–10 prioritized discovery questions mapped to relevant Lumenalta solution areas
- [x] **BRIEF-05**: Completed briefing is displayed in the web app and saved as a document in shared Lumenalta Google Drive

### Transcript Processing

- [x] **TRANS-01**: Seller can paste a raw meeting transcript into a web UI form
- [x] **TRANS-02**: Seller can select the relevant industry (from 11) and subsector (from 62) before processing
- [x] **TRANS-03**: System extracts structured fields from transcript: Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget
- [x] **TRANS-04**: System flags specific missing critical fields (e.g., "Budget not mentioned") and prevents pipeline from advancing until seller acknowledges each gap
- [x] **TRANS-05**: System maps transcript content to primary and secondary Lumenalta solution pillars

### Brief Generation

- [x] **GEN-01**: System generates a structured Multi-Pillar Sales Brief identifying primary and secondary solution pillars with supporting evidence from the transcript
- [x] **GEN-02**: System generates 2–3 ROI outcome statements and 1 value hypothesis per identified use case
- [x] **GEN-03**: Seller and SME can review the complete structured brief in the web app before any assets are generated
- [x] **GEN-04**: No asset generation begins until brief is explicitly approved via a hard-stop HITL checkpoint in the web app

### Content Library

- [x] **CONT-01**: All existing Lumenalta deck templates are ingested into AtlusAI at slide level — one retrievable unit per slide with metadata tags (industry, solution pillar, persona, funnel stage)
- [x] **CONT-02**: All case studies are indexed in AtlusAI tagged by industry, subsector, solution pillar, and buyer persona
- [x] **CONT-03**: Brand guidelines and approved image/icon library are indexed in AtlusAI for retrieval during asset assembly
- [x] **CONT-04**: All 11 industries are represented in AtlusAI with at least one complete deck template and one case study each
- [x] **CONT-05**: System retrieves relevant slide blocks from AtlusAI using industry + solution pillar + funnel stage as filter parameters
- [x] **CONT-06**: System enforces brand compliance by restricting asset generation to pre-approved AtlusAI building blocks — no AI-generated layouts or hallucinated capabilities

### Asset Generation

- [x] **ASSET-01**: System assembles a custom slide order as structured JSON (slide title, bullets, speaker notes, source block reference) using the approved brief and retrieved content blocks
- [x] **ASSET-02**: System generates bespoke copy for each slide block, grounded in the approved brief and constrained to Lumenalta's voice and positioning
- [x] **ASSET-03**: System creates a formatted Google Slides deck in shared Lumenalta Drive via Google Slides API using service account credentials
- [x] **ASSET-04**: System generates a slide-by-slide talk track as a Google Doc in shared Lumenalta Drive
- [x] **ASSET-05**: System generates a buyer FAQ Google Doc with anticipated objections and recommended responses based on stakeholder roles and business context

### Review & Delivery

- [x] **REVW-01**: Seller, SME, Marketing, and Solutions can review all generated assets (deck, talk track, FAQ) in the web app before final delivery
- [x] **REVW-02**: Web app provides direct links to all Google Drive artifacts after generation is complete
- [x] **REVW-03**: All generated Google Slides output uses only Lumenalta-approved layouts, colors, and typography from the building block library

### Touch 1: First Contact Assets

- [x] **TOUCH1-01**: Seller can select a first-contact flow, input company name, industry, and key context to generate a 1-2 pager
- [x] **TOUCH1-02**: System suggests a generated 1-2 slide Google Slides pager from a branded template, customized with client-specific positioning; seller can approve the suggestion or override it with a custom version
- [x] **TOUCH1-03**: Generated or overridden pager is saved to a per-deal folder in shared Lumenalta Google Drive
- [x] **TOUCH1-04**: Approved pagers are recorded as successful outputs (positive signal); overridden pagers are recorded as learning signals (negative signal) and the seller's override is ingested into AtlusAI for future retrieval
- [x] **TOUCH1-05**: Seller can upload a custom Google Slides pager as an override when the AI-generated suggestion doesn't meet needs

### Touch 2: Intro Conversation Assets

- [x] **TOUCH2-01**: Seller can select an intro deck flow, input company name, industry, salesperson name/photo, and optionally a customer logo
- [x] **TOUCH2-02**: System AI-selects relevant "Meet Lumenalta" slides based on industry and client context from the content library
- [x] **TOUCH2-03**: System assembles selected slides into a Google Slides deck with salesperson name/photo and customer name/logo customizations applied
- [x] **TOUCH2-04**: Generated intro deck is saved to a per-deal folder in shared Lumenalta Google Drive

### Touch 3: Capability & Use Case Alignment Assets

- [x] **TOUCH3-01**: Seller can select a capability alignment flow, input company name, industry, and 1-2 relevant capability areas
- [x] **TOUCH3-02**: System AI-selects relevant slides from AtlusAI deck and L2 capability decks based on industry and selected capability areas
- [x] **TOUCH3-03**: System assembles selected slides into a Google Slides deck with salesperson and customer customizations
- [x] **TOUCH3-04**: Generated capability deck is saved to a per-deal folder in shared Lumenalta Google Drive

### Data Capture & Knowledge Growth

- [x] **DATA-01**: Every interaction across all touch points persists a complete interaction record: inputs (company, industry, context), decisions (approve/override/edit), output artifact references (Drive links), and timestamps
- [x] **DATA-02**: All meeting transcripts, notes, and conversation context submitted through any flow are stored and indexed for future retrieval and pattern learning
- [x] **DATA-03**: Approved outputs are flagged as positive examples in the knowledge base; overrides and significant edits are flagged as improvement signals
- [x] **DATA-04**: Override pagers (Touch 1), edited decks, and approved outputs are ingested into AtlusAI to improve future generation quality — the knowledge base grows with each interaction
- [x] **DATA-05**: Interaction history for a given company/deal is retrievable so that later touch points can build on context from earlier touches (e.g., Touch 2 can reference what was generated in Touch 1 for the same company)

## v2 Requirements

### Feedback Loop (Automated Refinement)

- **FDBK-01**: Human edits made to generated assets post-HITL-2 are captured and stored in a structured log (v1 captures the raw interaction data via DATA-01 through DATA-04; v2 automates the analysis)
- **FDBK-02**: Edit patterns are analyzed to surface recurring AI mistakes for prompt refinement
- **FDBK-03**: RAG retrieval accuracy is improved using edit history to identify content gaps in the building block library

### CRM Integration

- **CRM-01**: System reads deal context (company, stage, contacts) from Salesforce to pre-populate transcript form fields
- **CRM-02**: Generated assets are linked to the relevant Salesforce opportunity record

### Transcript API Integration

- **INT-01**: System connects directly to Granola API to ingest transcripts without copy-paste
- **INT-02**: System connects to Zoom AI / Firefly API as alternative transcript sources

## Out of Scope

| Feature | Reason |
|---------|--------|
| Salesforce integration (v1) | Data hygiene at Lumenalta not ready; inconsistent field completeness would make AI outputs unreliable; establishing data hygiene standards is a prerequisite |
| Real-time / in-call AI coaching | Fundamentally different architecture (low-latency audio pipeline); pre-call briefing serves the same seller-preparation goal |
| Per-seller Google OAuth / personal Drive | Multiple OAuth tokens, per-user credential management, and data ownership ambiguity are unnecessary overhead; service account to shared Drive covers the use case |
| AI-generated slide layouts | Produces off-brand output; violates brand guidelines; pre-approved building blocks are a non-negotiable constraint |
| Fine-tuning / custom model training | Requires labeled training data that doesn't exist yet; prompt engineering achieves 90% of the benefit at a fraction of the cost |
| Automated feedback loop analysis | v1 captures all interaction data and ingests overrides into AtlusAI; automated pattern analysis and prompt refinement from edit history is v2 |
| Custom analytics dashboard | Google Drive metadata provides basic tracking; formal analytics is premature before consistent adoption |
| Mobile-optimized UI | Web-first; pre/post-call work happens at a desk |
| Competitive intelligence module | High hallucination risk; requires curated, maintained competitive content not yet available |
| Real-time collaborative brief editing | Async HITL is adequate; operational transform/CRDT complexity not justified |
| Email / follow-up outreach generation | Different workflow and compliance considerations; out of scope for proposal collateral system |
| Video upload / meeting recording processing | Recording-consent complexity, storage costs, and integration surface not justified; manual paste works with any meeting tool |
| User authentication / access control | Out of scope for hackathon demo; service account provides drive access; auth layer is a production hardening concern |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRIEF-01 | Phase 10 | Complete |
| BRIEF-02 | Phase 10 | Complete |
| BRIEF-03 | Phase 10 | Complete |
| BRIEF-04 | Phase 10 | Complete |
| BRIEF-05 | Phase 10 | Complete |
| TRANS-01 | Phase 5 | Complete |
| TRANS-02 | Phase 5 | Complete |
| TRANS-03 | Phase 5 | Complete |
| TRANS-04 | Phase 5 | Complete |
| TRANS-05 | Phase 5 | Complete |
| GEN-01 | Phase 5 | Complete |
| GEN-02 | Phase 5 | Complete |
| GEN-03 | Phase 6 | Complete |
| GEN-04 | Phase 6 | Complete |
| CONT-01 | Phase 12 | Complete |
| CONT-02 | Phase 12 | Complete |
| CONT-03 | Phase 12 | Complete |
| CONT-04 | Phase 12 | Complete |
| CONT-05 | Phase 7 | Complete |
| CONT-06 | Phase 7 | Complete |
| ASSET-01 | Phase 7 | Complete |
| ASSET-02 | Phase 7 | Complete |
| ASSET-03 | Phase 8 | Complete |
| ASSET-04 | Phase 8 | Complete |
| ASSET-05 | Phase 8 | Complete |
| REVW-01 | Phase 9 | Complete |
| REVW-02 | Phase 9 | Complete |
| REVW-03 | Phase 9 | Complete |
| TOUCH1-01 | Phase 4 | Complete |
| TOUCH1-02 | Phase 4 | Complete |
| TOUCH1-03 | Phase 4 | Complete |
| TOUCH1-04 | Phase 4 | Complete |
| TOUCH1-05 | Phase 4 | Complete |
| TOUCH2-01 | Phase 4 | Complete |
| TOUCH2-02 | Phase 4 | Complete |
| TOUCH2-03 | Phase 4 | Complete |
| TOUCH2-04 | Phase 4 | Complete |
| TOUCH3-01 | Phase 4 | Complete |
| TOUCH3-02 | Phase 4 | Complete |
| TOUCH3-03 | Phase 4 | Complete |
| TOUCH3-04 | Phase 4 | Complete |
| DATA-01 | Phase 4 | Complete |
| DATA-02 | Phase 5 | Complete |
| DATA-03 | Phase 4 | Complete |
| DATA-04 | Phase 4 | Complete |
| DATA-05 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 — Touch 1 approve/override feedback loop added, data capture & knowledge growth requirements added*
