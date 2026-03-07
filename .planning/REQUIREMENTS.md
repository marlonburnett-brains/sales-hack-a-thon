# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-07
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.

## v1.6 Requirements

Requirements for Touch 4 Artifact Intelligence. Each maps to roadmap phases.

### Schema

- [x] **SCHM-01**: Prisma migration adds nullable `artifactType` column to Template model
- [x] **SCHM-02**: Prisma migration adds nullable `artifactType` column to DeckStructure model with composite unique constraint `(touchType, artifactType)` replacing single-column `touchType @unique`
- [x] **SCHM-03**: Shared `ARTIFACT_TYPES` constant (`proposal`, `talk_track`, `faq`) defined in `@lumenalta/schemas`

### Classification

- [ ] **CLSF-01**: User can select artifact type (Proposal / Talk Track / FAQ) when classifying a presentation as Touch 4 Example
- [ ] **CLSF-02**: Artifact type selector only appears when Touch 4 + Example is selected in classify UI

### Deck Structures

- [x] **DECK-01**: AI inference engine filters Touch 4 examples by artifact type, producing 3 separate deck structures
- [x] **DECK-02**: Cron auto-inference iterates over 6 keys (Touch 1-3 + Touch 4 x3 artifact types) with per-key change detection
- [ ] **DECK-03**: Settings Touch 4 page shows tabbed view (Proposal / Talk Track / FAQ) with separate structure per tab
- [ ] **DECK-04**: Each Touch 4 artifact tab shows independent confidence scoring based on classified example count for that artifact type
- [ ] **DECK-05**: Chat refinement threads artifact type, allowing per-artifact-type conversation scoped to the correct structure

## Future Requirements

### Classification Enhancements

- **CLSF-03**: AI auto-suggests artifact type during classification
- **CLSF-04**: Template list page filterable by artifact type

### Deck Structure Enhancements

- **DECK-06**: Cross-artifact structural comparison view
- **DECK-07**: Custom artifact types beyond Proposal / Talk Track / FAQ

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI auto-classification of artifact type | Manual classification sufficient for v1.6; avoids incorrect AI suggestions polluting structures |
| Custom artifact types | Fixed three types match current GTM strategy; extensibility deferred |
| Template artifact type (non-Example) | User confirmed: only Examples need artifact type sub-classification |
| Action Required badge for missing artifact type | Deferred per user scope decision |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHM-01 | Phase 35 | Complete |
| SCHM-02 | Phase 35 | Complete |
| SCHM-03 | Phase 35 | Complete |
| CLSF-01 | Phase 37 | Pending |
| CLSF-02 | Phase 37 | Pending |
| DECK-01 | Phase 36 | Complete |
| DECK-02 | Phase 36 | Complete |
| DECK-03 | Phase 37 | Pending |
| DECK-04 | Phase 37 | Pending |
| DECK-05 | Phase 36 | Pending |

**Coverage:**
- v1.6 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
