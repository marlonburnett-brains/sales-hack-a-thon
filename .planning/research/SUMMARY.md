# Project Research Summary

**Project:** v1.8 Structure-Driven Deck Generation
**Domain:** Multi-source slide assembly with element-map-guided modifications for agentic sales platform
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

v1.8 bridges the gap between the intelligence layer (DeckStructure blueprints, slide classification, element maps) and the generation layer (Google Slides deck assembly). The core challenge is consuming DeckStructure as a generation blueprint, selecting context-appropriate slides from multiple source presentations, assembling them into a single output deck while preserving original designs, and applying surgical per-element text modifications using stored element maps. All of this must flow through the existing 3-stage HITL pipeline (Skeleton/Low-fi/High-fi) with enriched data payloads at each checkpoint.

The recommended approach requires zero new dependencies -- every capability is achievable with the existing `googleapis`, `@google/genai`, `openai`, Prisma, and Mastra packages. The work is 6 new TypeScript modules in a `generation/` directory, 2 nullable column additions to `InteractionRecord`, and new Zod schemas for the pipeline data contracts. The architecture follows a blueprint-first pattern: every generation starts by resolving DeckStructure into an ordered list of section slots, matching slides to sections using deal context, assembling from source presentations, and then applying element-map-guided modifications.

The dominant technical risk is Google Slides API's lack of cross-presentation slide copy (confirmed via Google Issue Tracker #167977584, open since 2020). The mitigation is a "sequential copy-and-prune" strategy where the primary source presentation is copied and pruned, and secondary source slides use content injection from element maps into branded template slides. This hybrid approach trades pixel-perfect layout for secondary slides in exchange for API simplicity, with a future path to Apps Script `appendSlide()` if visual fidelity becomes critical. Secondary risks include objectId collisions during multi-source merge, element map staleness between ingestion and generation, and HITL state payload bloat -- all have clear prevention strategies documented in the research.

## Key Findings

### Recommended Stack

No dependency changes. All capabilities come from existing packages. Stay on `googleapis@^144.0.0` (no new Slides methods in 171.x), `prisma@^6.3.1` (Prisma 7.x has vector regression), and `@mastra/core@^1.8.0` (suspend/resume handles HITL stages). See [STACK.md](./STACK.md) for full details.

**Core technologies (all existing):**
- `googleapis` (^144.0.0): Drive `files.copy` for multi-source assembly, Slides `batchUpdate` for modifications -- no upgrade needed
- `@google/genai` (^1.43.0): Gemini 2.5 Flash for modification planning and section-to-slide scoring -- flat structured output schemas only
- `openai` (^6.27.0): GPT-OSS 120b for per-slide creative copy generation -- same pattern as existing proposal assembly
- `@prisma/client` (^6.3.1): 2 new nullable columns on InteractionRecord via forward-only migration -- no new models
- `@mastra/core` (^1.8.0): New workflow steps using existing suspend/resume for enriched HITL checkpoints

### Expected Features

See [FEATURES.md](./FEATURES.md) for full analysis.

**Must have (table stakes -- closes 5 identified gaps):**
- DeckStructure blueprint resolver -- reads structureJson, resolves sections to SlideEmbedding records with classification and element metadata
- Context-aware section-to-slide matching -- scores candidates on industry, pillar, persona, funnel stage; cascading fallback for sparse library
- Multi-source slide assembly -- cherry-picks slides from different source presentations into one deck via copy-and-prune strategy
- Per-slide modification planning via element maps -- LLM reads element map, produces targeted modification plan, executes via scoped batchUpdate
- 3-stage HITL data contracts -- Skeleton=blueprint+selections, Low-fi=assembled deck URL, High-fi=modification plan summary
- Touch-type router with fallbacks -- routes through structure-driven pipeline when DeckStructure exists, falls back to existing paths otherwise

**Should have (differentiators for v1.8.x):**
- Variation preview in Skeleton stage -- show all candidate slides per section with thumbnails and match scores
- Cross-touch slide exclusion -- prevent repeated slides across touch decks for same deal
- Fallback synthesis for missing sections -- branded template injection when no good candidate exists
- Confidence-gated generation -- gate auto-generation on DeckStructure confidence level

**Defer (v2+):**
- Custom section insertion, template-level theme enforcement, generation analytics, smart modification learning

### Architecture Approach

The architecture adds a `generation/` module layer between the existing intelligence layer (DeckStructure, SlideEmbedding, SlideElement) and the existing HITL/workflow layer. Six new components form a linear pipeline: Blueprint Resolver -> Section Matcher -> Multi-Source Assembler (with Slide Copier) -> Modification Planner -> Element-Map Executor. Each component has a graceful degradation fallback to existing code paths. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

**Major components:**
1. **Blueprint Resolver** -- reads DeckStructure, produces GenerationBlueprint with ordered SectionSlots and candidate slideIds
2. **Section Matcher** -- scores candidate slides per section using classification metadata + vector similarity against deal context
3. **Multi-Source Assembler + Slide Copier** -- groups slides by source presentation, executes copy-and-prune for primary source, content injection for secondary sources
4. **Modification Planner** -- loads SlideElement records per assembled slide, LLM produces per-element modification actions (flat schema for Gemini compatibility)
5. **Element-Map Executor** -- executes planned modifications via scoped Slides API batchUpdate; re-reads presentation between slides for objectId stability

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 10 pitfalls with full recovery strategies.

