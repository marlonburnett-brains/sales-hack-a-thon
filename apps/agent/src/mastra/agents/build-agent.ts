import { Agent } from "@mastra/core/agent";
import type { AgentCatalogEntry } from "@lumenalta/schemas";
import { GoogleAuth } from "google-auth-library";

import { getPublishedAgentConfig } from "../../lib/agent-config";
import { env } from "../../env";

// Mastra splits on the first "/" — provider becomes "vertex", and the model name
// sent in the request body becomes "openai/gpt-oss-120b-maas", which is the
// <publisher>/<model> format that Vertex AI Model Garden requires.
const MODEL_ID = "vertex/openai/gpt-oss-120b-maas";

/**
 * Vertex AI Model Garden OpenAI-compatible endpoint URL.
 * Uses the same pattern as the classify-metadata ingestion path.
 */
const VERTEX_OPENAI_BASE_URL = `https://${env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_CLOUD_PROJECT}/locations/${env.GOOGLE_CLOUD_LOCATION}/endpoints/openapi`;

/**
 * Cached GoogleAuth client for obtaining short-lived Vertex AI access tokens.
 * google-auth-library handles token caching and refresh internally.
 */
const vertexAuth = new GoogleAuth({
  credentials: JSON.parse(env.VERTEX_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

/**
 * Get a short-lived access token from the service account credentials.
 * The GoogleAuth client caches tokens internally so repeated calls are cheap.
 */
async function getVertexAccessToken(): Promise<string> {
  const client = await vertexAuth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain Vertex AI access token from service account");
  }
  return tokenResponse.token;
}

export function buildNamedMastraAgent(entry: AgentCatalogEntry) {
  return new Agent({
    id: entry.agentId,
    name: entry.name,
    description: entry.responsibility,
    model: async () => {
      const apiKey = await getVertexAccessToken();
      return {
        id: MODEL_ID as `${string}/${string}`,
        url: VERTEX_OPENAI_BASE_URL,
        apiKey,
      };
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
