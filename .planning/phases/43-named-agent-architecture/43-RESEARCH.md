# Phase 43: Named Agent Architecture - Research

**Researched:** 2026-03-08
**Domain:** Named Mastra agent registry with Prisma-backed prompt versioning and runtime cache discipline
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All current LLM touchpoints become first-class named agents in this phase, not just seller-facing runtime flows
- Background jobs such as slide classification, slide description, and template auto-classification should be formalized as equal members of the agent catalog
- Deck-structure inference and deck-structure chat refinement should be separate named agents, not one shared deck-intelligence agent
- When the same responsibility appears across touches, prefer a shared job-based agent instead of duplicating agents per touch

- Default to one clear responsibility per agent
- If two prompts mostly differ by output shape or mode but serve the same job, keep them in the same agent family rather than creating a whole new agent
- Touch 4 should keep explicit sub-roles where the work is already clearly distinct today, including extraction, briefing, ROI framing, slide selection, and FAQ generation
- When in doubt, prefer cleaner responsibility boundaries over keeping the total agent count small

- Use role-based names for the formal agent catalog
- Names should be plain-language and understandable to product/admin users, not just engineers
- Names should emphasize business function over model mechanics
- Shared agents should keep touch-agnostic names unless the responsibility is truly touch-specific

- Use a shared Lumenalta baseline prompt layer plus a focused role-specific prompt layer for each named agent
- The shared baseline should carry brand and governance rules, especially approved-building-block limits and HITL expectations
- Specialist behavior should be expressed by overriding within the role-specific prompt, not by abandoning the shared baseline
- Keep consistency high across the roster so the full catalog feels like one governed system

### Claude's Discretion
- Exact agent IDs and storage keys behind the user-facing names
- Exact catalog membership for borderline cases where research finds two current prompts should stay together as one family
- Exact caching and prompt-loading mechanics, as long as published versions remain the source of truth

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-01 | All LLM interactions are formalized as named agents with dedicated system prompts | Recommended responsibility-first catalog, Mastra `Agent` registration pattern, and full roster coverage of workflow, deck-intelligence, ingestion, and internal extraction prompt sites |
| AGENT-02 | Each agent has a clear responsibility boundary and cached system prompt support | Recommended layered prompt resolver, published-version cache keys, immutable `AgentConfigVersion` records, and workflow version pinning across suspend/resume |
</phase_requirements>

## Summary

Phase 43 should formalize the existing prompt sprawl into a named agent catalog, but the safest implementation path is not to make `@mastra/editor` the source of truth yet. The current codebase already has many prompt sites spread across workflows, deck-intelligence helpers, ingestion jobs, and the AtlusAI extraction adapter. Those prompts map cleanly to a responsibility-first roster, and Mastra's current agent docs support dynamic `instructions` and central registration, so the runtime side is straightforward. The unstable part is editor persistence: current official evidence for `@mastra/editor` is a changelog announcement plus npm metadata, not a mature reference surface.

For planning, treat Prisma-backed `AgentConfig` and `AgentConfigVersion` models as the authoritative prompt store in the app schema, and treat Mastra agents as runtime wrappers that resolve published prompts through an async instruction loader. That matches the phase boundary, matches the roadmap note that Phase 43 owns those migrations, and keeps Phase 44 free to validate whether `@mastra/editor` can sit on top later without forcing this phase onto an under-documented API.

The most important design constraint is prompt determinism across long-running workflows. Touch 1 and Touch 4 already suspend and resume; if prompt lookups always read the latest published text, a workflow can cross a publish boundary and silently change behavior mid-run. Plan for immutable prompt versions, cache by published version, and capture the chosen version IDs at workflow start so resumed steps keep the same instructions.

