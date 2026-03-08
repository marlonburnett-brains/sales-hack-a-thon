import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("seller-facing workflow named-agent coverage", () => {
  it("routes pre-call generation steps through named agents instead of inline model calls", () => {
    const source = readWorkspaceFile("src/mastra/workflows/pre-call-workflow.ts");

    expect(source).toMatch(/agentId:\s*"company-researcher"/);
    expect(source).toMatch(/agentId:\s*"value-hypothesis-strategist"/);
    expect(source).toMatch(/agentId:\s*"discovery-question-strategist"/);
    expect(source).toMatch(/executeNamedAgent/);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });

  it("routes touch 1 prompt generation through the first-contact pager agent", () => {
    const source = readWorkspaceFile("src/mastra/workflows/touch-1-workflow.ts");

    expect(source).toMatch(/agentId:\s*"first-contact-pager-writer"/);
    expect(source).toMatch(/executeNamedAgent/);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });

  it("routes touch 4 prompt sites through named agents instead of inline prompt authority", () => {
    const source = readWorkspaceFile("src/mastra/workflows/touch-4-workflow.ts");

    expect(source).toMatch(/agentId:\s*"transcript-extractor"/);
    expect(source).toMatch(/agentId:\s*"sales-brief-strategist"/);
    expect(source).toMatch(/agentId:\s*"roi-framing-analyst"/);
    expect(source).toMatch(/agentId:\s*"proposal-slide-selector"/);
    expect(source).toMatch(/agentId:\s*"buyer-faq-strategist"/);
    expect(source).toMatch(/executeNamedAgent/);
    expect(source).not.toMatch(/new GoogleGenAI/);
    expect(source).not.toMatch(/ai\.models\.generateContent\(/);
  });
});
