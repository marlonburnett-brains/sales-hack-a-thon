# Phase 48: HITL Stage Revert Route - Research

**Researched:** 2026-03-08
**Domain:** Agent API route registration, Prisma InteractionRecord updates, Next.js server action wiring
**Confidence:** HIGH

## Summary

Phase 48 closes the "TOUCH-REVERT-ROUTE" integration gap identified in the v1.7 milestone audit. The web client already has the full revert flow wired: `handleStageClick` in `touch-page-client.tsx` calls `revertStageAction` (server action) which calls `revertInteractionStage` (api-client) which POSTs to `/interactions/:id/revert-stage`. The agent service, however, never registered this route -- so the call returns 404.

The fix is purely agent-side: register `POST /interactions/:id/revert-stage` using the established `registerApiRoute` pattern in `apps/agent/src/mastra/index.ts`. The route must update `InteractionRecord.hitlStage` to the target stage and clear downstream `stageContent`. No schema migration is needed -- `hitlStage` and `stageContent` fields already exist. No UI changes are needed -- the stepper, click handler, and server action are all implemented.

**Primary recommendation:** Add one `registerApiRoute` call in `index.ts` that validates the request body with zod, performs a Prisma update, and returns `{ success: true }`. Follow the exact pattern of existing `/interactions/:id/approve-assets`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOUCH-06 | Each touch follows a 3-stage HITL workflow: Skeleton > Low-fi sketch > High-fi presentation | The forward flow works (Phase 46). This phase closes the revert path so users can navigate back between stages and regenerate. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core/server | (current) | `registerApiRoute` for Hono-based route registration | All agent routes use this pattern |
| zod | (current) | Request body validation | Every existing POST route validates with zod |
| @prisma/client | 6.19.x | Database update for InteractionRecord | Project-standard ORM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner (web) | (current) | Toast notifications for revert success/error | Already wired in touch-page-client.tsx |

**Installation:** None required -- all dependencies already installed.

## Architecture Patterns

### Existing Route Registration Pattern

Every agent API route follows this exact pattern (from `apps/agent/src/mastra/index.ts`):

```typescript
registerApiRoute("/interactions/:id/revert-stage", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    try {
      const body = await c.req.json();
      const data = z.object({
        targetStage: z.enum(["skeleton", "lowfi", "highfi"]),
      }).parse(body);

      // Business logic here
      // ...

      return c.json({ success: true });
    } catch (err) {
      console.error("[revert-stage] Error:", err);
      return c.json(
        { error: "Stage revert failed", details: String(err) },
        500
      );
    }
  },
}),
```

### Downstream Content Clearing Logic

When reverting to a target stage, downstream `stageContent` must be cleared. The `stageContent` field is a JSON string storing content at the current stage. The revert logic should:

1. Set `hitlStage` to `targetStage`
2. Clear `stageContent` (set to `null`) so the UI triggers regeneration
3. Optionally reset `status` to `"generating"` or leave as-is depending on whether the user will re-trigger generation manually

Since the UI already handles "Generate Another" and the existing `handleGenerate` callback, setting `stageContent = null` is sufficient. The user clicks the completed stage in the stepper, the revert clears content, and `router.refresh()` re-renders the page showing the stage with no content, prompting regeneration.

### Stage Ordering Validation

Valid revert targets per current stage:
- From `lowfi`: can revert to `skeleton`
- From `highfi`: can revert to `skeleton` or `lowfi`
- From `ready`: can revert to `skeleton`, `lowfi`, or `highfi`
- From `skeleton`: cannot revert (first stage)

The route should validate that `targetStage` is actually earlier than the current `hitlStage`. The stage order is: `skeleton` (0) < `lowfi` (1) < `highfi` (2) < `ready` (3).

### Existing Client-Side Flow (Already Implemented)

```
User clicks completed stage pill in HitlStageStepper
  -> handleStageClick (touch-page-client.tsx:354)
    -> revertStageAction (touch-actions.ts:240)
      -> revertInteractionStage (api-client.ts:636)
        -> POST /interactions/:id/revert-stage { targetStage }
          -> [MISSING: agent route] <-- THIS IS WHAT WE ADD
```

After revert succeeds, `router.refresh()` re-fetches server data, showing the reverted stage.

### Anti-Patterns to Avoid
- **Do NOT restart the Mastra workflow** on revert. The revert is a DB-only operation. The user triggers regeneration separately via the existing generate flow.
- **Do NOT add any UI code** -- the stepper, click handler, and server action are all complete and tested.
- **Do NOT add a Prisma migration** -- `hitlStage` and `stageContent` fields already exist on `InteractionRecord`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Manual field checks | `z.object({ targetStage: z.enum([...]) }).parse(body)` | Consistent with every other route |
| Route registration | Raw Hono handler | `registerApiRoute` from `@mastra/core/server` | Project standard; handles auth, middleware |

