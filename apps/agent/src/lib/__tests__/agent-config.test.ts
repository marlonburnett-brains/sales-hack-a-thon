import { beforeEach, describe, expect, it, vi } from "vitest";

type PublishedVersionRecord = {
  id: string;
  version: number;
  baselinePrompt: string;
  rolePrompt: string;
  compiledPrompt?: string | null;
  isPublished: boolean;
  publishedAt?: Date | null;
  publishedBy?: string | null;
};

type AgentConfigRecord = {
  id: string;
  agentId: string;
  name: string;
  responsibility: string;
  family: string;
  isShared: boolean;
  touchTypes: string;
  status: string;
  publishedVersionId?: string | null;
  publishedVersion?: PublishedVersionRecord | null;
};

const prismaState = vi.hoisted(() => {
  const state = {
    configsByAgentId: new Map<string, AgentConfigRecord>(),
    configsByVersionId: new Map<string, AgentConfigRecord>(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };

  state.findUnique.mockImplementation(async ({ where }: { where: { agentId: string } }) => {
    return state.configsByAgentId.get(where.agentId) ?? null;
  });

  state.findUniqueOrThrow.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const config = state.configsByVersionId.get(where.id);
    if (!config?.publishedVersion || config.publishedVersion.id !== where.id) {
      throw new Error(`Missing version ${where.id}`);
    }
    return {
      ...config.publishedVersion,
      agentConfig: config,
    };
  });

  return state;
});

vi.mock("../db", () => ({
  prisma: {
    agentConfig: {
      findUnique: prismaState.findUnique,
    },
    agentConfigVersion: {
      findUniqueOrThrow: prismaState.findUniqueOrThrow,
    },
  },
}));

function seedPublishedConfig(input: {
  agentId: string;
  name?: string;
  versionId: string;
  version: number;
  baselinePrompt: string;
  rolePrompt: string;
  compiledPrompt?: string | null;
}) {
  const record: AgentConfigRecord = {
    id: `config-${input.agentId}`,
    agentId: input.agentId,
    name: input.name ?? input.agentId,
    responsibility: "Test responsibility",
    family: "test-family",
    isShared: false,
    touchTypes: JSON.stringify(["touch_4"]),
    status: "published",
    publishedVersionId: input.versionId,
    publishedVersion: {
      id: input.versionId,
      version: input.version,
      baselinePrompt: input.baselinePrompt,
      rolePrompt: input.rolePrompt,
      compiledPrompt: input.compiledPrompt ?? null,
      isPublished: true,
      publishedAt: new Date("2026-03-08T20:00:00Z"),
      publishedBy: "system:test",
    },
  };

  prismaState.configsByAgentId.set(input.agentId, record);
  prismaState.configsByVersionId.set(input.versionId, record);
  return record;
}

describe("agent prompt config resolver", () => {
  beforeEach(async () => {
    prismaState.configsByAgentId.clear();
    prismaState.configsByVersionId.clear();
    prismaState.findUnique.mockClear();
    prismaState.findUniqueOrThrow.mockClear();

    const mod = await import("../agent-config");
    mod.invalidateAgentPromptCache();
  });

  it("returns the published version metadata plus compiled baseline and role instructions for a named agent", async () => {
    seedPublishedConfig({
      agentId: "sales-brief-strategist",
      name: "Sales Brief Strategist",
      versionId: "version-1",
      version: 1,
      baselinePrompt: "Baseline prompt",
      rolePrompt: "Role prompt",
    });

    const { getPublishedAgentConfig } = await import("../agent-config");

    const resolved = await getPublishedAgentConfig("sales-brief-strategist");

    expect(resolved.agentId).toBe("sales-brief-strategist");
    expect(resolved.version.id).toBe("version-1");
    expect(resolved.version.version).toBe(1);
    expect(resolved.compiledPrompt).toBe("Baseline prompt\n\nRole prompt");
    expect(resolved.instructions).toEqual([
      { role: "system", content: "Baseline prompt" },
      { role: "system", content: "Role prompt" },
    ]);
  });

  it("keys cache entries by immutable published version identity so a new publish does not reuse stale instructions", async () => {
    seedPublishedConfig({
      agentId: "sales-brief-strategist",
      name: "Sales Brief Strategist",
      versionId: "version-1",
      version: 1,
      baselinePrompt: "Baseline v1",
      rolePrompt: "Role v1",
    });

    const {
      getPublishedAgentConfig,
      invalidateAgentPromptCache,
      getAgentPromptCacheSnapshot,
    } = await import("../agent-config");

    const first = await getPublishedAgentConfig("sales-brief-strategist");
    expect(first.compiledPrompt).toBe("Baseline v1\n\nRole v1");
    expect(prismaState.findUnique).toHaveBeenCalledTimes(1);

    prismaState.configsByAgentId.set("sales-brief-strategist", {
      ...prismaState.configsByAgentId.get("sales-brief-strategist")!,
      publishedVersionId: "version-2",
      publishedVersion: {
        id: "version-2",
        version: 2,
        baselinePrompt: "Baseline v2",
        rolePrompt: "Role v2",
        compiledPrompt: null,
        isPublished: true,
        publishedAt: new Date("2026-03-08T20:05:00Z"),
        publishedBy: "system:test",
      },
    });
    prismaState.configsByVersionId.set("version-2", prismaState.configsByAgentId.get("sales-brief-strategist")!);

    invalidateAgentPromptCache({ agentId: "sales-brief-strategist" });

    const second = await getPublishedAgentConfig("sales-brief-strategist");

    expect(second.version.id).toBe("version-2");
    expect(second.compiledPrompt).toBe("Baseline v2\n\nRole v2");
    expect(prismaState.findUnique).toHaveBeenCalledTimes(2);
    expect(getAgentPromptCacheSnapshot().keys).toContain("sales-brief-strategist:version-2");
    expect(getAgentPromptCacheSnapshot().keys).not.toContain("sales-brief-strategist:version-1");
  });

  it("can resolve a pinned config by version id without relying on latest published reads", async () => {
    seedPublishedConfig({
      agentId: "proposal-copywriter",
      name: "Proposal Copywriter",
      versionId: "version-7",
      version: 7,
      baselinePrompt: "Pinned baseline",
      rolePrompt: "Pinned role",
    });

    const { getAgentConfigByVersionId } = await import("../agent-config");

    const resolved = await getAgentConfigByVersionId("version-7");

    expect(resolved.agentId).toBe("proposal-copywriter");
    expect(resolved.version.id).toBe("version-7");
    expect(resolved.compiledPrompt).toBe("Pinned baseline\n\nPinned role");
    expect(prismaState.findUnique).not.toHaveBeenCalled();
    expect(prismaState.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "version-7" } }),
    );
  });
});
