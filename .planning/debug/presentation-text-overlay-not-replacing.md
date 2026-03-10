---
status: awaiting_human_verify
trigger: "Presentation generation is overlaying new text on top of existing template elements instead of replacing their content. Lorem ipsum placeholder text remains visible underneath. Second slide is completely untouched."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes: (1) LLM prompt too conservative -- PRESERVE rules cover lorem ipsum placeholders, causing only 2-3/26+ elements to be modified. (2) deleteText+insertText strips formatting -- need to capture original text style and reapply after replacement.
test: Fix both issues and have user verify
expecting: All lorem ipsum replaced with deal-specific content, and text retains original formatting (font, size, color, bold/italic)
next_action: Implement fixes to modification-planner prompt and modification-executor formatting preservation

## Symptoms

expected: Agent should parse document content, identify existing text elements in Google Slides template, and REPLACE their text content while keeping slide structure intact. Unused elements should be removed.
actual: New text boxes are being created and overlaid on top of existing template elements. Original lorem ipsum placeholder text remains visible underneath new content. Second slide completely untouched.
errors: No error messages - generation "succeeds" but produces garbage output
reproduction: Generate any presentation through Touch 1: First Contact Pager flow
started: Current behavior

## Eliminated

- hypothesis: modification-executor using wrong API (createShape/insertText instead of deleteText+insertText)
  evidence: Code correctly uses deleteText { type: ALL } + insertText pattern on existing elements
  timestamp: 2026-03-09T00:15:00Z

- hypothesis: SlideElement records not populated in database
  evidence: extractElements is called during ingest-template.ts for both new and updated slides
  timestamp: 2026-03-09T00:20:00Z

- hypothesis: slideObjectId not populated in SlideEmbedding DB records
  evidence: slide-extractor.ts stores slide.objectId from Google Slides API; ingest-template.ts writes it to DB
  timestamp: 2026-03-09T00:25:00Z

- hypothesis: Previous objectId translation fix was complete and working
  evidence: User reports slide 1 (primary) STILL has overlay issue - primary slides don't use translation at all since objectIds are preserved in copy. Also slides 2+ still untouched, and images now being modified.
  timestamp: 2026-03-09T02:00:00Z

## Evidence

- timestamp: 2026-03-09T00:10:00Z
  checked: modification-executor.ts buildRequests function
  found: Uses deleteText { textRange: { type: "ALL" } } + insertText pattern, which is correct
  implication: The executor logic itself is sound; the issue is upstream in objectId resolution

- timestamp: 2026-03-09T00:15:00Z
  checked: multi-source-assembler.ts buildSecondarySlideRequests
  found: Secondary slides are rebuilt from scratch using createSlide + createShape with GENERATED objectIds (via makeElementObjectId). Source element objectIds are NOT preserved.
  implication: For multi-source scenarios, DB element objectIds don't match assembled element objectIds

- timestamp: 2026-03-09T00:18:00Z
  checked: multi-source-assembler.ts assembleMultiSourceDeck
  found: slideIdMap exists internally (maps source slideObjectId -> assembled slideObjectId) but is NOT returned to caller. For secondary slides, mapping is source -> "generated-{source}"
  implication: executeStructureDrivenPipeline has no way to translate objectIds for modification plans

- timestamp: 2026-03-09T00:20:00Z
  checked: route-strategy.ts executeStructureDrivenPipeline steps 5-6
  found: Modification planning uses selection.slideObjectId (source template IDs). Execution uses plan.slideObjectId against assembled presentation. For secondary slides, these don't match.
  implication: Modifications are silently skipped for all secondary source slides

- timestamp: 2026-03-09T00:25:00Z
  checked: modification-executor.ts getSlideElementIds
  found: Only collects TOP-LEVEL pageElement objectIds; does NOT recurse into elementGroup children. But extractElements (ingestion) DOES recurse into groups.
  implication: Elements inside groups can be planned for modification but executor can't find them

