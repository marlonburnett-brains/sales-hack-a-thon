import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AGENT_CATALOG } from "@lumenalta/schemas";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("deck-intelligence named-agent adoption", () => {
  it("routes deck-structure inference through the named analyst agent", () => {
    const source = readWorkspaceFile("src/deck-intelligence/infer-deck-structure.ts");

    expect(source).toMatch(/executeRuntimeProviderNamedAgent/);
    expect(source).toMatch(/agentId:\s*"deck-structure-analyst"/);
    expect(source).toMatch(/DECK_STRUCTURE_SCHEMA/);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });

  it("routes chat refinement through the separate refinement assistant while preserving stream and structure flows", () => {
    const source = readWorkspaceFile("src/deck-intelligence/chat-refinement.ts");

    expect(source).toMatch(/streamRuntimeProviderNamedAgent/);
    expect(source).toMatch(/executeRuntimeProviderNamedAgent/);
    expect(source).toMatch(/agentId:\s*"deck-structure-refinement-assistant"/);
    expect(source).toMatch(/DECK_STRUCTURE_SCHEMA/);
    expect(source).toMatch(/onChunk\(/);
    expect(source).toMatch(/inferDeckStructure\(key, updatedConstraints\)/);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent(Stream)?\(/);
  });

  it("keeps deck inference and refinement as separate catalog roles", () => {
    expect(
      AGENT_CATALOG.find((entry) => entry.agentId === "deck-structure-analyst"),
    )?.toMatchObject({
      family: "deck-intelligence",
      sourceSites: ["apps/agent/src/deck-intelligence/infer-deck-structure.ts"],
    });

    expect(
      AGENT_CATALOG.find(
        (entry) => entry.agentId === "deck-structure-refinement-assistant",
      ),
    )?.toMatchObject({
      family: "deck-intelligence",
      sourceSites: ["apps/agent/src/deck-intelligence/chat-refinement.ts"],
    });
  });
});
