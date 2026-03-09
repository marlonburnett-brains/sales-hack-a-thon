# Phase 52: Multi-Source Slide Assembler - Research

**Researched:** 2026-03-09
**Domain:** Google Slides API / Google Drive API -- multi-presentation assembly
**Confidence:** HIGH

## Summary

Phase 52 implements the core multi-source slide assembly engine: given a `SlideSelectionPlan` (slideId + source presentationId pairs from multiple templates), produce a single Google Slides presentation preserving original designs. The critical constraint is that the **Google Slides API has no native cross-presentation slide copy** -- there is no `importSlides` or `copySlide(from, to)` endpoint. Google Issue Tracker #167977584 confirms this is an open feature request with no timeline.

The project already uses a "copy-and-prune" pattern in `deck-customizer.ts::assembleDeckFromSlides()` for single-source assembly. Phase 52 extends this to multi-source by: (1) copying the primary source presentation via `drive.files.copy()`, (2) pruning unneeded slides, (3) for each secondary source, copying that presentation, pruning to needed slides, then extracting content. The `MultiSourcePlan` and `SecondarySource` types from Phase 50 (`apps/agent/src/generation/types.ts`) already define the data contract.

**Primary recommendation:** Use the "primary copy-and-prune + secondary copy-and-prune" strategy. For secondary sources, copy the entire source via Drive API, prune to needed slides, then merge into the target using the same copy-and-prune approach. Since cross-presentation slide copying is impossible via the Slides API, secondary slides must be handled via a content-injection fallback (read slide elements from secondary copy, create blank slides in target, inject content) OR by accepting that secondary source slides will lose some design fidelity. The pragmatic approach: copy each secondary source presentation, prune it, then merge by reading page elements and recreating them in the target -- accepting that complex shapes/custom icons may not transfer perfectly.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-4.1 | Group selected slides by source presentationId | Use `SlideSelectionPlan.selections` array, group by `sourcePresentationId` field. Straightforward Map/Record grouping. |
| FR-4.2 | Identify primary source (most slides) and use as base via `drive.files.copy()` | Existing `drive.files.copy()` pattern in `deck-customizer.ts` lines 178-186. Primary = group with largest count. |
| FR-4.3 | Delete unneeded slides from the base copy (reuse copy-and-prune) | Existing `deleteObject` batchUpdate pattern in `deck-customizer.ts` lines 213-224. |
| FR-4.4 | For secondary source slides: copy, extract, merge into target | **Critical path**: No native cross-presentation copy. Must copy secondary source, read its elements via `presentations.get`, then recreate in target via `createSlide` + element injection. |
| FR-4.5 | Reorder all slides via `updateSlidesPosition` | Existing pattern in `deck-customizer.ts` lines 229-252. Note: slideObjectIds must be in existing presentation order. |
| FR-4.6 | Clean up all temporary copies in `finally` blocks | Existing `drive.files.delete` + try/finally pattern in `deck-assembly.ts` lines 175-187. |
| FR-4.7 | Share assembled presentation with org via existing `shareWithOrg` | Direct reuse of `drive-folders.ts::shareWithOrg()`. |
| FR-4.8 | Handle single-source case efficiently (skip multi-source logic) | Early return when grouping yields exactly 1 source presentationId. Delegate to existing `assembleDeckFromSlides()`. |
| FR-4.9 | Save assembled presentation to deal's Google Drive folder | Existing `drive.files.copy()` with `parents: [targetFolderId]` pattern. |
| NFR-3 | Google Slides API calls stay within 60 req/min user-level rate limit | Write requests: 60/min/user. For a 12-slide deck from 3 sources: ~15-20 API calls. Well within limits. See rate limit analysis below. |
| NFR-6 | Temporary Drive copies cleaned up in `finally` blocks | All temp copies tracked in array, deleted in `finally` block regardless of success/failure. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | existing | Google Slides API v1 + Drive API v3 | Already in project, provides typed clients via `google.slides()` and `google.drive()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | workspace | Generation pipeline types (SlideSelectionPlan, etc.) | Import shared types for assembler input |
| apps/agent generation/types | local | MultiSourcePlan, SecondarySource | Agent-specific assembly plan types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Copy-and-prune | Apps Script appendSlides | Better fidelity but requires Apps Script deployment, adds infrastructure complexity, known performance issues (Google Issue #167014939) |
| Element reconstruction | Template-based content injection | Loses all original design; only preserves text content |

**Installation:** No new dependencies needed (NFR-1).

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
├── generation/
│   ├── types.ts              # MultiSourcePlan, SecondarySource (exists)
│   └── multi-source-assembler.ts  # NEW: core assembler module
├── lib/
│   ├── deck-customizer.ts    # Existing: assembleDeckFromSlides (reuse for single-source)
│   ├── drive-folders.ts      # Existing: shareWithOrg, getOrCreateDealFolder
│   └── google-auth.ts        # Existing: getDriveClient, getSlidesClient
```

