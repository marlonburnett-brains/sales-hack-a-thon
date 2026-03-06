---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/schemas/gemini-schema.ts
  - packages/schemas/index.ts
  - packages/schemas/llm/transcript-fields.ts
  - packages/schemas/llm/sales-brief.ts
  - packages/schemas/llm/slide-assembly.ts
  - packages/schemas/llm/pager-content.ts
  - packages/schemas/llm/capability-deck-selection.ts
  - packages/schemas/llm/company-research.ts
  - packages/schemas/llm/intro-deck-selection.ts
  - packages/schemas/llm/proposal-copy.ts
  - packages/schemas/llm/hypotheses.ts
  - packages/schemas/llm/roi-framing.ts
  - packages/schemas/llm/slide-metadata.ts
  - packages/schemas/llm/discovery-questions.ts
  - packages/schemas/app/interaction-record.ts
  - packages/schemas/app/feedback-signal.ts
  - packages/schemas/constants.ts
  - apps/agent/src/validation/validate-schemas.ts
  - apps/agent/src/lib/proposal-assembly.ts
  - apps/agent/src/lib/slide-selection.ts
  - apps/agent/src/ingestion/classify-metadata.ts
  - apps/agent/src/ingestion/pilot-ingestion.ts
  - apps/agent/src/ingestion/run-ingestion.ts
  - apps/agent/src/ingestion/ingest-template.ts
  - apps/agent/src/mastra/workflows/pre-call-workflow.ts
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/mastra/workflows/touch-4-workflow.ts
  - apps/agent/src/scripts/verify-rag-quality.ts
  - apps/web/src/lib/error-messages.ts
  - deploy/.env.example
  - README.md
autonomous: true
requirements: [QUICK-5]
must_haves:
  truths:
    - "Zero occurrences of 'gemini' (case-insensitive) in source code files (*.ts, *.tsx)"
    - "Zero occurrences of 'Gemini' in README.md and deploy/.env.example"
    - "All imports of zodToGeminiSchema replaced with zodToLlmJsonSchema"
    - "TypeScript compiles with zero new errors"
  artifacts:
    - path: "packages/schemas/llm-json-schema.ts"
      provides: "Renamed LLM-agnostic schema utility (formerly gemini-schema.ts)"
      exports: ["zodToLlmJsonSchema"]
    - path: "packages/schemas/index.ts"
      provides: "Updated barrel export with new function name"
  key_links:
    - from: "packages/schemas/index.ts"
      to: "packages/schemas/llm-json-schema.ts"
      via: "export { zodToLlmJsonSchema }"
      pattern: "zodToLlmJsonSchema"
    - from: "apps/agent/src/mastra/workflows/*.ts"
      to: "@lumenalta/schemas"
      via: "import { zodToLlmJsonSchema }"
      pattern: "zodToLlmJsonSchema"
---

<objective>
Rewrite all Gemini references and related code to be LLM-agnostic across the entire codebase.

Purpose: Quick Task 1 switched the actual LLM provider from Gemini to Vertex AI with gpt-oss-120b, but left behind ~100+ references to "Gemini" in function names, variable names, comments, docs, and the README. This plan renames everything to be provider-neutral so the codebase accurately reflects that the LLM layer is pluggable.

