# Phase 36: Backend Engine & API Routes - Research

**Researched:** 2026-03-07
**Domain:** Artifact-aware deck intelligence backend and API contracts
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Inference scoping
- Touch 4 primary examples must match the requested `artifactType` exactly; do not include null or mismatched examples in inference for that artifact
- Touch 4 secondary templates may include all Touch 4 templates as variation sources, even if they are not artifact-matched
- If a Touch 4 artifact has zero matching examples, persist and return an empty artifact-specific structure row rather than falling back to a generic Touch 4 structure
- Keep strict artifact separation for inference inputs; do not revive best-effort or generic Touch 4 merging

### API contract
- `GET /deck-structures` should return six logical entries: Touch 1, Touch 2, Touch 3, Pre-call, plus three separate Touch 4 entries for Proposal, Talk Track, and FAQ
- Touch 4 detail, infer, and chat routes should keep the existing `:touchType` route shape and identify the artifact with `?artifactType=`
- Touch 4 requests that omit `artifactType` should fail with a clear validation error instead of returning a generic placeholder
- Non-Touch-4 requests may ignore an extra `artifactType` parameter and continue resolving against `artifactType = null`

### Cron behavior
- Cron should treat Proposal, Talk Track, and FAQ as independent Touch 4 inference keys on every cycle
- Each Touch 4 artifact key should compute its own data hash from artifact-qualified data so re-inference is scoped independently
- Active chat protection should apply per artifact row; a recent Proposal chat must not block Talk Track or FAQ re-inference
- If one artifact key fails during cron, log it and continue processing the remaining artifact keys and touch types

### Chat refinement
- Touch 4 chat history, constraint summaries, and `lastChatAt` values should be stored separately per artifact-specific deck structure row
- Chat-triggered re-inference for Touch 4 must use the same requested artifact only; do not infer from combined Touch 4 data and then filter later
- Touch 4 chat requests without `artifactType` should be rejected rather than routed to a generic or inferred default artifact
- Long-thread summarization should stay per artifact so Proposal, Talk Track, and FAQ constraints never leak into one another

### Claude's Discretion
- Exact response payload field names for representing artifact-specific list entries, as long as clients can distinguish the three Touch 4 entries cleanly
- Exact validation error wording for missing `artifactType` requests
- Exact implementation strategy for artifact-qualified hashing and deck-structure row creation timing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DECK-01 | AI inference engine filters Touch 4 examples by artifact type, producing 3 separate deck structures | Add `(touchType, artifactType)`-aware inference inputs, artifact-qualified hashing, and artifact-row persistence in `apps/agent/src/deck-intelligence/infer-deck-structure.ts` |
| DECK-02 | Cron auto-inference iterates over 6 keys (Touch 1-3 + Touch 4 x3 artifact types) with per-key change detection | Replace current touch-type-only cron key loop with explicit deck keys and per-row `lastChatAt` / `dataHash` handling in `apps/agent/src/deck-intelligence/auto-infer-cron.ts` |
| DECK-05 | Chat refinement threads artifact type, allowing per-artifact-type conversation scoped to the correct structure | Thread `artifactType` through route validation, deck-structure lookup, message persistence, summarization, and web proxy helpers in `apps/agent/src/deck-intelligence/chat-refinement.ts`, `apps/agent/src/mastra/index.ts`, and `apps/web/src/lib/api-client.ts` |
</phase_requirements>

## Summary

Phase 36 is mostly a keying and contract-hardening phase, not a net-new subsystem. The project already has the schema needed for per-artifact rows (`DeckStructure.artifactType`, `Template.artifactType`, and `@@unique([touchType, artifactType])`), plus working inference, cron, and chat pipelines that currently assume a single nullable row per touch type. Planning should focus on making every backend operation resolve the correct deck-structure key first, then reuse the existing flow against that key.

The biggest implementation constraint is that Touch 4 must stop behaving like a generic touch type everywhere. Today the backend explicitly returns a placeholder for generic `touch_4`, cron excludes `touch_4`, and chat/infer/detail routes all query `artifactType: null`. Phase 36 should replace that placeholder mode with explicit artifact-aware behavior while preserving the existing route family shape and nullable-row handling for non-Touch-4 requests.

