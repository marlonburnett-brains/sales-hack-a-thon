---
phase: quick
plan: 5
subsystem: refactoring
tags: [llm, naming, code-hygiene, vertex-ai]

requires:
  - phase: quick-1
    provides: LLM provider switch from Gemini to Vertex AI gpt-oss-120b
provides:
  - LLM-agnostic naming across entire codebase
  - zodToLlmJsonSchema utility function (renamed from zodToGeminiSchema)
affects: [all-llm-consumers, documentation, onboarding]

tech-stack:
  added: []
  patterns:
    - "LLM-agnostic naming convention: use 'LLM' not provider-specific names"

key-files:
  created:
    - packages/schemas/llm-json-schema.ts
  modified:
    - packages/schemas/index.ts
    - apps/agent/src/validation/validate-schemas.ts
    - apps/agent/src/lib/proposal-assembly.ts
    - apps/agent/src/lib/slide-selection.ts
    - apps/agent/src/mastra/workflows/pre-call-workflow.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/scripts/verify-rag-quality.ts
    - apps/agent/src/ingestion/classify-metadata.ts
    - apps/agent/src/ingestion/run-ingestion.ts
    - apps/agent/src/ingestion/pilot-ingestion.ts
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/web/src/lib/error-messages.ts
    - packages/schemas/llm/*.ts (12 files)
    - packages/schemas/app/interaction-record.ts
    - packages/schemas/app/feedback-signal.ts
    - packages/schemas/constants.ts
    - deploy/.env.example
    - README.md

key-decisions:
  - "Removed dead gemini string check from error-messages.ts rather than replacing (api and model checks already cover LLM errors)"
  - "Replaced GEMINI_API_KEY env var row in README with GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION to reflect actual Vertex AI config"

patterns-established:
  - "LLM-agnostic naming: all comments, function names, and docs use 'LLM' not provider-specific names"

requirements-completed: [QUICK-5]

duration: 11min
completed: 2026-03-06
---

# Quick Task 5: Rewrite All Gemini References Summary

**Renamed zodToGeminiSchema to zodToLlmJsonSchema and eliminated 100+ Gemini references across 30+ files for fully LLM-agnostic codebase**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-06T21:41:23Z
- **Completed:** 2026-03-06T21:52:45Z
- **Tasks:** 3
- **Files modified:** 31

## Accomplishments
- Renamed gemini-schema.ts to llm-json-schema.ts with zodToLlmJsonSchema function
- Updated all 10+ agent source file imports and usages
- Replaced "Gemini-safe:" with "LLM-safe:" in 12 LLM schema files
- Updated README.md architecture diagram, tech stack table, and workflow descriptions
- Removed dead "gemini" string check from error-messages.ts
- Final verification: zero occurrences of "gemini" (case-insensitive) across entire codebase

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename gemini-schema.ts and update all code references** - `6859bd4` (refactor)
2. **Task 2: Update all comments in LLM schema files and remaining docs** - `0da192b` (docs)
3. **Task 3: TypeScript compilation check and final sweep** - No changes needed (verification only)

## Files Created/Modified
- `packages/schemas/llm-json-schema.ts` - Renamed utility (formerly gemini-schema.ts), exports zodToLlmJsonSchema
- `packages/schemas/gemini-schema.ts` - DELETED
- `packages/schemas/index.ts` - Updated barrel export to new function name
- `apps/agent/src/ingestion/classify-metadata.ts` - Renamed GEMINI_RESPONSE_SCHEMA to LLM_RESPONSE_SCHEMA, _geminiApiKey to _legacyApiKey
- `apps/agent/src/ingestion/run-ingestion.ts` - Renamed geminiApiKey to cloudProject
- `apps/agent/src/ingestion/pilot-ingestion.ts` - Renamed _geminiApiKey to _legacyApiKey
- `apps/web/src/lib/error-messages.ts` - Removed dead "gemini" string check
- `README.md` - Full rewrite of LLM references, updated env var table
- `deploy/.env.example` - Removed "Gemini" from Vertex AI comment
- 12 LLM schema files - "Gemini-safe:" to "LLM-safe:" in JSDoc
- 2 app schema files - "NOT sent to Gemini" to "NOT sent to LLM"
- `packages/schemas/constants.ts` - Updated 2 Gemini comment references

## Decisions Made
- Removed dead `lower.includes("gemini")` check from error-messages.ts rather than replacing with "llm" -- the existing "api" and "model" checks already cover LLM errors
- Replaced GEMINI_API_KEY env var in README with GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION to reflect the actual Vertex AI configuration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Codebase is fully LLM-agnostic
- TypeScript compiles with no new errors from the rename
- Zero occurrences of "gemini" outside .planning/ historical docs

---
*Quick Task: 5*
*Completed: 2026-03-06*
