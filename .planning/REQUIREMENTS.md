# Requirements: v1.8 Structure-Driven Deck Generation

## Milestone Goal

Close the 5 gaps between the intelligence layer (DeckStructure + element maps) and the generation layer so all touches (1-4) produce visually diverse, design-preserved decks assembled from multiple source presentations using DeckStructure blueprints, context-aware slide selection, and element-map-guided surgical modifications.

## Success Criteria

- All 4 touch types route through structure-driven generation when a DeckStructure exists
- Output decks contain slides from multiple source presentations, each preserving its original design
- Per-slide modifications are planned using element maps and executed surgically
- 3-stage HITL (Skeleton/Low-fi/High-fi) maps to the new pipeline data flow
- Graceful fallback to legacy generation paths when DeckStructure is unavailable or low-confidence

---

## Functional Requirements

### FR-1: Generation Pipeline Types & Interfaces

Define shared TypeScript types for the structure-driven generation pipeline.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | `GenerationBlueprint` type: ordered list of `SectionSlot`s with touchType, artifactType, dealContext, sequenceRationale | P1 |
| FR-1.2 | `SectionSlot` type: sectionName, purpose, isOptional, candidateSlideIds[], selectedSlideId?, sourcePresentationId?, modificationPlan? | P1 |
| FR-1.3 | `SlideSelectionPlan` type: mapping of section -> chosen slideId + source presentationId + match rationale | P1 |
| FR-1.4 | `MultiSourcePlan` type: primarySource (presentationId, keepSlideIds, deleteSlideIds), secondarySources[], finalSlideOrder | P1 |
| FR-1.5 | `ModificationPlan` type: slideId, slideObjectId, modifications[] (elementId, currentContent, newContent, reason), unmodifiedElements[] | P1 |
| FR-1.6 | `DealContext` type: dealId, companyName, industry, pillars, persona, funnelStage, priorTouchSlideIds[] | P1 |

### FR-2: Blueprint Resolver

Consume DeckStructure as the generation blueprint for all touches.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Read `DeckStructure.structureJson` for a given touchType + artifactType key | P1 |
| FR-2.2 | Iterate sections in order, resolve each section's `slideIds` to full `SlideEmbedding` records with classification metadata | P1 |
| FR-2.3 | Include `SlideEmbedding.templateId -> Template.presentationId` resolution for source presentation mapping | P1 |
| FR-2.4 | Produce a `GenerationBlueprint` with populated `SectionSlot.candidateSlideIds` | P1 |
| FR-2.5 | Handle missing/empty DeckStructure gracefully by returning null (triggers fallback to legacy path) | P1 |
| FR-2.6 | Support all 7 logical DeckStructure keys (touch_1, touch_2, touch_3, pre_call, touch_4 x proposal, touch_4 x talk_track, touch_4 x faq) | P1 |

### FR-3: Context-Aware Section-to-Slide Matching

Select the best candidate slide per section based on deal context.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Score candidate slides against deal context using `SlideEmbedding.classificationJson` metadata (industry, pillar, persona, funnel stage) | P1 |
| FR-3.2 | Use vector similarity (pgvector cosine distance) as a secondary scoring signal when metadata match is tied | P1 |
| FR-3.3 | Produce a `SlideSelectionPlan` mapping each section to its chosen slideId + source presentationId | P1 |
| FR-3.4 | Fall back to highest-confidence candidate when deal context is sparse or no strong match exists | P1 |
| FR-3.5 | Resolve `SlideEmbedding.templateId -> Template.presentationId` for each selected slide | P1 |
| FR-3.6 | Exclude slides already used in prior touches for the same deal (cross-touch exclusion) | P2 |

### FR-4: Multi-Source Slide Assembly

Cherry-pick slides from multiple source presentations into one deck.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Group selected slides by source `presentationId` | P1 |
| FR-4.2 | Identify primary source (most slides selected) and use as base via `drive.files.copy()` | P1 |
| FR-4.3 | Delete unneeded slides from the base copy (reuse copy-and-prune pattern from `deck-customizer.ts`) | P1 |
| FR-4.4 | For secondary source slides: copy source presentation, extract needed slides via element reconstruction or copy-and-prune, merge into target | P1 |
| FR-4.5 | Reorder all slides in target to match DeckStructure section order via `updateSlidesPosition` | P1 |
| FR-4.6 | Clean up all temporary copies in `finally` blocks to prevent Drive clutter | P1 |
| FR-4.7 | Share assembled presentation with org via existing `shareWithOrg` pattern | P1 |
| FR-4.8 | Handle single-source case efficiently (skip multi-source logic, use standard copy-and-prune) | P1 |
| FR-4.9 | Save assembled presentation to deal's Google Drive folder | P1 |

### FR-5: Per-Slide Modification Planning

