import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("template classify contract", () => {
  it("carries artifactType through the web classify request contract", () => {
    const apiClientSource = readWorkspaceFile("../web/src/lib/api-client.ts");
    const actionSource = readWorkspaceFile("../web/src/lib/actions/template-actions.ts");

    expect(apiClientSource).toMatch(/artifactType\?:\s*ArtifactType\s*\|\s*null/);
    expect(apiClientSource).toMatch(/body:\s*JSON\.stringify\(data\)/);
    expect(actionSource).toMatch(/artifactType\?:\s*ArtifactType\s*\|\s*null/);
    expect(actionSource).toMatch(/artifactType,?\s*\}\)/);
  });

  it("rejects touch_4 example saves without artifactType", () => {
    const source = readWorkspaceFile("src/mastra/index.ts");

    expect(source).toMatch(/classification === "example"/);
    expect(source).toMatch(/touchTypes\.length !== 1/);
    expect(source).toMatch(/touchTypes\[0\] === "touch_4"/);
    expect(source).toMatch(/artifactType is required for touch_4 examples/i);
  });

  it("clears stale artifactType for templates and non-touch_4 examples", () => {
    const source = readWorkspaceFile("src/mastra/index.ts");

    expect(source).toMatch(/artifactType:\s*null/);
    expect(source).toMatch(/data\.classification === "template"/);
    expect(source).toMatch(/data\.touchTypes\?\.\[0\] !== "touch_4"/);
    expect(source).toMatch(/revalidatePath\("\/settings\/deck-structures\/touch-4"\)/);
  });
});
