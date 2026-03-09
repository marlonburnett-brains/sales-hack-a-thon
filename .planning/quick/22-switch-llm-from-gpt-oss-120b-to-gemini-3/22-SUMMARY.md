---
phase: quick-22
plan: 01
subsystem: agent-llm
tags: [model-switch, vertex-ai, gemini]
dependency_graph:
  requires: []
  provides: [gemini-3.1-flash-lite-preview-model-config]
  affects: [agent-executor, mastra-agent, chat-provider, schema-validation]
tech_stack:
  added: []
  patterns: [vertex-ai-openai-compatible-endpoint]
key_files:
  created: []
  modified:
    - apps/agent/src/mastra/agents/build-agent.ts
    - apps/agent/src/lib/agent-executor.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/validation/validate-schemas.ts
decisions:
  - Same Vertex AI OpenAI-compatible endpoint serves both Model Garden and native Gemini models
metrics:
  duration: 1 min
  completed: "2026-03-09T23:44:42Z"
---

# Quick Task 22: Switch LLM from gpt-oss-120b to Gemini 3.1 Flash Lite Summary

Switched all LLM model references from gpt-oss-120b-maas and gemini-2.0-flash to gemini-3.1-flash-lite-preview across the entire agent codebase, preserving existing Vertex AI auth patterns.

## What Changed

### Task 1: Switch Mastra agent model (faeee06)
- Changed `MODEL_ID` in `build-agent.ts` from `vertex/openai/gpt-oss-120b-maas` to `vertex/google/gemini-3.1-flash-lite-preview`
- Updated comments to reflect the endpoint serves both Model Garden and native Gemini models
- Auth flow (GoogleAuth + getVertexAccessToken) unchanged

### Task 2: Update all secondary model references (49f1ab3)
- `agent-executor.ts`: Changed both `generateContent` and `generateContentStream` calls from `gemini-2.0-flash` to `gemini-3.1-flash-lite-preview`
- `index.ts`: Changed chat provider stream model from `gemini-2.0-flash` to `gemini-3.1-flash-lite-preview`
- `validate-schemas.ts`: Updated console log from `openai/gpt-oss-120b-maas` to `google/gemini-3.1-flash-lite-preview`

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Zero references to `gpt-oss-120b` remain in `apps/agent/src/`
- Zero references to `gemini-2.0-flash` remain in `apps/agent/src/`
- 6 references to `gemini-3.1-flash-lite-preview` across 4 files
- Pre-existing TypeScript errors in unrelated files (deal-chat, deck-intelligence) -- not caused by this change
