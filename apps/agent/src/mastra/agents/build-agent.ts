import { Agent } from "@mastra/core/agent";
import type { AgentCatalogEntry } from "@lumenalta/schemas";

import { getPublishedAgentConfig } from "../../lib/agent-config";
import { env } from "../../env";

// Mastra splits on the first "/" — provider becomes "google", and the model
// name sent in the request body becomes "gemini-3-flash-preview".
const MODEL_ID = "google/gemini-3-flash-preview";

/**
 * Google AI Studio OpenAI-compatible endpoint.
 * Serves all Gemini models via OpenAI chat completions format.
 */
const AI_STUDIO_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

export function buildNamedMastraAgent(entry: AgentCatalogEntry) {
  return new Agent({
    id: entry.agentId,
    name: entry.name,
    description: entry.responsibility,
    model: {
      id: MODEL_ID as `${string}/${string}`,
      url: AI_STUDIO_OPENAI_BASE_URL,
      apiKey: env.GOOGLE_AI_STUDIO_API_KEY,
    },
    instructions: async () => {
      const resolved = await getPublishedAgentConfig(entry.agentId);
      return {
        role: "system",
        content: resolved.compiledPrompt,
      };
    },
  });
}