**Primary recommendation:** Use custom Prisma `AgentConfig` + `AgentConfigVersion` as the published source of truth, register named Mastra agents with async layered instructions, and pin prompt versions per workflow run.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mastra/core` | `^1.8.0` in repo | Register named agents and resolve dynamic instructions at runtime | Official Mastra docs support agent registration plus async `instructions`, which fits DB-backed prompt lookup |
| `prisma` / `@prisma/client` | `^6.3.1` in repo | Persist `AgentConfig` and immutable `AgentConfigVersion` rows in `public` schema | Matches project migration discipline and keeps prompt source of truth in app-owned tables |
| `@mastra/pg` | `^1.7.1` in repo | Persist Mastra-managed runtime state in `mastra` schema | Already wired in `apps/agent/src/mastra/index.ts`; no second runtime storage system needed |
| `@google/genai` | `^1.43.0` in repo | Existing model client behind prompt-driven execution | All current prompt sites already use it, so named agents should wrap current behavior instead of swapping providers |
| `zod` + `@lumenalta/schemas` | `^4.3.6` + workspace | Keep structured outputs and prompt contracts stable | Existing workflows and ingestion code already depend on shared schema contracts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.0.18` in repo | Contract tests for roster completeness, cache invalidation, and resolver behavior | Add focused Phase 43 tests around agent registry and version pinning |
| `@mastra/editor` | `0.7.0` latest on npm | Optional later integration for stored-agent editing/versioning | Validate in Phase 44 only after Phase 43 ships stable custom models |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Prisma prompt models | `@mastra/editor` | Editor is promising, but current evidence is mainly changelog + npm metadata; Phase 43 already owns Prisma migrations and cannot depend on under-documented storage/runtime semantics |
| Shared job-based agent families | One agent per touch page | Easier naming at first, but duplicates prompts and violates the user decision to share responsibilities across touches when the job is the same |
| Immutable prompt versions pinned per run | Always read current published prompt | Simpler lookup, but breaks determinism across suspend/resume workflows |

**Installation:**
```bash
# Recommended Phase 43 path uses existing repo dependencies.
# Optional validation spike for Phase 44 only:
pnpm --filter agent add @mastra/editor@0.7.0
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/agent/src/
├── mastra/agents/           # named agent definitions and registry
├── lib/agent-config.ts      # Prisma prompt reads/writes + version pin helpers
├── lib/agent-prompt-cache.ts # in-memory published-version cache
└── mastra/index.ts          # register agents with Mastra instance

apps/agent/prisma/
├── schema.prisma            # AgentConfig + AgentConfigVersion models
└── seed.ts                  # seed published defaults for first-run behavior

packages/schemas/
└── constants.ts or new agent catalog file  # shared agent ids/names if web needs them later
```

### Pattern 1: Responsibility-First Agent Catalog
**What:** Convert each prompt-bearing responsibility into a named agent or named agent family, including internal/background jobs.
**When to use:** For every current prompt site except non-prompt model calls like embeddings.
**Example roster:**

| User-facing name | Suggested key | Responsibility | Current source sites |
|------------------|---------------|----------------|----------------------|
| Company Researcher | `company-researcher` | Pre-call company research | `apps/agent/src/mastra/workflows/pre-call-workflow.ts` |
| Pre-Call Strategist | `pre-call-strategist` | Value hypotheses + discovery questions family | `apps/agent/src/mastra/workflows/pre-call-workflow.ts` |
| First Contact Pager Writer | `first-contact-pager-writer` | Touch 1 pager generation | `apps/agent/src/mastra/workflows/touch-1-workflow.ts` |
| Deck Slide Selector | `deck-slide-selector` | Shared Touch 2/3 selection family with mode inputs | `apps/agent/src/lib/slide-selection.ts` |
| Transcript Extractor | `transcript-extractor` | Touch 4 field extraction | `apps/agent/src/mastra/workflows/touch-4-workflow.ts` |
| Sales Brief Strategist | `sales-brief-strategist` | Touch 4 pillar mapping + brief generation | `apps/agent/src/mastra/workflows/touch-4-workflow.ts` |
| ROI Framing Analyst | `roi-framing-analyst` | Touch 4 ROI enrichment | `apps/agent/src/mastra/workflows/touch-4-workflow.ts` |
| Proposal Slide Selector | `proposal-slide-selector` | Touch 4 candidate slide allocation | `apps/agent/src/mastra/workflows/touch-4-workflow.ts` |
| Proposal Copywriter | `proposal-copywriter` | Touch 4 retrieved-slide rewriting | `apps/agent/src/lib/proposal-assembly.ts` |
| Buyer FAQ Strategist | `buyer-faq-strategist` | Touch 4 FAQ generation | `apps/agent/src/mastra/workflows/touch-4-workflow.ts` |
| Knowledge Result Extractor | `knowledge-result-extractor` | Atlus raw MCP results -> structured slide results | `apps/agent/src/lib/atlusai-search.ts` |
| Deck Structure Analyst | `deck-structure-analyst` | Structure inference | `apps/agent/src/deck-intelligence/infer-deck-structure.ts` |
| Deck Structure Refinement Assistant | `deck-structure-refinement-assistant` | Structure chat refinement | `apps/agent/src/deck-intelligence/chat-refinement.ts` |
| Slide Metadata Classifier | `slide-metadata-classifier` | Per-slide metadata tagging | `apps/agent/src/ingestion/classify-metadata.ts` |
| Slide Description Writer | `slide-description-writer` | Per-slide narrative description | `apps/agent/src/ingestion/describe-slide.ts` |
| Template Classification Analyst | `template-classification-analyst` | Auto-classify templates/examples | `apps/agent/src/ingestion/auto-classify-templates.ts` |

