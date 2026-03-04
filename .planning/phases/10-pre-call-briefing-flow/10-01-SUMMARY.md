---
phase: 10-pre-call-briefing-flow
plan: 01
subsystem: api
tags: [mastra, gemini, google-docs, workflow, pre-call, briefing]

# Dependency graph
requires:
  - phase: 03-zod-schema-layer
    provides: CompanyResearchLlmSchema, HypothesesLlmSchema, DiscoveryQuestionsLlmSchema, zodToGeminiSchema
  - phase: 08-google-workspace-output-generation
    provides: createGoogleDoc doc-builder, getOrCreateDealFolder drive-folders
provides:
  - 6-step pre-call briefing Mastra workflow (researchCompany, queryCaseStudies, generateHypotheses, generateDiscoveryQuestions, buildBriefingDoc, recordInteraction)
  - pre_call touch type in TOUCH_TYPES constant
  - startPreCallWorkflow and getPreCallWorkflowStatus API client functions
  - generatePreCallBriefingAction and checkPreCallStatusAction server actions
affects: [10-02-pre-call-ui, pre-call-briefing-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [direct-generation-workflow, json-serialized-step-data]

key-files:
  created:
    - apps/agent/src/mastra/workflows/pre-call-workflow.ts
  modified:
    - packages/schemas/constants.ts
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/actions/touch-actions.ts

key-decisions:
  - "JSON string serialization for compound objects between Mastra steps (same pattern as Phase 7)"
  - "Direct-generation pattern (no suspend/resume) matching Touch 2 workflow"
  - "Graceful fallback for case study search -- empty array if no results or search fails"

patterns-established:
  - "Pre-call workflow direct generation: 6-step sequential pipeline with no HITL checkpoint"

requirements-completed: [BRIEF-01, BRIEF-02, BRIEF-03, BRIEF-04, BRIEF-05]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 10 Plan 01: Pre-Call Briefing Backend Pipeline Summary

**6-step Mastra workflow generating company research, value hypotheses, discovery questions, and Google Doc briefing via Gemini 2.5 Flash with API client and server action plumbing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T16:46:10Z
- **Completed:** 2026-03-04T16:49:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created 479-line pre-call workflow with 6 sequential steps using Gemini structured output
- Each Gemini step uses zodToGeminiSchema + structured JSON response pattern consistent with Phase 4+
- Google Doc briefing created in per-deal Drive folder with locked naming convention
- InteractionRecord created with touchType='pre_call' and full inputs/outputRefs
- API client and server action plumbing complete for web app integration
- Both agent and web packages build successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pre-call workflow and register in Mastra** - `cae95cd` (feat)
2. **Task 2: Add API client functions and server actions for pre-call flow** - `2eb71ae` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `apps/agent/src/mastra/workflows/pre-call-workflow.ts` - 6-step pre-call briefing Mastra workflow (479 lines)
- `packages/schemas/constants.ts` - Added 'pre_call' to TOUCH_TYPES constant
- `apps/agent/src/mastra/index.ts` - Registered pre-call-workflow in Mastra instance
- `apps/web/src/lib/api-client.ts` - Added startPreCallWorkflow and getPreCallWorkflowStatus functions
- `apps/web/src/lib/actions/touch-actions.ts` - Added generatePreCallBriefingAction and checkPreCallStatusAction server actions

## Decisions Made
- JSON string serialization for compound objects (companyResearch, hypotheses, discoveryQuestions, caseStudies) between Mastra steps -- same pattern as Phase 7 for storage compatibility
- Direct-generation pattern (no suspend/resume) matching Touch 2 workflow -- pre-call briefing is auto-approved
- Graceful fallback for case study search: returns empty array if no case study results found or search fails
- Case study filtering uses metadata.slideCategory includes "case_study" pattern, takes top 2 results

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pre-call workflow registered and callable via API
- Server actions ready for UI integration in Plan 10-02
- All 5 BRIEF requirements addressed by the backend pipeline

## Self-Check: PASSED

All files and commits verified:
- pre-call-workflow.ts: FOUND
- 10-01-SUMMARY.md: FOUND
- cae95cd (Task 1): FOUND
- 2eb71ae (Task 2): FOUND

---
*Phase: 10-pre-call-briefing-flow*
*Completed: 2026-03-04*
