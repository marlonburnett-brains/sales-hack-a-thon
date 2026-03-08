import type { AgentId } from "@lumenalta/schemas";

import { prisma } from "./db";
import {
  createPublishedVersionCacheKey,
  getCachedPublishedPrompt,
  getPublishedPromptCacheSnapshot,
  invalidatePublishedPromptCache,
  setCachedPublishedPrompt,
} from "./agent-prompt-cache";

export interface ResolvedAgentPromptVersion {
  id: string;
  version: number;
  baselinePrompt: string;
  rolePrompt: string;
  compiledPrompt: string;
  isPublished: boolean;
  publishedAt: Date | null;
  publishedBy: string | null;
}

export interface ResolvedAgentConfig {
  agentId: string;
  name: string;
  responsibility: string;
  family: string;
  isShared: boolean;
  touchTypes: string[];
  status: string;
  version: ResolvedAgentPromptVersion;
  compiledPrompt: string;
  instructions: Array<{ role: "system"; content: string }>;
}

type PublishedConfigRecord = {
  id: string;
  agentId: string;
  name: string;
  responsibility: string;
  family: string;
  isShared: boolean;
  touchTypes: string;
  status: string;
  publishedVersion: {
    id: string;
    version: number;
    baselinePrompt: string;
    rolePrompt: string;
    compiledPrompt: string | null;
    isPublished: boolean;
    publishedAt: Date | null;
    publishedBy: string | null;
  } | null;
};

type VersionRecord = {
  id: string;
  version: number;
  baselinePrompt: string;
  rolePrompt: string;
  compiledPrompt: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  publishedBy: string | null;
  agentConfig: Omit<PublishedConfigRecord, "publishedVersion">;
};

function parseTouchTypes(touchTypes: string): string[] {
  try {
    const parsed = JSON.parse(touchTypes);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function compileAgentInstructions(baselinePrompt: string, rolePrompt: string) {
  const instructions = [
    { role: "system" as const, content: baselinePrompt },
    { role: "system" as const, content: rolePrompt },
  ];

  return {
    instructions,
    compiledPrompt: `${baselinePrompt}\n\n${rolePrompt}`,
  };
}

function resolveCachedInstructions(agentId: string, versionId: string, baselinePrompt: string, rolePrompt: string) {
  const cacheKey = createPublishedVersionCacheKey(agentId, versionId);
  const cached = getCachedPublishedPrompt(cacheKey);
  if (cached) {
    return cached;
  }

  return setCachedPublishedPrompt(cacheKey, compileAgentInstructions(baselinePrompt, rolePrompt));
}

function mapPublishedConfig(record: PublishedConfigRecord): ResolvedAgentConfig {
  if (!record.publishedVersion) {
    throw new Error(`Agent ${record.agentId} does not have a published prompt version.`);
  }

  const compiled = resolveCachedInstructions(
    record.agentId,
    record.publishedVersion.id,
    record.publishedVersion.baselinePrompt,
    record.publishedVersion.rolePrompt,
  );

  return {
    agentId: record.agentId,
    name: record.name,
    responsibility: record.responsibility,
    family: record.family,
    isShared: record.isShared,
    touchTypes: parseTouchTypes(record.touchTypes),
    status: record.status,
    version: {
      id: record.publishedVersion.id,
      version: record.publishedVersion.version,
      baselinePrompt: record.publishedVersion.baselinePrompt,
      rolePrompt: record.publishedVersion.rolePrompt,
      compiledPrompt: record.publishedVersion.compiledPrompt ?? compiled.compiledPrompt,
      isPublished: record.publishedVersion.isPublished,
      publishedAt: record.publishedVersion.publishedAt,
      publishedBy: record.publishedVersion.publishedBy,
    },
    compiledPrompt: compiled.compiledPrompt,
    instructions: compiled.instructions,
  };
}

function mapVersionConfig(record: VersionRecord): ResolvedAgentConfig {
  const compiled = resolveCachedInstructions(
    record.agentConfig.agentId,
    record.id,
    record.baselinePrompt,
    record.rolePrompt,
  );

  return {
    agentId: record.agentConfig.agentId,
    name: record.agentConfig.name,
    responsibility: record.agentConfig.responsibility,
    family: record.agentConfig.family,
    isShared: record.agentConfig.isShared,
    touchTypes: parseTouchTypes(record.agentConfig.touchTypes),
    status: record.agentConfig.status,
    version: {
      id: record.id,
      version: record.version,
      baselinePrompt: record.baselinePrompt,
      rolePrompt: record.rolePrompt,
      compiledPrompt: record.compiledPrompt ?? compiled.compiledPrompt,
      isPublished: record.isPublished,
      publishedAt: record.publishedAt,
      publishedBy: record.publishedBy,
    },
    compiledPrompt: compiled.compiledPrompt,
    instructions: compiled.instructions,
  };
}

export async function getPublishedAgentConfig(agentId: AgentId | string): Promise<ResolvedAgentConfig> {
  const record = (await prisma.agentConfig.findUnique({
    where: { agentId },
    include: {
      publishedVersion: true,
    },
  })) as PublishedConfigRecord | null;

  if (!record) {
    throw new Error(`Agent ${agentId} was not found.`);
  }

  return mapPublishedConfig(record);
}

export async function getAgentConfigByVersionId(versionId: string): Promise<ResolvedAgentConfig> {
  const record = (await prisma.agentConfigVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: {
      agentConfig: true,
    },
  })) as VersionRecord;

  return mapVersionConfig(record);
}

export function invalidateAgentPromptCache(input?: { agentId?: string; versionId?: string }) {
  invalidatePublishedPromptCache(input);
}

export function getAgentPromptCacheSnapshot() {
  return getPublishedPromptCacheSnapshot();
}
