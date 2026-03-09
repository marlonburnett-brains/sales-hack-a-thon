# Feature Research

**Domain:** Structure-driven deck generation for agentic sales platform (v1.8)
**Researched:** 2026-03-09
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that close the 5 identified gaps between the intelligence layer (DeckStructure + element maps) and the generation layer. Without these, the DeckStructure intelligence layer produces blueprints that no generation code reads.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **DeckStructure as generation blueprint** | DeckStructure already exists with ordered sections and mapped slideIds; users see it in Settings UI but generation ignores it entirely. The intelligence-to-generation bridge does not exist. | MEDIUM | Existing `DeckStructure` model, `deck-structure-schema.ts`, `structureJson` column | Resolver reads `structureJson`, iterates sections in order, resolves each section's `slideIds` to full `SlideEmbedding` records with classification metadata. All 7 logical keys (touch_1 through touch_4 x artifact) must route through this. Replaces the current independent RAG retrieval in Touch 4 and manual selection in Touch 2-3. |
| **Context-aware section-to-slide matching** | Each DeckStructure section maps to multiple candidate slideIds (variations). Without context-aware scoring, the system picks arbitrarily. Sellers expect industry-relevant, persona-appropriate slides. | MEDIUM | Blueprint consumption, `SlideEmbedding.classificationJson` (industry, pillar, persona, stage arrays), deal context | LLM-scored or vector-similarity-scored selection from candidates per section. Similar to existing `slide-selection.ts` but scoped per-section rather than whole-deck. Scores candidates on: industry match, pillar alignment, persona fit, funnel stage appropriateness. Falls back to highest-confidence candidate when deal context is sparse. |
| **Multi-source slide assembly** | The vision requires cherry-picking slides from different source presentations into one deck. Current system copies ONE source and prunes. A typical deck draws from 3-5 different templates. | HIGH | Google Slides API constraints, `Template.presentationId` for source resolution, section-to-slide matching output | **Critical API constraint:** Google Slides API `duplicateObject` works within a single presentation only. No native cross-presentation slide copy exists ([Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584)). Requires copy-per-source-group strategy (see "Multi-Source Assembly" section below). |
| **Design-preserved output** | Current Touch 4 duplicates one template slide N times -- every output slide looks identical. Users expect each slide to retain its original layout (charts, images, branded designs preserved). | HIGH | Multi-source assembly (slides must come from their original source decks to preserve design) | Design preservation IS multi-source assembly. When you copy a slide from its source presentation, you automatically get its original layout. The constraint is NOT generating new layouts but copying existing ones and modifying only text content. |
| **Per-slide modification planning via element maps** | Element maps exist in the DB (`SlideElement` model with elementId, position, size, type, contentText per element) but are never consumed during generation. Surgical text replacement requires knowing WHICH text boxes to modify and HOW. | MEDIUM | `SlideElement` table data, multi-source assembly (need the actual copied slide), deal context for content decisions | LLM reads element map for a copied slide, receives deal context (company name, industry, desired outcomes), and produces a modification plan: `[{elementId, action: "replace"|"keep", newContent}]`. Only text/shape elements get modified; images, tables, groups are preserved. Executes via Google Slides `replaceAllText` scoped to `pageObjectIds` or individual `deleteText` + `insertText` requests per element. |
| **3-stage HITL alignment with new pipeline** | Existing HITL has Skeleton/Low-fi/High-fi stages from v1.7. These must map to the new generation pipeline data flow. | MEDIUM | All above features, existing Mastra suspend/resume pattern | **Skeleton** = DeckStructure blueprint with selected slide candidates (thumbnails, scores, section assignments). Seller reviews/swaps selections. **Low-fi** = assembled multi-source deck in Google Slides. Seller reviews in Google Slides, confirms or requests changes. **High-fi** = element-map-guided modification plan applied. Seller reviews final deck. Each uses existing suspend/resume -- only the data payloads change. |

### Differentiators (Competitive Advantage)

