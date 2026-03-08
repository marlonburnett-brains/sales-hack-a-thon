import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("touch 4 workflow source contract", () => {
  it("awaits createRun and resumes by step name", () => {
    const source = readWorkspaceFile("src/mastra/index.ts");

    expect(source).toMatch(/const run = await wf\.createRun\(\{ runId: data\.runId \}\);/);
    expect(source).toMatch(/await run\.resume\(\{\s*step: "await-brief-approval"/s);
    expect(source).toMatch(/await run\.resume\(\{\s*step: "await-asset-review"/s);
    expect(source).not.toMatch(/stepId:/);
  });

  it("uses Zod 4 record and error issue semantics in touched routes", () => {
    const routeSource = readWorkspaceFile("src/mastra/index.ts");
    const workflowSource = readWorkspaceFile("src/mastra/workflows/touch-4-workflow.ts");

    expect(routeSource).toMatch(/editedBrief: z\.record\(z\.string\(\), z\.unknown\(\)\)/);
    expect(routeSource).toMatch(/details: err\.issues/);
    expect(workflowSource).toMatch(
      /const fieldSeveritySchema = z\.record\(\s*z\.string\(\),\s*z\.enum\(\["error", "warning", "ok"\]\),\s*\)/s,
    );
  });
});