### Pattern 1: Primary Copy-and-Prune
**What:** Copy the primary source presentation (most slides selected), then delete unneeded slides.
**When to use:** Always -- this is the base of every assembly operation.
**Example:**
```typescript
// Source: deck-customizer.ts (existing pattern)
const copy = await drive.files.copy({
  fileId: primarySource.presentationId,
  requestBody: {
    name: deckName,
    parents: [targetFolderId],
  },
  supportsAllDrives: true,
});
const presentationId = copy.data.id!;

// Read slides, identify deletions
const presentation = await slides.presentations.get({ presentationId });
const allSlides = presentation.data.slides ?? [];
const keepSet = new Set(primarySource.keepSlideIds);
const deleteIds = allSlides
  .filter(s => !keepSet.has(s.objectId!))
  .map(s => s.objectId!);

// Delete in one batchUpdate
await slides.presentations.batchUpdate({
  presentationId,
  requestBody: {
    requests: deleteIds.map(objectId => ({ deleteObject: { objectId } })),
  },
});
```

### Pattern 2: Secondary Source Slide Injection (Copy-Prune-Merge)
**What:** For each secondary source, copy the full presentation, prune to needed slides only, then extract those slides' content and inject into the target. Since cross-presentation slide copy is impossible, this uses a two-step approach: (1) create a temporary copy of the secondary source, (2) use the Slides API to read page elements from the temp copy, (3) create new slides in the target and inject content.
**When to use:** When slides come from sources other than the primary.
**Critical limitation:** The Google Slides API cannot perfectly reconstruct complex slide designs (custom shapes, icons, grouped elements). Text content and basic shapes transfer well; complex visual designs may have fidelity loss.
**Example:**
```typescript
// For each secondary source
for (const secondary of secondarySources) {
  let tempCopyId: string | null = null;
  try {
    // Copy the secondary source presentation
    const tempCopy = await drive.files.copy({
      fileId: secondary.presentationId,
      requestBody: { name: `_temp_secondary_${Date.now()}` },
      supportsAllDrives: true,
    });
    tempCopyId = tempCopy.data.id!;

    // Read the temp copy to get slide content
    const tempPresentation = await slides.presentations.get({
      presentationId: tempCopyId,
    });

    // For each needed slide from this secondary source
    for (const slideId of secondary.slideIds) {
      const sourceSlide = tempPresentation.data.slides?.find(
        s => s.objectId === slideId
      );
      if (!sourceSlide) continue;

      // Create a blank slide in the target
      // Then inject text content from source elements
      // (See Code Examples section for full implementation)
    }
  } finally {
    // Always clean up temp copy
    if (tempCopyId) {
      try {
        await drive.files.delete({ fileId: tempCopyId, supportsAllDrives: true });
      } catch { /* ignore cleanup errors */ }
    }
  }
}
```

### Pattern 3: Slide Reordering
**What:** After all slides are in the target, reorder to match `finalSlideOrder`.
**When to use:** After primary prune + secondary injection.
**Important:** `slideObjectIds` must be provided in their *current* presentation order. Re-read the presentation after mutations before reordering.
**Example:**
```typescript
// Re-read to get current state
const final = await slides.presentations.get({ presentationId: targetId });
const currentSlides = final.data.slides ?? [];

// Build current-order list matching finalSlideOrder
// updateSlidesPosition moves slides to insertionIndex
await slides.presentations.batchUpdate({
  presentationId: targetId,
  requestBody: {
    requests: [{
      updateSlidesPosition: {
        slideObjectIds: finalSlideOrder,
        insertionIndex: 0,
      },
    }],
  },
});
```

### Pattern 4: Single-Source Fast Path
**What:** When all selected slides come from one source, skip multi-source logic entirely.
**When to use:** When `groupBy(sourcePresentationId)` yields exactly 1 group.
**Example:**
```typescript
// Detect single-source case
const groups = groupSlidesBySource(selections);
if (groups.size === 1) {
  // Delegate to existing assembleDeckFromSlides
  return assembleDeckFromSlides({
    sourcePresentationId: [...groups.keys()][0],
    selectedSlideIds: [...groups.values()][0].map(s => s.slideId),
    slideOrder: finalSlideOrder,
    targetFolderId,
    deckName,
  });
}
```