Features beyond closing the 5 gaps. Not required for v1.8 but create significant seller value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Variation preview in Skeleton stage** | Show all candidate slides per section with thumbnails, classification badges, and match scores. Seller can swap candidates before committing to assembly. | MEDIUM | Thumbnails already cached per slide via `thumbnailUrl`. Classification data exists in `classificationJson`. Requires UI component showing N candidates per section with select/swap interaction. |
| **Cross-touch slide exclusion** | Slides selected for Touch 2 (intro) inform Touch 3 (capability) and Touch 4 (proposal) to avoid repeating content. Prior touch history already tracked in `InteractionRecord`. | LOW | `priorTouchOutputs` already passed to `slide-selection.ts`. Extend to structure-driven selection by including previously-used slideIds as an exclusion set in the scoring function. |
| **Fallback synthesis for missing sections** | When DeckStructure has a required section but no good candidate slides exist (low similarity scores, wrong industry), fall back to the branded-template content injection approach. | LOW | Existing `deck-assembly.ts` placeholder injection works for this. Use as fallback when no retrieved slide scores above a configurable threshold. Prevents empty sections in the output deck. |
| **Confidence-gated generation** | Only auto-generate with DeckStructure when confidence is green (6+ examples). Yellow/red confidence shows a warning and offers manual section selection instead. | LOW | `calculateConfidence()` already returns color tier. Gate the generation entry point on confidence level. Prevents poor-quality auto-generation from under-trained structures. |
| **Modification diff preview** | In High-fi stage, show before/after text diffs for each element the LLM plans to modify. Seller approves or edits the modification plan before execution. | MEDIUM | Requires rendering element map contents alongside proposed changes. SlideElement positions enable approximate visual placement in a preview layout. |
| **Section-level regeneration** | In Low-fi or High-fi stage, seller can mark a single section for re-generation (pick a different candidate slide or re-run modifications) without rebuilding the entire deck. | MEDIUM | Requires tracking which slides map to which sections in the assembled deck. Delete the section's slides, re-run assembly for just that section, insert at the correct position. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time in-browser slide preview rendering** | Sellers want to see assembled slides in the app without opening Google Slides. | Google Slides API has no render-to-image endpoint for arbitrary slides. Thumbnails are only available via `presentations.pages.getThumbnail` after the presentation exists. Building a PPTX/Slides renderer is a multi-month effort. | Use cached ingestion thumbnails in Skeleton stage. Link to Google Slides for Low-fi and High-fi review. Already works this way for existing preview flows. |
| **Drag-and-drop slide reordering in browser** | Intuitive UX for adjusting slide order after assembly. | Explicitly out of scope in PROJECT.md. Google Slides has a better editor for this. Building a partial Slides editor in-browser creates maintenance burden without matching Google's capability. | Show ordered list with move-up/move-down in Skeleton stage for section reordering. Sellers use Google Slides for fine-grained slide reordering. |
| **AI-generated slide layouts** | Create novel layouts that don't exist in any source template. | Violates brand compliance constraint: "AI may only assemble pre-approved Lumenalta building blocks -- no generated layouts." Generated layouts look amateur compared to professionally designed templates. | Select from existing slide variations in the template library. Library grows as more templates are ingested via the Discovery UI. |
| **Full element-level content generation** | Replace ALL text on every slide with fresh AI-generated content. | Destroys the original slide's information architecture. Case study slides contain specific data points (client names, metrics, timelines) that shouldn't be hallucinated. Methodology slides describe real Lumenalta processes. | Surgical modification: only replace deal-specific content (company names, industry references, customizable summary bullets). Preserve structural content (methodology descriptions, capability definitions, case study specifics). |
| **Cross-presentation theme harmonization** | Auto-reconcile visual themes when mixing slides from different source presentations. | Google Slides API has no theme merge capability. Each slide retains its source presentation's theme. Forcing a theme change via API is destructive -- it can break custom layouts, color schemes, and font stacks. | Standardize on consistent Lumenalta branding across all source templates (already the case since templates are professionally designed to Lumenalta brand). Flag visually inconsistent slides in HITL review for seller awareness. |
| **Automated deck length optimization** | AI decides how many slides the deck should have. | Sellers have strong opinions on deck length based on meeting context (15-min call vs. 1-hour workshop vs. written leave-behind). Auto-sizing often over-generates. | DeckStructure's `isOptional` flag lets the system include/exclude optional sections. Seller confirms section selection in Skeleton stage. Section count drives slide count naturally. |

