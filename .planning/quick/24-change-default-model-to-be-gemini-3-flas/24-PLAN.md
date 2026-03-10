---
phase: quick-24
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/lib/agent-executor.ts
  - apps/agent/src/mastra/index.ts
  - apps/agent/src/validation/validate-schemas.ts
autonomous: true
requirements: [QUICK-24]
must_haves:
  truths:
    - "All default model references use gemini-3-flash-preview instead of gemini-3.1-flash-lite-preview"
    - "Explicit model overrides (modification-planner, visual-qa, build-agent) remain unchanged since they already use gemini-3-flash-preview"
  artifacts:
    - path: "apps/agent/src/lib/agent-executor.ts"
      provides: "Default model for executeRuntimeProviderNamedAgent and streamRuntimeProviderNamedAgent"
      contains: "gemini-3-flash-preview"
    - path: "apps/agent/src/mastra/index.ts"
      provides: "Prompt editor chat stream model"
      contains: "gemini-3-flash-preview"
  key_links: []
---

<objective>
Change the default LLM model from gemini-3.1-flash-lite-preview to gemini-3-flash-preview across all occurrences in the agent codebase.

Purpose: Upgrade the default model to gemini-3-flash-preview for better quality output.
Output: All model references updated, agent compiles cleanly.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/lib/agent-executor.ts
@apps/agent/src/mastra/index.ts
@apps/agent/src/validation/validate-schemas.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace all gemini-3.1-flash-lite-preview references with gemini-3-flash-preview</name>
  <files>apps/agent/src/lib/agent-executor.ts, apps/agent/src/mastra/index.ts, apps/agent/src/validation/validate-schemas.ts</files>
  <action>
    Replace every occurrence of "gemini-3.1-flash-lite-preview" with "gemini-3-flash-preview" in these three files:

    1. `apps/agent/src/lib/agent-executor.ts` — Two occurrences:
       - Line 178: default model in `executeRuntimeProviderNamedAgent` function
       - Line 211: model in `streamRuntimeProviderNamedAgent` function

    2. `apps/agent/src/mastra/index.ts` — One occurrence:
       - Line 3744: model in prompt editor chat stream

    3. `apps/agent/src/validation/validate-schemas.ts` — One occurrence:
       - Line 193: console.log model name display string

    Do NOT change files that already use "gemini-3-flash-preview" (modification-planner.ts, visual-qa.ts, build-agent.ts) — they are already correct.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -r "gemini-3.1-flash-lite-preview" apps/agent/src/ && echo "FAIL: old model still found" || echo "PASS: no old model references" && grep -c "gemini-3-flash-preview" apps/agent/src/lib/agent-executor.ts apps/agent/src/mastra/index.ts</automated>
  </verify>
  <done>Zero occurrences of "gemini-3.1-flash-lite-preview" remain in the codebase. The three files now reference "gemini-3-flash-preview".</done>
</task>

<task type="auto">
  <name>Task 2: Verify TypeScript compilation</name>
  <files>apps/agent/src/lib/agent-executor.ts</files>
  <action>
    Run the TypeScript compiler in the agent app to confirm no type errors were introduced by the model string change. This is a string literal swap so it should be clean, but verify anyway.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon/apps/agent && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>TypeScript compilation succeeds with no errors related to the model change.</done>
</task>

</tasks>

<verification>
- `grep -r "gemini-3.1-flash-lite-preview" apps/agent/src/` returns no results
- `grep -r "gemini-3-flash-preview" apps/agent/src/` shows all expected occurrences
- TypeScript compiles without errors
</verification>

<success_criteria>
All default model references changed from gemini-3.1-flash-lite-preview to gemini-3-flash-preview. Agent compiles cleanly. No unintended changes to files already using gemini-3-flash-preview.
</success_criteria>

<output>
After completion, create `.planning/quick/24-change-default-model-to-be-gemini-3-flas/24-SUMMARY.md`
</output>
