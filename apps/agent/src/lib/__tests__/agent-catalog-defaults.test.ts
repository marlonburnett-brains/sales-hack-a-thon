import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AGENT_CATALOG } from "@lumenalta/schemas";

import {
  buildAgentCatalogDefaults,
  seedPublishedAgentCatalog,
} from "../agent-catalog-defaults";

function createPrismaMock() {
  let nextConfigId = 1;
  let nextVersionId = 1;

  const configs = new Map<string, any>();
  const versions = new Map<string, any>();

  return {
    agentConfig: {
      async findUnique({ where }: { where: { agentId: string } }) {
        return configs.get(where.agentId) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const record = { id: `config-${nextConfigId++}`, ...data } as Record<
          string,
          unknown
        >;
        configs.set(record.agentId as string, record);
        return record;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const record = [...configs.values()].find((config) => config.id === where.id);
        if (!record) {
          throw new Error(`Missing config ${where.id}`);
        }
        Object.assign(record, data);
        return record;
      },
    },
    agentConfigVersion: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { agentConfigId_version: { agentConfigId: string; version: number } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        const key = `${where.agentConfigId_version.agentConfigId}:${where.agentConfigId_version.version}`;
        const existing = versions.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const record = { id: `version-${nextVersionId++}`, ...create };
        versions.set(key, record);
        return record;
      },
    },
    snapshot() {
      return {
        configs: [...configs.values()],
        versions: [...versions.values()],
      };
    },
  };
}

describe("agent catalog defaults", () => {
  it("builds one published version-1 default per catalog entry with separate baseline and role prompt layers", () => {
    const defaults = buildAgentCatalogDefaults();

    expect(defaults).toHaveLength(AGENT_CATALOG.length);

    for (const entry of defaults) {
      expect(entry.version.version).toBe(1);
      expect(entry.version.baselinePrompt).toContain("Lumenalta");
      expect(entry.version.rolePrompt).toContain(entry.config.name);
      expect(entry.version.rolePrompt).toContain(entry.config.responsibility);
      expect(entry.version.rolePrompt).not.toBe(entry.version.baselinePrompt);
      expect(entry.version.compiledPrompt).toContain(entry.version.baselinePrompt);
      expect(entry.version.compiledPrompt).toContain(entry.version.rolePrompt);
    }
  });

  it("defines immutable version history plus a published-version pointer in the Prisma schema", () => {
    const schema = readFileSync(
      new URL("../../../prisma/schema.prisma", import.meta.url),
      "utf8",
    );

    expect(schema).toContain("model AgentConfig {");
    expect(schema).toMatch(/publishedVersionId\s+String\?\s+@unique/);
    expect(schema).toMatch(/publishedVersion\s+AgentConfigVersion\?/);
    expect(schema).toContain("model AgentConfigVersion {");
    expect(schema).toContain("@@unique([agentConfigId, version])");
  });

  it("seeds idempotently without duplicate configs or duplicate version-1 rows", async () => {
    const prisma = createPrismaMock();

    await seedPublishedAgentCatalog(prisma as never, new Date("2026-03-08T16:00:00Z"));
    await seedPublishedAgentCatalog(prisma as never, new Date("2026-03-08T16:05:00Z"));

    const snapshot = prisma.snapshot();

    expect(snapshot.configs).toHaveLength(AGENT_CATALOG.length);
    expect(snapshot.versions).toHaveLength(AGENT_CATALOG.length);

    for (const config of snapshot.configs) {
      expect(config.publishedVersionId).toMatch(/^version-/);
      expect(config.status).toBe("published");
    }

    for (const version of snapshot.versions) {
      expect(version.version).toBe(1);
      expect(version.isPublished).toBe(true);
      expect(version.baselinePrompt).toContain("Lumenalta");
    }
  });
});
