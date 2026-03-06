# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-05
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.

## v1.2 Requirements

Requirements for milestone v1.2 Templates & Slide Intelligence. Each maps to roadmap phases.

### CI/CD Pipeline

- [x] **CICD-01**: Push to main triggers automated lint, type-check, and build via GitHub Actions
- [x] **CICD-02**: Web app auto-deploys to Vercel after checks pass
- [x] **CICD-03**: Agent auto-deploys to Railway after checks pass
- [x] **CICD-04**: Pending Prisma migrations auto-run against target database before deploy

### Navigation

- [x] **NAV-01**: User can navigate between Deals and Templates via a persistent side panel
- [x] **NAV-02**: Side panel is collapsible and preserves all existing authenticated routes

### Template Management

- [x] **TMPL-01**: User can add a Google Slides template by pasting a URL with display name and touch type assignment
- [x] **TMPL-02**: User can view a list of all registered templates with status badges (Ready, No Access, Not Ingested, Stale)
- [x] **TMPL-03**: User can delete a registered template
- [x] **TMPL-04**: User can assign multiple touch types (Touch 1-4) to each template
- [x] **TMPL-05**: System validates Google Slides URL format and extracts presentation ID on add
- [x] **TMPL-06**: System checks file access on add and flags inaccessible files with service account email for sharing
- [x] **TMPL-07**: System detects when a template source file has been modified since last ingestion and shows staleness badge

### Slide Intelligence

- [x] **SLIDE-01**: pgvector extension enabled in Supabase with slide embeddings table and HNSW index
- [x] **SLIDE-02**: User can trigger slide ingestion for an accessible template
- [x] **SLIDE-03**: Agent extracts text content from each slide via Google Slides API
- [x] **SLIDE-04**: Agent generates vector embedding for each slide via Vertex AI text-embedding model
- [x] **SLIDE-05**: Agent classifies each slide by industry, solution pillar, persona, funnel stage, and content type via LLM structured output
- [x] **SLIDE-06**: Embeddings and classifications are stored in Supabase pgvector
- [x] **SLIDE-07**: User can see real-time progress during multi-slide ingestion (slide N/M)
- [x] **SLIDE-08**: Each classification includes a confidence score (0-100%)
- [x] **SLIDE-09**: User can find similar slides across all ingested presentations via vector similarity search

### Preview & Review

- [x] **PREV-01**: User can preview slides at presentation size in the viewport with navigation between slides
- [x] **PREV-02**: Each slide displays AI-assigned classification tags (industry, pillar, persona, stage) alongside the preview
- [x] **PREV-03**: User can rate a slide classification as correct (thumbs up) or incorrect (thumbs down)
- [x] **PREV-04**: User can correct individual classification tags via inline editing when rating as incorrect
- [x] **PREV-05**: Corrections update pgvector metadata immediately (real-time improvement)

## Future Requirements

Deferred to v1.2.x or later. Tracked but not in current roadmap.

### Template Enhancements

- **TMPL-08**: System auto-re-ingests templates when Drive webhook detects source file changes
- **TMPL-09**: Cross-template deduplication flags near-duplicate slides across presentations

### Analytics

- **ANLYT-01**: Classification analytics dashboard shows distribution by industry/pillar/persona and coverage gaps
- **ANLYT-02**: Review completion rate tracking across all templates

### Search

- **SRCH-01**: Full-text search across slide content via Supabase tsvector index

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag-and-drop slide reordering | Rebuilding Google Slides editor is massive scope creep; sellers reorder in Google Slides |
| In-browser slide content editing | No WYSIWYG for Slides content; link to Google Slides for editing |
| Automated nightly re-classification | Expensive API calls for rarely-changing content; use version tracking instead |
| Multi-tenant template libraries | Single-team tool for ~20 sellers; shared library IS the product |
| Custom embedding model selection | Inconsistent vector spaces break similarity search; one model for all |
| Real-time collaborative curation | Low-frequency admin operation; last-write-wins is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CICD-01 | Phase 18 | Complete |
| CICD-02 | Phase 18 | Complete |
| CICD-03 | Phase 18 | Complete |
| CICD-04 | Phase 18 | Complete |
| NAV-01 | Phase 19 | Complete |
| NAV-02 | Phase 19 | Complete |
| TMPL-01 | Phase 19 | Complete |
| TMPL-02 | Phase 19 | Complete |
| TMPL-03 | Phase 19 | Complete |
| TMPL-04 | Phase 19 | Complete |
| TMPL-05 | Phase 19 | Complete |
| TMPL-06 | Phase 19 | Complete |
| TMPL-07 | Phase 19 | Complete |
| SLIDE-01 | Phase 18 | Complete |
| SLIDE-02 | Phase 20 | Complete |
| SLIDE-03 | Phase 20 | Complete |
| SLIDE-04 | Phase 20 | Complete |
| SLIDE-05 | Phase 20 | Complete |
| SLIDE-06 | Phase 20 | Complete |
| SLIDE-07 | Phase 20 | Complete |
| SLIDE-08 | Phase 20 | Complete |
| SLIDE-09 | Phase 21 | Complete |
| PREV-01 | Phase 21 | Complete |
| PREV-02 | Phase 21 | Complete |
| PREV-03 | Phase 21 | Complete |
| PREV-04 | Phase 21 | Complete |
| PREV-05 | Phase 21 | Complete |

**Coverage:**
- v1.2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