## Common Pitfalls

### Pitfall 1: Not Validating Stage Order
**What goes wrong:** Route accepts reverting to a "later" stage (e.g., from skeleton to highfi), which makes no logical sense.
**Why it happens:** Only validating the targetStage enum without checking current stage.
**How to avoid:** Fetch current `hitlStage` from DB first, compare stage indices, reject if target >= current.
**Warning signs:** Users see empty content after "reverting" to a stage they haven't reached.

### Pitfall 2: Forgetting to Clear stageContent
**What goes wrong:** hitlStage reverts but old stageContent remains, showing stale content for the reverted stage.
**Why it happens:** Only updating `hitlStage` without nulling `stageContent`.
**How to avoid:** Always set `stageContent: null` in the same Prisma update.
**Warning signs:** After revert, user sees highfi content displayed under the skeleton stage label.

### Pitfall 3: Route Path Mismatch
**What goes wrong:** 404 persists even after adding the route.
**Why it happens:** Path in `registerApiRoute` doesn't match the path in `api-client.ts`.
**How to avoid:** The client sends to `/interactions/${interactionId}/revert-stage`. The route must be registered as `/interactions/:id/revert-stage` with method `POST`.
**Warning signs:** Network tab shows 404 on the POST request.

### Pitfall 4: Resetting Workflow State
**What goes wrong:** Reverting tries to manipulate Mastra workflow run state, causing errors or unintended side effects.
**Why it happens:** Confusing DB-level stage tracking with workflow execution state.
**How to avoid:** The revert is DB-only. Do NOT call `workflow.createRun()` or `run.resume()`. The user will trigger a new generation run if needed.

## Code Examples

### Route Implementation (Complete)

```typescript
// Source: Pattern derived from existing /interactions/:id/approve-assets route
registerApiRoute("/interactions/:id/revert-stage", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    try {
      const body = await c.req.json();
      const data = z
        .object({
          targetStage: z.enum(["skeleton", "lowfi", "highfi"]),
        })
        .parse(body);

      // Fetch current interaction to validate revert is backwards
      const interaction = await prisma.interactionRecord.findUniqueOrThrow({
        where: { id },
        select: { hitlStage: true },
      });

      const STAGE_ORDER: Record<string, number> = {
        skeleton: 0,
        lowfi: 1,
        highfi: 2,
        ready: 3,
      };

      const currentIndex = STAGE_ORDER[interaction.hitlStage ?? ""] ?? -1;
      const targetIndex = STAGE_ORDER[data.targetStage] ?? -1;

      if (targetIndex >= currentIndex) {
        return c.json(
          { error: "Can only revert to an earlier stage" },
          400
        );
      }

      // Update hitlStage and clear stageContent
      await prisma.interactionRecord.update({
        where: { id },
        data: {
          hitlStage: data.targetStage,
          stageContent: null,
        },
      });

      return c.json({ success: true });
    } catch (err) {
      console.error("[revert-stage] Error:", err);
      return c.json(
        { error: "Stage revert failed", details: String(err) },
        500
      );
    }
  },
}),
```

### Where to Place the Route

The route should be placed in the "Asset Review API" section of `apps/agent/src/mastra/index.ts`, alongside the existing `/interactions/:id/asset-review`, `/interactions/:id/approve-assets`, and `/interactions/:id/reject-assets` routes (around line 1520-1530).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No revert capability | POST /interactions/:id/revert-stage | Phase 48 | Users can navigate back in HITL stages |

## Open Questions

None. The implementation path is clear and fully constrained by existing patterns.

## Sources

### Primary (HIGH confidence)
- `apps/agent/src/mastra/index.ts` -- existing route registration patterns (lines 1357-1530 for interaction routes)
- `apps/web/src/lib/api-client.ts` -- client-side revert function (lines 630-647)
- `apps/web/src/lib/actions/touch-actions.ts` -- server action (lines 240-247)
- `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx` -- handleStageClick (lines 354-374)
- `apps/agent/prisma/schema.prisma` -- InteractionRecord model (lines 107-129)
- `.planning/v1.7-MILESTONE-AUDIT.md` -- gap identification (TOUCH-REVERT-ROUTE)
- `apps/web/src/components/touch/hitl-stage-stepper.tsx` -- stage stepper with click handlers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - exact pattern exists in 3+ adjacent routes
- Pitfalls: HIGH - derived from direct code inspection of existing flow

**Research date:** 2026-03-08
**Valid until:** Indefinite (internal project patterns, not external library versions)