Output: All source files, docs, and config free of Gemini-specific naming. The utility function `zodToGeminiSchema` renamed to `zodToLlmJsonSchema`, file renamed from `gemini-schema.ts` to `llm-json-schema.ts`.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/1-switch-llm-from-gemini-to-gpt-oss-120b-o/1-SUMMARY.md
@packages/schemas/gemini-schema.ts
@packages/schemas/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename gemini-schema.ts and update all code references</name>
  <files>
    packages/schemas/gemini-schema.ts (DELETE)
    packages/schemas/llm-json-schema.ts (CREATE)
    packages/schemas/index.ts
    apps/agent/src/validation/validate-schemas.ts
    apps/agent/src/lib/proposal-assembly.ts
    apps/agent/src/lib/slide-selection.ts
    apps/agent/src/mastra/workflows/pre-call-workflow.ts
    apps/agent/src/mastra/workflows/touch-1-workflow.ts
    apps/agent/src/mastra/workflows/touch-4-workflow.ts
    apps/agent/src/scripts/verify-rag-quality.ts
    apps/agent/src/ingestion/classify-metadata.ts
    apps/agent/src/ingestion/pilot-ingestion.ts
    apps/agent/src/ingestion/run-ingestion.ts
  </files>
  <action>
    1. Create `packages/schemas/llm-json-schema.ts` with the same logic as `gemini-schema.ts` but:
       - Rename function from `zodToGeminiSchema` to `zodToLlmJsonSchema`
       - Update all comments/JSDoc to say "LLM-compatible JSON Schema" instead of "Gemini"
       - Update `@returns` to say "Plain JSON Schema object compatible with LLM structured output" (not "Gemini's responseJsonSchema")
    2. Delete `packages/schemas/gemini-schema.ts`
    3. Update `packages/schemas/index.ts`:
       - Change export to `export { zodToLlmJsonSchema } from "./llm-json-schema.ts"`
       - Change comment from "Gemini-safe, flat, no transforms" to "LLM-safe: flat, no transforms"
    4. In ALL agent source files that import `zodToGeminiSchema` from `@lumenalta/schemas`, rename to `zodToLlmJsonSchema`. Files (10 total):
       - `apps/agent/src/validation/validate-schemas.ts`
       - `apps/agent/src/lib/proposal-assembly.ts`
       - `apps/agent/src/lib/slide-selection.ts`
       - `apps/agent/src/mastra/workflows/pre-call-workflow.ts`
       - `apps/agent/src/mastra/workflows/touch-1-workflow.ts`
       - `apps/agent/src/mastra/workflows/touch-4-workflow.ts`
       - `apps/agent/src/scripts/verify-rag-quality.ts`
    5. In `apps/agent/src/ingestion/classify-metadata.ts`:
       - Rename `GEMINI_RESPONSE_SCHEMA` to `LLM_RESPONSE_SCHEMA`
       - Rename `_geminiApiKey` parameter to `_legacyApiKey` in both `classifySlide` and `classifyAllSlides`
       - Update all comments: "Gemini" -> "LLM" (e.g., "Classify a single slide using LLM structured output")
    6. In `apps/agent/src/ingestion/run-ingestion.ts`:
       - Rename `geminiApiKey` variable to `cloudProject` (it already holds `env.GOOGLE_CLOUD_PROJECT`)
       - Update console.log from "Classifying ... with Gemini" to "Classifying ... with LLM"
       - Pass renamed variable to `classifyAllSlides`
    7. In `apps/agent/src/ingestion/pilot-ingestion.ts`:
       - Rename `_geminiApiKey` parameter to `_legacyApiKey`
       - Update comments
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -ri "gemini" packages/schemas/llm-json-schema.ts packages/schemas/index.ts apps/agent/src/ --include="*.ts" | grep -v node_modules | grep -v ".planning" && echo "FAIL: Gemini references found" || echo "PASS: No Gemini references in source"</automated>
  </verify>
  <done>
    - `gemini-schema.ts` deleted, `llm-json-schema.ts` exists with `zodToLlmJsonSchema`
    - All 10+ agent files import and use `zodToLlmJsonSchema`
    - `GEMINI_RESPONSE_SCHEMA` renamed to `LLM_RESPONSE_SCHEMA`
    - `_geminiApiKey` parameters renamed to `_legacyApiKey`
    - Zero occurrences of "gemini" (case-insensitive) in any .ts file under packages/schemas/ or apps/agent/src/
  </done>
</task>