1. **No cross-presentation slide copy in Google Slides REST API** -- use sequential copy-and-prune with hybrid approach (primary source preserves design, secondary sources use content injection). Prototype with real API integration test before building full pipeline.
2. **ObjectId collisions when merging from multiple presentations** -- never reuse source objectIds; generate new IDs; maintain source-to-output ID mapping; always re-read presentation after batchUpdate.
3. **Element map staleness between ingestion and generation** -- re-fetch source slide elements via `presentations.get` at generation time; lock source data for workflow duration; suppress auto-re-ingestion during active generation.
4. **DeckStructure slideIds becoming dangling references** -- validate every slideId against DB at generation time; filter archived/deleted slides; fall back to vector similarity search when sections have zero valid candidates.
5. **replaceAllText cross-contamination in multi-source decks** -- use element-targeted `deleteText`+`insertText` instead of `replaceAllText` for content modifications; always scope with `pageObjectIds` for placeholder replacements.

## Implications for Roadmap

Based on dependency analysis from architecture research and pitfall-to-phase mapping:

### Phase 1: Foundation Types + Blueprint Resolution + Section Matching

**Rationale:** Blueprint Resolver is the foundation -- every downstream component depends on GenerationBlueprint and SectionSlot types. Section Matcher fills the selected slideId per section, which is required before assembly can begin. These are pure data transforms and DB queries with no Google API mutations, making them low-risk to build first.
**Delivers:** `generation/types.ts`, `generation/blueprint-resolver.ts`, `generation/section-matcher.ts`, new Zod schemas (ResolvedBlueprint, ModificationAction)
**Addresses:** DeckStructure blueprint consumption, context-aware section-to-slide matching (Features P1)
**Avoids:** Context matching over-fitting (Pitfall 8) -- build cascading fallback from day one; dangling slideId references (Pitfall 4) -- validate slideIds at resolution time
**Uses:** Prisma (DeckStructure, SlideEmbedding, SlideElement), pgvector (cosine similarity pre-filter), Gemini Flash (structured scoring)

### Phase 2: Multi-Source Slide Assembly

**Rationale:** Most complex component and highest technical risk due to Google API limitations. Must be built and validated before modification planning, because Low-fi HITL (assembled deck review) is useful even without surgical modifications. Needs an integration test proving the cross-presentation merge strategy works before building downstream.
**Delivers:** `generation/multi-source-assembler.ts`, `generation/slide-copier.ts`, AssemblyManifest schema, Prisma migration for `blueprintJson` and `assemblyManifest` columns
**Addresses:** Multi-source slide assembly, design-preserved output (Features P1)
**Avoids:** No cross-presentation copy API (Pitfall 1) -- prototype early; objectId collisions (Pitfall 2) -- generate new IDs with mapping; theme conflicts (Pitfall 6) -- verify theme compatibility before assembly
**Uses:** googleapis (Drive files.copy, Slides batchUpdate), existing deck-customizer.ts copy-and-prune patterns

### Phase 3: Modification Planning + Execution

**Rationale:** Can be developed in parallel with Phase 2 once types are defined (Phase 1 complete). Depends on assembled slides existing in the target presentation for elementId resolution. The modification planner and executor form a tight pair.
**Delivers:** `generation/modification-planner.ts`, `generation/element-map-executor.ts`, ModificationPlan schema, new named agent "modification-planner"
**Addresses:** Per-slide modification planning via element maps (Features P1)
**Avoids:** Element map staleness (Pitfall 3) -- re-fetch live data at generation time; element type assumptions (Pitfall 9) -- build type-specific executors; replaceAllText cross-contamination (Pitfall 5) -- use element-targeted operations
**Uses:** Prisma (SlideElement), Gemini Flash (modification planning), GPT-OSS 120b (creative copy generation), googleapis (Slides batchUpdate)

### Phase 4: Workflow Integration + HITL Wiring

**Rationale:** Integrates the full pipeline into existing touch workflows with HITL checkpoints. Must come last because it depends on all pipeline components. Each touch can be migrated independently with fallback to existing behavior.
**Delivers:** Modified touch 1-4 workflows, HITL stage data contracts, touch-type router with fallbacks, modified proposal-assembly.ts
**Addresses:** 3-stage HITL alignment, touch-type router with fallbacks (Features P1)
**Avoids:** HITL state explosion (Pitfall 7) -- store heavy data in DB, keep suspend payloads under 5KB with IDs only; concurrent modification between stages (Pitfall 10) -- check revisionId before High-fi modifications
**Uses:** @mastra/core (suspend/resume), all Phase 1-3 components

### Phase 5: Polish + Differentiators (v1.8.x)

