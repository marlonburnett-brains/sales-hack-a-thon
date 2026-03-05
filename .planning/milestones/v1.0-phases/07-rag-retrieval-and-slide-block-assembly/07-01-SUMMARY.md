---
phase: 07-rag-retrieval-and-slide-block-assembly
plan: 01
subsystem: api
tags: [rag, retrieval, gemini, zod, proposal, slide-assembly, drive-api]

# Dependency graph
requires:
  - phase: 03-zod-schema-layer
    provides: "SlideAssemblyLlmSchema, SlideMetadataSchema, zodToGeminiSchema, SalesBriefLlmSchema"
  - phase: 02-content-library-ingestion
    provides: "AtlusAI ingested slide content in Drive folder"
  - phase: 04-touch-1-3
    provides: "searchSlides, searchByCapability in atlusai-search.ts"
provides:
  - "searchForProposal() multi-pass retrieval function with 3-tier fallback"
  - "filterByMetadata() post-retrieval filtering using SlideMetadataSchema"
  - "buildSlideJSON() ordered slide assembly with fixed section template"
  - "generateSlideCopy() per-slide Gemini copy rewriting with brand constraints"
  - "ProposalCopyLlmSchema for per-slide copy generation output"
  - "Extended SlideAssemblyLlmSchema with sectionType and sourceType fields"
  - "3 test brief fixtures covering Financial Services, Healthcare, Technology"
  - "RAG quality verification script with --schema-only and --industry modes"
affects: [07-02, 08-google-slides-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-pass-retrieval, metadata-filtering, brand-constrained-copy-generation]

key-files:
  created:
    - packages/schemas/llm/proposal-copy.ts
    - apps/agent/src/lib/proposal-assembly.ts
    - apps/agent/src/scripts/test-briefs.ts
    - apps/agent/src/scripts/verify-rag-quality.ts
  modified:
    - packages/schemas/llm/slide-assembly.ts
    - packages/schemas/index.ts
    - apps/agent/src/lib/atlusai-search.ts

key-decisions:
  - "Extended SlideAssemblyLlmSchema in-place with sectionType/sourceType string fields (backward compatible, Gemini-safe)"
  - "ProposalCopyLlmSchema kept minimal (slideTitle, bullets, speakerNotes) for focused copy rewriting"
  - "Three-tier fallback in searchForProposal: industry-specific, broad, cross-industry -- never fails"
  - "Slides with unparseable metadata included by filterByMetadata (don't discard content due to metadata issues)"
  - "Dynamic deck length formula with floor 8 ceiling 18 for proposal assembly"
  - "Minimal content slides (<20 words) skip Gemini copy rewriting and return original text"

patterns-established:
  - "Multi-pass retrieval: primary pillar -> secondary pillars -> case studies with Map-based dedup"
  - "Metadata-safe filtering: safeParse + include-on-failure pattern"
  - "Fixed section template: title_context -> problem_restatement -> primary -> secondary -> case_study -> roi_outcomes -> next_steps"
  - "Brand-constrained copy generation with explicit grounding constraints in Gemini prompt"

requirements-completed: [CONT-05, CONT-06]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 7 Plan 01: RAG Retrieval and Slide Block Assembly Summary

**Multi-pass RAG retrieval pipeline with 3-tier fallback, post-retrieval metadata filtering, ordered SlideJSON assembly with fixed section template, and brand-constrained Gemini copy generation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T13:25:01Z
- **Completed:** 2026-03-04T13:30:27Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Extended SlideAssemblyLlmSchema with sectionType and sourceType fields for deck section tracking
- Built searchForProposal() with 3-pass retrieval (primary pillar, secondary pillars, case studies) and Map-based deduplication with 3-tier sparse-result fallback
- Created proposal-assembly.ts with filterByMetadata, buildSlideJSON, and generateSlideCopy functions
- Created 3 realistic test brief fixtures and quality verification script with schema round-trip validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SlideAssembly schema and create ProposalCopy schema** - `9ca1ac0` (feat)
2. **Task 2: Build searchForProposal multi-pass retrieval and proposal-assembly module** - `98dcf19` (feat)
3. **Task 3: Create test brief fixtures and RAG quality verification script** - `182d6cc` (feat)

## Files Created/Modified
- `packages/schemas/llm/slide-assembly.ts` - Extended with sectionType and sourceType fields
- `packages/schemas/llm/proposal-copy.ts` - New ProposalCopyLlmSchema for per-slide copy generation
- `packages/schemas/index.ts` - Added barrel export for ProposalCopyLlmSchema
- `apps/agent/src/lib/atlusai-search.ts` - Added searchForProposal() multi-pass retrieval with ProposalSearchResult
- `apps/agent/src/lib/proposal-assembly.ts` - filterByMetadata, buildSlideJSON, generateSlideCopy business logic
- `apps/agent/src/scripts/test-briefs.ts` - 3 mock approved brief fixtures (Financial Services, Healthcare, Technology)
- `apps/agent/src/scripts/verify-rag-quality.ts` - RAG quality verification with --schema-only and --industry modes

## Decisions Made
- Extended SlideAssemblyLlmSchema in-place with string fields (not enum) for Gemini safety and backward compatibility
- ProposalCopyLlmSchema kept minimal with 3 fields -- focused on copy rewriting output only
- filterByMetadata uses safeParse and includes slides with unparseable metadata to avoid discarding content
- buildSlideJSON uses dynamic deck length formula (floor 8, ceiling 18) based on use case count and available case studies
- generateSlideCopy skips Gemini call for minimal content slides (<20 words) to avoid unnecessary API calls
- Sparse result fallback progressively broadens search: with industry -> without industry -> cross-industry

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- packages/schemas has no tsconfig.json (plan's verification command referenced one). Verified schemas compile through apps/agent/tsconfig.json instead. Pre-existing Mastra API type errors in apps/agent/src/mastra/index.ts are unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All retrieval and assembly infrastructure ready for Plan 07-02 (deck assembly workflow integration)
- searchForProposal, filterByMetadata, buildSlideJSON, generateSlideCopy all exported and compilable
- Extended SlideAssemblyLlmSchema passes Gemini schema round-trip (verified via --schema-only)
- Full retrieval mode requires AtlusAI content to be ingested (Phase 2 dependency)

## Self-Check: PASSED

All 7 created/modified files verified on disk. All 3 task commits (9ca1ac0, 98dcf19, 182d6cc) verified in git log.

---
*Phase: 07-rag-retrieval-and-slide-block-assembly*
*Completed: 2026-03-04*