## Feature Dependencies

```
DeckStructure Blueprint Consumption
    |
    +--requires--> Context-Aware Section-to-Slide Matching
    |                  |
    |                  +--requires--> SlideEmbedding classification data (EXISTS)
    |                  +--requires--> Deal context: industry, pillar, persona (EXISTS)
    |
    +--feeds-------> Multi-Source Slide Assembly
                         |
                         +--requires--> Source presentation resolution via Template.presentationId (EXISTS)
                         +--requires--> Copy-per-source-group strategy (NEW)
                         +--enables---> Design-Preserved Output (automatic consequence of source copying)
                         |
                         +--feeds-------> Per-Slide Modification Planning
                                             |
                                             +--requires--> SlideElement data per slide (EXISTS)
                                             +--requires--> Copied slide with resolvable elementIds (from assembly)
                                             +--enables---> Surgical text replacement via batchUpdate

3-Stage HITL Integration
    |
    +--Skeleton stage--requires--> Blueprint consumption + section-to-slide matching
    +--Low-fi stage---requires--> Multi-source assembly
    +--High-fi stage--requires--> Per-slide modification planning
```

### Dependency Notes

- **Blueprint consumption is the foundation.** Everything else depends on the system reading DeckStructure and iterating its sections. Must be built first.
- **Section-to-slide matching enables assembly.** Cannot assemble slides from multiple sources until you know WHICH slides to pick for each section.
- **Multi-source assembly enables design preservation.** Design preservation is not a separate implementation -- it is the natural consequence of copying slides from their original source presentations rather than injecting content into a generic template.
- **Modification planning requires assembled slides.** Element-level modifications can only be planned on slides that exist in the target presentation (elementIds must be resolvable in the target context after copy).
- **HITL stages map cleanly to the pipeline.** Skeleton = blueprint + selections, Low-fi = assembled deck, High-fi = modifications. No changes needed to the suspend/resume pattern -- only the data passed at each checkpoint changes.
- **Fallback synthesis is independent.** Can be added at any point since it uses the existing branded-template injection path as a safety net.

## MVP Definition

### Launch With (v1.8 Core)

The minimum set that closes all 5 gaps from the gap analysis.

- [ ] **DeckStructure blueprint resolver** -- Reads `structureJson`, iterates sections in order, resolves slideIds to `SlideEmbedding` records with full classification and element metadata. Returns a `ResolvedBlueprint` with section-level candidate lists.
- [ ] **Section-to-slide scorer** -- For each section, scores candidate slides against deal context (industry, pillar, persona, stage) using classification metadata comparison and optional vector similarity. Selects the best match per section. Produces a `SlideSelectionPlan` mapping section -> chosen slideId + source presentationId.
- [ ] **Multi-source slide assembler** -- Groups selected slides by source `presentationId`. Copies source presentations to temp files, prunes to only needed slides, merges into a single target presentation. Cleans up temp files. Handles the primary-source optimization (largest group becomes the base).
- [ ] **Element-map modification planner** -- For each assembled slide: loads `SlideElement` records, LLM produces a modification plan with per-element actions, executes via Google Slides `batchUpdate` with element-scoped text operations.
- [ ] **HITL stage data contracts** -- Skeleton checkpoint sends blueprint + slide selections (with thumbnails and scores) for review. Low-fi checkpoint sends assembled presentation URL. High-fi checkpoint sends modification plan summary for approval.
- [ ] **Touch-type router** -- Routes all touch types through the structure-driven pipeline when a DeckStructure exists with sufficient confidence. Falls back to existing generation paths (copy-and-prune for Touch 2-3, template injection for Touch 1, RAG-to-JSON for Touch 4) when DeckStructure is unavailable.

