export interface CachedAgentPromptValue {
  compiledPrompt: string;
  instructions: Array<{ role: "system"; content: string }>;
}

const promptCache = new Map<string, CachedAgentPromptValue>();

export function createPublishedVersionCacheKey(agentId: string, versionId: string): string {
  return `${agentId}:${versionId}`;
}

export function getCachedPublishedPrompt(cacheKey: string): CachedAgentPromptValue | null {
  return promptCache.get(cacheKey) ?? null;
}

export function setCachedPublishedPrompt(
  cacheKey: string,
  value: CachedAgentPromptValue,
): CachedAgentPromptValue {
  promptCache.set(cacheKey, value);
  return value;
}

export function invalidatePublishedPromptCache(input?: {
  agentId?: string;
  versionId?: string;
}): void {
  if (!input?.agentId && !input?.versionId) {
    promptCache.clear();
    return;
  }

  for (const key of [...promptCache.keys()]) {
    const [cachedAgentId, cachedVersionId] = key.split(":");
    if (input.agentId && cachedAgentId !== input.agentId) continue;
    if (input.versionId && cachedVersionId !== input.versionId) continue;
    promptCache.delete(key);
  }
}

export function getPublishedPromptCacheSnapshot() {
  return {
    size: promptCache.size,
    keys: [...promptCache.keys()].sort(),
  };
}
