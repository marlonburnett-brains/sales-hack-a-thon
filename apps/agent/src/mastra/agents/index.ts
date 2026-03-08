import { AGENT_CATALOG, type AgentId } from "@lumenalta/schemas";

import { buildNamedMastraAgent } from "./build-agent";

export const namedMastraAgents = Object.fromEntries(
  AGENT_CATALOG.map((entry) => [entry.agentId, buildNamedMastraAgent(entry)]),
) as Record<AgentId, ReturnType<typeof buildNamedMastraAgent>>;