**Primary recommendation:** Introduce one shared backend resolver for `DeckStructureKey = { touchType, artifactType }`, use it across inference, cron, chat, and API routes, and keep non-Touch-4 behavior on `artifactType = null`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | `^6.3.1` | Read/write `Template`, `DeckStructure`, and `DeckChatMessage` rows | Existing persistence layer; all current deck-intelligence code already uses it |
| Mastra server APIs | `@mastra/core ^1.8.0`, `mastra ^1.3.5` | Register agent routes and stream chat responses | Existing API surface lives in `registerApiRoute(...)`; Phase 36 should extend, not replace it |
| Google GenAI | `@google/genai ^1.43.0` | Structured inference and chat summarization | Current inference/chat implementation is already built on `GoogleGenAI` |
| Zod | `^4.3.6` | Request validation for route params/body/query | Already used in API routes; best fit for missing-`artifactType` validation errors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@lumenalta/schemas` | workspace | Shared `ARTIFACT_TYPES`, labels, and touch constants | Use for canonical artifact order, labels, and query validation |
| Next.js | `^15.5.12` | Web proxy routes and server actions | Use for threading `artifactType` from web to agent without inventing a new transport |
| Vitest | `^4.0.18` | Agent and web contract tests | Use for pure-function tests and route-contract simulations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keep `:touchType` + `?artifactType=` | Separate `/deck-structures/touch-4/:artifactType/...` routes | Clearer URLs, but conflicts with locked API decision and creates a new route family |
| `findFirst` + `update/create` for nullable rows | `upsert` on compound key | Not reliable for this codebase's nullable-key pattern; current repo already standardizes on `findFirst` semantics |
| Reuse generic Touch 4 row | One row per artifact | Generic row is explicitly deferred/blocked; separate rows are required for DECK-01/02/05 |

**Installation:**
```bash
pnpm --filter agent exec vitest
pnpm --filter web exec vitest
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/agent/src/deck-intelligence/
├── infer-deck-structure.ts   # Key resolution, artifact-aware filtering, persistence
├── auto-infer-cron.ts        # Explicit deck key loop and per-key hashing
├── chat-refinement.ts        # Per-row chat history and re-inference
└── deck-structure-schema.ts  # Output schema and confidence helpers

apps/agent/src/mastra/
└── index.ts                  # Route parsing, query validation, response shaping

apps/web/src/
├── lib/api-client.ts         # Agent request builders with optional artifactType
├── lib/actions/deck-structure-actions.ts
└── app/api/deck-structures/chat/route.ts
```

### Pattern 1: Resolve a deck-structure key first
**What:** Normalize every operation to a `{ touchType, artifactType }` key before querying Prisma, hashing data, or calling inference/chat.
**When to use:** In every detail, infer, chat, cron, and list code path.
**Example:**
```typescript
// Source: apps/agent/src/mastra/index.ts:2557, apps/agent/src/deck-intelligence/chat-refinement.ts:150
type DeckStructureKey = {
  touchType: string;
  artifactType: string | null;
};

function resolveDeckStructureKey(touchType: string, artifactType?: string | null): DeckStructureKey {
  if (touchType === "touch_4") {
    if (!artifactType) throw new Error("artifactType is required for touch_4");
    return { touchType, artifactType };
  }

  return { touchType, artifactType: null };
}
```

### Pattern 2: Filter examples strictly, templates broadly
**What:** For Touch 4 inference, primary examples must match the requested artifact exactly; secondary templates can still reuse all Touch 4 templates.
**When to use:** In template selection and hash-input generation.
**Example:**
```typescript
// Source: apps/agent/src/deck-intelligence/infer-deck-structure.ts:278
const exampleWhere =
  touchType === "touch_4"
    ? { contentClassification: "example", artifactType }
    : { contentClassification: "example" };

const templateWhere =
  touchType === "touch_4"
    ? { contentClassification: "template" }
    : { contentClassification: "template" };
```

### Pattern 3: Keep nullable-row persistence semantics
**What:** Continue using `findFirst` followed by `update` or `create` because the repo already handles nullable `artifactType` rows this way.
**When to use:** Any `DeckStructure` write path, including empty-row creation.
**Example:**
```typescript
// Source: apps/agent/src/deck-intelligence/infer-deck-structure.ts:39
const existing = await prisma.deckStructure.findFirst({
  where: { touchType, artifactType },
  select: { id: true },
});

