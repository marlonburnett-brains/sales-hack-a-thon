---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
must_haves:
  truths:
    - "All LLM calls use Vertex AI authentication (not API key)"
    - "All LLM calls target GPT-OSS 120b model (not gemini-2.5-flash)"
    - "vertex-service-account.json is gitignored"
    - "Env schema validates GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION instead of GEMINI_API_KEY"
  artifacts:
    - path: "apps/agent/src/env.ts"
      provides: "Vertex AI env vars (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION)"
      contains: "GOOGLE_CLOUD_PROJECT"
    - path: ".gitignore"
      provides: "Credential file exclusion"
      contains: "vertex-service-account.json"
  key_links:
    - from: "apps/agent/src/*/workflows/*.ts"
      to: "apps/agent/src/env.ts"
      via: "env.GOOGLE_CLOUD_PROJECT, env.GOOGLE_CLOUD_LOCATION"
      pattern: "vertexai:\\s*true"
---

<objective>
Switch all LLM calls from Gemini API key authentication to Vertex AI with GPT-OSS 120b model.

Purpose: Move from Google AI Studio (GEMINI_API_KEY) to Vertex AI service account auth for GPT-OSS 120b model access.
Output: All GoogleGenAI client initializations use vertexai mode; model references updated; env config updated.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/env.ts
@apps/agent/.env.example
@.gitignore
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update env config and gitignore for Vertex AI</name>
  <files>apps/agent/src/env.ts, apps/agent/.env.example, .gitignore</files>
  <action>
1. In `apps/agent/src/env.ts`:
   - Remove the `GEMINI_API_KEY: z.string().min(1)` field and its comments
   - Add two new fields:
     ```
     // Google Cloud project ID for Vertex AI
     GOOGLE_CLOUD_PROJECT: z.string().min(1),
     // Google Cloud region for Vertex AI (e.g., us-central1)
     GOOGLE_CLOUD_LOCATION: z.string().min(1),
     ```
   - Keep `GOOGLE_APPLICATION_CREDENTIALS` as an implicit env var (the @google/genai SDK reads it automatically from the environment when vertexai: true is set — no need to add it to the schema, but mention it in a comment near the new fields)

2. In `apps/agent/.env.example`:
   - Remove `GEMINI_API_KEY=` line if present
   - Add:
     ```
     GOOGLE_APPLICATION_CREDENTIALS=./vertex-service-account.json
     GOOGLE_CLOUD_PROJECT=your-gcp-project-id
     GOOGLE_CLOUD_LOCATION=us-central1
     ```

3. In `.gitignore`:
   - Add `vertex-service-account.json` in the "Sensitive credentials" section (next to existing `service-account-key.json`)
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -q "GOOGLE_CLOUD_PROJECT" apps/agent/src/env.ts && grep -q "GOOGLE_CLOUD_LOCATION" apps/agent/src/env.ts && ! grep -q "GEMINI_API_KEY" apps/agent/src/env.ts && grep -q "vertex-service-account.json" .gitignore && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>env.ts validates GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION (no GEMINI_API_KEY), .env.example shows new vars, vertex-service-account.json is gitignored</done>
</task>

<task type="auto">
  <name>Task 2: Update all GoogleGenAI client initializations and model names</name>
  <files>
    apps/agent/src/mastra/workflows/touch-1-workflow.ts,
    apps/agent/src/mastra/workflows/touch-4-workflow.ts,
    apps/agent/src/mastra/workflows/pre-call-workflow.ts,
    apps/agent/src/lib/slide-selection.ts,
    apps/agent/src/lib/proposal-assembly.ts,
    apps/agent/src/validation/validate-schemas.ts,
    apps/agent/src/ingestion/run-ingestion.ts,
    apps/agent/src/ingestion/pilot-ingestion.ts,
    apps/agent/src/ingestion/classify-metadata.ts
  </files>
  <action>
In ALL files listed above, apply these two changes:

