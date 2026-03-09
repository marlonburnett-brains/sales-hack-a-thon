---
phase: quick-19
plan: 01
subsystem: generation-pipeline
tags: [section-aware-draft, deck-structure, touch-workflows, ui]
dependency_graph:
  requires: [deck-structure-schema, deck-structure-key, pager-content-schema]
  provides: [section-aware-draft-schema, deck-structure-loader]
  affects: [touch-1-workflow, touch-2-workflow, touch-3-workflow, regenerate-stage, touch-stage-content]
tech_stack:
  added: []
  patterns: [section-aware-draft, deck-structure-loader, conditional-schema-selection]
key_files:
  created:
    - packages/schemas/llm/section-aware-draft.ts
    - apps/agent/src/lib/deck-structure-loader.ts
  modified:
    - packages/schemas/index.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/agent/src/lib/regenerate-stage.ts
    - apps/web/src/components/touch/touch-stage-content.tsx
decisions:
  - Store section-aware content directly in stageContent JSON; build backward-compatible flat draftContent for workflow schema pipeline
  - Section detection in UI via Array.isArray(data.sections) check on existing stageContent
  - Touch 2/3 section enrichment via slideId matching against DeckSection.slideIds
metrics:
  duration: 5 min
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 6
  completed: "2026-03-09T22:48:30Z"
---

# Quick Task 19: Make All Touch Workflow Draft Generation Template-Aware

Section-aware draft schema with per-section content slots, shared deck-structure loader, updated Touch 1/2/3 workflows and regeneration with DeckStructure-gated section prompts, and UI that renders per-section cards with names, purposes, and speaker notes.

## Task Summary

### Task 1: Create section-aware draft schema and deck-structure loader
- **Commit:** 4f643be
- Created `SectionDraftLlmSchema` with `sections` array of `SectionDraftEntrySchema` entries (sectionName, sectionPurpose, contentText, speakerNotes)
- Created `deck-structure-loader.ts` with `loadDeckSections()` (queries Prisma for DeckStructure by touchType) and `formatSectionsForPrompt()` (formats sections for LLM injection)
- Exported all new types from `@lumenalta/schemas` barrel

### Task 2: Update Touch 1/2/3 workflows and regeneration
- **Commit:** 2f1976d
- Touch 1 `generateDraftText` now calls `loadDeckSections("touch_1")` and uses `SectionDraftLlmSchema` with template-structure-aware prompt when sections exist; falls back to legacy `PagerContentLlmSchema` otherwise
- Touch 2 `generateDraftOrder` enriches slideNotes by matching slideIds against DeckStructure section slideIds for richer section-tagged notes
- Touch 3 `generateDraftOrder` applies same section enrichment pattern as Touch 2
- `regenerateStage` lowfi branch uses section-aware prompt with `SectionDraftLlmSchema` when DeckStructure available
- Touch 4 workflow left untouched (already has its own rich section-aware pipeline)

### Task 3: Update UI to display section-aware draft content
- **Commit:** 9419e20
- Touch 1 lowfi detects `sections` array and renders per-section cards with section name heading, purpose badge, content text body, and speaker notes in muted collapsible style
- Touch 2/3 lowfi detects notes starting with "Section:" and splits to show section name in badge with remaining description text
- All legacy rendering paths preserved unchanged for backward compatibility

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Section-aware stageContent storage:** Store the full `SectionDraftLlmSchema` result directly in `stageContent` JSON column. The workflow `outputSchema` still passes `draftContent: PagerContentLlmSchema` for backward compatibility with downstream steps (assembly). The UI reads `stageContent` which has the richer section data.

2. **Backward-compatible flat draftContent:** When section-aware path is used, a flat `PagerContentLlmSchema` is synthesized from section data (combining all contentText for valueProposition, extracting capability sections) so the assembly step can still use text replacements.

3. **Touch 2/3 slideId matching:** Match each slideId in the skeleton's slideOrder against DeckSection.slideIds to find the owning section. This gives richer notes without requiring an LLM call.