Plan surgical modifications using element maps.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Load `SlideElement` records for each assembled slide | P1 |
| FR-5.2 | Send element map + deal context to LLM (named agent: "modification-planner") to produce `ModificationPlan` | P1 |
| FR-5.3 | Only plan modifications for text-bearing elements (text, shape with text); preserve images, tables, groups | P1 |
| FR-5.4 | Distinguish between deal-specific content to modify (company names, industry references, summary bullets) and structural content to preserve (methodology descriptions, capability definitions, case study specifics) | P1 |
| FR-5.5 | Register "modification-planner" as a new named agent with versioned system prompt in AgentConfig | P1 |
| FR-5.6 | Fall back to placeholder injection when element maps are missing for a slide | P1 |

### FR-6: Element-Map Modification Execution

Execute planned modifications via Google Slides API.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Execute modifications per slide via `presentations.batchUpdate` with element-scoped text operations | P1 |
| FR-6.2 | Scope all text operations to specific `pageObjectIds` to prevent cross-slide contamination | P1 |
| FR-6.3 | Re-read presentation after each slide's modifications to handle objectId drift | P1 |
| FR-6.4 | Handle modification failures gracefully -- skip failed elements, log warnings, continue with remaining slides | P1 |

### FR-7: HITL Integration

Map 3-stage HITL workflow to the new generation pipeline.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | **Skeleton stage:** Present GenerationBlueprint with selected slides per section, including thumbnails (from `SlideEmbedding.thumbnailUrl`) and match rationale | P1 |
| FR-7.2 | **Skeleton stage:** Allow seller to swap slide selections, toggle optional sections, reorder sections | P1 |
| FR-7.3 | **Low-fi stage:** Present assembled multi-source Google Slides deck URL for review | P1 |
| FR-7.4 | **Low-fi stage:** Allow seller to approve or request changes (triggers re-assembly or section-level adjustments) | P1 |
| FR-7.5 | **High-fi stage:** Present modification plan summary (which elements change, what the new content will be) | P1 |
| FR-7.6 | **High-fi stage:** Execute approved modifications and present final deck URL | P1 |
| FR-7.7 | Reuse existing Mastra suspend/resume pattern -- only data payloads change, not the HITL mechanism | P1 |

### FR-8: Touch-Type Routing

Route all touches through structure-driven pipeline with fallback.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-8.1 | Touch 1 (pager): Route through blueprint -> single-source assembly -> modifications when DeckStructure exists | P1 |
| FR-8.2 | Touch 2 (intro deck): Route through blueprint -> multi-source assembly -> modifications when DeckStructure exists | P1 |
| FR-8.3 | Touch 3 (capability deck): Route through blueprint -> multi-source assembly -> modifications when DeckStructure exists | P1 |
| FR-8.4 | Touch 4 (proposal/talk track/FAQ): Route through blueprint -> multi-source assembly -> modifications when DeckStructure exists | P1 |
| FR-8.5 | Fall back to legacy generation path (slide-assembly.ts for T1, deck-customizer.ts for T2-3, deck-assembly.ts for T4) when no DeckStructure exists | P1 |
| FR-8.6 | Gate auto-generation on DeckStructure confidence: green (6+ examples) auto-generates; yellow/red shows warning and offers manual section selection | P2 |

### FR-9: Fallback & Safety

Graceful degradation when structure-driven generation cannot proceed.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-9.1 | When no good candidate slide exists for a section (all scores below threshold), fall back to branded-template content injection for that section | P2 |
| FR-9.2 | When element maps are missing, fall back to placeholder injection pattern | P1 |
| FR-9.3 | When source presentation is inaccessible (Drive permissions), skip that slide and log warning | P1 |
| FR-9.4 | Preserve all existing generation paths as fallbacks -- no existing generation code is deleted | P1 |

---

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | No new npm dependencies -- all capabilities from existing googleapis, Prisma, Mastra, Gemini | P1 |
| NFR-2 | No new Prisma models -- use existing DeckStructure, SlideEmbedding, SlideElement, Template | P1 |
| NFR-3 | Google Slides API calls stay within 60 req/min user-level rate limit for typical 12-slide deck | P1 |
| NFR-4 | All schema changes via `prisma migrate dev --name <name>` (never db push or reset) | P1 |
| NFR-5 | LLM schemas must be flat objects with no optionals/unions (Gemini structured output compatibility) | P1 |
| NFR-6 | Temporary Drive copies cleaned up in `finally` blocks | P1 |
| NFR-7 | Element-map modifications scoped to `pageObjectIds` -- no global replaceAllText | P1 |
| NFR-8 | Re-read presentation after any `batchUpdate` to handle objectId drift | P1 |

---

## Out of Scope

