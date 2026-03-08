# Phase 40: Agent Typecheck Cleanup - Research

**Researched:** 2026-03-08
**Domain:** Agent TypeScript baseline repair for Mastra, Zod, Vitest, and shared schema package drift
**Confidence:** MEDIUM

## Summary

Phase 40 is a repo-health cleanup phase, not a feature phase. The current `pnpm --filter agent exec tsc --noEmit` baseline fails in 7 file buckets: two old Vitest suites, `apps/agent/src/lib/mcp-client.ts`, `apps/agent/src/mastra/index.ts`, `apps/agent/src/mastra/workflows/touch-4-workflow.ts`, and the shared `packages/schemas` barrel. The failures cluster into four actionable causes: TypeScript import-extension rules, Mastra workflow API drift, Zod 4 API drift, and stale MCP/Vitest test patterns.

The most important planning constraint is that Touch 4 behavior is already covered by targeted passing agent tests. `pnpm --filter agent exec vitest run src/mastra/__tests__/deck-structure-routes.test.ts src/mastra/__tests__/template-classify-route.test.ts` passes, so the cleanup plan should preserve those routes while fixing compile blockers around them. The risky area is MCP: `mcp-client.ts` currently depends on a private `@mastra/mcp` method, and its unit test suite is already stale beyond typing-only issues.

This should be planned as a small sequence of cleanup slices, not one undifferentiated sweep: first remove deterministic compiler drifts (`packages/schemas`, Zod 4, Mastra `createRun`/`resume`), then repair MCP source and tests together, then close with a clean compile and targeted regression proof.

**Primary recommendation:** Split Phase 40 into 3 plans: deterministic compiler/API drift fixes, MCP client plus test realignment, and final no-emit verification with Touch 4 regression proof.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Compiler enforcing the agent baseline | Actual installed compiler in `apps/agent/node_modules`; the no-emit gate is the phase exit criterion |
| @mastra/core | 1.8.0 | Workflow runtime and typed `Run` API | Current agent workflow code compiles against this API, so plan to the installed signatures, not older assumptions |
| @mastra/mcp | 1.0.2 | MCP client used by Atlus search integration | Current MCP wrapper depends on this package and its public/private boundary is the main risk hotspot |
| Zod | 4.3.6 | Runtime validation plus route typing | Current agent code already uses Zod 4, so route handlers must use Zod 4 error and record APIs |
| Vitest | 4.0.18 | Agent unit tests and mock utilities | Existing failing test typings come from current Vitest mock types, not from app code alone |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | workspace | Shared schema barrel consumed by agent | Update when agent compile fails due to shared source shape or import rules |
| @lumenalta/tsconfig | workspace | Shared node compiler baseline | Use as the constraint surface; avoid phase-local tsconfig loosening unless absolutely required |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixing source imports | Enable `allowImportingTsExtensions` | Not viable here because TypeScript only allows it with `noEmit` or `emitDeclarationOnly`, while the shared node base config emits output |
| Updating source to public APIs | Keep private API access with casts | Faster short-term, but keeps the compile and maintenance risk that caused this phase |
| Repairing stale tests with source fixes | Ignoring failing MCP tests and only chasing `tsc` green | Would leave the verification trail weak and risks regressing the MCP path while claiming baseline health |

**Installation:**
```bash
pnpm install
```

## Architecture Patterns

### Recommended Project Structure

```text
apps/agent/
├── src/lib/                  # MCP/search infrastructure and unit tests
├── src/mastra/               # API routes and workflows
└── tsconfig.json             # Agent compile target

packages/schemas/
├── index.ts                  # Shared barrel exported into agent compile
└── llm/                      # Shared schema modules consumed by agent
```

### Pattern 1: Fix by Error Family, Not File Order

**What:** Group work into compiler-rule drift, dependency API drift, and stale test drift.
**When to use:** When one `tsc` run surfaces many files but only a few root causes.
**Example:**
```typescript
// Source: https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html
export { SalesBriefLlmSchema, type SalesBrief } from "./llm/sales-brief";

// not
export { SalesBriefLlmSchema, type SalesBrief } from "./llm/sales-brief.ts";
```

### Pattern 2: Treat Mastra Run Creation as Async

**What:** `workflow.createRun()` must be awaited before calling `resume()`.
**When to use:** Every route that resumes a suspended workflow.
**Example:**
```typescript
// Source: https://mastra.ai/reference/workflows/workflow-methods/create-run
// Source: https://mastra.ai/reference/workflows/run-methods/resume
const wf = mastra.getWorkflow("touch-4-workflow");
const run = await wf.createRun({ runId: data.runId });

await run.resume({
  step: "await-brief-approval",
  resumeData: {
    decision: "approved",
    reviewerName: data.reviewerName,
  },
});
```

