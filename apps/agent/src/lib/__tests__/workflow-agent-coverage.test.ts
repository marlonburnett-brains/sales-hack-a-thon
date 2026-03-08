import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("seller-facing workflow named-agent coverage", () => {
  it("routes pre-call generation steps through named agents instead of inline model calls", () => {
    const source = readWorkspaceFile("src/mastra/workflows/pre-call-workflow.ts");

    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"company-researcher"/s);
    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"value-hypothesis-strategist"/s);
    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"discovery-question-strategist"/s);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });

  it("routes touch 1 prompt generation through the first-contact pager agent", () => {
    const source = readWorkspaceFile("src/mastra/workflows/touch-1-workflow.ts");

    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"first-contact-pager-writer"/s);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });

  it("routes touch 4 prompt sites through named agents instead of inline prompt authority", () => {
    const source = readWorkspaceFile("src/mastra/workflows/touch-4-workflow.ts");

    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"transcript-extractor"/s);
    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"sales-brief-strategist"/s);
    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"roi-framing-analyst"/s);
    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"proposal-slide-selector"/s);
    expect(source).toMatch(/executeNamedAgent\(\{\s*agentId:\s*"buyer-faq-strategist"/s);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });
});