- timestamp: 2026-03-09T00:30:00Z
  checked: git diff e264391..07111a4 for route-strategy.ts
  found: Recent commit fixed slideObjectId: selection.slideId -> selection.slideObjectId. Previous bug used DB ID instead of Google Slides objectId.
  implication: The slideId fix was necessary but insufficient -- element ID mapping for rebuilt slides was still missing

- timestamp: 2026-03-09T02:05:00Z
  checked: Code flow analysis for primary slide (slide 1)
  found: For single-source path, assembleDeckFromSlides copies presentation (objectIds preserved), does NOT return slideIdMap/elementIdMap. No translation needed. Modification executor should find elements directly by their source objectIds.
  implication: The overlay issue on slide 1 CANNOT be caused by objectId mismatch. Something else is wrong — either the batchUpdate is failing silently, the element IDs in DB don't match what's on the actual slide, or the modifications are being applied but to wrong elements.

- timestamp: 2026-03-09T02:10:00Z
  checked: Google Slides API batchUpdate atomicity
  found: Per Google docs, if ANY request in a batchUpdate fails, the ENTIRE batch is rolled back. No partial application.
  implication: If deleteText fails for even ONE element in a slide's batch, ALL modifications for that slide are lost. This would explain "untouched" slides if the error is caught silently.

- timestamp: 2026-03-09T02:15:00Z
  checked: Image modification path in multi-source-assembler
  found: buildImageRequests recreates images using source contentUrl for secondary slides. These URLs may be ephemeral Google-internal URLs. FIX APPLIED: Skip image recreation entirely for secondary slides.
  implication: This fixes the "images being modified" issue (problem 3)

- timestamp: 2026-03-09T02:20:00Z
  checked: Added comprehensive diagnostic logging to entire pipeline
  found: Added logging to route-strategy (step 3-6 details), modification-planner (element counts, DB lookups), modification-executor (slide/element matching, request details, error responses)
  implication: Next run will reveal exact runtime behavior for diagnosis

## Resolution

root_cause: CONFIRMED via user diagnostic logs. Two root causes:
1. **Modification planner prompt too conservative**: The PRESERVE rules listed "Case study specifics", "Capability definitions", "Process step labels" etc., which covers the vast majority of template text elements. The LLM was faithfully following instructions and only modifying 2-3 elements (company name references) out of 26-43 text elements. All lorem ipsum, success story text, stats, and descriptions were being preserved as "structural content."
2. **insertText loses formatting**: The deleteText(ALL) + insertText approach strips all text styling (font family, size, color, bold/italic). The new text renders as plain unstyled text, creating the visual "overlay" effect where unstyled text appears on top of a styled background.

fix: Changes applied:

1. **modification-planner.ts**: Rewrote LLM prompt to flip default behavior from "preserve most, modify few" to "modify most, preserve few". PRESERVE rules now only cover pure numeric labels (01, 02) and single-word structural markers. MODIFY rules now explicitly cover all descriptive text, case studies, stats, capabilities, etc. Added guidance that 80-100% of elements should be modified.
2. **modification-executor.ts**: Added formatting preservation. Before deleting text, the executor now captures the original text style (font, size, color, bold/italic) from each element's first text run. After deleteText+insertText, it applies updateTextStyle to restore the original formatting. Uses a precise fields mask to only set properties that were present in the original style.
3. **Previous session fixes** (objectId translation, group recursion, image skip) still in place.

verification: 51 generation tests pass. Awaiting user verification of a Touch 1 generation.

files_changed:
  - apps/agent/src/generation/multi-source-assembler.ts
  - apps/agent/src/generation/route-strategy.ts
  - apps/agent/src/generation/modification-executor.ts
  - apps/agent/src/generation/modification-planner.ts
  - apps/agent/src/lib/deck-customizer.ts
  - apps/agent/src/generation/__tests__/multi-source-assembler.test.ts
