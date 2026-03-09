# Pitfalls Research

**Domain:** Adding structure-driven deck generation with multi-source slide assembly, element-map-guided modifications, and context-aware matching to an existing Google Slides-based agentic sales platform (~61,245 LOC, 49 phases, Mastra workflows with 3-stage HITL suspend/resume, Prisma forward-only migrations)
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase analysis, Google Slides API documentation, and verified API constraints)

## Critical Pitfalls

### Pitfall 1: Google Slides API Has No Cross-Presentation Slide Copy Endpoint

**What goes wrong:**
The gap analysis states that "Google Slides API supports cross-presentation copy via `duplicateObject` with `objectIdHeader`" -- this is incorrect. The `duplicateObject` request only works **within a single presentation**. There is no REST API endpoint to copy a slide from Presentation A into Presentation B. The feature request for this capability (Google Issue Tracker #167977584) has been open since 2020 with no resolution. The existing `deck-customizer.ts` works only because it copies an entire presentation via Drive API and then deletes unwanted slides (copy-and-prune). Multi-source assembly -- cherry-picking slide 3 from Presentation A and slide 7 from Presentation B into a new deck -- cannot use this approach because copy-and-prune only works with one source.

**Why it happens:**
Developers read the `duplicateObject` documentation, see the `objectsIdsHeader` parameter for remapping IDs, and assume it supports cross-presentation operations. It does not -- the source objectId must exist in the same presentation being updated.

**How to avoid:**
Use the only viable multi-source strategy: **sequential Drive copy + merge**.
1. Create the output presentation by copying the "primary" source (the source with the most selected slides) via `drive.files.copy`.
2. For each additional source presentation, create a temporary copy via `drive.files.copy`.
3. From each temp copy, get the slide objectIds you need via `presentations.get`.
4. Use the Google Apps Script `appendSlides` equivalent pattern: copy the temp presentation's content into the target by creating blank slides and recreating elements, OR use the Drive API to copy the temp presentation, then use `presentations.batchUpdate` to move/reorder slides within the merged result.

The most reliable approach for this codebase: **copy-and-prune per source, then merge presentations via the Drive API**. Specifically:
- Copy Source A, prune to desired slides -> Temp A
- Copy Source B, prune to desired slides -> Temp B
- Copy Temp A as the output deck
- For slides from Temp B: read their full page element structure via `presentations.get`, create new slides in the output, and replicate elements via `batchUpdate` requests (`createShape`, `insertText`, `updateShapeProperties`, etc.)

Alternative (simpler but loses some formatting): Copy the primary source, prune. For secondary source slides, create blank slides in the output and inject text content using element maps already captured during ingestion. Accept that visual layout comes from the primary source's theme.

**Warning signs:**
- 400 errors from `duplicateObject` with "Object not found" when referencing objectIds from another presentation
- Planning documents or PRDs that assume `duplicateObject` works cross-presentation
- Test cases that only test single-source assembly and claim multi-source is "the same pattern"

**Phase to address:**
Multi-source slide assembly phase -- must prototype the actual cross-presentation merge strategy with a real Google Slides API integration test before building the full pipeline. This is the single highest-risk technical unknown in the milestone.

---

### Pitfall 2: ObjectId Collisions When Merging Slides From Multiple Presentations

**What goes wrong:**
Google Slides assigns objectIds to every element on every slide (shapes, text boxes, images, groups, tables). These IDs are unique **within a presentation** but not **across presentations**. When recreating elements from Source B inside a presentation that started as a copy of Source A, the recreated elements may collide with existing objectIds from Source A. The `createShape` request lets you specify a custom objectId, but if that ID already exists in the target presentation, the entire `batchUpdate` fails (all-or-nothing semantics).

Additionally, the existing element maps stored in `SlideElement` records contain `elementId` values from the original source presentation. After copying a slide into the output deck (even via copy-and-prune), the objectIds are preserved -- but if two source presentations happen to have elements with the same objectId (which is possible since Google does not guarantee cross-presentation uniqueness), only one survives.

**Why it happens:**
Developers treat elementIds as globally unique identifiers (like UUIDs) when they are actually scoped to a single presentation. The `SlideElement.elementId` column stores the original source presentation's objectId, and downstream code assumes this ID will be valid in the output presentation.

**How to avoid:**
- When creating elements in the output presentation, **never reuse source objectIds**. Generate new IDs using the allowed character set (alphanumeric + underscore/hyphen/colon, 5-50 chars).
- Maintain a mapping from `{sourcePresentationId, sourceElementId} -> outputElementId` so that modification planning can reference the correct output element.
- After any element creation or slide copy operation, re-read the presentation via `presentations.get` to discover the actual objectIds assigned by the API. The existing codebase comment "ALWAYS re-read presentation after ANY batchUpdate (objectId drift)" in `deck-assembly.ts` already acknowledges this pattern.
- In `SlideElement` queries, always join with `SlideEmbedding.presentationId` to disambiguate elements from different source presentations.

**Warning signs:**
- `batchUpdate` returning "Object already exists" errors
- Element maps from the DB not matching actual elements in the output presentation
- Text replacement operations hitting the wrong elements (replacing text in Source A's title box when targeting Source B's title box)

**Phase to address:**
Multi-source slide assembly phase AND per-slide modification planning phase -- both need the ID mapping infrastructure.

---

### Pitfall 3: Element Map Staleness Between Ingestion and Generation

**What goes wrong:**
Element maps are captured during slide ingestion (via `extract-elements.ts`) and stored in `SlideElement` records. Between ingestion and generation, the source presentation may have been edited in Google Slides by a human -- elements repositioned, text changed, new elements added, or elements deleted. The stored element map no longer matches the actual slide content. When the generation pipeline uses the stale element map to plan modifications (e.g., "replace text in element `p1_title_box` with deal-specific content"), the element may not exist or may contain different text, causing silent failures or incorrect replacements.

This is especially dangerous because the existing ingestion pipeline has a "smart merge" system that re-ingests changed slides based on content hash. But re-ingestion updates `SlideEmbedding` and `SlideElement` records without invalidating any in-progress `DeckStructure` references. A `DeckStructure.sections[].slideIds` array may point to `SlideEmbedding` records whose element maps were just refreshed, but the modification plan was built against the old element map.

**Why it happens:**
The ingestion pipeline and the generation pipeline are decoupled by design (and correctly so). But the element map is treated as a static lookup table when it is actually a snapshot that can become stale. The 5-minute staleness polling in the ingestion layer makes this worse -- it can trigger mid-generation.

**How to avoid:**
- At generation time, **always re-fetch the source slide's page elements via `presentations.get`** for the specific slides being assembled. Compare against the stored element map as a sanity check, but use the live data for modification planning.
- Lock the source presentation's slide data at the start of generation (read once, cache for the duration of the workflow run). Do not re-read mid-generation.
- Add a `lastVerifiedAt` timestamp to `SlideElement` records and skip modification planning for elements not verified within the current workflow run.
- Suppress auto-re-ingestion for source presentations that have active generation workflows referencing their slides.

**Warning signs:**
- `replaceAllText` operations that match zero elements (the placeholder text was changed in the source)
- Generated decks with mixed old and new content on the same slide
- Element maps showing 5 text boxes but the live slide having 6

**Phase to address:**
DeckStructure-to-generation bridge phase -- must define the "read live, verify against stored" pattern before per-slide modification planning.

---

### Pitfall 4: DeckStructure slideIds Becoming Dangling References

**What goes wrong:**
`DeckStructure.sections[].slideIds` contains arrays of `SlideEmbedding` IDs. These IDs are populated during inference from whatever slides exist in the library at inference time. Between inference and generation:
- Slides can be archived (removed from a source presentation, marked archived by smart merge)
- Source presentations can lose access (Google Drive permissions revoked)
- Re-ingestion can assign new IDs if the content hash changes enough to create a new record
- Chat refinement can add slideIds that the LLM hallucinated (non-existent IDs)

When the generation pipeline resolves a section's slideIds, some may point to archived/deleted records, inaccessible presentations, or simply not exist in the database.

**Why it happens:**
The DeckStructure is inferred by an LLM that receives slide data as context. The LLM outputs slideIds from that context. But the slideIds are database primary keys, and the LLM has no constraint preventing it from outputting IDs that look plausible but do not exist. Even valid IDs at inference time can become invalid before generation time -- there is no FK constraint between `DeckStructure.structureJson` (a JSON blob) and `SlideEmbedding.id`.

**How to avoid:**
- At generation time, validate every slideId against the database. For each section, filter to only slideIds that: (a) exist in `SlideEmbedding`, (b) are not archived (`archivedAt IS NULL`), and (c) belong to a presentation the service account can still access.
- If a section has zero valid slideIds after filtering, fall back to vector similarity search against the section's name/purpose to find replacement slides at generation time.
- After LLM inference, run a post-processing step that strips any slideIds not found in the `SlideEmbedding` table. The existing inference code should already do this but must be verified.
- Consider storing the `presentationId` alongside each `slideId` in the DeckStructure sections so that access checks can be batched per-presentation rather than per-slide.

**Warning signs:**
- Generation failing with "SlideEmbedding not found" errors
- Sections rendering with zero slides in the skeleton HITL stage
- DeckStructure showing slideIds that do not appear in any `SlideEmbedding` query result

**Phase to address:**
DeckStructure-to-generation bridge phase -- slideId validation is the first thing the bridge must do before any assembly begins.

---

### Pitfall 5: replaceAllText Cross-Contamination in Multi-Source Assembled Decks

**What goes wrong:**
The existing `deck-assembly.ts` correctly uses `pageObjectIds` scoping when calling `replaceAllText` to prevent cross-slide contamination. But in a multi-source assembled deck, the same placeholder text (e.g., a company name like "Acme Corp" or a section title like "Our Approach") may appear on slides from different source presentations. If `replaceAllText` is called without `pageObjectIds` scoping (or with the wrong page scoping), it replaces text across ALL slides that contain the match, not just the intended slide.

This is especially dangerous with element-map-guided modifications where the system is doing targeted text replacement. If the modification plan says "on slide 3, replace 'Industry Leader' with 'Financial Services Leader'" and the call omits `pageObjectIds`, every slide containing "Industry Leader" gets modified.

**Why it happens:**
The current codebase already handles this correctly for single-source decks (line 236-238 in `deck-assembly.ts` shows `pageObjectIds: [newSlideObjectId]`). But when refactoring for multi-source assembly, developers may introduce new replacement logic that forgets this scoping -- especially when switching from `replaceAllText` (global find-and-replace) to more surgical `deleteText` + `insertText` operations on specific elements.

**How to avoid:**
- For element-map-guided modifications, do NOT use `replaceAllText`. Instead use `deleteText` + `insertText` targeted at specific element objectIds via `objectId` in the request. This is more precise than `replaceAllText` with `pageObjectIds` and eliminates the cross-contamination vector entirely.
- If `replaceAllText` must be used (e.g., for placeholder tags like `{{customer-name}}`), always include `pageObjectIds` scoped to the single slide being modified.
- Add a post-generation verification step that reads the final presentation and checks that no source-presentation-specific text leaked into unrelated slides.

**Warning signs:**
- Multiple slides showing the same deal-specific text when only one should have been modified
- Source slide content (case study names, client names from examples) appearing on unrelated slides
- Text replacement operations reporting more replacements than expected

**Phase to address:**
Per-slide modification planning phase -- the modification executor must use element-level operations, not page-level replacements.

---

### Pitfall 6: Theme/Master Slide Conflicts in Multi-Source Decks

**What goes wrong:**
Each Google Slides presentation has its own theme (colors, fonts, master slides, layouts). When slides from Source A and Source B are merged into a single output presentation, the output inherits Source A's theme (since it was created as a copy of Source A). Slides recreated from Source B lose their original theme-dependent formatting:
- Colors defined by theme color roles (ACCENT1, ACCENT2, etc.) resolve to Source A's theme colors, not Source B's
- Fonts specified as "theme font" resolve to Source A's font family
- Slide backgrounds using master slide backgrounds show Source A's master, not Source B's
- Layout placeholders reference Source A's layouts, which may have different placeholder positions

The result is slides from Source B looking visually broken -- wrong colors, wrong fonts, mispositioned elements -- even though their content is correct.

**Why it happens:**
Developers test with source presentations that happen to use the same theme (e.g., all Lumenalta decks use the same brand template). In production, source presentations may have been created at different times with different theme versions, or may include slides imported from client presentations with entirely different themes.

**How to avoid:**
- For the Lumenalta use case, enforce that all source presentations (templates and examples) use the same brand theme. This is already implicitly true for branded content but must be verified during ingestion.
- During ingestion, capture the presentation's theme ID and compare it against a known "approved theme" ID. Flag presentations with non-standard themes as requiring manual review before their slides can be used in assembly.
- When assembling slides from a non-matching theme, convert theme-dependent properties to explicit values. For example, if a text box specifies color as `themeColor: ACCENT1`, resolve it to the actual RGB value from the source theme and set it as an explicit `rgbColor` in the output. This is complex but necessary for visual fidelity.
- Alternatively (and more practically for this milestone): only allow multi-source assembly between presentations that share the same theme. The gap analysis already notes that the content library is curated Lumenalta content, so this constraint is reasonable.

**Warning signs:**
- Slides looking visually different in the output deck compared to their source presentation
- Brand colors appearing as generic blue/gray on assembled slides
- Fonts rendering as default (Arial) instead of the brand font

**Phase to address:**
Multi-source slide assembly phase -- must verify theme compatibility before attempting assembly. Add a theme check to the slide selection pipeline.

---

### Pitfall 7: 3-Stage HITL State Explosion With Structure-Driven Generation

**What goes wrong:**
The existing 3-stage HITL workflow (Skeleton -> Low-fi -> High-fi) was designed for a linear pipeline where each stage produces a single artifact type. With structure-driven generation, the stages become:
- **Skeleton**: DeckStructure blueprint + per-section slide selections (multiple selections per section, with alternatives)
- **Low-fi**: Assembled deck from selected slides (multi-source merge result)
- **High-fi**: Surgically modified deck with element-level text replacements

Each stage now carries significantly more state than before. The Skeleton stage alone includes the full DeckStructure, N section-to-slide mappings, M alternative candidates per section, the matching rationale, and the deal context used for matching. This state must survive the Mastra suspend/resume cycle and be readable by the frontend for display.

The problem: Mastra `suspend()` serializes the suspend payload as JSON into PostgresStore. The existing Touch 4 workflow's suspend payload is ~2KB. A structure-driven skeleton with 12 sections, 4 candidates each, full element maps per candidate, and matching rationale could be 50-100KB. PostgresStore's `TEXT` column can handle this, but the frontend must parse and render this complex nested structure, and the resume handler must validate it against the current schema (which may have changed between suspend and resume if a deployment occurred).

**Why it happens:**
Developers add fields to the suspend/resume schemas incrementally ("we also need the element map for preview") without tracking total payload size or considering the frontend rendering complexity of deeply nested structures.

**How to avoid:**
- Store the heavy data (full element maps, alternative candidates, matching rationale) in the database as structured records, NOT in the Mastra suspend payload. The suspend payload should contain only IDs and user decisions.
- Design the Skeleton stage suspend payload as: `{ deckStructureId: string, selections: Array<{sectionIndex: number, selectedSlideId: string}> }`. The frontend fetches the full DeckStructure and slide details via separate API calls using these IDs.
- Define explicit Zod schemas for each stage's suspend and resume payloads. Never use `z.any()` or `z.record()` for HITL payloads -- they must be fully typed for the frontend to render forms.
- Version the suspend/resume schemas. If a schema changes between deployments, existing suspended workflows must be migrated or force-completed rather than silently failing on resume.

**Warning signs:**
- Suspend payloads exceeding 10KB
- Frontend rendering the HITL review screen taking >2 seconds due to large payload parsing
- Resume failures with Zod validation errors after a deployment
- The Skeleton review UI becoming a complex form with 12+ sections, each with slide preview carousels and alternative selectors

**Phase to address:**
3-stage HITL integration phase -- define the suspend/resume payload contracts for all three stages before building any UI or workflow code.

---

### Pitfall 8: Context-Aware Slide Matching Over-Fitting to Sparse Library

**What goes wrong:**
The context-aware matching system scores candidate slides based on industry, pillar, persona, and funnel stage alignment with the deal context. With only 38 slides from 5 presentations in the current library, most sections will have 1-2 candidates at best, and many sections will have zero candidates matching all context dimensions. An over-fitted matcher (requiring industry AND pillar AND persona AND stage to match) returns zero results for most deal contexts. An under-fitted matcher (accepting any slide) returns irrelevant content.

The deeper problem: the DeckStructure's slideIds are already pre-filtered during inference. If the inference LLM mapped 3 slideIds to the "Case Study" section, and the matcher then filters by deal context, the final candidate set may be empty -- the LLM already picked the best available slides, and the context filter eliminated them.

**Why it happens:**
Developers build the matching logic against ideal scenarios (complete library with slides covering all industries and pillars) but deploy against the actual sparse library. The matching algorithm is tuned on test data that has good coverage, then fails silently in production by returning empty result sets.

**How to avoid:**
- Implement a **cascading fallback** matcher: first try exact match on all dimensions, then progressively relax (drop persona, then drop stage, then drop pillar, then accept any industry). Return the best available slide with a confidence score indicating how well it matched.
- Always guarantee at least one slide per required (non-optional) section. If matching returns zero, fall back to the DeckStructure's slideIds without context filtering, then to vector similarity search against the section purpose description.
- Log match quality metrics per generation (what percentage of sections got exact matches vs. fallback matches) so the team can identify library gaps.
- In the Skeleton HITL stage, show the match quality to the seller: "Best match (industry + pillar)" vs. "Partial match (industry only)" vs. "No match -- using closest available". Let the seller override with manual slide selection.

**Warning signs:**
- Generated decks with the same 3-4 slides appearing across all deals regardless of context
- Sections showing "No slides available" in the Skeleton review stage
- Match scores uniformly low (< 0.3) across all sections

**Phase to address:**
Context-aware section-to-slide matching phase -- build the cascading fallback from day one, not as a later fix.

---

### Pitfall 9: Element Type Assumptions Breaking Surgical Modifications

**What goes wrong:**
The element map extraction (`extract-elements.ts`) classifies elements as "shape", "text", "image", "table", or "group". The modification planner assumes that "text" elements can be modified via `deleteText` + `insertText`, "image" elements via `replaceImage`, and "shape" elements are inert backgrounds. But Google Slides has more complex element types:
- A "shape" with no text today may have text added by a human editor before generation, making it a modification target
- A "group" element cannot have its children individually targeted by `batchUpdate` -- the group must be ungrouped first, or addressed via the child's full objectId path
- A "table" element requires cell-specific addressing (`tableCellLocation: {rowIndex, columnIndex}`) for text replacement, not flat `deleteText`/`insertText`
- An "image" element that is actually a shape with an image fill behaves differently from a standalone image element
- `linked shapes` (shapes linked to a chart, spreadsheet, or another presentation) silently reject modifications

The modification planner builds a plan assuming uniform element behavior, but element types have different API request requirements.

**Why it happens:**
The element map captures the type correctly, but the modification executor treats all "text" elements identically. The current `extractElementType` function (line 39-52 of `extract-elements.ts`) uses a priority-based classification that can mis-classify edge cases (e.g., a shape with text AND an image fill gets classified as "text" because text check runs before image check).

**How to avoid:**
- Build a type-specific modification executor: `TextModifier`, `TableModifier`, `ImageModifier`, each generating the correct `batchUpdate` request type for their element type.
- For "group" elements, either skip them (plan modifications on the group's children instead) or ungroup before modifying. The element map already recursively extracts group children (line 160-162 in `extract-elements.ts`), so modification planning should target children, not the group container.
- For "table" elements, the modification plan must specify `{rowIndex, columnIndex}` for each cell to modify. The current element map does not capture cell-level position -- it concatenates all cell text into a single `contentText` string. The element map schema needs extension for table cells.
- Add an `isModifiable` flag to the element map that indicates whether the element type supports programmatic modification via the Slides API.

**Warning signs:**
- `batchUpdate` failing with "Invalid requests[N]: Element not found or type mismatch"
- Table content being replaced as a blob instead of cell-by-cell
- Group elements silently ignored during modification (no error, but no changes applied)
- Modification plans targeting background shapes that should be left alone

**Phase to address:**
Per-slide modification planning phase -- the modification executor must be type-aware from the start. Extend element map extraction to capture table cell structure if table modifications are in scope.

---

### Pitfall 10: Concurrent Modification of Output Presentation During Generation

**What goes wrong:**
The generation pipeline executes multiple `batchUpdate` calls sequentially against the output presentation (create slides, inject text, reorder, apply customizations). If the Low-fi stage produces the assembled deck and the seller opens it in Google Slides to preview, the seller's browser establishes a WebSocket connection to the presentation. If the High-fi stage then runs `batchUpdate` to apply surgical modifications, Google Slides handles concurrent modifications via operational transforms -- but the API client does not. The API client may see stale objectIds because the presentation was modified by the seller's browser session (e.g., the seller manually moved an element, changing its transform properties).

More critically: if the seller manually edits a slide between the Low-fi and High-fi stages (which is expected -- they preview and make notes), the element map-based modification plan targets elements based on the Low-fi state. The seller's edits may have changed text content, repositioned elements, or added new elements that the plan does not account for.

**Why it happens:**
The HITL workflow by design encourages human review between stages. The Low-fi stage produces a Google Slides presentation that the seller can open and inspect. The High-fi stage then modifies the same presentation. There is no mechanism to detect or handle intervening human edits.

**How to avoid:**
- Before applying High-fi modifications, re-read the presentation via `presentations.get` and compare against the expected state from the Low-fi stage. If the presentation has been modified (revision count changed, elements moved, text changed), warn the seller and offer to regenerate from Low-fi.
- Store the `presentation.revisionId` at the end of the Low-fi stage. At the start of High-fi, check if the revisionId matches. If not, the presentation was modified externally.
- Design the High-fi modifications to be **idempotent** -- applying them twice should produce the same result as applying once. This means using absolute values for positions/sizes, not relative adjustments.
- Alternatively: do not modify the Low-fi presentation in place. Create a new copy for High-fi modifications, preserving the Low-fi version as a reference.

**Warning signs:**
- High-fi modifications silently overwriting seller's manual edits
- `batchUpdate` failing with "revision mismatch" errors
- Generated deck having a mix of AI-modified and human-modified content that looks inconsistent

**Phase to address:**
3-stage HITL integration phase -- define the Low-fi to High-fi transition contract (new copy vs. in-place modification) before building the High-fi executor.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single-source assembly for all touches initially | Avoids solving the hard multi-source merge problem; ships faster | Decks look uniform (all slides from one source); defeats the "visually diverse" vision | Acceptable as Phase 1 if multi-source is planned for Phase 2 within the same milestone |
| Skipping element map verification at generation time | Faster generation; fewer API calls to Google | Stale element maps cause silent modification failures; no way to diagnose why text wasn't replaced | Never -- always verify element map freshness for any slide being modified |
| Storing full slide element maps in Mastra suspend payload | No extra DB queries during HITL review; self-contained workflow state | Payload bloat; slow suspend/resume; schema migration breaks active workflows | Never -- store in DB, reference by ID in workflow |
| Using `replaceAllText` instead of element-targeted `deleteText`/`insertText` | Simpler code; matches existing pattern in `deck-assembly.ts` | Cross-contamination risk; cannot handle per-element modifications; breaks with multi-source decks | Only for placeholder-based replacements (e.g., `{{customer-name}}`) scoped with `pageObjectIds`; never for content-level modifications |
| Hardcoding theme compatibility check to "always compatible" | Avoids building theme comparison logic; all current content uses the same theme | Silently produces broken-looking decks when a non-standard theme presentation enters the library | Acceptable for MVP if all source presentations are verified to use the same brand theme; add validation before allowing new presentations as assembly sources |
| Re-using existing `SlideAssembly` schema for structure-driven generation | No new schema; existing proposal-assembly code works | Schema lacks fields for source presentation tracking, element map references, and modification plans; forces workarounds like the `SlideWithSourceMeta` cast on line 156 of `deck-assembly.ts` | Never -- define a new `StructuredSlideAssembly` schema from the start |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Slides API `batchUpdate` | Sending all modification requests in a single `batchUpdate` call across multiple slides; one invalid request fails ALL requests (atomic semantics) | Batch per-slide: one `batchUpdate` per slide, with per-slide error handling (try/catch). The existing `deck-assembly.ts` already follows this pattern (line 154-271). |
| Google Slides objectIds after `duplicateObject` | Assuming the duplicated slide's element objectIds are predictable or match the source | Always read `duplicateResponse.data.replies[0].duplicateObject.objectId` for the new slide ID, then `presentations.get` to discover element IDs within the new slide |
| `DeckStructure.structureJson` + `SlideEmbedding` | Treating `slideIds` in the JSON blob as foreign keys with referential integrity | They are not FK-constrained. Validate existence at read time. Consider a junction table (`DeckStructureSlide`) for proper FK enforcement if time permits. |
| Google Drive API `files.copy` rate limits | Copying N source presentations sequentially for multi-source assembly; 5+ copy operations can hit rate limits (user-level: 10 requests per second) | Batch with delays (100ms between copy operations); re-use temp copies across slides from the same source presentation; clean up temp copies in a `finally` block |
| Element map `positionX`/`positionY` in EMU | Using raw EMU values for modification planning without accounting for the slide's `transform` (which includes scaleX, scaleY, shearX, shearY, translateX, translateY) | Element positions in the element map are `transform.translateX/Y`, which are absolute. But for grouped elements, positions are relative to the group's transform. Use the recursively-extracted children (already in `extract-elements.ts`) but verify that position coordinates are absolute, not group-relative. |
| Mastra workflow suspend/resume + schema evolution | Changing the suspend schema for the Skeleton stage after some workflows are already suspended | Pin schema version in the suspend payload; detect version mismatch on resume and either migrate or force-complete with user notification |
| Ingestion auto-re-ingestion + generation pipeline | Auto-re-ingestion running during a generation workflow; re-ingestion archives or modifies `SlideEmbedding` records that the generation pipeline is actively reading | Add a "generation lock" flag that suppresses re-ingestion for presentations whose slides are being assembled. The existing "active session protection" pattern (SHA-256 change detection, 30-min window) can be adapted. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full element maps for all candidate slides during matching | Matching step takes 10+ seconds; high DB query load | Only fetch element maps for the final selected slides (after matching), not for all candidates. Matching should use slide metadata (classification, description), not element-level data. | With 50+ candidate slides per section (when library grows) |
| Sequential `presentations.get` calls for each source presentation | Multi-source assembly taking 30+ seconds for 4-5 sources; Google API latency dominates | Batch source presentation reads with `Promise.all`; cache presentation data per source for the duration of the generation run | With 3+ source presentations in a single assembly |
| Re-reading the output presentation after every single `batchUpdate` | 2N API calls for N slides (one write, one read per slide); generation takes minutes | Group modifications by type: all slide creations first, one read, all text replacements second, one final read. The existing "re-read after batchUpdate" discipline should be applied per-phase, not per-request. | With 15+ slides in the output deck |
| LLM-powered modification planning for every element on every slide | One LLM call per slide (12+ slides) with full element map context; 30+ seconds of LLM inference | Use rule-based modification for standard patterns (title replacement, company name, date). Reserve LLM planning for complex content modifications (case study narratives, solution descriptions). | Immediately -- 12 LLM calls adds 30-60 seconds to generation |
| Vector similarity search fallback for every unmatched section | Each fallback query hits pgvector for 768-dim cosine similarity across all slides | Cache embedding query results; use metadata pre-filtering before vector search (filter by touch type and slide category first, then rank by similarity) | With 200+ slides in the library |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Temp presentation copies not cleaned up after multi-source assembly | Orphaned Google Drive files accumulate under the service account; potential data exposure if temp copies contain sensitive content | Use a `try/finally` pattern that deletes all temp copies regardless of success/failure. Log cleanup failures for manual remediation. The existing `tryAccessSourcePresentation` in `deck-assembly.ts` (line 84-94) already follows this pattern but only for validation copies. |
| Element maps exposing internal content in the Skeleton HITL stage | Sellers see raw element text from example presentations (client names, financial figures from case studies) in the review UI | Sanitize element map content for display: show element type and position, but redact or summarize `contentText` from example slides. Only show full content for the seller's own deal data. |
| Source presentation access tokens stored in workflow state | If the generation workflow stores Google access tokens in the Mastra suspend payload for resumption, those tokens persist in PostgresStore beyond their expiry | Never store tokens in workflow state. Re-acquire tokens at resume time using the existing `getPooledGoogleAuth` pattern. Tokens should flow through function parameters, not serialized state. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Skeleton stage showing raw DeckStructure JSON | Sellers cannot interpret section names, slide IDs, and variation counts in JSON format | Render the Skeleton as a visual slide-order preview: section name cards with thumbnail previews of the selected slide for each section, drag-to-reorder, and a "swap slide" button showing alternatives |
| No visual diff between Low-fi and High-fi stages | Seller cannot see what the AI changed during surgical modifications; approves blindly | Highlight modified elements in the High-fi preview (colored borders or annotation badges indicating "AI modified this text") |
| Slide matching showing only the best match without alternatives | Seller cannot exercise judgment; stuck with AI's single choice per section | Show top 3 candidates per section with match score explanations; let seller swap any section's slide before assembly |
| Context-aware matching not explaining its reasoning | Seller sees a slide selected for "Case Study" section but does not understand why this slide vs. others | Include a one-line rationale per selection: "Selected because: Financial Services industry match + Enterprise persona match (score: 0.87)" |
| HITL revert from High-fi losing manual edits | Seller reverts from High-fi to Low-fi, expecting to keep their manual edits to the Google Slides deck, but revert regenerates from scratch | Warn before revert: "This will regenerate the deck from your Skeleton selections. Any manual edits to the Google Slides file will be lost." Preserve the current Google Slides file as a backup before regenerating. |

## "Looks Done But Isn't" Checklist

- [ ] **Multi-source assembly:** Often missing cleanup of temp presentation copies -- verify that ALL temporary Drive files are deleted even when the assembly pipeline fails mid-execution
- [ ] **Element-map-guided modification:** Often missing table cell support -- verify that tables with per-cell content are modified cell-by-cell (`tableCellLocation`), not as a single text blob
- [ ] **DeckStructure bridge:** Often missing slideId validation -- verify that archived, deleted, or inaccessible slides are filtered out before presenting the Skeleton to the seller
- [ ] **Context-aware matching:** Often missing the "no matches" fallback -- verify that every required section gets at least one slide even when context filters return empty results
- [ ] **Skeleton HITL stage:** Often missing the "empty section" UI state -- verify that optional sections with zero available slides show a "Skip this section" option rather than an error
- [ ] **Low-fi to High-fi transition:** Often missing revision check -- verify that the system detects external edits to the Google Slides file between stages and warns the seller
- [ ] **Theme compatibility:** Often missing validation at ingestion time -- verify that newly ingested presentations are checked against the brand theme before their slides become assembly candidates
- [ ] **Per-slide error handling:** Often missing partial success reporting -- verify that if 2 of 12 slides fail modification, the seller sees which slides failed and can choose to proceed with 10 successful slides
- [ ] **Slide reordering in assembled deck:** Often missing the final read-back -- verify slide order in the output presentation matches the DeckStructure section order after all batchUpdate operations complete

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ObjectId collision in multi-source assembly | MEDIUM | Re-read the output presentation; identify colliding elements; regenerate with new IDs using the mapping table; if unrecoverable, delete output and reassemble from scratch |
| Stale element map causing wrong text replacement | LOW | Re-read the affected slide from the source presentation; rebuild element map; re-run modification for that slide only; update stored element map |
| DeckStructure slideIds pointing to archived slides | LOW | Re-run slideId validation; replace invalid IDs with vector similarity search results; update DeckStructure JSON; no need to re-infer |
| Theme mismatch producing visually broken slides | HIGH | Must re-assemble the deck using only theme-compatible sources, or manually convert theme-dependent properties to explicit values across all affected slides |
| Multi-source assembly temp copies not cleaned up | LOW | Query Drive API for files named `_temp_*` or `_assembly_*` owned by the service account; batch delete; add a scheduled cleanup job |
| HITL suspend payload too large causing slow resume | MEDIUM | Extract heavy data into DB records; update workflow code to reference by ID; force-complete existing large-payload workflows and ask sellers to restart |
| Cross-contamination from unscoped replaceAllText | MEDIUM | Re-read the output presentation; identify slides with incorrect text replacements; either re-run with correct scoping or manually fix via additional batchUpdate calls |
| Modification plan failing on grouped elements | LOW | Ungroup the element via `ungroupObjects` request; re-plan modifications targeting the now-ungrouped children; re-execute |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| No cross-presentation slide copy API | Multi-source slide assembly | Integration test: copy slide from Presentation A into Presentation B; verify content and formatting preserved |
| ObjectId collisions | Multi-source slide assembly | Test: assemble from 3 sources; verify no "Object already exists" errors; verify element count matches expectations |
| Element map staleness | DeckStructure-to-generation bridge | Test: modify a source slide in Google Slides, then generate; verify generation uses live data, not stale element map |
| Dangling slideIds in DeckStructure | DeckStructure-to-generation bridge | Test: archive a slide, then generate from a DeckStructure referencing it; verify graceful fallback, not crash |
| replaceAllText cross-contamination | Per-slide modification planning | Test: assemble a deck where 2 slides contain identical text; modify only one; verify the other is unchanged |
| Theme conflicts in multi-source decks | Multi-source slide assembly | Test: assemble from presentations with different themes; verify visual output; add theme check to ingestion |
| HITL state explosion | 3-stage HITL integration | Measure suspend payload size for a 12-section deck; verify < 5KB; verify frontend renders Skeleton in < 1 second |
| Context matching over-fitting | Context-aware section-to-slide matching | Test: generate for an industry with zero exact-match slides; verify cascading fallback produces a complete deck |
| Element type assumptions | Per-slide modification planning | Test: modify a slide containing a table, a group, and an image; verify each element type is handled correctly |
| Concurrent modification between HITL stages | 3-stage HITL integration | Test: manually edit the Low-fi Google Slides file; trigger High-fi; verify warning or graceful handling |

## Sources

- [Google Slides API Slide Operations](https://developers.google.com/workspace/slides/api/samples/slides) -- confirms `duplicateObject` is within-presentation only
- [Google Slides API Merge Guide](https://developers.google.com/workspace/slides/api/guides/merge) -- tag-based replacement pattern, "don't manipulate your template copy" warning
- [Google Slides API DuplicateObjectRequest](https://developers.google.com/resources/api-libraries/documentation/slides/v1/java/latest/com/google/api/services/slides/v1/model/DuplicateObjectRequest.html) -- objectIds map must reference existing IDs in the same presentation
- [Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584) -- Feature request for cross-presentation slide copy; open since 2020, unresolved
- [Google Slides API Batch Requests](https://developers.google.com/slides/api/guides/batch) -- all-or-nothing semantics for batchUpdate
- [Google Apps Script Presentation.appendSlides](https://developers.google.com/apps-script/reference/slides/presentation) -- Apps Script has cross-presentation copy but REST API does not
- Direct codebase analysis: `deck-assembly.ts` (single-source assembly, pageObjectIds scoping), `deck-customizer.ts` (copy-and-prune strategy), `extract-elements.ts` (element map extraction with recursive group handling), `deck-structure-schema.ts` (DeckSection with slideIds), `touch-4-workflow.ts` (3-stage suspend/resume pattern)
- `apps/agent/prisma/schema.prisma`: `SlideElement` model stores elementId from source presentation; no FK to output presentation elements
- `CLAUDE.md`: Forward-only migration discipline constraining schema evolution approach
- `.planning/slide-deck-generation-gap-analysis.md`: Gap analysis incorrectly states duplicateObject supports cross-presentation copy

---
*Pitfalls research for: v1.8 Structure-Driven Deck Generation milestone on Lumenalta Agentic Sales Orchestration*
*Researched: 2026-03-09*
