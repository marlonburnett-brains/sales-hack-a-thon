---
phase: quick
plan: 1
subsystem: agent-llm
tags: [vertex-ai, gpt-oss-120b, llm-provider]
dependency_graph:
  requires: []
  provides: [vertex-ai-auth, gpt-oss-120b-model]
  affects: [all-llm-calls, ingestion-pipeline, validation-scripts]
tech_stack:
  added: [vertex-ai-auth]
  patterns: [vertexai-true-client-init]
key_files:
  created: []
  modified:
    - apps/agent/src/env.ts
    - apps/agent/.env.example
    - .gitignore
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/mastra/workflows/pre-call-workflow.ts
    - apps/agent/src/lib/slide-selection.ts
    - apps/agent/src/lib/proposal-assembly.ts
    - apps/agent/src/validation/validate-schemas.ts
    - apps/agent/src/ingestion/run-ingestion.ts
    - apps/agent/src/ingestion/pilot-ingestion.ts
    - apps/agent/src/ingestion/classify-metadata.ts
decisions:
  - Vertex AI auth via vertexai: true flag on GoogleGenAI client (reads GOOGLE_APPLICATION_CREDENTIALS automatically)
  - classify-metadata.ts function signatures kept backward-compatible with optional _geminiApiKey parameter
metrics:
  duration: 14 min
  completed: "2026-03-04"
---

# Quick Task 1: Switch LLM from Gemini to GPT-OSS 120b Summary

All LLM calls switched from Google AI Studio (GEMINI_API_KEY) to Vertex AI service account auth with gpt-oss-120b model across 12 files.

## What Changed

### Task 1: Update env config and gitignore for Vertex AI
- Removed `GEMINI_API_KEY` from env schema in `apps/agent/src/env.ts`
- Added `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` with `.min(1)` validation
- Added comment noting `GOOGLE_APPLICATION_CREDENTIALS` is read automatically by the SDK
- Updated `.env.example` with new Vertex AI vars
- Added `vertex-service-account.json` to `.gitignore`
- **Commit:** 218758d

### Task 2: Update all GoogleGenAI client initializations and model names
- Replaced 15 instances of `new GoogleGenAI({ apiKey: ... })` with `new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION })`
- Replaced 16 instances of `model: "gemini-2.5-flash"` with `model: "gpt-oss-120b"`
- Removed local `geminiApiKey` variables and their null checks in slide-selection.ts, proposal-assembly.ts, validate-schemas.ts, run-ingestion.ts, pilot-ingestion.ts
- Updated classify-metadata.ts to import env directly and use Vertex AI auth instead of receiving API key as a parameter
- Updated preflight error messages to reference GOOGLE_CLOUD_PROJECT instead of GEMINI_API_KEY
- **Commit:** efdcb48

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] classify-metadata.ts function signature update**
- **Found during:** Task 2
- **Issue:** `classifySlide` and `classifyAllSlides` accepted `geminiApiKey: string` as a parameter and constructed the GoogleGenAI client with it. After switching to Vertex AI, the API key parameter was no longer needed.
- **Fix:** Changed parameter to optional `_geminiApiKey?: string` for backward compatibility, imported env directly, and constructed the Vertex AI client from env vars. Removed the geminiApiKey argument from internal calls.
- **Files modified:** classify-metadata.ts, pilot-ingestion.ts, run-ingestion.ts
- **Commit:** efdcb48

## Verification Results

- Zero references to `GEMINI_API_KEY` in `apps/agent/src/`
- Zero references to `gemini-2.5-flash` in `apps/agent/src/`
- 15 files with `vertexai: true`
- 16 files with `gpt-oss-120b`
- TypeScript compiles with no new errors (pre-existing errors in index.ts and touch-4-workflow.ts line 67 unrelated to this change)

## Self-Check: PASSED
