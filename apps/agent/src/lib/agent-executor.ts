import type { AgentId } from "@lumenalta/schemas";
import type { Agent, StructuredOutputOptions } from "@mastra/core/agent";

import { getAgentConfigByVersionId, getPublishedAgentConfig } from "./agent-config";

export interface ExecuteNamedAgentParams<TOutput = undefined> {
  agentId: AgentId;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  pinnedVersionId?: string;
  options?: Omit<Parameters<Agent["generate"]>[1], "instructions"> & {
    structuredOutput?: StructuredOutputOptions<TOutput>;
  };
}

export interface NamedAgentExecutionResult<TOutput = undefined> {
  text: string;
  object: TOutput;
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
  const resolved = params.pinnedVersionId
    ? await getAgentConfigByVersionId(params.pinnedVersionId)
    : await getPublishedAgentConfig(params.agentId);

  if (resolved.agentId !== params.agentId) {
    throw new Error(
      `Pinned prompt version ${resolved.version.id} belongs to ${resolved.agentId}, not ${params.agentId}`,
    );
  }

  const runtimeResolver = resolver ?? {
    getMastraAgent: (agentId: AgentId) => {
      throw new Error(`Named agent resolver not initialized for ${agentId}`);
    },
  };
  const agent = runtimeResolver.getMastraAgent(params.agentId);
  const response = await agent.generate(params.messages, {
    ...params.options,
    instructions: {
      role: "system",
      content: resolved.compiledPrompt,
    },
  });

  return {
    text: response.text,
    object: response.object,
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
