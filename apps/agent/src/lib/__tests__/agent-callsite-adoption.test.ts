import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AGENT_CATALOG } from "@lumenalta/schemas";

function readSource(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("internal/background named-agent adoption", () => {
  it("routes Atlus extraction and ingestion jobs through named agents instead of inline prompt authority", () => {
    const adoptedCallsites = [
      ["lib/atlusai-search.ts", "knowledge-result-extractor"],
      ["ingestion/classify-metadata.ts", "slide-metadata-classifier"],
      ["ingestion/describe-slide.ts", "slide-description-writer"],
      ["ingestion/auto-classify-templates.ts", "template-classification-analyst"],
      ["validation/validate-schemas.ts", "schema-validation-auditor"],
    ] as const;

    for (const [relativePath, agentId] of adoptedCallsites) {
      const source = readSource(relativePath);

      expect(source).toContain("executeNamedAgent");
      expect(source).toContain(`agentId: \"${agentId}\"`);
      expect(source).not.toContain("new GoogleGenAI");
    }
  });

  it("covers the adopted internal/background jobs in the shared agent catalog", () => {
    expect(
      AGENT_CATALOG.find((entry) => entry.agentId === "knowledge-result-extractor"),
    )?.toMatchObject({
      sourceSites: ["apps/agent/src/lib/atlusai-search.ts"],
      family: "knowledge-extraction",
    });

    expect(
      AGENT_CATALOG.find((entry) => entry.agentId === "slide-metadata-classifier"),
    )?.toMatchObject({
      sourceSites: ["apps/agent/src/ingestion/classify-metadata.ts"],
      family: "ingestion",
    });

    expect(
      AGENT_CATALOG.find((entry) => entry.agentId === "slide-description-writer"),
    )?.toMatchObject({
      sourceSites: ["apps/agent/src/ingestion/describe-slide.ts"],
      family: "ingestion",
    });

    expect(
      AGENT_CATALOG.find((entry) => entry.agentId === "template-classification-analyst"),
    )?.toMatchObject({
      sourceSites: ["apps/agent/src/ingestion/auto-classify-templates.ts"],
      family: "ingestion",
    });

    expect(
      AGENT_CATALOG.find((entry) => entry.agentId === "schema-validation-auditor"),
    )?.toMatchObject({
      sourceSites: ["apps/agent/src/validation/validate-schemas.ts"],
      family: "validation",
    });
  });
});
