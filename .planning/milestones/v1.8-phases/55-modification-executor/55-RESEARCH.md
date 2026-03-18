# Phase 55: Modification Executor - Research

**Researched:** 2026-03-09
**Domain:** Google Slides API element-scoped text replacement via batchUpdate
**Confidence:** HIGH

## Summary

Phase 55 implements the execution layer for modification plans produced by Phase 53's Modification Planner. The core challenge is surgically replacing text content in specific elements within specific slides of an assembled Google Slides presentation, without causing cross-slide contamination or breaking presentation structure.

The project already has extensive Google Slides API patterns established in `deck-assembly.ts` (pageObjectIds-scoped replaceAllText, re-read after batchUpdate, per-slide error handling) and `deck-customizer.ts` (replaceAllText for branding). Phase 55 differs fundamentally: instead of template placeholder replacement via `replaceAllText`, it must use element-targeted `deleteText` + `insertText` operations, scoped to individual shape objectIds. This is because element maps provide specific element-level modifications (not template tag matches).

**Primary recommendation:** Build a `modification-executor.ts` in `apps/agent/src/generation/` that iterates slides sequentially, groups all element modifications for a single slide into one `batchUpdate` call (deleteText ALL + insertText per element), re-reads the presentation after each slide's batch, and wraps each slide in try/catch to skip failures gracefully.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-6.1 | Execute modifications per slide via `presentations.batchUpdate` with element-scoped text operations | deleteText + insertText pattern with shape objectId scoping; existing `getSlidesClient()` and batchUpdate patterns in deck-assembly.ts |
| FR-6.2 | Scope all text operations to specific `pageObjectIds` to prevent cross-slide contamination | deleteText/insertText use element `objectId` directly (not slide pageObjectId), which inherently scopes to one element; no global replaceAllText needed |
| FR-6.3 | Re-read presentation after each slide's modifications to handle objectId drift | Existing pattern in deck-assembly.ts line 275: `presentation = await slides.presentations.get({ presentationId })` after batchUpdate |
| FR-6.4 | Handle modification failures gracefully -- skip failed elements, log warnings, continue with remaining slides | Per-slide try/catch pattern from deck-assembly.ts lines 154-270; extend to per-element error handling within each slide |
| NFR-7 | Element-map modifications scoped to pageObjectIds -- no global replaceAllText | deleteText/insertText target individual element objectIds; this is stricter than pageObjectIds scoping and fully satisfies the requirement |
| NFR-8 | Re-read presentation after any batchUpdate to handle objectId drift | Sequential slide processing with presentations.get() between each slide's batchUpdate |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | existing | Google Slides API client (`slides.presentations.batchUpdate`, `slides.presentations.get`) | Already used project-wide; NFR-1 prohibits new deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | existing | `ModificationPlan` type (from modification-plan-schema.ts) | Type input to executor |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| deleteText+insertText | replaceAllText with pageObjectIds | replaceAllText requires matching text content (fragile); deleteText+insertText is authoritative |
| Sequential slide processing | Parallel Promise.all per slide | Sequential is required by NFR-8 (re-read between slides); parallel would use stale objectIds |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/generation/
  modification-executor.ts    # NEW: Phase 55
  modification-planner.ts     # Phase 53 (upstream input)
  modification-plan-schema.ts # ModificationPlan type
  types.ts                    # MultiSourcePlan, SecondarySource
  blueprint-resolver.ts       # Phase 51
