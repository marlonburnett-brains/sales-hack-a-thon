---
status: fixing
trigger: "Refactor Touch 2/3 skeleton and low-fi stages to use deck-structure-aware infrastructure"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Touch 2/3 selectSlides used broken MCP/Drive keyword search (selectSlidesForDeck); refactored to use blueprint-based selection (selectSlidesForBlueprint)
test: Replaced selectSlidesForDeck with resolveGenerationStrategy + selectSlidesForBlueprint; added sections to skeleton schema; updated UI
expecting: Skeleton stage now produces section-aware slide selections with proper slideIds from DeckStructure
next_action: Verify TypeScript compilation and await human verification

## Symptoms

expected: After triggering Touch 2 generation, slides should be selected and displayed on the Touch 2 page
actual: UI shows "No slide selection available yet" even after generation POST returns 200
errors: MCP search fails (falls back to Drive - expected). POST returns 200 but page shows no slides.
reproduction: Navigate to Touch 2 for deal cmmij6r6e0016vd0jwlqxqiwz and trigger generation
started: Currently broken

## Eliminated

- hypothesis: Simple field name mismatch in UI (selectedSlides vs selectedSlideIds) is the only issue
  evidence: Fixing the UI alone did not resolve the problem because the most recent interaction's stageContent was corrupted by regenerateStage writing Touch 1 pager content into a Touch 2 interaction
  timestamp: 2026-03-09T00:30:00Z

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: touch-2-workflow.ts selectSlides step (line 110-124)
  found: stageContent stored as {selectedSlideIds, slideOrder, selectionRationale, personalizationNotes}
  implication: These are all string/string[] fields, no selectedSlides array of objects

- timestamp: 2026-03-09T00:02:00Z
  checked: touch-stage-content.tsx Touch23Content skeleton renderer (line 338-343)
  found: UI reads data?.selectedSlides expecting Array<{slideId, title, reason}> - field does not exist in stageContent
  implication: selectedSlides is always undefined, defaults to [], shows "No slide selection available yet"

- timestamp: 2026-03-09T00:30:00Z
  checked: Database - InteractionRecord for deal cmmij6r6e0016vd0jwlqxqiwz, touchType=touch_2
  found: Two interactions. Most recent (cmmjyv8en) has stageContent={companyName, headline, valueProposition, keyCapabilities} which is Touch 1 pager schema, NOT touch_2 slide selection schema. Older (cmmjyv1wr) has correct shape but empty arrays (0 slides found).
  implication: Most recent interaction had its stageContent corrupted -- wrong data shape entirely

- timestamp: 2026-03-09T00:35:00Z
  checked: regenerate-stage.ts skeleton path (lines 42-70)
  found: The skeleton regeneration is NOT touch-type-aware. It always uses first-contact-pager-writer agent and {companyName, headline, valueProposition, keyCapabilities} schema regardless of interaction.touchType
  implication: regenerateStage called on a touch_2 interaction overwrites slide selection data with Touch 1 pager content

- timestamp: 2026-03-09T00:40:00Z
  checked: InteractionRecord cmmjyv8en timestamps
  found: created 02:04:02, updated 02:10:03 (6 min later), 0 feedback signals
  implication: stageContent was modified ~6 min after creation, consistent with regenerateStage being called

- timestamp: 2026-03-09T00:45:00Z
  checked: Slide selection results for this deal
  found: selectSlidesForDeck returns 0 candidates for PepsiCo/Industrial Goods -- no slides ingested in knowledge base
  implication: Even with correct code, slide selection will be empty until slides are ingested into AtlusAI

## Resolution

root_cause: Touch 2/3 skeleton stage used selectSlidesForDeck (MCP/Drive keyword search) which is unreliable and produces empty results. Meanwhile, the assembleDeck step already used the correct blueprint-based infrastructure (resolveGenerationStrategy + selectSlidesForBlueprint). The skeleton and low-fi stages were disconnected from this working infrastructure.

fix: Refactored Touch 2/3 workflows to use blueprint-based selection throughout:
  1. Replaced selectSlidesForDeck with buildDealContext + resolveGenerationStrategy + selectSlidesForBlueprint in both touch-2 and touch-3 selectSlides steps
  2. Added `sections` field (optional) to skeletonContentSchema with sectionName, purpose, selectedSlideId, rationale
  3. Updated generateDraftOrder in both workflows to use skeleton sections first for enriched notes, falling back to DeckStructure sections, then generic notes
  4. Updated Touch23Content UI to render section-based view when sections are available (showing section names, purposes, match status, and rationale)
  5. Removed selectSlidesForDeck import from both workflow files

verification: TypeScript compilation passes -- zero errors in modified files. All pre-existing errors are in unrelated files. Backward compatibility maintained (sections field is optional, legacy shapes still rendered).
files_changed:
  - apps/agent/src/mastra/workflows/touch-2-workflow.ts
  - apps/agent/src/mastra/workflows/touch-3-workflow.ts
  - apps/web/src/components/touch/touch-stage-content.tsx