### Add After Validation (v1.8.x)

Features to add once the core pipeline works end to end.

- [ ] **Variation preview UI** -- Trigger: sellers want to see alternative slide candidates before committing to assembly
- [ ] **Cross-touch slide exclusion** -- Trigger: sellers notice repeated slides across touch decks for the same deal
- [ ] **Modification diff preview** -- Trigger: sellers want to review AI text changes before they hit the deck
- [ ] **Confidence-gated generation** -- Trigger: low-confidence structures produce poor results that need gating
- [ ] **Section-level regeneration** -- Trigger: sellers want to fix one section without rebuilding the entire deck

### Future Consideration (v2+)

- [ ] **Custom section insertion** -- Allow sellers to add ad-hoc sections not in the DeckStructure blueprint. Requires UI for section creation and slide library browsing.
- [ ] **Template-level theme enforcement** -- Ensure all slides in a multi-source deck conform to a single theme. Requires Google Slides theme API research (currently no viable approach).
- [ ] **Generation analytics** -- Track which slides are most frequently selected, modified, or rejected. Feed back into DeckStructure refinement and confidence scoring.
- [ ] **Smart modification learning** -- Track which element modifications sellers approve vs. override. Use patterns to improve future modification plans.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase Suggestion |
|---------|------------|---------------------|----------|------------------|
| DeckStructure blueprint resolver | HIGH | LOW | P1 | Phase 1 -- unlocks everything |
| Section-to-slide scorer | HIGH | MEDIUM | P1 | Phase 1 -- paired with resolver |
| Multi-source slide assembler | HIGH | HIGH | P1 | Phase 2 -- most complex, core capability |
| Fallback synthesis for missing sections | MEDIUM | LOW | P1 | Phase 2 -- safety net during assembly |
| Element-map modification planner | HIGH | MEDIUM | P1 | Phase 3 -- post-assembly refinement |
| HITL stage data contracts | HIGH | MEDIUM | P1 | Phase 4 -- wires into existing workflow |
| Touch-type router with fallbacks | HIGH | LOW | P1 | Phase 4 -- integration layer |
| Variation preview UI | MEDIUM | MEDIUM | P2 | v1.8.x |
| Cross-touch slide exclusion | MEDIUM | LOW | P2 | v1.8.x |
| Confidence-gated generation | LOW | LOW | P3 | v1.8.x |
| Modification diff preview | MEDIUM | MEDIUM | P3 | v1.8.x |
| Section-level regeneration | MEDIUM | MEDIUM | P3 | v1.8.x |

**Priority key:**
- P1: Must have -- closes one of the 5 identified gaps
- P2: Should have -- improves quality or seller experience
- P3: Nice to have -- polish and advanced UX

## Multi-Source Assembly: The Hard Problem

The single most complex feature in v1.8. Requires careful strategy due to Google Slides API limitations.

### Why It's Hard

Google Slides API `duplicateObject` only works within a single presentation. There is no `importSlide` or `appendSlide` in the REST API ([Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584)). Apps Script has `appendSlides()` but it has documented performance issues and is not available via REST API.

### Recommended Strategy: Copy-and-Prune Per Source Group

1. **Group** selected slides by source `presentationId` (typically 2-5 groups)
2. **Identify the largest group** as the "base" source
3. **Copy the base source** to the deal folder via `drive.files.copy` -- these slides get perfect design preservation
4. **Delete unneeded slides** from the base copy (reuse existing copy-and-prune pattern from `deck-customizer.ts`)
5. **For each additional source group:**
   a. Copy the additional source to a temp file via `drive.files.copy`
   b. Read all slides via `presentations.get`
   c. For each needed slide: read its `pageElements` structure
   d. In the target presentation: `createSlide` then recreate elements via `createShape`, `createImage`, `insertText`, and styling requests
   e. Delete the temp copy
