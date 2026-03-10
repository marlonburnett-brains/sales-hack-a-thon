import type { AgentId } from "@lumenalta/schemas";
import type { Agent, StructuredOutputOptions } from "@mastra/core/agent";
import { GoogleGenAI } from "@google/genai";

import { env } from "../env";

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

let runtimeResolverPromise: Promise<NamedAgentResolver> | null = null;

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

export function createJsonResponseOptions(
  schema?: Record<string, unknown>,
): Parameters<Agent["generate"]>[1] {
  return {
    responseFormat: schema
      ? {
          type: "json",
          schema,
        }
      : {
          type: "json",
        },
  } as Parameters<Agent["generate"]>[1];
}

export async function executeRuntimeNamedAgent<TOutput = undefined>(
  params: ExecuteNamedAgentParams<TOutput>,
): Promise<NamedAgentExecutionResult<TOutput>> {
  runtimeResolverPromise ??= createMastraAgentResolver();
  return executeNamedAgent(params, await runtimeResolverPromise);
}

interface ProviderResponseOptions {
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
}

function getNamedAgentPromptResolver(
  params: ExecuteNamedAgentParams,
): Promise<Awaited<ReturnType<typeof getPublishedAgentConfig>>> {
  return params.pinnedVersionId
    ? getAgentConfigByVersionId(params.pinnedVersionId)
    : getPublishedAgentConfig(params.agentId);
}

function createProviderClient() {
  return new GoogleGenAI({
    apiKey: env.GOOGLE_AI_STUDIO_API_KEY,
  });
}

function toProviderContents(
  params: ExecuteNamedAgentParams,
  compiledPrompt: string,
): string {
  return [
    compiledPrompt,
    ...params.messages.map(
      (message) => `${message.role.toUpperCase()}: ${message.content}`,
    ),
  ].join("\n\n");
}

function toProviderResponseOptions(
  params: ExecuteNamedAgentParams,
): ProviderResponseOptions | undefined {
  // Check structuredOutput first (used by workflow steps)
  const structuredOutput = params.options?.structuredOutput as
    | { schema?: Record<string, unknown> }
    | undefined;

  if (structuredOutput?.schema) {
    return {
      responseMimeType: "application/json",
      responseSchema: structuredOutput.schema,
    };
  }

  // Fall back to responseFormat (used by direct callers)
  const responseFormat = params.options?.responseFormat as
    | { type?: string; schema?: Record<string, unknown> }
    | undefined;

  if (!responseFormat || responseFormat.type !== "json") {
    return undefined;
  }

  return {
    responseMimeType: "application/json",
    ...(responseFormat.schema ? { responseSchema: responseFormat.schema } : {}),
  };
}

export async function executeRuntimeProviderNamedAgent<TOutput = undefined>(
  params: ExecuteNamedAgentParams<TOutput>,
  options?: { model?: string },
): Promise<NamedAgentExecutionResult<TOutput>> {
  const resolved = await getNamedAgentPromptResolver(params);
  const ai = createProviderClient();
  const config = toProviderResponseOptions(params);
  const model = options?.model ?? "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model,
    contents: toProviderContents(params, resolved.compiledPrompt),
    ...(config ? { config } : {}),
  });

  return {
    text: response.text ?? "",
    object: undefined as TOutput,
    response: response as NamedAgentExecutionResult<TOutput>["response"],
    promptVersion: {
      agentId: params.agentId,
      id: resolved.version.id,
      version: resolved.version.version,
      publishedAt: resolved.version.publishedAt,
      publishedBy: resolved.version.publishedBy,
    },
  };
}

export async function streamRuntimeProviderNamedAgent<TOutput = undefined>(
  params: ExecuteNamedAgentParams<TOutput>,
): Promise<{
  stream: AsyncIterable<{ text?: string }>;
  promptVersion: NamedAgentExecutionResult<TOutput>["promptVersion"];
}> {
  const resolved = await getNamedAgentPromptResolver(params);
  const ai = createProviderClient();
  const config = toProviderResponseOptions(params);

  const stream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: toProviderContents(params, resolved.compiledPrompt),
    ...(config ? { config } : {}),
  });

  return {
    stream,
    promptVersion: {
      agentId: params.agentId,
      id: resolved.version.id,
      version: resolved.version.version,
      publishedAt: resolved.version.publishedAt,
      publishedBy: resolved.version.publishedBy,
    },
  };
}