if (existing) {
  await prisma.deckStructure.update({ where: { id: existing.id }, data });
} else {
  await prisma.deckStructure.create({ data: { touchType, artifactType, ...data } });
}
```

### Pattern 4: Preserve the streaming chat transport
**What:** Keep the current stream text + delimiter + JSON payload protocol; only thread artifact scoping through it.
**When to use:** Chat route and web proxy changes.
**Example:**
```typescript
// Source: apps/agent/src/mastra/index.ts:2720, apps/web/src/components/settings/chat-bar.tsx:112
controller.enqueue(encoder.encode("\n---STRUCTURE_UPDATE---\n"));
controller.enqueue(encoder.encode(JSON.stringify({ updatedStructure, diff })));
```

### Anti-Patterns to Avoid
- **Generic Touch 4 fallback:** Do not infer or return placeholder data for `touch_4` without an artifact key.
- **Post-filtering combined inference:** Do not infer across all Touch 4 examples and then slice the result by artifact.
- **Shared Touch 4 chat state:** Do not let one artifact's `chatContextJson`, `lastChatAt`, or summarized history affect another.
- **Ad hoc artifact strings:** Do not hardcode labels/order; use shared schema constants.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact lists and labels | Custom string arrays in agent/web | `ARTIFACT_TYPES` and `ARTIFACT_TYPE_LABELS` from `@lumenalta/schemas` | Prevents order drift between API and UI |
| Nullable deck-structure upsert logic | New custom SQL or reset-style migration workaround | Existing `findFirst` + `update/create` pattern | Already established for nullable `artifactType` rows |
| Query-string handling | Manual string concatenation for `?artifactType=` | `URLSearchParams` or equivalent helper in web/client code | Avoids missing/incorrect encoding |
| Chat update transport | A second chat response format | Existing delimiter-based stream payload | Current web chat bar already parses it |
| Confidence rules | New scoring formula per artifact | Existing `calculateConfidence(exampleCount)` helper | Keeps UI semantics stable across touch types |

**Key insight:** The repo already has most of the machinery; Phase 36 should specialize the current system by key, not create a second deck-intelligence stack.

## Common Pitfalls

### Pitfall 1: Missing `artifactType` validation leaks placeholder behavior
**What goes wrong:** Touch 4 detail/infer/chat requests silently resolve `artifactType: null` and keep returning generic placeholder behavior.
**Why it happens:** Current route handlers only read `:touchType` and explicitly special-case generic Touch 4.
**How to avoid:** Validate query params at the route boundary and reject missing `artifactType` for `touch_4` before calling domain logic.
**Warning signs:** Route handlers still call `isUnsupportedGenericTouch4(touchType)` with no query parsing.

### Pitfall 2: Cron still thinks in touch types, not deck keys
**What goes wrong:** Proposal chat activity blocks FAQ refreshes, or one Touch 4 hash suppresses another.
**Why it happens:** `auto-infer-cron.ts` currently loops `touch_1`-`touch_3` only and loads one nullable row per touch type.
**How to avoid:** Build an explicit six-key loop: `touch_1`, `touch_2`, `touch_3`, `pre_call`, and `touch_4` x 3 artifacts only if pre-call truly belongs in list contract; otherwise mirror the locked `GET /deck-structures` response contract separately from cron's deck-producing key set.
**Warning signs:** `DECK_TOUCH_TYPES` is still derived by filtering `TOUCH_TYPES` rather than an explicit key list.

### Pitfall 3: Empty artifact rows are not persisted
**What goes wrong:** UI contracts become unstable because missing rows disappear instead of showing an empty artifact-specific structure.
**Why it happens:** Existing empty persistence path only writes nullable rows for non-generic keys.
**How to avoid:** Persist an empty row for `(touch_4, artifactType)` whenever matching examples are zero.
**Warning signs:** `inferDeckStructure` returns an empty output without a matching `DeckStructure.create/update` for the artifact key.

### Pitfall 4: Example/template filters drift apart from hash filters
**What goes wrong:** Cron believes nothing changed or re-infers unnecessarily because hash inputs do not match inference inputs.
**Why it happens:** `computeDataHash` currently hashes touch-type-qualified examples only, with no artifact awareness.
**How to avoid:** Use the same artifact-qualified selection rules in both `computeDataHash` and `inferDeckStructure`.
**Warning signs:** Hash code and inference code have separate filtering branches with different artifact logic.

### Pitfall 5: Web helpers stay touch-type only
**What goes wrong:** Backend supports artifact scoping, but web calls cannot request it, blocking Phase 37.
**Why it happens:** `api-client.ts`, server actions, and chat proxy only accept `touchType` today.
**How to avoid:** Add optional `artifactType` parameters now, even if Phase 37 is the first UI to use them broadly.
**Warning signs:** `getDeckStructure`, `triggerDeckInference`, and chat proxy signatures still only accept `touchType`.

## Code Examples

Verified patterns from current repo sources:

### Artifact-aware deck-structure lookup
```typescript
// Source: apps/agent/src/deck-intelligence/chat-refinement.ts:150
const existing = await prisma.deckStructure.findFirst({
  where: {
    touchType,
    artifactType,
  },
  include: {
    chatMessages: {
      orderBy: { createdAt: "asc" },
    },
  },
});
```

### Route-level query validation
```typescript
// Source: apps/agent/src/mastra/index.ts:2557, adapted to Phase 36 contract
const query = z.object({ artifactType: z.enum(ARTIFACT_TYPES).optional() }).parse(c.req.query());
const artifactType = touchType === "touch_4" ? query.artifactType ?? null : null;