```

### Pattern 1: deleteText ALL + insertText per Element
**What:** Replace all text in a shape element by first deleting everything, then inserting new content at index 0.
**When to use:** Every element modification from the ModificationPlan.
**Example:**
```typescript
// Source: https://developers.google.com/workspace/slides/api/guides/styling
// For each modification in the plan, generate a pair of requests:
const requests: slides_v1.Schema$Request[] = [];
for (const mod of plan.modifications) {
  // 1. Delete ALL existing text in the element
  requests.push({
    deleteText: {
      objectId: mod.elementId,  // Shape/text element objectId
      textRange: { type: "ALL" },
    },
  });
  // 2. Insert new content at position 0
  requests.push({
    insertText: {
      objectId: mod.elementId,
      insertionIndex: 0,
      text: mod.newContent,
    },
  });
}
// Execute as single atomic batchUpdate
await slides.presentations.batchUpdate({
  presentationId,
  requestBody: { requests },
});
```

### Pattern 2: Sequential Slide Processing with Re-read
**What:** Process one slide at a time, re-reading presentation state between slides.
**When to use:** Always (NFR-8 mandates this).
**Example:**
```typescript
// Source: deck-assembly.ts line 275 pattern
for (const slidePlan of modificationPlans) {
  try {
    // Build deleteText+insertText requests for this slide
    const requests = buildSlideRequests(slidePlan);
    if (requests.length === 0) continue;

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });

    // CRITICAL: re-read after each slide's modifications (NFR-8)
    await slides.presentations.get({ presentationId });

    results.push({ slideId: slidePlan.slideId, status: "success" });
  } catch (err) {
    // FR-6.4: skip failed slides, log warning, continue
    console.warn(`[modification-executor] Slide ${slidePlan.slideId} failed: ${err}`);
    results.push({ slideId: slidePlan.slideId, status: "skipped", error: String(err) });
  }
}
```

### Pattern 3: Element-Level Verification Before Modification
**What:** Before executing modifications, re-read the slide's current elements and verify element objectIds still exist. Skip any modifications targeting elements that have drifted.
**When to use:** After re-reading presentation state.
**Example:**
```typescript
// After re-read, extract current element IDs from the target slide
const currentPresentation = await slides.presentations.get({ presentationId });
const targetSlide = currentPresentation.data.slides?.find(
  s => s.objectId === slidePlan.slideObjectId
);
if (!targetSlide) {
  console.warn(`Slide ${slidePlan.slideObjectId} no longer exists, skipping`);
  continue;
}
const currentElementIds = new Set(
  (targetSlide.pageElements ?? []).map(el => el.objectId).filter(Boolean)
);
// Filter modifications to only target elements that still exist
const validMods = slidePlan.modifications.filter(mod =>
  currentElementIds.has(mod.elementId)
);
```

### Anti-Patterns to Avoid
- **Global replaceAllText without pageObjectIds:** This modifies ALL slides containing the matching text -- direct violation of NFR-7.
- **Parallel slide processing:** Processing slides in parallel means the re-read after one slide's batchUpdate won't reflect changes from concurrent batches. Sequential only.
- **Hardcoded objectIds:** Always read objectIds from `presentations.get()` response, never hardcode them.
- **Not handling empty modifications:** If a slide's ModificationPlan has zero modifications, skip the batchUpdate call entirely (avoids empty request error).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slides API client | Custom HTTP client | `getSlidesClient()` from `google-auth.ts` | Auth handling, token refresh already solved |
| Modification plan structure | Custom schema | `ModificationPlan` from `modification-plan-schema.ts` | Phase 53 already produces this exact type |
| Per-slide error handling pattern | New error handling | Copy pattern from `deck-assembly.ts` lines 154-270 | Proven in production, handles edge cases |
| Text extraction from elements | Custom parser | `extractElements()` from `extract-elements.ts` | Already handles shapes, tables, groups, text runs |

## Common Pitfalls

### Pitfall 1: deleteText on Empty Elements
**What goes wrong:** Calling `deleteText` with `textRange: { type: "ALL" }` on an element with no text content causes a 400 error from the Slides API.
**Why it happens:** The ModificationPlan may include elements whose text was already removed by a prior operation, or the element may have been emptied during assembly.
**How to avoid:** Before generating deleteText requests, verify the element has text content by checking the re-read presentation data, or wrap in try/catch at the request level.
**Warning signs:** 400 errors from batchUpdate mentioning "Invalid text range."

### Pitfall 2: Text Style Loss After deleteText + insertText
**What goes wrong:** Deleting all text removes ALL formatting (font size, color, bold, etc.). The inserted text gets default formatting, not the original element's styling.
**Why it happens:** Google Slides text runs carry their own styling. `deleteText ALL` removes the runs and their styles. `insertText` creates a new run with inherited or default style.
**How to avoid:** For Phase 55 v1, accept this limitation -- the content accuracy is more important than exact formatting preservation. If formatting is critical in future, use `updateTextStyle` requests after insertion to re-apply styling.
**Warning signs:** Modified slides look visually different from originals (font changes, color changes).

### Pitfall 3: ObjectId Drift After Multi-Slide Batch
**What goes wrong:** If you modify multiple slides in a single batchUpdate, the response may not reflect intermediate objectId changes, and subsequent operations reference stale IDs.
**Why it happens:** While batchUpdate is atomic, complex operations (especially involving duplicateObject or deleteObject) can cause the API to reassign internal IDs.
**How to avoid:** Process one slide per batchUpdate call, re-read after each (NFR-8 requirement).
**Warning signs:** "Object not found" errors on subsequent batchUpdate calls.

### Pitfall 4: Rate Limiting for Large Decks
**What goes wrong:** A 12-slide deck with re-reads generates ~24 API calls (12 batchUpdates + 12 presentations.get). At peak this could approach the 60 req/min per-user limit (NFR-3).
**Why it happens:** Sequential processing with re-reads doubles the API call count.
**How to avoid:** For typical 12-slide decks this is well within limits (24 < 60). For larger decks, add a small delay (500ms) between slides only if approaching the limit.
**Warning signs:** 429 Too Many Requests responses.

### Pitfall 5: Newline Handling in insertText
**What goes wrong:** Google Slides text elements have specific newline semantics. The last character of every text box is always a trailing `\n` that cannot be deleted. Inserting text that ends with `\n` may create an extra blank line.
**Why it happens:** Slides API treats text elements as containing at least one paragraph ending with `\n`.
**How to avoid:** Trim trailing newlines from `newContent` before insertion, as the mandatory trailing `\n` will be added automatically by Slides.
**Warning signs:** Extra blank lines at the end of modified text boxes.

## Code Examples

### Complete Modification Executor Pattern
```typescript
// Source: Synthesized from deck-assembly.ts patterns + Slides API docs
import type { ModificationPlan } from "./modification-plan-schema";
import { getSlidesClient } from "../lib/google-auth";
import type { slides_v1 } from "googleapis";