### Pattern 3: Use Zod 4 Shapes Explicitly

**What:** Zod 4 route handlers should use `err.issues`, and `z.record()` should provide both key and value schemas.
**When to use:** Any route validation or helper schema touched by this phase.
**Example:**
```typescript
// Source: https://zod.dev/basics
const fieldSeveritySchema = z.record(
  z.string(),
  z.enum(["error", "warning", "ok"]),
);

try {
  schema.parse(body);
} catch (err) {
  if (err instanceof z.ZodError) {
    return c.json({ error: "Invalid request body", details: err.issues }, 400);
  }
}
```

### Pattern 4: Source Fix and Test Fix Move Together for MCP

**What:** Any `mcp-client.ts` change must land with its Vitest suite updates.
**When to use:** When replacing private MCP access or updating Atlus auth mocks.
**Example:**
```typescript
// Keep the source/test seam aligned:
// - source imports current auth helpers actually used by mcp-client.ts
// - test mocks must include the same exports
// - test health-check expectations must match the real code path
```

### Anti-Patterns to Avoid

- **Compiler flag escape hatch:** Do not loosen tsconfig to hide source errors that should be fixed directly.
- **Private Mastra dependency reach-through:** Do not keep `getConnectedClientForServer` as a normal typed call; it is private in the installed `@mastra/mcp` types.
- **Type-only green build:** Do not stop at `tsc` green if MCP tests still reflect removed exports or dead assumptions.
- **Touch 4 collateral edits:** Do not refactor deck-structure routes broadly; the current Touch 4 route tests already pass and should stay the guardrail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript `.ts` import handling | A custom resolver workaround in app code | Extensionless local imports | The compiler already defines the rule; the simplest compliant source shape is the durable fix |
| Workflow resume control flow | Custom casts around `Promise<Run>` | `await workflow.createRun()` plus documented `run.resume()` | Mastra 1.8.0 already exposes the supported path |
| Zod v4 compatibility shim | A fake `errors` alias or wrapper | Native `err.issues` and explicit `z.record(key, value)` | The installed Zod types already encode the current API |
| Vitest callable mock typing | Broad `ReturnType<typeof vi.fn>` placeholders | Explicit callable mock signatures or typed wrappers | Current Vitest mock inference is what triggers the test TS2348 failures |
| MCP transport internals | A growing custom adapter over private client internals | Smallest possible public-API-aligned seam, or one isolated escape hatch if no public path exists | This is the highest churn surface in the phase and should be contained |

**Key insight:** Most Phase 40 work is dependency-drift reconciliation, not business-logic repair. Plan for narrow, source-of-truth-aligned updates instead of framework-level rewrites.

## Common Pitfalls

### Pitfall 1: Treating All Failures as Equal Priority

**What goes wrong:** Planning follows file order and mixes low-risk syntax cleanup with MCP behavior changes.
**Why it happens:** The `tsc` output is flat, but the causes are not.
**How to avoid:** Triage into compiler-rule drift, Mastra API drift, Zod drift, and MCP seam drift first.
**Warning signs:** Plan steps touch `packages/schemas`, route handlers, and MCP internals in one broad change.

### Pitfall 2: Fixing Mastra Resume Calls Without Reading Current API

**What goes wrong:** Code keeps calling `wf.createRun()` synchronously, then TypeScript flags missing `resume()`.
**Why it happens:** Older assumptions no longer match Mastra 1.8.0.
**How to avoid:** Treat `createRun()` as async everywhere and use `step` + `resumeData` in `run.resume()`.
**Warning signs:** Types mention `Promise<Run<...>>` instead of `Run<...>`.

### Pitfall 3: Preserving Zod 3 Habits in Zod 4 Code

**What goes wrong:** Route handlers read `err.errors`, or helper schemas use old `z.record(valueSchema)` shorthand.
**Why it happens:** Zod 4 tightened typing and renamed common access patterns.
**How to avoid:** Standardize on `err.issues` and two-argument `z.record()` in touched files.
**Warning signs:** TS2339 on `errors` or TS2554 on `z.record(...)`.

### Pitfall 4: Solving MCP Type Errors While Leaving MCP Tests Stale

**What goes wrong:** `mcp-client.ts` compiles, but its tests still fail because mocks omit `persistAtlusClientId` and still assume `listTools()` health checks.
**Why it happens:** The suite predates the current implementation.
**How to avoid:** Plan MCP source and MCP tests in the same slice.
**Warning signs:** Vitest failures mention missing mock exports or `getConnectedClientForServer is not a function`.