### Pattern 2: Layered Prompt Resolution
**What:** Resolve each agent instruction from two layers: shared Lumenalta baseline + role-specific published prompt.
**When to use:** Every named agent, especially where governance rules must stay consistent.
**Example:**
```typescript
// Source: https://mastra.ai/docs/agents/overview
import { Agent } from "@mastra/core/agent";

export const agent = new Agent({
  id: "sales-brief-strategist",
  name: "Sales Brief Strategist",
  instructions: async () => {
    const published = await getPublishedAgentPrompt("sales-brief-strategist");
    return [
      { role: "system", content: LUMENALTA_BASELINE_PROMPT },
      { role: "system", content: published.rolePrompt },
    ];
  },
  model: "openai/gpt-oss-120b-maas",
});
```

### Pattern 3: Published-Version Cache, Not "Current Prompt" Cache
**What:** Cache resolved prompts by `agentId + publishedVersion` and invalidate on publish.
**When to use:** Runtime prompt resolution in API handlers, workflows, and background jobs.
**Example:**
```typescript
// Source: project pattern from apps/agent/src/lib/atlusai-search.ts + Phase 43 recommendation
const promptCache = new Map<string, string>();

export async function getCompiledPrompt(agentId: string): Promise<{ prompt: string; version: number }> {
  const config = await prisma.agentConfig.findUniqueOrThrow({
    where: { agentId },
    include: { publishedVersion: true },
  });

  const version = config.publishedVersion.version;
  const cacheKey = `${agentId}:${version}`;
  const cached = promptCache.get(cacheKey);
  if (cached) return { prompt: cached, version };

  const prompt = `${config.publishedVersion.baselinePrompt}\n\n${config.publishedVersion.rolePrompt}`;
  promptCache.set(cacheKey, prompt);
  return { prompt, version };
}
```

### Pattern 4: Version Pinning Across Suspend/Resume
**What:** Capture chosen prompt version IDs at workflow start and thread them through later steps.
**When to use:** Any workflow with suspend/resume or long multi-step execution.
**Example:**
```typescript
// Source: existing suspend/resume pattern in apps/agent/src/mastra/workflows/touch-1-workflow.ts
const agentVersions = {
  transcriptExtractorVersionId,
  salesBriefStrategistVersionId,
  roiFramingAnalystVersionId,
};

return {
  ...inputData,
  agentVersions,
};

// Later steps resolve by versionId, not by latest published row.
```

### Anti-Patterns to Avoid
- **Inline prompt strings as the permanent architecture:** acceptable today, but Phase 43 should remove prompt authority from workflow/helper files.
- **One giant "sales agent":** hides responsibility boundaries and makes future prompt management unusable for admins.
- **Per-touch duplication of the same job:** violates the locked decision to share reusable responsibilities.
- **Background-job exceptions:** if a prompt exists, it belongs in the catalog.
- **Latest-prompt lookup during resume:** creates nondeterministic workflow behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime agent registry | Ad-hoc maps of prompt strings and helper functions | Mastra `Agent` registration in `mastra/index.ts` | Keeps agent discovery, lifecycle, and later tooling aligned with the framework |
| Prompt version history | Mutable single-row prompt fields only | `AgentConfig` + immutable `AgentConfigVersion` snapshots | Publish/rollback/audit all require immutable history |
| Cache semantics | Global `Map<agentId, prompt>` with manual guesswork | Cache by published version key with explicit invalidation on publish | Prevents stale prompt reuse and mixed-version execution |
| Shared governance rules | Copy/paste baseline text into every prompt file | Central baseline layer plus role-specific layer | Reduces drift and lets Phase 44 edit surfaces stay coherent |
| Future agent editing UI in this phase | Bespoke editing framework now | Defer UI to Phase 44; keep this phase API/model focused | Phase 43 requirement is architecture + prompt source of truth, not management UX |

