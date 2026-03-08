import type { AgentId } from "@lumenalta/schemas";
import type { Agent } from "@mastra/core/agent";

import { getPublishedAgentConfig } from "./agent-config";

export interface ExecuteNamedAgentParams {
  agentId: AgentId;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  options?: Parameters<Agent["generate"]>[1];
}

export interface NamedAgentExecutionResult {
  text: string;
  response: Awaited<ReturnType<Agent["generate"]>>;
  promptVersion: {
    agentId: AgentId;
    id: string;
    version: number;
    publishedAt: Date | null;
    publishedBy: string | null;
  };
}

export interface NamedAgentResolver {
  getMastraAgent(agentId: AgentId): Pick<Agent, "generate">;
}

export async function executeNamedAgent(
  params: ExecuteNamedAgentParams,
  resolver?: NamedAgentResolver,
): Promise<NamedAgentExecutionResult> {
  const resolved = await getPublishedAgentConfig(params.agentId);
  const runtimeResolver = resolver ?? {
    getMastraAgent: (agentId: AgentId) => {
      throw new Error(`Named agent resolver not initialized for ${agentId}`);
    },
  };
  const agent = runtimeResolver.getMastraAgent(params.agentId);
  const response = await agent.generate(params.messages, params.options);

  return {
    text: response.text,
    response,
    promptVersion: {
      agentId: params.agentId,
      id: resolved.version.id,
      version: resolved.version.version,
      publishedAt: resolved.version.publishedAt,
      publishedBy: resolved.version.publishedBy,
    },
  };
}

export async function createMastraAgentResolver(): Promise<NamedAgentResolver> {
  const { mastra } = await import("../mastra/index");
  return {
    getMastraAgent(agentId: AgentId) {
      return mastra.getAgent(agentId);
    },
  };
}