**Change 1 — Client initialization:** Replace every occurrence of:
```ts
new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
// or
new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! })
// or
new GoogleGenAI({ apiKey: geminiApiKey })
```
with:
```ts
new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION })
```

Also remove any local variables like `const geminiApiKey = env.GEMINI_API_KEY` and their associated null checks / error messages referencing GEMINI_API_KEY. Replace those checks with equivalent checks for GOOGLE_CLOUD_PROJECT if they exist as guard clauses.

**Change 2 — Model name:** Replace every occurrence of:
```ts
model: "gemini-2.5-flash"
```
with:
```ts
model: "gpt-oss-120b"
```

**Specific files and their occurrences:**

- `touch-1-workflow.ts`: 1 client init (line ~53), 1 model ref (line ~71)
- `touch-4-workflow.ts`: 5 client inits (lines ~93, ~318, ~405, ~817, ~1214), 5 model refs (lines ~128, ~350, ~445, ~873, ~1248)
- `pre-call-workflow.ts`: 3 client inits (lines ~88, ~171, ~214), 3 model refs (lines ~93, ~183, ~233)
- `slide-selection.ts`: 1 local var + check + client init (lines ~229-236), 2 model refs (lines ~257, ~290)
- `proposal-assembly.ts`: 1 local var + client init (lines ~292-293), 1 model ref (line ~326)
- `validate-schemas.ts`: 1 check + client init (lines ~32-42), 2 model refs (lines ~192, ~205)
- `run-ingestion.ts`: 1 local var + check (lines ~254-256) — update the check message
- `pilot-ingestion.ts`: 1 client init (line ~75), 1 model ref (line ~78), 1 local var + check (lines ~255-257)
- `classify-metadata.ts`: 1 client init (line ~180), 1 model ref (line ~189)

Do NOT change the import statement for GoogleGenAI — the same `@google/genai` package supports both API key and Vertex AI modes.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && echo "--- Checking no GEMINI_API_KEY refs remain ---" && (grep -r "GEMINI_API_KEY" apps/agent/src/ && echo "FAIL: GEMINI_API_KEY still referenced" || echo "PASS: No GEMINI_API_KEY refs") && echo "--- Checking no gemini-2.5-flash refs remain ---" && (grep -r "gemini-2.5-flash" apps/agent/src/ && echo "FAIL: gemini-2.5-flash still referenced" || echo "PASS: No gemini-2.5-flash refs") && echo "--- Checking vertexai: true present ---" && grep -r "vertexai: true" apps/agent/src/ | wc -l | xargs -I{} echo "{} files with vertexai: true" && echo "--- Checking gpt-oss-120b present ---" && grep -r "gpt-oss-120b" apps/agent/src/ | wc -l | xargs -I{} echo "{} files with gpt-oss-120b"</automated>
  </verify>
  <done>Zero references to GEMINI_API_KEY or gemini-2.5-flash in apps/agent/src/. All GoogleGenAI clients use vertexai: true. All model references use gpt-oss-120b.</done>
</task>

</tasks>

<verification>
1. `grep -r "GEMINI_API_KEY" apps/agent/src/` returns no results
2. `grep -r "gemini-2.5-flash" apps/agent/src/` returns no results
3. `grep -r "vertexai: true" apps/agent/src/` shows all client init sites
4. `grep -r "gpt-oss-120b" apps/agent/src/` shows all model references
5. `npx tsc --noEmit` in apps/agent compiles without type errors
</verification>

<success_criteria>
- All LLM calls authenticate via Vertex AI (vertexai: true with project/location)
- All LLM calls target gpt-oss-120b model
- No references to GEMINI_API_KEY remain in source code
- No references to gemini-2.5-flash remain in source code
- Env schema validates GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION
- vertex-service-account.json is in .gitignore
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/1-switch-llm-from-gemini-to-gpt-oss-120b-o/1-SUMMARY.md`
</output>