- Drag-and-drop slide reordering in browser (use Google Slides for this)
- AI-generated slide layouts (only assemble pre-existing slides)
- Cross-presentation theme harmonization (not supported by Google Slides API)
- Real-time in-browser slide preview rendering (use cached thumbnails + Google Slides links)
- Apps Script migration for perfect multi-source fidelity (future enhancement)
- Modification diff preview UI (v1.8.x)
- Section-level regeneration (v1.8.x)
- Variation preview UI showing all candidates per section (v1.8.x)

---

## Dependency Map

```
FR-1 (Types) ──────────────────────────────────────────────────────┐
  |                                                                 |
  +---> FR-2 (Blueprint Resolver) ---> FR-3 (Section Matcher) --+  |
  |                                                              |  |
  |    FR-5 (Mod Planner) ---> FR-6 (Mod Executor)          --+ |  |
  |         [parallel with FR-4]                               | |  |
  |                                                            | |  |
  +---> FR-4 (Multi-Source Assembly)                       ---+ +-> FR-7 (HITL)
  |         [parallel with FR-5+6]                           | |    |
  |                                                          | |    |
  +----------------------------------------------------------+-+--> FR-8 (Routing)
                                                                    |
                                                              FR-9 (Fallback)
```

**Parallel tracks after FR-1:**
- Track A: FR-2 (Blueprint Resolver) -> FR-3 (Section Matcher)
- Track B: FR-4 (Multi-Source Assembly)
- Track C: FR-5 (Modification Planner) -> FR-6 (Modification Executor)
- All converge at FR-7 (HITL) + FR-8 (Routing) + FR-9 (Fallback)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FR-1.1 | Phase 50 | Complete |
| FR-1.2 | Phase 50 | Complete |
| FR-1.3 | Phase 50 | Complete |
| FR-1.4 | Phase 50 | Complete |
| FR-1.5 | Phase 50 | Complete |
| FR-1.6 | Phase 50 | Complete |
| FR-2.1 | Phase 51 | Complete |
| FR-2.2 | Phase 51 | Complete |
| FR-2.3 | Phase 51 | Complete |
| FR-2.4 | Phase 51 | Complete |
| FR-2.5 | Phase 51 | Complete |
| FR-2.6 | Phase 51 | Complete |
| FR-3.1 | Phase 54 | Complete |
| FR-3.2 | Phase 54 | Complete |
| FR-3.3 | Phase 54 | Complete |
| FR-3.4 | Phase 54 | Complete |
| FR-3.5 | Phase 54 | Complete |
| FR-3.6 | Phase 54 | Complete |
| FR-4.1 | Phase 52 | Complete |
| FR-4.2 | Phase 52 | Complete |
| FR-4.3 | Phase 52 | Complete |
| FR-4.4 | Phase 52 | Complete |
| FR-4.5 | Phase 52 | Complete |
| FR-4.6 | Phase 52 | Complete |
| FR-4.7 | Phase 52 | Complete |
| FR-4.8 | Phase 52 | Complete |
| FR-4.9 | Phase 52 | Complete |
| FR-5.1 | Phase 53 | Complete |
| FR-5.2 | Phase 53 | Complete |
| FR-5.3 | Phase 53 | Complete |
| FR-5.4 | Phase 53 | Complete |
| FR-5.5 | Phase 53 | Complete |
| FR-5.6 | Phase 53 | Complete |
| FR-6.1 | Phase 55 | Complete |
| FR-6.2 | Phase 55 | Complete |
| FR-6.3 | Phase 55 | Complete |
| FR-6.4 | Phase 55 | Complete |
| FR-7.1 | Phase 56 | Complete |
| FR-7.2 | Phase 56 | Complete |
| FR-7.3 | Phase 56 | Complete |
| FR-7.4 | Phase 56 | Complete |
| FR-7.5 | Phase 56 | Complete |
| FR-7.6 | Phase 56 | Complete |
| FR-7.7 | Phase 56 | Complete |
| FR-8.1 | Phase 57 | Complete |
| FR-8.2 | Phase 57 | Complete |
| FR-8.3 | Phase 57 | Complete |
| FR-8.4 | Phase 57 | Complete |
| FR-8.5 | Phase 57 | Complete |
| FR-8.6 | Phase 57 | Complete |
| FR-9.1 | Phase 57 | Complete |
| FR-9.2 | Phase 57 | Complete |
| FR-9.3 | Phase 57 | Complete |
| FR-9.4 | Phase 57 | Complete |
| NFR-1 | Phase 57 | Complete |
| NFR-2 | Phase 57 | Complete |
| NFR-3 | Phase 52 | Complete |
| NFR-4 | Phase 57 | Complete |
| NFR-5 | Phase 50 | Complete |
| NFR-6 | Phase 52 | Complete |
| NFR-7 | Phase 55 | Complete |
| NFR-8 | Phase 55 | Complete |