### Anti-Patterns to Avoid
- **Global replaceAllText without pageObjectIds:** Causes cross-slide text contamination. Always scope to specific slide objectIds.
- **Hardcoded objectIds:** ObjectIds change after mutations. Always re-read presentation via `presentations.get` after any `batchUpdate`.
- **Not cleaning up temp copies:** Leads to Drive clutter. Always use `finally` blocks.
- **Sequential single-slide batchUpdate calls:** Wastes API quota. Batch multiple `deleteObject` requests into a single `batchUpdate` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Single-source assembly | New copy-and-prune logic | `deck-customizer.ts::assembleDeckFromSlides()` | Already tested and working in production workflows |
| Org sharing | Custom permissions logic | `drive-folders.ts::shareWithOrg()` | Handles domain-wide + owner permissions correctly |
| Drive file operations | Raw API calls | `getDriveClient()` / `getSlidesClient()` from `google-auth.ts` | Handles auth (service account + user token pool) |
| Deal folder management | Folder creation logic | `drive-folders.ts::getOrCreateDealFolder()` | Idempotent, handles naming conventions |
| Slide element text extraction | Manual JSON parsing | `extractSlideText()` pattern from `deck-assembly.ts` | Handles nested textElements correctly |

**Key insight:** The single-source path is already built. Phase 52's real work is the multi-source orchestration layer that wraps the existing single-source primitives and adds secondary source handling.

## Common Pitfalls

### Pitfall 1: ObjectId Drift After batchUpdate
**What goes wrong:** After any `batchUpdate` (delete, create, duplicate), slide objectIds may change. Using stale IDs causes 404 errors.
**Why it happens:** Google Slides API regenerates internal IDs after structural mutations.
**How to avoid:** Always re-read the presentation via `presentations.get()` after any `batchUpdate` that adds or removes slides.
**Warning signs:** `InvalidArgument` or `NotFound` errors on objectIds that existed before a mutation.