**Rationale:** Only after core pipeline works end-to-end. These improve quality and seller experience but are not required to close the 5 gaps.
**Delivers:** Variation preview UI, cross-touch slide exclusion, fallback synthesis for missing sections, confidence-gated generation

### Phase Ordering Rationale

- **Dependency chain:** Blueprint resolution (P1) -> section matching (P1) -> assembly (P2) -> modifications (P3) -> integration (P4). This mirrors the data flow: you cannot assemble slides you have not selected, and you cannot modify slides you have not assembled.
- **Risk front-loading:** Phase 2 (multi-source assembly) is the highest-risk component due to Google API constraints. Building it in Phase 2 (not Phase 4) means the hardest problem is solved early, and downstream phases can adapt to whatever assembly strategy proves viable.
- **Parallel opportunity:** Phase 3 (modification) can run in parallel with Phase 2 after Phase 1 types are defined. This compresses the timeline.
- **Graceful degradation:** Each phase adds value independently. After Phase 1-2, the system can produce assembled decks from DeckStructure without surgical modifications. After Phase 3, modifications work but are not yet wired into HITL. Phase 4 connects everything.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Multi-Source Assembly):** Highest technical risk. Needs a spike/prototype proving the Drive copy-and-prune merge strategy works with real Google Slides API calls. The hybrid approach (primary source copy-and-prune + secondary source content injection) must be validated with actual presentations to determine visual fidelity.
- **Phase 4 (HITL Wiring):** The suspend/resume payload contracts need careful schema design. The Skeleton stage UI rendering complexity (12+ sections with thumbnails and alternatives) needs frontend prototyping.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Blueprint + Matching):** Well-documented patterns -- Prisma queries, vector similarity, LLM structured output. All patterns exist in the current codebase.
- **Phase 3 (Modification):** Element map consumption is a new application of existing patterns (SlideElement queries + Gemini structured output + Slides batchUpdate). The type-specific executor pattern is standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All existing packages verified sufficient. Version constraints documented with rationale. |
| Features | HIGH | 5 gaps clearly identified from gap analysis. Feature dependency chain validated against codebase. MVP vs. defer boundary is clear. |
| Architecture | HIGH | Full codebase analysis (61,245 LOC). Component boundaries, data joins, and existing code extensions all verified against actual source files. |
| Pitfalls | HIGH | All 10 pitfalls verified against Google Slides API documentation and existing codebase patterns. Cross-presentation copy limitation confirmed via Google Issue Tracker. |

**Overall confidence:** HIGH

### Gaps to Address

- **Multi-source assembly visual fidelity:** The hybrid approach (primary source copy-and-prune + secondary source content injection) has not been tested with real presentations. A spike in Phase 2 must validate that content injection into branded template slides produces acceptable output quality. If not, the fallback is single-source assembly per deck (simpler but less visually diverse).
- **Table cell modification support:** Current element map extraction concatenates table cell text into a single `contentText` string. If table modifications are in scope for v1.8, the element map schema needs extension to capture `{rowIndex, columnIndex}` per cell. This can be deferred if table content is treated as "preserve as-is."
- **Sparse library matching quality:** With only 38 slides from 5 presentations, the cascading fallback matcher may frequently fall through to the lowest tier (any available slide). Actual match quality will only be measurable after Phase 1 is built against real deal contexts.
- **Apps Script migration path:** If the hybrid multi-source approach proves insufficient for visual fidelity, migration to Apps Script `appendSlide()` via the Apps Script API is the documented escape hatch. This adds infrastructure complexity (Apps Script project deployment, execution permissions) and should only be pursued if seller feedback demands it.

## Sources

### Primary (HIGH confidence)
- [Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584) -- confirmed no REST API cross-presentation slide copy
- [Google Slides API Slide Operations](https://developers.google.com/workspace/slides/api/samples/slides) -- `duplicateObject` is single-presentation only
- [Google Slides API REST Reference](https://developers.google.com/workspace/slides/api/reference/rest) -- verified batchUpdate request types
- [Google Slides API Merge Guide](https://developers.google.com/workspace/slides/api/guides/merge) -- template merge via replaceAllText
- [Google Slides API Batch Requests](https://developers.google.com/slides/api/guides/batch) -- all-or-nothing batchUpdate semantics
- [Google Apps Script Presentation.appendSlides](https://developers.google.com/apps-script/reference/slides/presentation) -- cross-presentation copy exists in Apps Script only
- [googleapis npm](https://www.npmjs.com/package/googleapis) -- latest 171.x has no new Slides methods for v1.8
- Codebase analysis: `deck-assembly.ts`, `deck-customizer.ts`, `extract-elements.ts`, `slide-selection.ts`, `proposal-assembly.ts`, `deck-structure-schema.ts`, `schema.prisma`, touch workflows

### Secondary (MEDIUM confidence)
- [Experiments with Google Slides API to recreate slides](https://www.bentumbleson.com/experiments-with-the-google-slides-api-to-recreate-slides/) -- confirms element reconstruction is lossy
- Sequential copy-and-prune as standard multi-source workaround -- multiple developer blog posts and Stack Overflow answers

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
