# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-05
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.

## v1.2 Requirements

Requirements for milestone v1.2 Templates & Slide Intelligence. Each maps to roadmap phases.

### CI/CD Pipeline

- [ ] **CICD-01**: Push to main triggers automated lint, type-check, and build via GitHub Actions
- [ ] **CICD-02**: Web app auto-deploys to Vercel after checks pass
- [ ] **CICD-03**: Agent auto-deploys to Railway after checks pass
- [ ] **CICD-04**: Pending Prisma migrations auto-run against target database before deploy

### Navigation

- [ ] **NAV-01**: User can navigate between Deals and Templates via a persistent side panel
- [ ] **NAV-02**: Side panel is collapsible and preserves all existing authenticated routes

### Template Management

- [ ] **TMPL-01**: User can add a Google Slides template by pasting a URL with display name and touch type assignment
- [ ] **TMPL-02**: User can view a list of all registered templates with status badges (Ready, No Access, Not Ingested, Stale)
- [ ] **TMPL-03**: User can delete a registered template
- [ ] **TMPL-04**: User can assign multiple touch types (Touch 1-4) to each template
- [ ] **TMPL-05**: System validates Google Slides URL format and extracts presentation ID on add
- [ ] **TMPL-06**: System checks file access on add and flags inaccessible files with service account email for sharing
- [ ] **TMPL-07**: System detects when a template source file has been modified since last ingestion and shows staleness badge

### Slide Intelligence

- [ ] **SLIDE-01**: pgvector extension enabled in Supabase with slide embeddings table and HNSW index
- [ ] **SLIDE-02**: User can trigger slide ingestion for an accessible template
- [ ] **SLIDE-03**: Agent extracts text content from each slide via Google Slides API
- [ ] **SLIDE-04**: Agent generates vector embedding for each slide via Vertex AI text-embedding model
- [ ] **SLIDE-05**: Agent classifies each slide by industry, solution pillar, persona, funnel stage, and content type via LLM structured output
- [ ] **SLIDE-06**: Embeddings and classifications are stored in Supabase pgvector
- [ ] **SLIDE-07**: User can see real-time progress during multi-slide ingestion (slide N/M)
- [ ] **SLIDE-08**: Each classification includes a confidence score (0-100%)
- [ ] **SLIDE-09**: User can find similar slides across all ingested presentations via vector similarity search

### Preview & Review

- [ ] **PREV-01**: User can preview slides at presentation size in the viewport with navigation between slides
- [ ] **PREV-02**: Each slide displays AI-assigned classification tags (industry, pillar, persona, stage) alongside the preview
- [ ] **PREV-03**: User can rate a slide classification as correct (thumbs up) or incorrect (thumbs down)
- [ ] **PREV-04**: User can correct individual classification tags via inline editing when rating as incorrect
- [ ] **PREV-05**: Corrections update pgvector metadata immediately (real-time improvement)

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
| CICD-01 | Phase 18 | Pending |
| CICD-02 | Phase 18 | Pending |
| CICD-03 | Phase 18 | Pending |
| CICD-04 | Phase 18 | Pending |
| NAV-01 | Phase 19 | Pending |
| NAV-02 | Phase 19 | Pending |
| TMPL-01 | Phase 19 | Pending |
| TMPL-02 | Phase 19 | Pending |
| TMPL-03 | Phase 19 | Pending |
| TMPL-04 | Phase 19 | Pending |
| TMPL-05 | Phase 19 | Pending |
| TMPL-06 | Phase 19 | Pending |
| TMPL-07 | Phase 19 | Pending |
| SLIDE-01 | Phase 18 | Pending |
| SLIDE-02 | Phase 20 | Pending |
| SLIDE-03 | Phase 20 | Pending |
| SLIDE-04 | Phase 20 | Pending |
| SLIDE-05 | Phase 20 | Pending |
| SLIDE-06 | Phase 20 | Pending |
| SLIDE-07 | Phase 20 | Pending |
| SLIDE-08 | Phase 20 | Pending |
| SLIDE-09 | Phase 21 | Pending |
| PREV-01 | Phase 21 | Pending |
| PREV-02 | Phase 21 | Pending |
| PREV-03 | Phase 21 | Pending |
| PREV-04 | Phase 21 | Pending |
| PREV-05 | Phase 21 | Pending |

**Coverage:**
- v1.2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
