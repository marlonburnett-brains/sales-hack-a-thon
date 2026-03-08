# Phase 39: Artifact Contract Hardening - Research

**Researched:** 2026-03-08
**Domain:** Shared `ArtifactType` contract hardening across web settings, web API helpers, and agent chat/deck-structure paths
**Confidence:** HIGH

## Summary

Phase 39 is a contract-tightening phase, not a feature-discovery phase. The canonical artifact vocabulary already exists in `@lumenalta/schemas` as `ARTIFACT_TYPES`, `ARTIFACT_TYPE_LABELS`, and `ArtifactType`, and the backend already resolves Touch 4 deck structures through the shared `{ touchType, artifactType }` key. The remaining risk is that several web and agent paths still accept or expose `artifactType` as broad `string`, which weakens compile-time safety and keeps artifact-specific routing dependent on casts and runtime checks.

The main planning target is to align every artifact-qualified deck-structure and chat boundary to the shared `ArtifactType` contract while preserving the existing Touch 4 route family. On the web side, `deck-structure-view.tsx` is still touch-type keyed and would lose artifact-qualified detail if it were reused for Touch 4 entries. On the agent side, route query parsing and chat/inference helper signatures still use `string | null` in places even though `resolveDeckStructureKey()` already defines the stricter contract. The plan should harden those boundaries without inventing new endpoint families or local enums.

Regression coverage should focus on the real risks surfaced by the audit: Touch 4 detail loading must stay artifact-qualified, chat requests must keep sending the selected artifact end-to-end, and compile-time-facing helper types must reject invalid artifact strings before runtime. The existing Vitest coverage already proves most of the behavior shape; Phase 39 should extend it around the legacy settings view and the remaining broad-type seams.

**Primary recommendation:** Normalize every artifact-qualified deck-structure and chat API surface to `ArtifactType | null`, keep `resolveDeckStructureKey()` as the single runtime gate, and either harden or retire `deck-structure-view.tsx` so it cannot collapse Touch 4 artifact rows into a touch-only map.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@lumenalta/schemas` | workspace | Canonical `ARTIFACT_TYPES`, `ARTIFACT_TYPE_LABELS`, and `ArtifactType` exports | Already established as the shared public contract for artifact values across web and agent |
| `next` | `^15.5.12` | Web app routes, server actions, and settings UI | Existing web deck-structure and proxy paths already live here |
| `react` | `^19.0.0` | Settings detail views, tabs, and chat UI state | Current Touch 4 settings flow is React client state-driven |
| `zod` | `^4.3.6` | Request/query validation at web and agent boundaries | Current route validation already uses it and should be narrowed to artifact enums |
| `mastra` / `@mastra/core` | `^1.3.5` / `^1.8.0` | Agent API route registration | Current deck-structure detail, infer, and chat endpoints are implemented here |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.0.18` | Web and agent regression tests | Use for artifact-contract assertions and settings/chat regression coverage |
| `@testing-library/react` | `^16.3.2` | Web component behavior tests | Use for Touch 4 tab/view reuse and artifact-qualified UI state |
| `lucide-react` | `^0.576.0` | Existing settings UI icons | Only for keeping current UI components compiling; not part of the hardening work |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared `ArtifactType` imports from `@lumenalta/schemas` | App-local string unions or `type ArtifactType = string` | Faster locally, but reintroduces drift and defeats the Phase 35 shared-contract decision |
| Existing `:touchType` route family with `artifactType` query param | Separate `/touch_4/:artifactType/...` endpoint family | More explicit URLs, but conflicts with the locked Phase 36 routing decision and broadens change surface |
| `resolveDeckStructureKey()` as the runtime gate | Duplicated touch/artifact branching in each caller | Creates inconsistent validation and makes future contract drift likely |

**Installation:**
```bash
pnpm --filter web exec vitest run src/components/settings/__tests__/touch-type-detail-view.test.tsx
pnpm --filter agent exec vitest run src/mastra/__tests__/deck-structure-routes.test.ts
```

## Architecture Patterns

