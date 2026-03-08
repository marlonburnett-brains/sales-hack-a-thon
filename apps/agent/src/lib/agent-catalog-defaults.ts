import { AGENT_CATALOG, type AgentCatalogEntry } from "@lumenalta/schemas";

const DEFAULT_PUBLISHER = "system:seed";

export const LUMENALTA_BASELINE_PROMPT = [
  "You are a named Lumenalta sales system agent.",
  "",
  "Global operating rules:",
  "- Stay inside Lumenalta's approved capabilities and building blocks.",
  "- Ground outputs in the provided deal, transcript, retrieval, or slide context.",
  "- Do not invent customer facts, proof points, assets, or delivery claims.",
  "- Respect human-in-the-loop checkpoints whenever approval is required.",
  "- Write in a professional, concise, outcome-focused Lumenalta voice.",
].join("\n");

export interface AgentCatalogDefault {
  config: {
    agentId: string;
    name: string;
    responsibility: string;
    family: string;
    isShared: boolean;
    touchTypes: string[];
    status: "published";
  };
  version: {
    version: 1;
    baselinePrompt: string;
    rolePrompt: string;
    compiledPrompt: string;
    changeSummary: string;
    isPublished: true;
    publishedAt: Date;
    publishedBy: string;
  };
}

type AgentSeedPrisma = {
  agentConfig: {
    findUnique(args: { where: { agentId: string } }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  agentConfigVersion: {
    upsert(args: {
      where: { agentConfigId_version: { agentConfigId: string; version: number } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
};

function buildRolePrompt(entry: AgentCatalogEntry): string {
  return [
    `You are the ${entry.name} for Lumenalta's governed agent roster.`,
    "",
    `Primary responsibility: ${entry.responsibility}`,
    `Agent family: ${entry.family}`,
    `Scope: ${entry.isShared ? "shared across workflows" : "touch-specific"}`,
    `Touch coverage: ${entry.touchTypes.length > 0 ? entry.touchTypes.join(", ") : "none"}`,
    `Prompt source notes: ${entry.sourceNotes}`,
    "",
    "Stay inside this role boundary. If adjacent work is needed, provide structured output for the downstream agent instead of absorbing its responsibility.",
  ].join("\n");
}

export function buildAgentCatalogDefaults(now = new Date()): AgentCatalogDefault[] {
  return AGENT_CATALOG.map((entry) => {
    const rolePrompt = buildRolePrompt(entry);
    return {
      config: {
        agentId: entry.agentId,
        name: entry.name,
        responsibility: entry.responsibility,
        family: entry.family,
        isShared: entry.isShared,
        touchTypes: entry.touchTypes,
        status: "published",
      },
      version: {
        version: 1,
        baselinePrompt: LUMENALTA_BASELINE_PROMPT,
        rolePrompt,
        compiledPrompt: `${LUMENALTA_BASELINE_PROMPT}\n\n${rolePrompt}`,
        changeSummary: "Initial published prompt seeded from the shared named-agent catalog.",
        isPublished: true,
        publishedAt: now,
        publishedBy: DEFAULT_PUBLISHER,
      },
    };
  });
}

export async function seedPublishedAgentCatalog(
  prisma: AgentSeedPrisma,
  now = new Date(),
): Promise<void> {
  const defaults = buildAgentCatalogDefaults(now);

  for (const entry of defaults) {
    const existingConfig = await prisma.agentConfig.findUnique({
      where: { agentId: entry.config.agentId },
    });

    const config = existingConfig
      ? existingConfig
      : await prisma.agentConfig.create({
          data: {
            agentId: entry.config.agentId,
            name: entry.config.name,
            responsibility: entry.config.responsibility,
            family: entry.config.family,
            isShared: entry.config.isShared,
            touchTypes: JSON.stringify(entry.config.touchTypes),
            status: entry.config.status,
          },
        });

    const version = await prisma.agentConfigVersion.upsert({
      where: {
        agentConfigId_version: {
          agentConfigId: config.id,
          version: entry.version.version,
        },
      },
      create: {
        agentConfigId: config.id,
        version: entry.version.version,
        baselinePrompt: entry.version.baselinePrompt,
        rolePrompt: entry.version.rolePrompt,
        compiledPrompt: entry.version.compiledPrompt,
        changeSummary: entry.version.changeSummary,
        isPublished: entry.version.isPublished,
        publishedAt: entry.version.publishedAt,
        publishedBy: entry.version.publishedBy,
      },
      update: {
        baselinePrompt: entry.version.baselinePrompt,
        rolePrompt: entry.version.rolePrompt,
        compiledPrompt: entry.version.compiledPrompt,
        changeSummary: entry.version.changeSummary,
        isPublished: entry.version.isPublished,
        publishedAt: entry.version.publishedAt,
        publishedBy: entry.version.publishedBy,
      },
    });

    await prisma.agentConfig.update({
      where: { id: config.id },
      data: {
        name: entry.config.name,
        responsibility: entry.config.responsibility,
        family: entry.config.family,
        isShared: entry.config.isShared,
        touchTypes: JSON.stringify(entry.config.touchTypes),
        status: entry.config.status,
        publishedVersionId: version.id,
      },
    });
  }
}
