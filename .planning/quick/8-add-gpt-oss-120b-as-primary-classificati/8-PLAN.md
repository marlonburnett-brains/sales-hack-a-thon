---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/package.json
  - apps/agent/src/ingestion/classify-metadata.ts
autonomous: true
requirements: [QUICK-8]
must_haves:
  truths:
    - "Classification attempts gpt-oss-120b first via OpenAI SDK"
    - "On gpt-oss failure, falls back to Gemini seamlessly"
    - "After N consecutive gpt-oss failures, remaining slides use Gemini"
    - "Classified metadata passes existing SlideMetadataSchema validation"
  artifacts:
    - path: "apps/agent/src/ingestion/classify-metadata.ts"
      provides: "Dual-backend classification with gpt-oss primary and Gemini fallback"
  key_links:
    - from: "classify-metadata.ts"
      to: "OpenAI SDK"
      via: "openai npm package pointed at Vertex AI OpenAI-compatible endpoint"
    - from: "classify-metadata.ts"
      to: "google-auth-library"
      via: "getAccessToken() for short-lived service account token as apiKey"
---

<objective>
Add gpt-oss-120b as the primary classification model with automatic Gemini fallback.

Purpose: gpt-oss-120b (MaaS on Vertex AI) uses the OpenAI-compatible API, not the Gemini API. The Google GenAI SDK's structured output config is silently ignored by MaaS models. This plan adds proper OpenAI SDK integration for gpt-oss with JSON mode and falls back to Gemini when gpt-oss is unavailable.

Output: Updated classify-metadata.ts with dual-backend support, openai npm package installed.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/ingestion/classify-metadata.ts
@apps/agent/src/env.ts
@apps/agent/src/lib/google-auth.ts
@apps/agent/package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install openai SDK and implement dual-backend classification</name>
  <files>apps/agent/package.json, apps/agent/src/ingestion/classify-metadata.ts</files>
  <action>
1. Install the `openai` npm package in apps/agent: `cd apps/agent && pnpm add openai`

2. Refactor `apps/agent/src/ingestion/classify-metadata.ts`:

   a. Add imports:
      - `import OpenAI from "openai"`
      - `import { GoogleAuth } from "google-auth-library"` (already in project, used for service account access token)

   b. Create a helper `getVertexAccessToken()` that uses `google-auth-library` to get a short-lived access token from the service account credentials in `GOOGLE_APPLICATION_CREDENTIALS`, scoped to `https://www.googleapis.com/auth/cloud-platform`. Use `GoogleAuth` with `credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)` to match the existing pattern in google-auth.ts (no file-based GOOGLE_APPLICATION_CREDENTIALS needed).

   c. Create a plain JSON schema object (NOT using `Type.*` from @google/genai) that mirrors the existing `LLM_RESPONSE_SCHEMA` structure but uses standard JSON Schema format (`{ type: "object", properties: { ... } }`). This will be embedded in the system prompt for gpt-oss since `json_object` mode only guarantees valid JSON, not schema conformity.

   d. Create `classifySlideWithGptOss(prompt: string): Promise<string>` that:
      - Gets a fresh access token via `getVertexAccessToken()`
      - Creates an OpenAI client with:
        - `baseURL`: `https://${env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_CLOUD_PROJECT}/locations/${env.GOOGLE_CLOUD_LOCATION}/endpoints/openapi`
        - `apiKey`: the access token
      - Calls `client.chat.completions.create()` with:
        - `model`: `"openai/gpt-oss-120b-maas"`
        - `response_format`: `{ type: "json_object" }`
        - `messages`: a system message containing "You must respond with valid JSON matching the following schema:" + the JSON schema string, and a user message with the classification prompt
        - `temperature`: 0.2
      - Returns the response content string

   e. Create `classifySlideWithGemini(prompt: string): Promise<string>` that extracts the current Gemini call logic from `classifySlide()` into its own function (uses existing GoogleGenAI + responseSchema pattern).

   f. Refactor `classifySlide()` to:
      - Build the prompt (unchanged)
      - Try `classifySlideWithGptOss(prompt)` first
      - If it throws, log a warning: `"gpt-oss failed for slide ${slide.slideIndex}, falling back to Gemini: ${error.message}"`
      - On gpt-oss failure, call `classifySlideWithGemini(prompt)`
      - Parse and validate with Zod as before (unchanged)

   g. Add consecutive failure tracking to `classifyAllSlides()`:
      - Track a `consecutiveGptOssFailures` counter (module-level or local to batch)
      - Threshold: `MAX_CONSECUTIVE_FAILURES = 3`
      - When counter reaches threshold, log: `"gpt-oss failed ${MAX_CONSECUTIVE_FAILURES} consecutive times, switching to Gemini for remaining slides"`
      - Skip gpt-oss attempts for remaining slides in the batch
      - Pass a `useGeminiOnly?: boolean` flag to `classifySlide()` to control this

   h. Keep the existing `LLM_RESPONSE_SCHEMA` (with `Type.*`) for the Gemini backend. Create a separate `JSON_SCHEMA_FOR_PROMPT` plain object for the gpt-oss system prompt.

   IMPORTANT: Do NOT cache the OpenAI client instance across calls -- the access token is short-lived and a fresh token should be obtained per-call (or per small batch). Token fetching is cached internally by google-auth-library so this is not expensive.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon/apps/agent && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>
    - openai package installed in apps/agent
    - classifySlide tries gpt-oss first, falls back to Gemini on failure
    - Consecutive failure threshold (3) switches remaining batch slides to Gemini-only
    - TypeScript compiles without errors
    - Existing Gemini path unchanged and still functional
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify end-to-end classification with test script</name>
  <files>apps/agent/src/scripts/test-slide-processing.ts</files>
  <action>
Run the existing test script to verify gpt-oss classification works end-to-end:

```bash
cd apps/agent && npx tsx --env-file=.env src/scripts/test-slide-processing.ts
```

Check the output for:
1. No TypeScript compilation errors
2. gpt-oss calls succeed (look for valid JSON responses, no "falling back to Gemini" warnings)
3. SlideMetadataSchema validation passes (no "Failed to parse LLM response" warnings)
4. If gpt-oss is unavailable in the environment, verify the fallback to Gemini works cleanly

If the test script needs minor adjustments to work with the refactored code (e.g., import changes), fix them. Do NOT modify the core classification logic in this task -- only the test script if needed.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon/apps/agent && npx tsx --env-file=.env src/scripts/test-slide-processing.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Test script runs without crashes
    - Classification produces valid SlideMetadata for at least one slide
    - Console output shows which backend was used (gpt-oss or Gemini fallback)
  </done>
</task>

</tasks>

<verification>
1. `cd apps/agent && npx tsc --noEmit` -- TypeScript compiles cleanly
2. `cd apps/agent && npx tsx --env-file=.env src/scripts/test-slide-processing.ts` -- end-to-end classification works
3. Check logs for "gpt-oss" or "Gemini fallback" messages confirming dual-backend behavior
</verification>

<success_criteria>
- gpt-oss-120b is the primary classification model via OpenAI SDK on Vertex AI
- Gemini 2.0 Flash is the automatic fallback on gpt-oss failure
- Consecutive failure threshold prevents wasting time on repeated gpt-oss failures
- All existing classification behavior preserved (Zod validation, default metadata on parse failure, rate limiting)
- Test script confirms working classification
</success_criteria>

<output>
After completion, create `.planning/quick/8-add-gpt-oss-120b-as-primary-classificati/8-SUMMARY.md`
</output>