### Recommended Project Structure
```text
packages/schemas/
├── constants.ts                  # Canonical artifact tuple, labels, and type
└── index.ts                      # Public barrel for web/agent imports

apps/web/src/
├── lib/api-client.ts             # Typed deck-structure and chat-facing DTOs/helpers
├── lib/actions/deck-structure-actions.ts
├── components/settings/          # Touch 4 tabs, detail view, chat bar, legacy view
└── app/api/deck-structures/chat/route.ts

apps/agent/src/
├── deck-intelligence/            # Key resolution, inference, chat refinement
└── mastra/index.ts               # Route boundary parsing and handler wiring
```

### Pattern 1: Single Shared Artifact Contract
**What:** Import `ArtifactType` from `@lumenalta/schemas` everywhere artifact-qualified deck/chat data crosses a boundary.
**When to use:** Any prop, helper parameter, DTO field, or query/body schema that represents the proposal/talk_track/faq contract.
**Example:**
```typescript
// Source: `packages/schemas/constants.ts`
export const ARTIFACT_TYPES = ["proposal", "talk_track", "faq"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
```

### Pattern 2: Resolve Identity Through `{ touchType, artifactType }`
**What:** Keep deck-structure identity centralized in `resolveDeckStructureKey()` and pass the resolved key downstream.
**When to use:** Detail fetches, inference, chat refinement, and any persistence lookup touching `DeckStructure` rows.
**Example:**
```typescript
// Source: `apps/agent/src/deck-intelligence/deck-structure-key.ts`
export function resolveDeckStructureKey(
  touchType: string,
  artifactType: string | null = null,
): DeckStructureKey {
  if (!isTouch4(touchType)) {
    return { touchType, artifactType: null };
  }

  if (!artifactType) {
    throw new Error("artifactType is required for touch_4 deck structures");
  }

  if (!isArtifactType(artifactType)) {
    throw new Error(`Unsupported artifactType for touch_4: ${artifactType}`);
  }

  return { touchType, artifactType };
}
```

### Pattern 3: Preserve Artifact Qualification in Touch 4 Settings UI
**What:** Any reusable Touch 4 settings view must key state by artifact-qualified identity, not by `touchType` alone.
**When to use:** Legacy `deck-structure-view.tsx`, Touch 4 tab warming, or any future shared settings surface that loads multiple deck structures.
**Example:**
```typescript
// Source: `apps/web/src/components/settings/touch-type-detail-view.tsx`
const detail = await getDeckStructureAction(touchType, artifactType);

<ChatBar
  touchType={touchType}
  artifactType={artifactType}
  onStructureUpdate={handleStructureUpdate}
/>
```

### Anti-Patterns to Avoid
- **Touch-type-only maps for Touch 4:** `Record<string, DeckStructureDetail>` keyed only by `touchType` will overwrite proposal/talk_track/faq entries.
- **Broad `string` artifact types at typed boundaries:** this forces casts, weakens editor help, and hides broken call chains until runtime.
- **Caller-owned validation:** do not re-implement Touch 4 artifact rules in each component or route; validate once, then pass typed data.
- **New route families for this phase:** the locked contract is the existing `:touchType` route family plus optional `artifactType` query params.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact vocabulary | App-local string unions, duplicated label maps | `ArtifactType`, `ARTIFACT_TYPES`, `ARTIFACT_TYPE_LABELS` from `@lumenalta/schemas` | Prevents drift between UI copy, query params, and persisted values |
| Deck-structure identity rules | Per-file `if (touchType === "touch_4")` branches | `resolveDeckStructureKey()` | Keeps Touch 4 validation and normalization consistent |
| Query param validation | Manual `includes()` plus ad hoc casts in each route | `z.enum(ARTIFACT_TYPES)` where the input is optional, then pass typed values | Removes unsafe string handling at the request boundary |
| Multi-row Touch 4 state caching | `touchType`-only structure caches | Artifact-qualified keys or existing per-artifact detail components | Avoids proposal/talk_track/faq collisions |

**Key insight:** This phase is about deleting ambiguity, not adding flexibility. Every custom shortcut around `ArtifactType` or deck key resolution recreates the exact drift the audit flagged.

## Common Pitfalls

### Pitfall 1: Reusing `deck-structure-view.tsx` Without Artifact-Aware Keys
**What goes wrong:** The component loads Touch 4 summaries, then fetches details with `getDeckStructureAction(summary.touchType)` and stores them in a map keyed only by `touchType`.
**Why it happens:** The component predates artifact-qualified Touch 4 rows and assumes one detail row per touch type.
**How to avoid:** If the component remains in use, thread `artifactType` through detail fetches and key the local structure map by a composite key; otherwise explicitly retire it from Touch 4 usage and cover that with tests.
**Warning signs:** `touch_4` rows overwrite each other, artifact tabs show the wrong content, or reused detail views silently drop `artifactType`.