<task type="auto">
  <name>Task 2: Update all comments in LLM schema files and remaining docs</name>
  <files>
    packages/schemas/llm/transcript-fields.ts
    packages/schemas/llm/sales-brief.ts
    packages/schemas/llm/slide-assembly.ts
    packages/schemas/llm/pager-content.ts
    packages/schemas/llm/capability-deck-selection.ts
    packages/schemas/llm/company-research.ts
    packages/schemas/llm/intro-deck-selection.ts
    packages/schemas/llm/proposal-copy.ts
    packages/schemas/llm/hypotheses.ts
    packages/schemas/llm/roi-framing.ts
    packages/schemas/llm/slide-metadata.ts
    packages/schemas/llm/discovery-questions.ts
    packages/schemas/app/interaction-record.ts
    packages/schemas/app/feedback-signal.ts
    packages/schemas/constants.ts
    apps/agent/src/ingestion/ingest-template.ts
    apps/web/src/lib/error-messages.ts
    deploy/.env.example
    README.md
  </files>
  <action>
    1. In all `packages/schemas/llm/*.ts` files, replace comment patterns:
       - "Gemini-safe:" -> "LLM-safe:" (appears in ~12 files as JSDoc)
       - "Gemini extraction" -> "LLM extraction"
       - "Gemini maps transcript" -> "LLM maps transcript"
       - Any other "Gemini" mention -> "LLM" in comments only (no code changes needed in these files)
    2. In `packages/schemas/app/interaction-record.ts` and `packages/schemas/app/feedback-signal.ts`:
       - "NOT sent to Gemini" -> "NOT sent to LLM"
    3. In `packages/schemas/constants.ts`:
       - "refine Gemini extraction" -> "refine LLM extraction"
       - "so Gemini maps transcript" -> "so LLM maps transcript"
    4. In `apps/agent/src/ingestion/ingest-template.ts`:
       - "classify via Gemini" -> "classify via LLM"
    5. In `apps/web/src/lib/error-messages.ts`:
       - Change `lower.includes("gemini")` to `lower.includes("llm")` OR better: remove the "gemini" check entirely since the generic "api" and "model" checks on the same line already cover LLM errors. Prefer removing to avoid dead code.
    6. In `deploy/.env.example`:
       - "Service account credentials JSON for Vertex AI / Gemini" -> "Service account credentials JSON for Vertex AI"
    7. In `README.md`:
       - Replace "Gemini AI" with "LLM" in the intro paragraph
       - Replace "Gemini 2.5" in the architecture diagram with "LLM Service"
       - Replace "Gemini 2.5 Flash (`@google/genai`)" in the tech stack table with the current model info or just "LLM via Vertex AI (`@google/genai`)"
       - Replace all workflow descriptions mentioning "Gemini generates" with "LLM generates"
       - Replace `GEMINI_API_KEY` env var row with `GOOGLE_CLOUD_PROJECT` if not already updated
       - Do a final pass: no "Gemini" should remain in README.md
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -ri "gemini" packages/schemas/ apps/agent/src/ apps/web/src/ deploy/.env.example README.md --include="*.ts" --include="*.tsx" --include="*.md" --include="*.example" | grep -v node_modules | grep -v ".planning" && echo "FAIL: Gemini references remain" || echo "PASS: All Gemini references removed"</automated>
  </verify>
  <done>
    - All JSDoc comments in 14 schema files updated from "Gemini" to "LLM"
    - error-messages.ts no longer references "gemini"
    - deploy/.env.example updated
    - README.md fully LLM-agnostic
    - Zero occurrences of "gemini" (case-insensitive) in any source, config, or doc file (excluding .planning/)
  </done>
</task>

<task type="auto">
  <name>Task 3: TypeScript compilation check and final sweep</name>
  <files>None (verification only)</files>
  <action>
    1. Run TypeScript compilation across the monorepo to confirm no broken imports:
       - `cd packages/schemas && npx tsc --noEmit`
       - `cd apps/agent && npx tsc --noEmit` (may have pre-existing errors -- only check for NEW errors related to this rename)
       - `cd apps/web && npx tsc --noEmit` (may have pre-existing errors)
    2. Run a final case-insensitive grep across the ENTIRE repo (excluding .planning/, node_modules/, .git/) for "gemini" to catch any stragglers.
    3. Fix any remaining references found.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -ri "gemini" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" --include="*.example" --include="*.env*" . | grep -v node_modules | grep -v ".planning" | grep -v ".git" | grep -v ".claude" | grep -v ".opencode" && echo "FAIL" || echo "PASS: Zero Gemini references in codebase"</automated>
  </verify>
  <done>
    - TypeScript compiles with no new errors from the rename
    - Absolutely zero "gemini" references outside of .planning/ history docs
    - Codebase is fully LLM-agnostic
  </done>
</task>

</tasks>

<verification>
1. `grep -ri "gemini" . --include="*.ts" --include="*.tsx" --include="*.md" --include="*.example" | grep -v node_modules | grep -v .planning | grep -v .git | grep -v .claude | grep -v .opencode` returns empty
2. `packages/schemas/llm-json-schema.ts` exists and exports `zodToLlmJsonSchema`
3. `packages/schemas/gemini-schema.ts` does NOT exist
4. TypeScript compiles across the monorepo with no new errors
</verification>

<success_criteria>
- Zero occurrences of "gemini" (case-insensitive) in any source code, config, or documentation file (excluding .planning/ historical docs)
- The function `zodToLlmJsonSchema` works identically to the old `zodToGeminiSchema`
- All imports across 10+ agent files resolve correctly
- TypeScript compiles cleanly (no new errors)
</success_criteria>

<output>
After completion, create `.planning/quick/5-rewrite-all-gemini-references-and-relate/5-SUMMARY.md`
</output>