interface ExecuteModificationsParams {
  presentationId: string;
  plans: ModificationPlan[];
}

interface SlideModificationResult {
  slideId: string;
  slideObjectId: string;
  status: "success" | "skipped" | "no_modifications";
  modificationsApplied: number;
  error?: string;
}

interface ExecuteModificationsResult {
  results: SlideModificationResult[];
  totalApplied: number;
  totalSkipped: number;
}

export async function executeModifications(
  params: ExecuteModificationsParams,
): Promise<ExecuteModificationsResult> {
  const slides = getSlidesClient();
  const { presentationId, plans } = params;
  const results: SlideModificationResult[] = [];

  for (const plan of plans) {
    // Skip slides with no modifications
    if (plan.modifications.length === 0) {
      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "no_modifications",
        modificationsApplied: 0,
      });
      continue;
    }

    try {
      // Re-read presentation to get current element state
      const presentation = await slides.presentations.get({ presentationId });
      const targetSlide = presentation.data.slides?.find(
        (s) => s.objectId === plan.slideObjectId,
      );

      if (!targetSlide) {
        results.push({
          slideId: plan.slideId,
          slideObjectId: plan.slideObjectId,
          status: "skipped",
          modificationsApplied: 0,
          error: `Slide objectId ${plan.slideObjectId} not found in presentation`,
        });
        continue;
      }

      // Verify which elements still exist
      const currentElementIds = new Set(
        (targetSlide.pageElements ?? [])
          .map((el) => el.objectId)
          .filter(Boolean),
      );

      // Build requests for valid modifications only
      const requests: slides_v1.Schema$Request[] = [];
      let appliedCount = 0;

      for (const mod of plan.modifications) {
        if (!currentElementIds.has(mod.elementId)) {
          console.warn(
            `[modification-executor] Element ${mod.elementId} not found, skipping`,
          );
          continue;
        }

        requests.push(
          {
            deleteText: {
              objectId: mod.elementId,
              textRange: { type: "ALL" },
            },
          },
          {
            insertText: {
              objectId: mod.elementId,
              insertionIndex: 0,
              text: mod.newContent.replace(/\n$/, ""), // Trim trailing newline
            },
          },
        );
        appliedCount++;
      }

      if (requests.length > 0) {
        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });
      }

      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "success",
        modificationsApplied: appliedCount,
      });
    } catch (err) {
      console.warn(
        `[modification-executor] Slide ${plan.slideId} failed:`,
        err instanceof Error ? err.message : err,
      );
      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "skipped",
        modificationsApplied: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    results,
    totalApplied: results.reduce((sum, r) => sum + r.modificationsApplied, 0),
    totalSkipped: results.filter((r) => r.status === "skipped").length,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `replaceAllText` global | Element-scoped `deleteText + insertText` | Phase 55 (now) | Prevents cross-slide contamination, enables surgical modifications |
| Single batchUpdate for all slides | Per-slide batchUpdate with re-read | Phase 55 (now) | Handles objectId drift, enables per-slide error isolation |
| `deck-customizer.ts` placeholder injection | Element-map-guided surgical modifications | Phase 53-55 | Content-aware modifications instead of generic placeholder fill |

**Deprecated/outdated:**
- `replaceAllText` without `pageObjectIds`: Still used in `deck-customizer.ts` for branding (acceptable for template placeholders), but MUST NOT be used for element-map modifications.

## Open Questions

1. **Text formatting preservation**
   - What we know: `deleteText ALL` strips all formatting; `insertText` inherits default or shape-level style.
   - What's unclear: Whether the original text styling (font size, color, bold from SlideElement records) needs to be re-applied via `updateTextStyle` requests.
   - Recommendation: Accept formatting loss in v1. The modification planner (Phase 53) only modifies deal-specific text (company names, industry references), which typically use consistent styling. Add `updateTextStyle` in a future iteration if formatting issues arise in testing.

2. **Multi-paragraph element handling**
   - What we know: Some text elements contain multiple paragraphs separated by `\n`. `deleteText ALL` removes everything including paragraph breaks.
   - What's unclear: Whether `newContent` from the LLM planner preserves paragraph structure with `\n` characters.
   - Recommendation: Trust the LLM output -- the modification planner prompt instructs content to be same length or shorter. The `insertText` call will handle `\n` as paragraph breaks naturally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run apps/agent/src/generation/modification-executor.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FR-6.1 | Builds correct deleteText+insertText request pairs per element | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "builds request pairs"` | No -- Wave 0 |
| FR-6.2 | All requests target element objectIds, no global replaceAllText | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "scoped to element"` | No -- Wave 0 |
| FR-6.3 | Re-reads presentation between slides | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "re-reads presentation"` | No -- Wave 0 |
| FR-6.4 | Failed slides are skipped with warnings, remaining continue | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "skips failed slides"` | No -- Wave 0 |
| NFR-7 | No replaceAllText in entire module | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "no replaceAllText"` | No -- Wave 0 |
| NFR-8 | presentations.get called after each slide batchUpdate | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "re-reads after batch"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run apps/agent/src/generation/modification-executor.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/generation/modification-executor.test.ts` -- covers FR-6.1 through FR-6.4, NFR-7, NFR-8
- [ ] vitest config: verify `vitest.config.ts` or `vite.config.ts` exists at agent root, or add inline config
- [ ] Mock for `getSlidesClient()` -- mock `presentations.get` and `presentations.batchUpdate` responses

## Sources

### Primary (HIGH confidence)
- [Google Slides API - Editing and Styling Text](https://developers.google.com/workspace/slides/api/guides/styling) - deleteText/insertText patterns, textRange types, atomicity in batchUpdate
- [Google Slides API - Batch Requests](https://developers.google.com/workspace/slides/api/guides/batch) - atomicity guarantee, request counting toward quota
- Codebase: `apps/agent/src/lib/deck-assembly.ts` - established re-read pattern, pageObjectIds scoping, per-slide error handling
- Codebase: `apps/agent/src/generation/modification-planner.ts` - upstream ModificationPlan producer
- Codebase: `apps/agent/src/generation/modification-plan-schema.ts` - ModificationPlan type definition
- Codebase: `apps/agent/src/spike/slides-spike.ts` - proven insertText pattern with dynamic objectIds

### Secondary (MEDIUM confidence)
- [Google Slides API - Basic Writing](https://developers.google.com/workspace/slides/api/samples/writing) - text replacement examples

### Tertiary (LOW confidence)
- Training data: newline handling in text elements (trailing `\n` behavior) -- verified partially by spike but not documented officially for deleteText+insertText flow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - googleapis already used extensively in project, no new deps needed
- Architecture: HIGH - patterns directly derived from existing deck-assembly.ts and official API docs
- Pitfalls: HIGH - most identified from actual codebase experience (deck-assembly.ts comments) and API documentation

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- Google Slides API v1 is mature and rarely changes)