**Key insight:** the deceptively hard part is not agent construction; it is keeping published prompt versions deterministic, cache-safe, and explainable across workflows and background jobs.

## Common Pitfalls

### Pitfall 1: Prompt Drift Across Suspend/Resume
**What goes wrong:** a workflow starts under one prompt version and resumes under another after an admin publish.
**Why it happens:** runtime code reads the latest published prompt on every step.
**How to avoid:** pin version IDs at workflow start and resolve by version thereafter.
**Warning signs:** approval/resume outputs change without any input change.

### Pitfall 2: Agent Catalog Turns Into Workflow Names
**What goes wrong:** the roster reads like internal step IDs instead of product-facing roles.
**Why it happens:** engineers name agents from file names or workflow stages.
**How to avoid:** keep user-facing names role-based and plain-language; keep engineering keys separate.
**Warning signs:** names like `touch4-step2-brief` or `infer-structure-job-v2` leak into settings/API surfaces.

### Pitfall 3: Same Job Duplicated Per Touch
**What goes wrong:** Touch 2 and Touch 3 get separate slide-selector agents with near-identical prompts.
**Why it happens:** planning follows page boundaries instead of responsibility boundaries.
**How to avoid:** share a job-based family when the responsibility is the same and only the mode/input differs.
**Warning signs:** prompt diffs are mostly wording changes plus output shape tweaks.

### Pitfall 4: Background Jobs Stay Outside the Catalog
**What goes wrong:** ingestion and deck-intelligence prompts remain hidden utilities while only seller-facing prompts become agents.
**Why it happens:** teams scope "agent" to chat/workflow UX only.
**How to avoid:** inventory every prompt-bearing file and register them all in the catalog.
**Warning signs:** `GoogleGenAI` prompt builders still exist in ingestion/deck-intelligence after Phase 43.

### Pitfall 5: Cache Invalidates by Agent Only
**What goes wrong:** a publish updates one prompt version, but stale compiled instructions still serve because the cache key is too coarse.
**Why it happens:** cache stores `agentId -> prompt` with no version component.
**How to avoid:** key caches by immutable published version and clear keys on publish.
**Warning signs:** published prompt text in DB does not match observed runtime behavior.

### Pitfall 6: Migration Scope Creep
**What goes wrong:** Phase 43 bundles unrelated schema work or uses unsafe Prisma commands.
**Why it happens:** prompt architecture touches many files and planners over-batch DB changes.
**How to avoid:** keep Phase 43 migration focused on `AgentConfig` and `AgentConfigVersion`, and use forward-only `prisma migrate dev`.
**Warning signs:** migration plan mentions `db push`, reset flows, or unrelated models.

## Code Examples

Verified patterns from official sources:

### Dynamic Mastra Instructions
```typescript
// Source: https://mastra.ai/docs/agents/overview
import { Agent } from "@mastra/core/agent";

export const testAgent = new Agent({
  id: "test-agent",
  name: "Test Agent",
  instructions: async () => {
    return "You are a helpful assistant.";
  },
  model: "openai/gpt-5.1",
});
```

### Shared Postgres Storage at Mastra Instance Level
```typescript
// Source: https://mastra.ai/docs/memory/storage
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mastra-storage",
    connectionString: process.env.DATABASE_URL,
  }),
});
```