### Pitfall 5: Regressing Touch 4 While Cleaning Unrelated Compile Debt

**What goes wrong:** A broad route refactor accidentally changes artifact-qualified behavior.
**Why it happens:** `apps/agent/src/mastra/index.ts` contains both old cleanup targets and active Touch 4 endpoints.
**How to avoid:** Keep route edits minimal and re-run the two passing Touch 4 regression suites before phase closeout.
**Warning signs:** Changes touch deck-structure routing logic outside the exact type-fix lines.

## Code Examples

Verified patterns from official sources:

### Mastra Suspend/Resume

```typescript
// Source: https://mastra.ai/reference/workflows/workflow-methods/create-run
// Source: https://mastra.ai/reference/workflows/run-methods/resume
const run = await workflow.createRun({ runId: "run-123" });

await run.resume({
  step: "await-asset-review",
  resumeData: {
    decision: "approved",
    reviewerName: "Alex",
  },
});
```

### Zod 4 Error Access

```typescript
// Source: https://zod.dev/basics
try {
  schema.parse(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.issues);
  }
}
```

### TypeScript Import Extension Rule

```typescript
// Source: https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html
export { SlideMetadataSchema } from "./llm/slide-metadata";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod `err.errors` | Zod 4 `err.issues` | Zod 4 | Agent route validation handlers must update to compile |
| `z.record(valueSchema)` shorthand assumptions | `z.record(keySchema, valueSchema)` in current installed types | Zod 4 typing in this repo | Helper schemas and route payload schemas must be explicit |
| `workflow.createRun()` treated as sync | `await workflow.createRun()` | Mastra 1.8.0 API in repo | Resume routes must await run creation before calling `resume()` |
| Reaching into MCP client private methods as typed public API | Use public API or isolate one escape hatch behind a narrow adapter | Current `@mastra/mcp` 1.0.2 types | `mcp-client.ts` is the main remaining compile/test risk |

**Deprecated/outdated:**
- `err.errors` in agent route handlers: outdated under Zod 4; replace with `err.issues`.
- `.ts` extension barrel imports in `packages/schemas`: outdated for the current emitting compiler config.
- Synchronous `createRun()` assumptions: outdated for current Mastra typings.

## Open Questions

1. **What is the safest replacement for direct `getConnectedClientForServer()` usage?**
   - What we know: the installed `@mastra/mcp` types mark it private, and the current tests do not model the new health-check/tool-call path correctly.
   - What's unclear: whether there is a public `@mastra/mcp` path that preserves the raw `callTool` behavior needed to bypass schema conversion issues.
   - Recommendation: make this the only scoped investigation item in the MCP plan; if no public path exists, isolate the required escape hatch behind one helper and document it explicitly.

2. **Should MCP test repair be broader than compile-only updates?**
   - What we know: `src/lib/__tests__/mcp-client.test.ts` currently fails at runtime for semantic reasons, not just typing reasons.
   - What's unclear: whether the desired assertions should follow the current health-check implementation or intentionally revert behavior.
   - Recommendation: plan to align tests to current intended behavior, not historical assumptions, and capture that as verification evidence.

## Sources

### Primary (HIGH confidence)
- Local compiler run: `pnpm --filter agent exec tsc --noEmit` on 2026-03-08 - current failure inventory and file buckets
- Installed typings: `apps/agent/node_modules/@mastra/core/dist/workflows/workflow.d.ts` - `createRun()` returns `Promise<Run>` and `resume()` expects `step` + `resumeData`
- Installed typings: `apps/agent/node_modules/@mastra/mcp/dist/client/configuration.d.ts` - `getConnectedClientForServer` is private in the current package
- Installed typings: `apps/agent/node_modules/zod/v4/classic/errors.d.ts` and `apps/agent/node_modules/zod/v4/classic/schemas.d.ts` - Zod 4 uses `issues` and current `record(key, value)` signatures

### Secondary (MEDIUM confidence)
- https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html - compiler rule for `.ts` import extensions
- https://mastra.ai/reference/workflows/workflow-methods/create-run - current Mastra `createRun()` docs
- https://mastra.ai/reference/workflows/run-methods/resume - current Mastra `run.resume()` docs
- https://zod.dev/basics - current Zod 4 error handling docs
- https://vitest.dev/guide/mocking - current Vitest mocking guidance

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and signatures were verified from installed packages in this repo
- Architecture: MEDIUM - most fixes are deterministic, but the MCP public-API replacement still needs implementation-time validation
- Pitfalls: HIGH - they are grounded in current compiler output and current Vitest runtime failures

**Research date:** 2026-03-08
**Valid until:** 2026-03-15