### Pitfall 2: Tightening Types in Components but Not Route Schemas
**What goes wrong:** UI props become `ArtifactType`, but web/agent routes still parse `artifactType` as `z.string()` and helper signatures still accept `string`.
**Why it happens:** Contract hardening is only applied at the edge of the React tree, leaving transport seams broad.
**How to avoid:** Plan the change as an end-to-end sweep: DTOs, action signatures, proxy route schema, agent route query parsing, and helper functions.
**Warning signs:** New `as ArtifactType` casts appear, or invalid artifact strings remain type-correct until runtime.

### Pitfall 3: Breaking Non-Touch-4 Callers While Hardening Touch 4
**What goes wrong:** Shared helpers become too strict and force `artifactType` where non-Touch-4 flows should continue passing `null` or `undefined`.
**Why it happens:** The contract is artifact-qualified only when the data is Touch 4 scoped, but the deck-structure APIs still serve Touch 1-3.
**How to avoid:** Use `ArtifactType | null` or `ArtifactType | undefined` deliberately at shared interfaces, and keep Touch 4 enforcement in centralized validation.
**Warning signs:** Touch 1-3 tests start needing fake artifact values or helper overloads become awkward.

### Pitfall 4: Accidentally Expanding Scope Into Performance Debt
**What goes wrong:** The plan tries to solve the known Touch 4 double-fetch behavior while hardening types.
**Why it happens:** `Touch4ArtifactTabs` warms detail data and `TouchTypeDetailView` fetches again on mount, which is visible adjacent debt.
**How to avoid:** Treat double-fetch reduction as opportunistic only if it falls out naturally from the contract change; otherwise keep it explicitly out of Phase 39 unless needed for correctness.
**Warning signs:** The task list starts redesigning data loading instead of focusing on type safety and reuse safety.

## Code Examples

Verified patterns from repository sources:

### Shared Artifact Contract Export
```typescript
// Source: `packages/schemas/index.ts`
export {
  ARTIFACT_TYPES,
  ARTIFACT_TYPE_LABELS,
  type ArtifactType,
} from "./constants.ts";
```

### Web Proxy Enforces Touch 4 Artifact Requirement
```typescript
// Source: `apps/web/src/app/api/deck-structures/chat/route.ts`
const body = z
  .object({
    touchType: z.string().min(1),
    artifactType: z.enum(ARTIFACT_TYPES).optional(),
    message: z.string().min(1),
  })
  .safeParse(await request.json());

if (body.data.touchType === "touch_4" && !body.data.artifactType) {
  return NextResponse.json(
    { error: "artifactType is required for touch_4 chat requests" },
    { status: 400 },
  );
}
```

### Agent Route Resolves Artifact-Qualified Deck Keys
```typescript
// Source: `apps/agent/src/mastra/index.ts`
const query = z
  .object({ artifactType: z.string().nullable().optional() })
  .parse(c.req.query());

key = resolveDeckStructureKey(touchType, query.artifactType ?? null);
```

