---
status: awaiting_human_verify
trigger: "Model config broken - openai/gpt-oss-120b-maas should route to Vertex AI Model Garden, not OpenAI API"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - build-agent.ts passes model as plain string, Mastra resolves it as OpenAI API
test: Checked Mastra model resolution code in chunk-NXKI2L4X.js
expecting: Plain string -> gateway.getApiKey() -> OPENAI_API_KEY lookup
next_action: Await human verification of fix

## Symptoms

expected: Mastra agent calls gpt-oss-120b-maas via Vertex AI Model Garden using OpenAI SDK pointed at Vertex endpoint
actual: Mastra looks for process.env.OPENAI_API_KEY which doesn't exist
errors: "Could not find API key process.env.OPENAI_API_KEY for model id openai/gpt-oss-120b-maas"
reproduction: Run any workflow that uses the model
started: Was working before, now broken

## Eliminated

## Evidence

- timestamp: 2026-03-09
  checked: apps/agent/src/mastra/agents/build-agent.ts
  found: model set as plain string "openai/gpt-oss-120b-maas" with no Vertex AI config
  implication: Mastra model router treats this as standard OpenAI, looks for OPENAI_API_KEY

- timestamp: 2026-03-09
  checked: @mastra/core model resolution (chunk-NXKI2L4X.js lines 6677-6870)
  found: When config.url is set, uses createOpenAICompatible with custom baseURL and skips gateway API key lookup; when url is NOT set, calls gateway.getApiKey() which looks for OPENAI_API_KEY
  implication: Fix requires passing OpenAICompatibleConfig with url and apiKey

- timestamp: 2026-03-09
  checked: git show 80f7e1a (original gpt-oss-120b commit)
  found: classify-metadata.ts used OpenAI SDK with baseURL pointing to Vertex AI Model Garden and fresh access token from GoogleAuth
  implication: Pattern exists in codebase, just not wired into Mastra agent config

- timestamp: 2026-03-09
  checked: @mastra/core Agent types (agent.d.ts line 59)
  found: model property accepts DynamicArgument<MastraModelConfig> which includes async functions
  implication: Can use async function to get fresh access token on each call

## Resolution

root_cause: build-agent.ts passed the model as a plain string "openai/gpt-oss-120b-maas" to Mastra's Agent constructor. Mastra's ModelRouterLanguageModel resolves plain strings through its gateway system, which for "openai/" prefix models calls getApiKey() looking for process.env.OPENAI_API_KEY. The model is served by Vertex AI Model Garden, not OpenAI's API, so no OPENAI_API_KEY exists. The fix is to use Mastra's OpenAICompatibleConfig with a custom Vertex AI base URL and a dynamically-obtained Google access token.

fix: Changed build-agent.ts model from plain string to async function returning OpenAICompatibleConfig with Vertex AI Model Garden URL and fresh access token from GoogleAuth service account credentials.

verification: Type-checks pass (no new errors). Awaiting runtime verification.

files_changed:
  - apps/agent/src/mastra/agents/build-agent.ts
