---
phase: quick-22
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/mastra/agents/build-agent.ts
  - apps/agent/src/validation/validate-schemas.ts
  - apps/agent/src/lib/agent-executor.ts
  - apps/agent/src/mastra/index.ts
autonomous: true
requirements: [QUICK-22]
must_haves:
  truths:
    - "Mastra agent uses gemini-3.1-flash-lite-preview instead of gpt-oss-120b-maas"
    - "Agent executor and chat provider use gemini-3.1-flash-lite-preview instead of gemini-2.0-flash"
    - "All model references are consistent across codebase"
  artifacts:
    - path: "apps/agent/src/mastra/agents/build-agent.ts"
      provides: "Mastra agent model config pointing to Gemini 3.1 Flash Lite on Vertex AI"
      contains: "gemini-3.1-flash-lite-preview"
  key_links:
    - from: "apps/agent/src/mastra/agents/build-agent.ts"
      to: "Vertex AI Gemini OpenAI-compatible endpoint"
      via: "async model function returning id/url/apiKey"
      pattern: "gemini-3.1-flash-lite-preview"
---

<objective>
Switch the primary LLM from gpt-oss-120b-maas (OpenAI-compatible on Vertex AI Model Garden) to gemini-3.1-flash-lite-preview on Vertex AI. Also update the secondary model references from gemini-2.0-flash to gemini-3.1-flash-lite-preview for consistency.

Purpose: Move to a newer, faster model across the entire agent codebase.
Output: All model references updated, same auth pattern preserved.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/mastra/agents/build-agent.ts
@apps/agent/src/lib/agent-executor.ts
@apps/agent/src/mastra/index.ts
@apps/agent/src/validation/validate-schemas.ts
@apps/agent/src/env.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch Mastra agent model from gpt-oss-120b to Gemini 3.1 Flash Lite</name>
  <files>apps/agent/src/mastra/agents/build-agent.ts</files>
  <action>
Rewrite `build-agent.ts` to use Gemini 3.1 Flash Lite via the Vertex AI OpenAI-compatible endpoint:

1. Change MODEL_ID from `"vertex/openai/gpt-oss-120b-maas"` to `"vertex/google/gemini-3.1-flash-lite-preview"`.
   - Mastra splits on the first "/" so provider = "vertex", model name = "google/gemini-3.1-flash-lite-preview".

2. Keep VERTEX_OPENAI_BASE_URL exactly the same: `https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/endpoints/openapi`
   - Vertex AI's OpenAI-compatible endpoint works for both Model Garden models AND native Gemini models.

3. Keep the entire GoogleAuth + getVertexAccessToken pattern unchanged — same auth flow works for Gemini on Vertex AI.

4. Keep the async model function returning `{ id, url, apiKey }` unchanged — only the MODEL_ID constant value changes.

5. Update the comment at top from referencing "Model Garden" to referencing "Gemini on Vertex AI" for clarity. The endpoint URL comment can note it serves both Model Garden and native Gemini models.
  </action>
  <verify>
    <automated>cd apps/agent && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>build-agent.ts references gemini-3.1-flash-lite-preview, TypeScript compiles clean</done>
</task>

<task type="auto">
  <name>Task 2: Update all secondary model references to gemini-3.1-flash-lite-preview</name>
  <files>apps/agent/src/lib/agent-executor.ts, apps/agent/src/mastra/index.ts, apps/agent/src/validation/validate-schemas.ts</files>
  <action>
Update remaining model references across the codebase:

1. **agent-executor.ts** (lines 181, 211): Change both `model: "gemini-2.0-flash"` to `model: "gemini-3.1-flash-lite-preview"`. These use the `@google/genai` SDK with `vertexai: true` which natively supports Gemini model IDs — no endpoint changes needed.

2. **index.ts** (line 3748): Change `model: "gemini-2.0-flash"` to `model: "gemini-3.1-flash-lite-preview"` in the chat provider's generateContentStream call. Same `@google/genai` SDK, same auth, just the model string changes.

3. **validate-schemas.ts** (line 193): Update the console.log from `Model: openai/gpt-oss-120b-maas` to `Model: google/gemini-3.1-flash-lite-preview` to reflect the new model name.

No import changes needed — all three files already use the correct SDKs and auth patterns.
  </action>
  <verify>
    <automated>cd apps/agent && npx tsc --noEmit --pretty 2>&1 | head -30 && grep -rn "gpt-oss-120b\|gemini-2.0-flash" src/ | grep -v node_modules | grep -v ".d.ts"</automated>
  </verify>
  <done>Zero references to gpt-oss-120b-maas or gemini-2.0-flash remain in src/. All model strings are gemini-3.1-flash-lite-preview. TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
- `grep -rn "gpt-oss-120b" apps/agent/src/` returns zero results
- `grep -rn "gemini-2.0-flash" apps/agent/src/` returns zero results
- `grep -rn "gemini-3.1-flash-lite-preview" apps/agent/src/` returns 5 results (build-agent, agent-executor x2, index, validate-schemas)
- `cd apps/agent && npx tsc --noEmit` compiles without errors
</verification>

<success_criteria>
All LLM model references in the agent codebase point to gemini-3.1-flash-lite-preview. No references to the old models remain. TypeScript compiles cleanly.
</success_criteria>

<output>
After completion, create `.planning/quick/22-switch-llm-from-gpt-oss-120b-to-gemini-3/22-SUMMARY.md`
</output>