### Current Local Prompt Site to Migrate
```typescript
// Source: apps/agent/src/lib/slide-selection.ts
const prompt = buildTouch2Prompt(params, candidates);
const response = await ai.models.generateContent({
  model: "openai/gpt-oss-120b-maas",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: responseSchema,
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline prompt strings inside workflows/helpers | Registered named agents with dynamic instruction resolution | Current Mastra docs (`v1` era) | Centralizes prompt governance and prepares for settings-driven management |
| Mutable live prompt lookup | Immutable published versions with workflow pinning | Needed once suspend/resume workflows exist | Prevents nondeterministic outputs after prompt publishes |
| Touch-specific duplication | Shared job-based families with mode/context inputs | Required by Phase 43 user decisions | Keeps catalog smaller, clearer, and easier to govern |
| Hidden background prompts | Full catalog including ingestion/deck-intelligence | Current project scope | Makes the system auditable and complete for AGENT-01 |

**Deprecated/outdated:**
- Inline prompt authority in workflow/lib files: keep call-site context there, but move prompt source of truth into the named-agent layer.
- Treating `@mastra/editor` as a Phase 43 default: current docs evidence is not strong enough to make it the required foundation.

## Open Questions

1. **Should Phase 44 use `@mastra/editor` on top of the custom Prisma models, or keep custom CRUD end-to-end?**
   - What we know: official changelog says `@mastra/editor` can store, version, activate, and cache stored agents; npm metadata shows no React peer deps, which suggests API-first rather than UI-first.
   - What's unclear: there is no clearly discoverable current reference page for its storage API, migration shape, or UI surface.
   - Recommendation: keep Phase 43 independent of editor; plan a small Phase 44 validation spike before committing UI work to it.

2. **How should the two prompt layers be stored inside `AgentConfigVersion`?**
   - What we know: user wants a shared baseline plus role-specific override, and Phase 43 owns only `AgentConfig`/`AgentConfigVersion` migrations.
   - What's unclear: whether to persist `baselinePrompt` + `rolePrompt` separately, or persist `rolePrompt` plus a compiled prompt snapshot.
   - Recommendation: store both layer fields plus a compiled snapshot if planners want fastest reads; at minimum, preserve both layers in each immutable version row so publish-time behavior is reconstructable.

## Sources

### Primary (HIGH confidence)
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts` - current Touch 1 inline prompt site and suspend/resume pattern
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - current Touch 4 sub-role prompt boundaries
- `apps/agent/src/mastra/workflows/pre-call-workflow.ts` - current pre-call prompt families
- `apps/agent/src/lib/slide-selection.ts` - shared Touch 2/3 selection prompt family
- `apps/agent/src/lib/proposal-assembly.ts` - proposal copy generation prompt site
- `apps/agent/src/lib/atlusai-search.ts` - adaptive prompt cache precedent for internal extraction
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` - deck inference prompt site
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - separate deck refinement prompt site
- `apps/agent/src/ingestion/classify-metadata.ts` - slide metadata classification prompt site
- `apps/agent/src/ingestion/describe-slide.ts` - slide description prompt site
- `apps/agent/src/ingestion/auto-classify-templates.ts` - template classification prompt site
- `apps/agent/src/mastra/index.ts` - existing `PostgresStore` instance and Mastra integration point
- `apps/agent/package.json` - current dependency versions
- `apps/agent/vitest.config.ts` - current agent test framework
- `https://mastra.ai/docs/agents/overview` - dynamic instructions and agent registration
- `https://mastra.ai/docs/memory/storage` - instance-level `PostgresStore` usage and thread/resource semantics
- `https://mastra.ai/blog/changelog-2026-02-04` - official `@mastra/editor` announcement and claimed capabilities
- npm registry metadata via `npm view @mastra/editor version peerDependencies description dependencies --json` - package version and dependency surface

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` - prior project research that already anticipated custom prompt models and runtime pinning
- `.planning/research/SUMMARY.md` - roadmap-level risk framing around prompt version drift and editor uncertainty

### Tertiary (LOW confidence)
- No dedicated current Mastra reference page for `@mastra/editor` storage/runtime APIs was found during docs search; editor-specific implementation details beyond the changelog remain to be validated.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - almost all of it is existing repo infrastructure plus official Mastra docs/npm metadata
- Architecture: MEDIUM - the recommended custom Prisma path is strong, but exact layering fields and future editor handoff still need planner choices
- Pitfalls: HIGH - they come directly from current workflow patterns, cache precedents, and suspend/resume behavior already present in the repo

**Research date:** 2026-03-08
**Valid until:** 2026-04-07