6. **Reorder** all slides in the target to match the DeckStructure section order via `updateSlidesPosition`
7. **Share** with org via existing `shareWithOrg`

### Design Preservation Tiers

| Tier | Method | Fidelity | When Used |
|------|--------|----------|-----------|
| **Perfect** | Copy-and-prune from source | 100% -- identical to original | Slides from the base (largest) source group |
| **High** | Element-level reconstruction | ~90% -- text, images, basic shapes preserved; complex SmartArt/charts may lose formatting | Slides from secondary source groups |
| **Fallback** | Branded template injection | ~60% -- content preserved, layout is generic | When source presentation is inaccessible or reconstruction fails |

### API Call Budget

For a 12-slide deck drawing from 3 source presentations (6 + 4 + 2 distribution):
- 3 `drive.files.copy` (base + 2 additional sources)
- 1 `presentations.get` per source (3 total)
- 1 `presentations.batchUpdate` for deleting unneeded slides from base
- N `presentations.batchUpdate` for element reconstruction (2-4 per secondary slide, ~12-24 total)
- 1 `presentations.batchUpdate` for final reordering
- 2 `drive.files.delete` for temp copies
- 1 permission update for sharing
- **Total: ~25-35 API calls** (well within Google Slides API quotas of 60 requests/minute/project)

## Existing Infrastructure to Leverage

| Existing Asset | New Feature It Enables | Gap to Fill |
|----------------|----------------------|-------------|
| `DeckStructure.structureJson` with sections + slideIds | Blueprint resolver | Parse JSON, resolve slideIds to SlideEmbedding records |
| `SlideEmbedding.classificationJson` (8-axis) | Section-to-slide scoring | Build scoring function using classification match against deal context |
| `SlideElement` table (elementId, type, position, content) | Modification planning | LLM-driven modification plan generator + batchUpdate executor |
| `deck-customizer.ts` (copy-and-prune) | Multi-source assembly base group | Extend to handle multiple source groups, not just one |
| `deck-assembly.ts` (template duplication + injection) | Fallback synthesis | Use as fallback when no candidate slide meets quality threshold |
| `slide-selection.ts` (LLM-driven selection) | Section-to-slide scoring | Refactor to per-section scoring instead of whole-deck selection |
| `proposal-assembly.ts` (buildSlideJSON) | Blueprint-driven assembly | Replace fixed section template with DeckStructure sections |
| `Template.presentationId` | Source presentation resolution | Map slideId -> SlideEmbedding.templateId -> Template.presentationId |
| `thumbnailUrl` on SlideEmbedding | Skeleton stage preview | Display candidate thumbnails in HITL review UI |
| Mastra suspend/resume in workflows | HITL stage checkpoints | Reuse pattern, change checkpoint data payloads |
| `calculateConfidence()` in deck-structure-schema.ts | Confidence gating | Gate auto-generation on confidence color tier |
| `extractElements()` in extract-elements.ts | Element map reading | Already extracts what's needed; just need to consume it downstream |

## Sources

- [Google Slides API - Slide Operations](https://developers.google.com/workspace/slides/api/samples/slides) -- official API samples for slide duplication (HIGH confidence)
- [Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584) -- feature request for cross-presentation slide import, unresolved as of 2026 (HIGH confidence)
- [Google Slides API batchUpdate Reference](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate) -- full request type documentation (HIGH confidence)
- [Google Slides API presentations.pages.getThumbnail](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/getThumbnail) -- thumbnail generation (HIGH confidence)
- Existing codebase: `deck-assembly.ts`, `deck-customizer.ts`, `slide-selection.ts`, `proposal-assembly.ts`, `extract-elements.ts`, `deck-structure-schema.ts`, `schema.prisma` (HIGH confidence -- direct code review)

---
*Feature research for: Structure-driven deck generation (v1.8)*
*Researched: 2026-03-09*