### Pitfall 2: Cross-Presentation Slide Copy is Impossible
**What goes wrong:** Attempting to use `duplicateObject` to copy a slide from presentation A to presentation B fails -- it only works within a single presentation.
**Why it happens:** Google Slides API design limitation. No `importSlides` endpoint exists (Google Issue #167977584).
**How to avoid:** Use the copy-and-prune strategy for primary source. For secondary sources, accept content injection with potential fidelity loss.
**Warning signs:** Looking for a "copy slide between presentations" API method.

### Pitfall 3: updateSlidesPosition Order Requirement
**What goes wrong:** Passing `slideObjectIds` in an order that doesn't match their current position in the presentation causes the API to reject the request.
**Why it happens:** The API requires `slideObjectIds` to be in their current presentation order, not the desired target order.
**How to avoid:** Read current slide order first, filter to desired IDs maintaining current order, then specify the `insertionIndex`.
**Warning signs:** `InvalidArgument` error on `updateSlidesPosition`.

### Pitfall 4: Rate Limit Exhaustion
**What goes wrong:** Exceeding 60 write requests/minute/user causes 429 errors.
**Why it happens:** Each `batchUpdate` counts as one write request, but processing many secondary sources sequentially can accumulate.
**How to avoid:** Batch operations (multiple `deleteObject` in one `batchUpdate`). For a typical 12-slide deck from 3 sources, expect ~15-20 API calls total (well within limits).
**Warning signs:** HTTP 429 responses from the Slides or Drive API.

### Pitfall 5: Temp Copy Accumulation in Drive
**What goes wrong:** If cleanup fails silently, temporary presentation copies accumulate in the service account's Drive.
**Why it happens:** `drive.files.delete` in `finally` block swallows errors to prevent masking the real error.
**How to avoid:** Use a tracked array of temp file IDs, delete all in `finally`. Log warnings on cleanup failures for monitoring.
**Warning signs:** Growing number of `_temp_` files in the service account's Drive.

### Pitfall 6: Design Fidelity Loss on Secondary Sources
**What goes wrong:** Slides from secondary sources may lose complex visual elements (custom shapes, icons, grouped elements, images with specific positioning).
**Why it happens:** The Slides API cannot perfectly reconstruct all element types. Text and basic shapes work; complex visuals don't.
**How to avoid:** The primary source (most slides) gets 100% fidelity via `drive.files.copy()`. Only secondary slides (minority) risk fidelity loss. Document this limitation clearly.
**Warning signs:** Visual differences between original and assembled secondary slides.

## Code Examples

### Building a MultiSourcePlan from SlideSelectionPlan
```typescript
// Source: project types (generation/types.ts + packages/schemas/generation/types.ts)
function buildMultiSourcePlan(
  selections: SlideSelectionEntry[],
  allSlidesByPresentation: Map<string, string[]>  // presentationId -> all slideIds
): MultiSourcePlan {
  // Group selections by source presentation
  const groups = new Map<string, SlideSelectionEntry[]>();
  for (const sel of selections) {
    const existing = groups.get(sel.sourcePresentationId) ?? [];
    existing.push(sel);
    groups.set(sel.sourcePresentationId, existing);
  }

  // Primary = group with most slides
  let primaryPresentationId = '';
  let maxCount = 0;
  for (const [presId, entries] of groups) {
    if (entries.length > maxCount) {
      maxCount = entries.length;
      primaryPresentationId = presId;
    }
  }

  const primaryEntries = groups.get(primaryPresentationId)!;
  const primaryKeepIds = primaryEntries.map(e => e.slideId);
  const allPrimarySlides = allSlidesByPresentation.get(primaryPresentationId) ?? [];
  const primaryDeleteIds = allPrimarySlides.filter(id => !primaryKeepIds.includes(id));

  // Secondary sources
  const secondarySources: SecondarySource[] = [];
  for (const [presId, entries] of groups) {
    if (presId === primaryPresentationId) continue;
    secondarySources.push({
      templateId: entries[0].templateId,
      presentationId: presId,
      slideIds: entries.map(e => e.slideId),
    });
  }

  // Final order from selection order
  const finalSlideOrder = selections.map(s => s.slideId);

  return {
    primarySource: {
      templateId: primaryEntries[0].templateId,
      presentationId: primaryPresentationId,
      keepSlideIds: primaryKeepIds,
      deleteSlideIds: primaryDeleteIds,
    },
    secondarySources,
    finalSlideOrder,
  };
}
```

### Cleanup Pattern for Temporary Copies
```typescript
// Source: deck-assembly.ts pattern (existing in codebase)
async function assembleWithCleanup(plan: MultiSourcePlan): Promise<AssembleDeckResult> {
  const tempFileIds: string[] = [];

  try {
    // ... assembly logic ...
    // Track every temp copy
    tempFileIds.push(tempCopyId);
    // ... more work ...
    return result;
  } finally {
    // Clean up ALL temp copies regardless of success/failure
    for (const tempId of tempFileIds) {
      try {
        await drive.files.delete({ fileId: tempId, supportsAllDrives: true });
      } catch (cleanupErr) {
        console.warn(`[multi-source-assembler] Failed to clean up temp file ${tempId}: ${cleanupErr}`);
      }
    }
  }
}
```

### Rate Limit Analysis for Typical 12-Slide Deck
```
Scenario: 12 slides from 3 sources (8 primary, 2 from source B, 2 from source C)

API Calls:
1. drive.files.copy (primary)                    = 1 write
2. presentations.get (read primary copy)         = 1 read
3. batchUpdate: delete unneeded slides           = 1 write  (batched)
4. drive.files.copy (secondary B)                = 1 write
5. presentations.get (read secondary B)          = 1 read
6. batchUpdate: create 2 slides in target        = 1 write
7. batchUpdate: inject content into 2 slides     = 2 writes (1 per slide if scoped)
8. drive.files.delete (temp B)                   = 1 write
9. drive.files.copy (secondary C)                = 1 write
10. presentations.get (read secondary C)         = 1 read
11. batchUpdate: create 2 slides in target       = 1 write
12. batchUpdate: inject content into 2 slides    = 2 writes
13. drive.files.delete (temp C)                  = 1 write
14. presentations.get (re-read for reorder)      = 1 read
15. batchUpdate: updateSlidesPosition            = 1 write
16. shareWithOrg (permissions.create)             = 1 write (Drive API, separate quota)

Total Slides API writes: ~10-12 (well under 60/min)
Total Drive API writes: ~5-6
Total reads: ~4

Conclusion: Comfortably within rate limits for typical use.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-source copy-and-prune | Multi-source copy-and-prune + content injection | Phase 52 (now) | Enables slides from multiple template presentations in one deck |
| Global replaceAllText | pageObjectIds-scoped replaceAllText | Phase 7 (deck-assembly.ts) | Prevents cross-slide text contamination |
| Public viewer sharing | Org-scoped sharing (shareWithOrg) | Previous phase | Better security, domain-restricted access |

**Deprecated/outdated:**
- `makePubliclyViewable` pattern: replaced by `shareWithOrg` in drive-folders.ts
- Direct objectId hardcoding: always read from `presentations.get` response

## Open Questions

1. **Secondary slide fidelity approach**
   - What we know: Google Slides API cannot copy slides between presentations. Text + basic shapes can be recreated; complex visuals cannot.
   - What's unclear: Whether the hybrid approach (primary copy-and-prune for majority, content injection for secondary slides) produces acceptable visual quality for real customer-facing decks.
   - Recommendation: Implement the content injection approach for secondary slides. The primary source (majority of slides) retains 100% fidelity. For secondary slides, extract text content and inject into blank slides in the target. This matches the STATE.md blocker note about needing a spike. If fidelity is unacceptable, an alternative is to create separate temp copies per secondary source and use `drive.files.copy` to produce a multi-file output that a human merges manually -- but this defeats the purpose.

2. **ObjectId mapping between source and target**
   - What we know: When you `drive.files.copy()` a presentation, objectIds are preserved in the copy. When you create new slides via `createSlide`, the API generates new objectIds.
   - What's unclear: How to maintain the `finalSlideOrder` mapping when secondary slides get new objectIds in the target.
   - Recommendation: Maintain a mapping table `{ originalSlideId -> newSlideId }` during assembly. After all slides are in the target, translate `finalSlideOrder` using this mapping, then apply `updateSlidesPosition`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `apps/agent/vitest.config.ts` |
| Quick run command | `cd apps/agent && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FR-4.1 | Group slides by source presentationId | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "groups slides" -x` | Wave 0 |
| FR-4.2 | Identify primary source (largest group) | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "primary source" -x` | Wave 0 |
| FR-4.3 | Delete unneeded slides from base copy | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "prune" -x` | Wave 0 |
| FR-4.4 | Secondary source slide injection | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "secondary" -x` | Wave 0 |
| FR-4.5 | Reorder slides to match finalSlideOrder | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "reorder" -x` | Wave 0 |
| FR-4.6 | Cleanup temp copies in finally blocks | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "cleanup" -x` | Wave 0 |
| FR-4.7 | Share with org | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "share" -x` | Wave 0 |
| FR-4.8 | Single-source fast path | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "single-source" -x` | Wave 0 |
| FR-4.9 | Save to deal folder | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "deal folder" -x` | Wave 0 |
| NFR-3 | Rate limit compliance | manual-only | Count API calls in test output; verify < 60 writes/min | N/A |
| NFR-6 | Temp copies cleaned up | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "cleanup" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -x`
- **Per wave merge:** `cd apps/agent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/generation/__tests__/multi-source-assembler.test.ts` -- covers FR-4.1 through FR-4.9, NFR-6
- [ ] Mock factories for Google Slides/Drive API clients (vi.mock pattern for `google-auth.ts`)

## Sources

### Primary (HIGH confidence)
- Google Slides API official docs - [Slide operations](https://developers.google.com/workspace/slides/api/samples/slides) - confirmed no cross-presentation copy
- Google Slides API official docs - [Usage limits](https://developers.google.com/workspace/slides/api/limits) - 60 writes/min/user, 600 reads/min/user
- Google Slides API official docs - [batchUpdate reference](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate)
- Existing codebase: `deck-customizer.ts`, `deck-assembly.ts`, `slide-assembly.ts`, `drive-folders.ts`, `generation/types.ts`

### Secondary (MEDIUM confidence)
- [Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584) - Open feature request for cross-presentation slide copy, status: unblocked but not actively developed
- [Ben Tumbleson's experiments](https://www.bentumbleson.com/experiments-with-the-google-slides-api-to-recreate-slides/) - Detailed analysis of Slides API limitations for slide recreation: custom shapes fail, text formatting issues, missing shapeType data

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing project libraries, no new dependencies
- Architecture: HIGH - extending proven copy-and-prune pattern already in production
- Pitfalls: HIGH - verified against official docs and codebase experience
- Secondary source fidelity: MEDIUM - approach is sound but untested with real presentations (matches STATE.md blocker note)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain -- Google Slides API changes infrequently)
