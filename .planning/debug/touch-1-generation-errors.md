---
status: fixing
trigger: "Touch 1 page shows 'Generating content...' forever with two bugs: missing OPENAI_API_KEY for model openai/gpt-oss-120b-maas, frontend polls runId=undefined"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: Two independent bugs - (1) wrong model provider in build-agent.ts uses OpenAI but project uses Vertex AI, (2) runId not stored in InteractionRecord so extractRunId returns null
test: Fix model to use Vertex AI provider, fix runId persistence
expecting: Workflow completes successfully, polling uses valid runId
next_action: Apply fixes to both issues

## Symptoms

expected: Touch 1 content should generate successfully and display
actual: Spinner shows "Generating content..." forever, console shows errors
errors:
  - "Error: Could not find API key process.env.OPENAI_API_KEY for model id openai/gpt-oss-120b-maas" in agent:dev
  - "GET /api/workflows/status?runId=undefined&touchType=touch_1 502" repeated every ~2 seconds in web:dev
  - The workflow step that fails is: workflow.touch-1-workflow.step.generate-pager-content
reproduction: Navigate to a deal's Touch 1 page, it starts generating and gets stuck
started: Current state of the code

## Eliminated

- hypothesis: Missing OPENAI_API_KEY env var just needs to be added
  evidence: Project env schema (env.ts) has no OPENAI_API_KEY. Project uses Vertex AI with service account credentials (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION). The openai npm package is a transitive dep of @mastra/core, not a direct model provider choice.
  timestamp: 2026-03-09

- hypothesis: Mastra google provider (google/gemini-2.0-flash model string) could work
  evidence: google provider requires GOOGLE_GENERATIVE_AI_API_KEY which is not in .env. Project uses Vertex AI service account auth, not API key auth.
  timestamp: 2026-03-09

## Evidence

- timestamp: 2026-03-09
  checked: apps/agent/src/mastra/agents/build-agent.ts
  found: DEFAULT_MODEL = "openai/gpt-oss-120b-maas" -- all Mastra agents use this OpenAI model
  implication: Mastra agent.generate() tries to resolve openai provider which needs OPENAI_API_KEY

- timestamp: 2026-03-09
  checked: apps/agent/src/lib/agent-executor.ts
  found: executeRuntimeProviderNamedAgent() exists and uses @google/genai with vertexai:true and gemini-2.0-flash directly, bypassing Mastra agent model
  implication: There is already a working Vertex AI path; workflows just need to use it

- timestamp: 2026-03-09
  checked: All workflow files (touch-1, touch-4, pre-call)
  found: All workflows use executeRuntimeNamedAgent (goes through Mastra agent) not executeRuntimeProviderNamedAgent (goes direct to Vertex)
  implication: All workflows will fail with the same OpenAI API key error

- timestamp: 2026-03-09
  checked: apps/agent/.env
  found: No OPENAI_API_KEY, no GOOGLE_GENERATIVE_AI_API_KEY. Has GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS (Vertex AI creds)
  implication: Only Vertex AI path works

- timestamp: 2026-03-09
  checked: executeRuntimeProviderNamedAgent vs executeRuntimeNamedAgent
  found: Provider version handles responseFormat but not structuredOutput option. Workflows pass structuredOutput.
  implication: Need to enhance executeRuntimeProviderNamedAgent to handle structuredOutput

- timestamp: 2026-03-09
  checked: touch-page-client.tsx extractRunId()
  found: extractRunId tries to find runId in interaction.inputs, generatedContent, outputRefs -- none of these store the runId
  implication: runId is never persisted so polling always sends runId=undefined

- timestamp: 2026-03-09
  checked: touch-page-client.tsx handleGenerate()
  found: startGeneration returns result.runId from the workflow start API, which is used for polling. But on page reload, extractRunId returns null.
  implication: Bug 2 manifests when page has an in_progress interaction but no runId stored. The initial generation call works (has runId), but subsequent page loads lose it.

## Resolution

root_cause:
  BUG 1 (model error): build-agent.ts sets DEFAULT_MODEL = "openai/gpt-oss-120b-maas" which triggers Mastra's OpenAI provider that requires OPENAI_API_KEY. The project uses Vertex AI (service account) not OpenAI. The executeRuntimeNamedAgent function routes through Mastra agent.generate() which uses this broken model.

  BUG 2 (runId=undefined): The workflow start API returns a runId, and handleGenerate() correctly uses it for polling. However, extractRunId() tries to recover the runId from the InteractionRecord on page reload, but the runId is never stored in the interaction record. When the generate-pager-content step creates the InteractionRecord, it doesn't store the workflow runId.

fix:
  BUG 1: Switch workflows from executeRuntimeNamedAgent to executeRuntimeProviderNamedAgent (which uses @google/genai with Vertex AI directly). Enhance executeRuntimeProviderNamedAgent to handle structuredOutput option.

  BUG 2: Store the workflow runId in the InteractionRecord inputs when the workflow starts, so extractRunId can recover it on page reload.

verification: []
files_changed: []