if (touchType === "touch_4" && artifactType === null) {
  return c.json({ error: "artifactType is required for touch_4" }, 400);
}
```

### Web client query threading
```typescript
// Source: apps/web/src/lib/api-client.ts:952
export async function getDeckStructure(touchType: string, artifactType?: string) {
  const qs = new URLSearchParams();
  if (artifactType) qs.set("artifactType", artifactType);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return fetchJSON(`/deck-structures/${encodeURIComponent(touchType)}${suffix}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic `touch_4` placeholder row | Artifact-specific `touch_4` rows keyed by `artifactType` | v1.6 / Phase 36 | Enables independent inference, cron, and chat behavior |
| Touch-type-only cron loop | Explicit deck-structure key loop | v1.6 / Phase 36 | Prevents cross-artifact hash/chat interference |
| Touch-type-only web fetch helpers | Optional artifact-qualified fetch helpers | v1.6 / Phase 36 | Lets Phase 37 UI call the right backend contract |

**Deprecated/outdated:**
- `GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE` as the main Touch 4 runtime path: keep only as a guard for invalid generic requests, not as normal behavior.
- `where: { touchType, artifactType: null }` for every deck-intelligence query: only valid for non-Touch-4 requests after this phase.

## Open Questions

1. **What exact response fields should distinguish the three Touch 4 list entries?**
   - What we know: The client must receive six logical entries and distinguish Proposal, Talk Track, and FAQ cleanly.
   - What's unclear: Whether summaries/details should expose `artifactType`, `artifactLabel`, or a composite display field.
   - Recommendation: Include `artifactType` on summary/detail payloads and let UI derive labels from shared constants.

2. **Should empty artifact rows be created only during inference or also on read?**
   - What we know: Empty artifact-specific rows must exist once the backend operates on that key.
   - What's unclear: Whether list/detail routes should create missing empty rows lazily.
   - Recommendation: Create/update rows inside inference and chat-triggered re-inference only; keep reads side-effect free and synthesize placeholders only if a row truly has not been inferred yet.

3. **How much route-contract test coverage should Phase 36 add?**
   - What we know: There is no existing deck-structure route test file, but Vitest route-contract simulation is an established pattern.
   - What's unclear: Whether to test route handlers indirectly or extract shared helper functions first.
   - Recommendation: Extract small pure helpers (`resolveDeckStructureKey`, query builder, key list builder) and test those directly, plus one simulated route-contract test for missing-`artifactType` rejection.

## Sources

### Primary (HIGH confidence)
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` - current inference inputs, empty persistence, and generic Touch 4 guard
- `apps/agent/src/deck-intelligence/auto-infer-cron.ts` - current cron key loop, hashing, and active-chat protection
- `apps/agent/src/deck-intelligence/chat-refinement.ts` - current chat lookup, re-inference, and summarization flow
- `apps/agent/src/mastra/index.ts` - existing deck-structure list/detail/infer/chat route contracts
- `apps/agent/prisma/schema.prisma` - `Template.artifactType`, `DeckStructure.artifactType`, and compound uniqueness
- `packages/schemas/constants.ts` - canonical artifact constants and labels
- `apps/web/src/lib/api-client.ts` - current web request signatures for deck-structure APIs
- `apps/web/src/app/api/deck-structures/chat/route.ts` - current streaming proxy shape
- `.planning/milestones/v1.6-phases/36-backend-engine-api-routes/36-CONTEXT.md` - locked implementation decisions and integration targets
- `.planning/REQUIREMENTS.md` - DECK-01, DECK-02, DECK-05 scope

### Secondary (MEDIUM confidence)
- `apps/web/src/components/settings/deck-structure-view.tsx` - current assumptions about one entry per touch type in the settings UI
- `apps/web/src/components/settings/touch-type-detail-view.tsx` - current detail/chat expectations that Phase 37 will build on
- `apps/agent/src/mastra/__tests__/token-store-route.test.ts` - established pattern for simulated route-contract testing in agent

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and libraries come directly from workspace `package.json` files and active source files
- Architecture: HIGH - required changes are strongly constrained by current repo structure and locked Phase 36 decisions
- Pitfalls: HIGH - all listed pitfalls are visible in the current implementation gaps between Phase 35 placeholder behavior and Phase 36 requirements

**Research date:** 2026-03-07
**Valid until:** 2026-04-06
