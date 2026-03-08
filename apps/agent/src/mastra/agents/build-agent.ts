import { Agent } from "@mastra/core/agent";
import type { AgentCatalogEntry } from "@lumenalta/schemas";

import { getPublishedAgentConfig } from "../../lib/agent-config";

const DEFAULT_MODEL = "openai/gpt-oss-120b-maas";

export function buildNamedMastraAgent(entry: AgentCatalogEntry) {
  return new Agent({
    id: entry.agentId,
    name: entry.name,
    description: entry.responsibility,
    model: DEFAULT_MODEL,
    instructions: async () => {
      const resolved = await getPublishedAgentConfig(entry.agentId);
      return {
        role: "system",
        content: resolved.compiledPrompt,
      };
    },
  });
}