### Touch 4 Detail View Keeps Artifact Through Fetch and Chat
```typescript
// Source: `apps/web/src/components/settings/touch-type-detail-view.tsx`
const detail = await getDeckStructureAction(touchType, artifactType);

<ChatBar
  touchType={touchType}
  artifactType={artifactType}
  onStructureUpdate={handleStructureUpdate}
  initialMessages={structure.chatMessages}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Touch-type-only deck identity | Shared `{ touchType, artifactType }` deck key for Touch 4 | Phase 36 | Backend persistence and route lookup now support separate proposal/talk_track/faq rows |
| App-local artifact assumptions | Shared `@lumenalta/schemas` artifact contract | Phase 35 | Web and agent can import the same raw values, labels, and union type |
| Generic Touch 4 fallback row | Explicit artifact-qualified Touch 4 rows only | Phase 36 | Touch 4 operations must stay artifact-aware to reach the correct structure |
| Settings detail route branching only | `touch-4` page rendered through `Touch4ArtifactTabs` and per-artifact detail view | Phase 37 | Main Touch 4 UI is safe, but legacy reuse surfaces still need hardening |

**Deprecated/outdated:**
- `artifactType` typed as broad `string` in deck/chat helper seams: outdated relative to the shared contract and should be removed where artifact-qualified data is expected.
- `deck-structure-view.tsx` touch-type-only detail fetching for Touch 4: outdated assumption from pre-artifact settings UI.

## Open Questions

1. **Should `deck-structure-view.tsx` be hardened for future reuse or explicitly de-scoped from Touch 4 usage?**
   - What we know: It is not the current Touch 4 route entry, but the audit explicitly flags it as a reuse risk.
   - What's unclear: Whether planners want implementation to modernize it or to lock it away from artifact-qualified use.
   - Recommendation: Plan the safer default: harden it enough that Touch 4 summaries/details cannot collapse if the component is reused.

2. **How far should route query parsing be tightened in the agent?**
   - What we know: The runtime gate is already `resolveDeckStructureKey()`, but the route schemas still parse `artifactType` as `z.string().nullable().optional()`.
   - What's unclear: Whether Phase 39 should introduce a shared optional artifact schema helper or just narrow the local route schemas.
   - Recommendation: Prefer a small shared optional-artifact schema/helper if it reduces duplicate casts without broadening scope.

3. **Should Phase 39 also remove the Touch 4 double-fetch noted in the audit?**
   - What we know: `Touch4ArtifactTabs` preloads detail, and `TouchTypeDetailView` fetches again on mount.
   - What's unclear: Whether this is correctness-adjacent enough to include now.
   - Recommendation: Treat it as out of scope unless contract hardening naturally introduces a shared typed detail cache.

## Sources

### Primary (HIGH confidence)
- Repository source: `packages/schemas/constants.ts` - canonical `ARTIFACT_TYPES`, `ArtifactType`, and label map
- Repository source: `packages/schemas/index.ts` - public barrel export for the shared artifact contract
- Repository source: `apps/web/src/components/settings/deck-structure-view.tsx` - current legacy reuse risk and touch-type-only detail map
- Repository source: `apps/web/src/components/settings/touch-type-detail-view.tsx` - artifact-qualified detail fetch and chat wiring
- Repository source: `apps/web/src/components/settings/chat-bar.tsx` - current broad `artifactType?: string` prop and web chat request body
- Repository source: `apps/web/src/lib/api-client.ts` - current broad `artifactType` DTO/helper types for deck structures
- Repository source: `apps/web/src/lib/actions/deck-structure-actions.ts` - server action signatures still typed broadly
- Repository source: `apps/web/src/app/api/deck-structures/chat/route.ts` - web proxy request validation and agent route forwarding
- Repository source: `apps/agent/src/deck-intelligence/deck-structure-key.ts` - single runtime identity gate for Touch 4 artifact keys
- Repository source: `apps/agent/src/deck-intelligence/chat-refinement.ts` - chat refinement signature and artifact-qualified persistence lookups
- Repository source: `apps/agent/src/deck-intelligence/infer-deck-structure.ts` - inference helpers still exposing some broad `string | null` seams
- Repository source: `apps/agent/src/mastra/index.ts` - deck-structure detail, infer, and chat route query parsing
- Repository source: `apps/web/src/components/settings/__tests__/touch-type-detail-view.test.tsx` - existing artifact-qualified UI/chat regression coverage
- Repository source: `apps/web/src/components/settings/__tests__/touch-4-artifact-tabs.test.tsx` - existing tab shell coverage and typed mock seams
- Repository source: `apps/web/src/lib/__tests__/api-client.deck-structures.test.ts` - existing deck-structure helper transport coverage
- Repository source: `apps/agent/src/mastra/__tests__/deck-structure-routes.test.ts` - existing route and chat artifact contract coverage
- Repository source: `.planning/v1.6-v1.6-MILESTONE-AUDIT.md` - explicit Phase 39 tech-debt scope and success target

### Secondary (MEDIUM confidence)
- None needed; this phase is primarily constrained by current repository architecture rather than external library behavior.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived directly from workspace package manifests and current in-repo architecture
- Architecture: HIGH - backed by current web and agent source paths that already implement the contract
- Pitfalls: HIGH - directly identified by the milestone audit plus concrete code hotspots in current files

**Research date:** 2026-03-08
**Valid until:** 2026-04-07
