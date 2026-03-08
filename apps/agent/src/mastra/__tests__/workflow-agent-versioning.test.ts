import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("workflow named-agent version pinning", () => {
  it("pins touch 1 prompt versions across the seller approval suspend boundary", () => {
    const source = readWorkspaceFile("src/mastra/workflows/touch-1-workflow.ts");

    expect(source).toMatch(/agentVersions:\s*z\.object\(\{\s*firstContactPagerWriter:\s*z\.string\(\)/s);
    expect(source).toMatch(/generatedContent: PagerContentLlmSchema,[\s\S]*agentVersions:/s);
    expect(source).toMatch(/agentVersions:\s*inputData\.agentVersions/s);
  });

  it("pins touch 4 agent versions before approval and reuses them after resume", () => {
    const source = readWorkspaceFile("src/mastra/workflows/touch-4-workflow.ts");

    expect(source).toMatch(/const agentVersionsSchema = z\.object\(/);
    expect(source).toMatch(/agentVersions:\s*agentVersionsSchema/);
    expect(source).toMatch(/executeNamedAgent\(\{[\s\S]*agentId:\s*"sales-brief-strategist"[\s\S]*pinnedVersionId:\s*inputData\.agentVersions\.salesBriefStrategist/s);
    expect(source).toMatch(/executeNamedAgent\(\{[\s\S]*agentId:\s*"roi-framing-analyst"[\s\S]*pinnedVersionId:\s*inputData\.agentVersions\.roiFramingAnalyst/s);
    expect(source).toMatch(/executeNamedAgent\(\{[\s\S]*agentId:\s*"proposal-slide-selector"[\s\S]*pinnedVersionId:\s*inputData\.agentVersions\.proposalSlideSelector/s);
    expect(source).toMatch(/executeNamedAgent\(\{[\s\S]*agentId:\s*"buyer-faq-strategist"[\s\S]*pinnedVersionId:\s*inputData\.agentVersions\.buyerFaqStrategist/s);
  });
});
