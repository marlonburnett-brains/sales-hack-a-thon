import { beforeEach, describe, expect, it, vi } from "vitest";

import { AGENT_CATALOG } from "@lumenalta/schemas";

const promptLoaderState = vi.hoisted(() => ({
  getPublishedAgentConfig: vi.fn(),
}));

vi.mock("../../lib/agent-config", () => ({
  getPublishedAgentConfig: promptLoaderState.getPublishedAgentConfig,
}));

vi.mock("../../env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    GOOGLE_SERVICE_ACCOUNT_KEY: "{}",
    GOOGLE_TEMPLATE_PRESENTATION_ID: "test-template-id",
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
    VERTEX_SERVICE_ACCOUNT_KEY: "{}",
    SUPABASE_JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    NODE_ENV: "test",
  },
}));

describe("named Mastra agent registry", () => {
  beforeEach(() => {
    vi.resetModules();
    promptLoaderState.getPublishedAgentConfig.mockReset();
    promptLoaderState.getPublishedAgentConfig.mockImplementation(async (agentId: string) => ({
      agentId,
      name: AGENT_CATALOG.find((entry) => entry.agentId === agentId)?.name ?? agentId,
      responsibility: "Test responsibility",
      family: "test-family",
      isShared: false,
      touchTypes: [],
      status: "published",
      compiledPrompt: `Baseline for ${agentId}\n\nRole for ${agentId}`,
      instructions: [
        { role: "system", content: `Baseline for ${agentId}` },
        { role: "system", content: `Role for ${agentId}` },
      ],
      version: {
        id: `${agentId}-version-1`,
        version: 1,
        baselinePrompt: `Baseline for ${agentId}`,
        rolePrompt: `Role for ${agentId}`,
        compiledPrompt: `Baseline for ${agentId}\n\nRole for ${agentId}`,
        isPublished: true,
        publishedAt: new Date("2026-03-08T21:00:00Z"),
        publishedBy: "system:test",
      },
    }));
  });

  it("registers every shared catalog entry as a Mastra agent with the same stable id and plain-language name", async () => {
    const { namedMastraAgents } = await import("../agents");

    const registeredIds = Object.keys(namedMastraAgents).sort();
    const catalogIds = AGENT_CATALOG.map((entry) => entry.agentId).sort();

    expect(registeredIds).toEqual(catalogIds);

    for (const entry of AGENT_CATALOG) {
      const agent = namedMastraAgents[entry.agentId];
      expect(agent.id).toBe(entry.agentId);
      expect(agent.name).toBe(entry.name);
    }
  });

  it("resolves registered agent instructions asynchronously from the Prisma-backed prompt loader", async () => {
    const { namedMastraAgents } = await import("../agents");

    const agent = namedMastraAgents["sales-brief-strategist"];
    const instructions = await agent.getInstructions();

    expect(promptLoaderState.getPublishedAgentConfig).toHaveBeenCalledWith("sales-brief-strategist");
    expect(instructions).toEqual({
      role: "system",
      content: "Baseline for sales-brief-strategist\n\nRole for sales-brief-strategist",
    });
  });

  it("returns prompt version metadata alongside execution results so downstream flows can pin versions", async () => {
    const generate = vi.fn().mockResolvedValue({ text: "Structured answer" });

    const { executeNamedAgent } = await import("../../lib/agent-executor");

    const result = await executeNamedAgent(
      {
        agentId: "proposal-copywriter",
        messages: [{ role: "user", content: "Write a proposal summary" }],
      },
      {
        getMastraAgent: vi.fn().mockReturnValue({ generate }),
      },
    );

    expect(generate).toHaveBeenCalledWith(
      [{ role: "user", content: "Write a proposal summary" }],
      expect.objectContaining({
        instructions: expect.objectContaining({
          role: "system",
          content: expect.stringContaining("proposal-copywriter"),
        }),
      }),
    );
    expect(result.text).toBe("Structured answer");
    expect(result.promptVersion.id).toBe("proposal-copywriter-version-1");
    expect(result.promptVersion.version).toBe(1);
    expect(result.promptVersion.agentId).toBe("proposal-copywriter");
  });
});
