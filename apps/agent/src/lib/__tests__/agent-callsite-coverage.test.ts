import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { AGENT_CATALOG } from "@lumenalta/schemas";

type PromptBearingCallsite = {
  path: string;
  agentIds: string[];
};

const PROMPT_BEARING_CALLSITES: PromptBearingCallsite[] = [
  {
    path: "src/mastra/workflows/pre-call-workflow.ts",
    agentIds: [
      "company-researcher",
      "value-hypothesis-strategist",
      "discovery-question-strategist",
    ],
  },
  {
    path: "src/mastra/workflows/touch-1-workflow.ts",
    agentIds: ["first-contact-pager-writer"],
  },
  {
    path: "src/mastra/workflows/touch-4-workflow.ts",
    agentIds: [
      "transcript-extractor",
      "sales-brief-strategist",
      "roi-framing-analyst",
      "proposal-slide-selector",
      "buyer-faq-strategist",
    ],
  },
  {
    path: "src/lib/slide-selection.ts",
    agentIds: ["deck-slide-selector"],
  },
  {
    path: "src/lib/proposal-assembly.ts",
    agentIds: ["proposal-copywriter"],
  },
  {
    path: "src/lib/atlusai-search.ts",
    agentIds: ["knowledge-result-extractor"],
  },
  {
    path: "src/deck-intelligence/infer-deck-structure.ts",
    agentIds: ["deck-structure-analyst"],
  },
  {
    path: "src/deck-intelligence/chat-refinement.ts",
    agentIds: ["deck-structure-refinement-assistant"],
  },
  {
    path: "src/ingestion/classify-metadata.ts",
    agentIds: ["slide-metadata-classifier"],
  },
  {
    path: "src/ingestion/describe-slide.ts",
    agentIds: ["slide-description-writer"],
  },
  {
    path: "src/ingestion/auto-classify-templates.ts",
    agentIds: ["template-classification-analyst"],
  },
  {
    path: "src/ingestion/pilot-ingestion.ts",
    agentIds: ["solution-pillar-taxonomist"],
  },
  {
    path: "src/validation/validate-schemas.ts",
    agentIds: ["schema-validation-auditor"],
  },
];

const BUSINESS_ROOTS = [
  "src/mastra/workflows",
  "src/lib",
  "src/deck-intelligence",
  "src/ingestion",
  "src/validation",
];

const DIRECT_PROVIDER_ALLOWLIST = new Set([
  "src/lib/agent-executor.ts",
  "src/ingestion/embed-slide.ts",
]);

const DIRECT_PROVIDER_PATTERN = /new GoogleGenAI|\.models\.generateContent(Stream)?\(/;
const NAMED_AGENT_SEAM_PATTERN =
  /(?:execute|stream)(?:Runtime(?:Provider)?)?NamedAgent/;

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function collectTypeScriptFiles(dir: string): string[] {
  const absoluteDir = resolve(process.cwd(), dir);
  const entries = readdirSync(absoluteDir).flatMap((entry) => {
    const absolutePath = resolve(absoluteDir, entry);
    const relativePath = relative(process.cwd(), absolutePath);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (entry === "__tests__") {
        return [];
      }

      return collectTypeScriptFiles(relativePath);
    }

    return relativePath.endsWith(".ts") ? [relativePath] : [];
  });

  return entries;
}

describe("repo-level named-agent callsite coverage", () => {
  it("routes every known prompt-bearing business file through the named-agent seam", () => {
    for (const callsite of PROMPT_BEARING_CALLSITES) {
      const source = readWorkspaceFile(callsite.path);

      expect(source).toMatch(NAMED_AGENT_SEAM_PATTERN);
      for (const agentId of callsite.agentIds) {
        expect(source).toMatch(new RegExp(`agentId:\\s*"${agentId}"`));
      }
      expect(source).not.toMatch(/new GoogleGenAI/);
      expect(source).not.toMatch(/ai\.models\.generateContent(Stream)?\(/);
    }
  });

  it("ensures each referenced business-logic agent id exists in the shared catalog", () => {
    const catalogIds = new Set(AGENT_CATALOG.map((entry) => entry.agentId));

    for (const agentId of PROMPT_BEARING_CALLSITES.flatMap(
      (callsite) => callsite.agentIds,
    )) {
      expect(catalogIds.has(agentId)).toBe(true);
    }
  });

  it("fails if new business files bypass the named-agent seam with direct provider calls", () => {
    const directProviderBypasses = BUSINESS_ROOTS.flatMap((root) =>
      collectTypeScriptFiles(root).filter((filePath) => {
        if (DIRECT_PROVIDER_ALLOWLIST.has(filePath)) {
          return false;
        }

        return DIRECT_PROVIDER_PATTERN.test(readWorkspaceFile(filePath));
      }),
    );

    expect(directProviderBypasses).toEqual([]);
  });
});
