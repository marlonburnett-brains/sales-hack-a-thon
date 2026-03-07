# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-07
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.

## v1.5 Requirements

Requirements for milestone v1.5 Review Polish & Deck Intelligence. Each maps to roadmap phases.

### UX Polish

- [x] **UXP-01**: User sees document thumbnail previews on Discovery page cards (cached via GCS)
- [x] **UXP-02**: User sees file-type-specific icons when no thumbnail is available (Slides, Docs, Sheets, PDF)
- [x] **UXP-03**: User sees consistent ingestion status on Discovery and Templates pages (progress bar + slide count)
- [x] **UXP-04**: User receives immediate visual feedback when clicking Ingest (optimistic state, menu closes, button disabled)
- [x] **UXP-05**: User cannot trigger duplicate ingestion by clicking Ingest multiple times

### Slide Intelligence

- [x] **SLI-01**: System generates rich AI description for each slide during ingestion (purpose, visual composition, key content, use cases)
- [x] **SLI-02**: Slide descriptions are visible in the per-template slide viewer metadata panel
- [x] **SLI-03**: System extracts structured element map from Google Slides API during ingestion (element ID, type, position, content, styling)
- [x] **SLI-04**: Element maps are stored per slide and accessible for downstream consumption
- [x] **SLI-05**: System backfills descriptions and element maps for already-ingested slides on re-ingestion

### Content Classification

- [x] **CCL-01**: User can classify a presentation as "Template" or "Example"
- [x] **CCL-02**: User can bind an "Example" presentation to a specific touch type
- [x] **CCL-03**: User sees "Action Required" indicator on unclassified presentations
- [x] **CCL-04**: Classification is displayed on template cards and detail views

### Deck Intelligence

- [x] **DKI-01**: User can access a Settings page from the main sidebar navigation
- [x] **DKI-02**: Settings page has nested side navigation for sub-sections
- [ ] **DKI-03**: User can view AI-inferred deck structure breakdown for each touch type (Touch 1-4)
- [ ] **DKI-04**: Deck structures show section flow, variations, and reference slides mapped to each section
- [ ] **DKI-05**: Deck structures show confidence score per touch based on available examples
- [ ] **DKI-06**: User can refine AI analysis via chat bar (flag issues, add context, provide feedback)
- [ ] **DKI-07**: AI updates deck structure based on user chat feedback

## Future Requirements

### Slide Intelligence v2

- **SLI-06**: System detects layout type from element map (title slide, content slide, comparison, etc.)
- **SLI-07**: Slide similarity search includes element layout matching

### Deck Intelligence v2

- **DKI-08**: Deck structures auto-update when new examples are ingested
- **DKI-09**: Export deck structure as reusable assembly template

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time SSE for ingestion status | Polling sufficient for ~20 users; SSE adds infrastructure complexity |
| Vercel AI SDK / useChat | Incompatible with Mastra Hono architecture; build chat from primitives |
| Drag-and-drop slide reordering in viewer | Sellers reorder in Google Slides directly |
| Element map visual editor | Display only for v1.5; editing is future |
| Automatic classification inference | Users must explicitly classify; AI suggestion is v2 |
| Domain-wide delegation for Drive thumbnails | User-delegated OAuth + service account fallback sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UXP-01 | Phase 32 | Complete |
| UXP-02 | Phase 32 | Complete |
| UXP-03 | Phase 32 | Complete |
| UXP-04 | Phase 32 | Complete |
| UXP-05 | Phase 32 | Complete |
| SLI-01 | Phase 33 | Complete |
| SLI-02 | Phase 33 | Complete |
| SLI-03 | Phase 33 | Complete |
| SLI-04 | Phase 33 | Complete |
| SLI-05 | Phase 33 | Complete |
| CCL-01 | Phase 33 | Complete |
| CCL-02 | Phase 33 | Complete |
| CCL-03 | Phase 33 | Complete |
| CCL-04 | Phase 33 | Complete |
| DKI-01 | Phase 34 | Complete |
| DKI-02 | Phase 34 | Complete |
| DKI-03 | Phase 34 | Pending |
| DKI-04 | Phase 34 | Pending |
| DKI-05 | Phase 34 | Pending |
| DKI-06 | Phase 34 | Pending |
| DKI-07 | Phase 34 | Pending |

**Coverage:**
- v1.5 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
