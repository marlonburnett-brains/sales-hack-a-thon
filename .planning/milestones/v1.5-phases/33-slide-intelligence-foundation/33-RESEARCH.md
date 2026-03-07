# Phase 33: Slide Intelligence Foundation - Research

**Researched:** 2026-03-07
**Domain:** Slide AI descriptions, element map extraction, content classification UI
**Confidence:** HIGH

## Summary

This phase adds three capabilities to the existing ingestion pipeline and template management UI: (1) AI-generated slide descriptions via a separate LLM call, (2) structured element maps extracted from Google Slides API page element data, and (3) user-facing content classification (Template/Example) with touch binding. All three build directly on existing, well-understood patterns in the codebase.

The slide extractor (`slide-extractor.ts`) already calls `presentations.get` which returns full `pageElements` data including position, size, type, and styling -- currently only text is extracted. Extending this to return full element maps is straightforward. The LLM description generation follows the exact same `@google/genai` + `responseSchema` pattern used in `classify-metadata.ts`. The content classification UI extends the existing `template-card.tsx` dropdown and `template-utils.ts` status system.

**Primary recommendation:** Implement in three waves: (1) schema migration + element extraction + description generation in the ingestion pipeline, (2) backfill logic on agent startup, (3) UI for descriptions, element maps, and content classification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Separate LLM call from classification (accuracy over cost) -- different prompt strategies for categorical vs narrative tasks
- Descriptions cover all four aspects: purpose, visual composition, key content, use cases
- Displayed as dedicated collapsible section in ClassificationPanel (above classification tags), expanded by default
- Slides missing descriptions are auto-flagged for re-ingestion -- no manual action needed
- Placeholder shows "Generating description..." while backfill is in progress
- Full structural detail: element ID, type (shape/text/image/table/group), position (x, y, width, height), content text, basic styling (font size, color, bold)
- Stored in separate SlideElement table (one row per element, FK to SlideEmbedding) -- needed for downstream programmatic slide manipulation
- Extracted during the same ingestion pass as slide text (Google Slides API already returns page element data)
- Visible in slide viewer UI with shrinkable/expandable thumbnail layout
- Users can classify presentations as "Template" or "Example" from both template cards (quick action dropdown) and template detail/viewer page
- When classifying as "Example", touch type binding is required immediately (inline selector, can't save without selecting at least one touch)
- "Classify" amber badge on template cards for unclassified presentations
- New contentClassification enum field on Template model ('template' | 'example' | null)
- Classification visible on template cards and detail views
- Auto-detect on agent startup: find all slides with null description or null element map, queue their templates for re-ingestion
- Description-only pass for unchanged slides: run only description LLM call + element extraction, skip re-classification and re-embedding
- Fresh Google Slides API call during backfill for element extraction
- Background execution with summary toast on completion
- Templates show normal 'ingesting' status during backfill

### Claude's Discretion
- Exact description LLM prompt engineering and model selection
- SlideElement table schema details (column types, indexes)
- Element map viewer UI layout specifics (how thumbnail resize works)
- Backfill queue ordering and concurrency
- Rate limiting between description LLM calls
- Toast duration and backfill progress polling interval

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLI-01 | System generates rich AI description for each slide during ingestion | New `generateSlideDescription()` function using `@google/genai` structured output, added as step in `ingest-template.ts` after classification |
| SLI-02 | Slide descriptions are visible in the per-template slide viewer metadata panel | New collapsible description section in `ClassificationPanel` above classification tags |
| SLI-03 | System extracts structured element map from Google Slides API during ingestion | Extend `slide-extractor.ts` to return full `pageElements` data; store in new `SlideElement` table |
| SLI-04 | Element maps are stored per slide and accessible for downstream consumption | New `SlideElement` Prisma model with FK to `SlideEmbedding`, one row per page element |
| SLI-05 | System backfills descriptions and element maps for already-ingested slides on re-ingestion | Startup detection of null descriptions/element maps, description-only pass in `ingest-template.ts` |
| CCL-01 | User can classify a presentation as "Template" or "Example" | New `contentClassification` field on Template model, dropdown in template card + detail page |
| CCL-02 | User can bind an "Example" presentation to a specific touch type | Touch type selector appears when "Example" is selected, saves to existing `touchTypes` field |
| CCL-03 | User sees "Action Required" indicator on unclassified presentations | New "Classify" amber badge variant in `IngestionStatusBadge` / `template-utils.ts` |
| CCL-04 | Classification is displayed on template cards and detail views | Template card shows classification label, detail/viewer page shows classification state |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google/genai | (existing) | LLM description generation + structured output | Already used for classification in `classify-metadata.ts` |
| googleapis (slides_v1) | (existing) | Page element extraction from presentations.get | Already used in `slide-extractor.ts` |
| prisma | 6.19.x | SlideElement model + Template contentClassification field | Project ORM; stay on 6.19.x per blocker note |
| pgvector | (existing) | Raw SQL for SlideEmbedding upserts with description column | Existing pattern for vector-type columns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (existing) | Toast notifications for backfill completion | Backfill summary toast |
| lucide-react | (existing) | Icons for classification UI | Classify badge, dropdown items |
| shadcn/ui | (existing) | Collapsible, Select, Badge components | Description section, classification selector |

### Alternatives Considered
None -- all work uses existing stack. No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
├── ingestion/
│   ├── ingest-template.ts        # Extend with description + element extraction steps
│   ├── describe-slide.ts         # NEW: LLM description generation
│   ├── extract-elements.ts       # NEW: Element map extraction from pageElements
│   └── backfill-descriptions.ts  # NEW: Startup backfill detection + queue
├── lib/
│   └── slide-extractor.ts        # Extend to return raw pageElements alongside text
apps/web/src/
├── components/
│   └── slide-viewer/
│       ├── classification-panel.tsx  # Add description section
│       └── element-map-panel.tsx     # NEW: Element map viewer
├── lib/
│   ├── template-utils.ts            # Add "classify" status
│   └── actions/
│       └── template-actions.ts       # Add classification action
```

### Pattern 1: Description Generation (Same as classify-metadata.ts)
**What:** Separate LLM call using `@google/genai` with `responseSchema` for structured description output
**When to use:** During ingestion, after slide text extraction, separate from classification
**Example:**
```typescript
// Source: classify-metadata.ts existing pattern
const DESCRIPTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    purpose: { type: Type.STRING, description: "What this slide is for" },
    visualComposition: { type: Type.STRING, description: "Layout and visual elements" },
    keyContent: { type: Type.STRING, description: "Main information conveyed" },
    useCases: { type: Type.STRING, description: "When to use this slide" },
  },
  required: ["purpose", "visualComposition", "keyContent", "useCases"],
};

const ai = new GoogleGenAI({ vertexai: true, project, location });
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",  // Same model as classification
  contents: descriptionPrompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: DESCRIPTION_SCHEMA,
  },
});
```

### Pattern 2: Element Map Extraction from Google Slides API
**What:** Extract full structural data from `pageElements` returned by `presentations.get`
**When to use:** During same ingestion pass as text extraction
**Example:**
```typescript
// Source: Google Slides API pageElement structure (slides_v1.Schema$PageElement)
interface ExtractedElement {
  elementId: string;       // element.objectId
  elementType: string;     // "shape" | "text" | "image" | "table" | "group"
  positionX: number;       // element.transform.translateX (EMU)
  positionY: number;       // element.transform.translateY (EMU)
  width: number;           // element.size.width.magnitude (EMU)
  height: number;          // element.size.height.magnitude (EMU)
  contentText: string;     // extracted text content
  fontSize: number | null; // from textStyle.fontSize.magnitude
  fontColor: string | null; // from textStyle.foregroundColor
  isBold: boolean;         // from textStyle.bold
}

// Element type detection:
// element.shape -> "shape" or "text" (if has text content)
// element.image -> "image"
// element.table -> "table"
// element.elementGroup -> "group"
```

### Pattern 3: Backfill Detection on Startup
**What:** Query for slides missing descriptions or element maps, queue their templates for re-ingestion
**When to use:** Agent startup, after `clearStaleIngestions()` completes
**Example:**
```typescript
// Run after clearStaleIngestions() in mastra/index.ts startup
async function detectAndQueueBackfill(): Promise<void> {
  // Find templates with slides missing descriptions
  const templateIds = await prisma.$queryRaw<{ templateId: string }[]>`
    SELECT DISTINCT "templateId" FROM "SlideEmbedding"
    WHERE archived = false AND description IS NULL
  `;

  for (const { templateId } of templateIds) {
    ingestionQueue.enqueue(templateId);  // Uses existing queue
  }
}
```

### Pattern 4: Content Classification (Template/Example)
**What:** New enum field on Template model with UI for classification
**When to use:** User action from template card dropdown or detail page
**Example:**
```typescript
// Template model extension
contentClassification String?  // null | "template" | "example"

// API endpoint pattern (follows existing registerApiRoute pattern)
registerApiRoute("/templates/:id/classify", {
  method: "POST",
  handler: async (req) => {
    const { classification, touchTypes } = await req.json();
    // If "example", touchTypes is required
    await prisma.template.update({
      where: { id },
      data: { contentClassification: classification, touchTypes: JSON.stringify(touchTypes) },
    });
  },
});
```

### Anti-Patterns to Avoid
- **Combining description + classification in one LLM call:** Decision explicitly locks separate calls for accuracy
- **Using `prisma db push`:** Project rule requires `prisma migrate dev --name <name>` for all schema changes
- **Storing element map as JSON blob on SlideEmbedding:** Decision requires separate `SlideElement` table for downstream programmatic access
- **Re-running embedding during backfill:** Decision says skip re-classification and re-embedding for unchanged slides

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON structured output from LLM | Custom JSON parsing + validation | `@google/genai` `responseSchema` config | Gemini guarantees valid JSON matching schema; already proven in classify-metadata.ts |
| Element position/size units | Custom unit conversion | Google Slides EMU (English Metric Units) stored as-is | 1 EMU = 1/914400 inch; convert only at display time if needed |
| Ingestion queue management | Custom concurrent queue | Existing `IngestionQueue` singleton | Already handles dedup, sequential processing, rate limiting |
| Status badge variants | New badge component | Extend existing `STATUS_CONFIG` in `template-utils.ts` | Consistent with Ready/Stale/Failed pattern |

**Key insight:** Nearly everything in this phase extends existing patterns rather than introducing new ones. The description generation is a carbon copy of classification. Element extraction extends an API call already being made. Classification UI extends existing badge/dropdown patterns.

## Common Pitfalls

### Pitfall 1: EMU Unit Confusion
**What goes wrong:** Google Slides positions/sizes are in EMUs (914400 per inch), not pixels
**Why it happens:** Developers expect pixel values from the API
**How to avoid:** Store raw EMU values in the database; convert to pixels/percentages only in the UI layer. Document the conversion factor.
**Warning signs:** Element positions look absurdly large (millions)

### Pitfall 2: Missing pageElements on Certain Slide Types
**What goes wrong:** Some slides (like master layouts or note pages) may have unexpected element structure
**Why it happens:** Google Slides has multiple page types: slides, masters, layouts, notes
**How to avoid:** Only extract from `presentation.slides` (already the case in `slide-extractor.ts`), not from masters/layouts
**Warning signs:** Duplicate elements or elements from master templates appearing in extraction

### Pitfall 3: Backfill Race Condition with Manual Re-ingest
**What goes wrong:** User triggers re-ingest while backfill is also queued for the same template
**Why it happens:** Both startup backfill and user action enqueue the same templateId
**How to avoid:** `IngestionQueue.enqueue()` already deduplicates by templateId -- this is handled automatically
**Warning signs:** Template stuck in "ingesting" state

### Pitfall 4: SlideEmbedding Description Column in Raw SQL
**What goes wrong:** New `description` column on SlideEmbedding must be included in the raw SQL INSERT/UPDATE statements
**Why it happens:** SlideEmbedding uses raw SQL (not Prisma) because of the vector column
**How to avoid:** Update ALL raw SQL statements in `ingest-template.ts` that INSERT or UPDATE `SlideEmbedding` to include the new `description` column
**Warning signs:** Descriptions are null even after ingestion completes

### Pitfall 5: Prisma Migration with Existing Data
**What goes wrong:** Adding NOT NULL columns to tables with existing data fails
**Why it happens:** Existing rows can't satisfy NOT NULL constraint
**How to avoid:** New columns (`description`, `contentClassification`) MUST be nullable (they start as null and get populated)
**Warning signs:** Migration fails with "column contains null values"

### Pitfall 6: Content Classification vs touchTypes Semantics
**What goes wrong:** Conflating `contentClassification` with existing `touchTypes` field
**Why it happens:** Both relate to content categorization
**How to avoid:** `contentClassification` is a new field (template/example/null), separate from `touchTypes` which stores JSON array of touch bindings. When classifying as "Example", touchTypes gets updated but contentClassification is the enum field.
**Warning signs:** Existing touch type assignments getting overwritten

## Code Examples

### Slide Description LLM Prompt
```typescript
// describe-slide.ts
function buildDescriptionPrompt(slide: ExtractedSlide, titleSlideText: string): string {
  return `You are analyzing a single slide from a sales presentation to generate a rich description.

DECK CONTEXT:
- Deck name: ${slide.presentationName}
- Slide index: ${slide.slideIndex}
- Title slide content: ${titleSlideText || "(no title slide text)"}

SLIDE CONTENT:
${slide.textContent || "(empty)"}

SPEAKER NOTES:
${slide.speakerNotes || "(none)"}

Generate a comprehensive description covering:
1. PURPOSE: What is this slide designed to communicate? What role does it play in the presentation?
2. VISUAL COMPOSITION: Describe the layout, key visual elements, and how information is organized.
3. KEY CONTENT: Summarize the main points, data, or messaging on this slide.
4. USE CASES: When and how would a sales team use this specific slide? Which meetings or audiences is it best suited for?

Be specific and actionable. A seller should read this description and immediately understand when to use this slide.`;
}
```

### Element Extraction from pageElements
```typescript
// extract-elements.ts
import type { slides_v1 } from "googleapis";

interface SlideElementData {
  elementId: string;
  elementType: "shape" | "text" | "image" | "table" | "group";
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  contentText: string;
  fontSize: number | null;
  fontColor: string | null;
  isBold: boolean;
}

function extractElementType(element: slides_v1.Schema$PageElement): SlideElementData["elementType"] {
  if (element.elementGroup) return "group";
  if (element.table) return "table";
  if (element.image) return "image";
  if (element.shape?.text?.textElements?.some(te => te.textRun?.content?.trim())) return "text";
  return "shape";
}

function extractElements(pageElements: slides_v1.Schema$PageElement[]): SlideElementData[] {
  const result: SlideElementData[] = [];

  for (const el of pageElements) {
    const transform = el.transform;
    const size = el.size;

    // Get first text style for basic styling info
    let fontSize: number | null = null;
    let fontColor: string | null = null;
    let isBold = false;

    const textElements = el.shape?.text?.textElements ?? [];
    for (const te of textElements) {
      if (te.textRun?.style) {
        const style = te.textRun.style;
        if (style.fontSize?.magnitude) fontSize = style.fontSize.magnitude;
        if (style.foregroundColor?.opaqueColor?.rgbColor) {
          const rgb = style.foregroundColor.opaqueColor.rgbColor;
          fontColor = `#${Math.round((rgb.red ?? 0) * 255).toString(16).padStart(2, '0')}${Math.round((rgb.green ?? 0) * 255).toString(16).padStart(2, '0')}${Math.round((rgb.blue ?? 0) * 255).toString(16).padStart(2, '0')}`;
        }
        if (style.bold) isBold = true;
        break; // Use first text run's style
      }
    }

    result.push({
      elementId: el.objectId ?? "",
      elementType: extractElementType(el),
      positionX: transform?.translateX ?? 0,
      positionY: transform?.translateY ?? 0,
      width: size?.width?.magnitude ?? 0,
      height: size?.height?.magnitude ?? 0,
      contentText: extractTextFromElement(el),
      fontSize,
      fontColor,
      isBold,
    });

    // Recurse into groups
    if (el.elementGroup?.children) {
      result.push(...extractElements(el.elementGroup.children));
    }
  }

  return result;
}
```

### Prisma Schema Migration
```prisma
// Add to SlideEmbedding
model SlideEmbedding {
  // ... existing fields ...
  description String?   // AI-generated rich description (JSON: purpose, visualComposition, keyContent, useCases)
  // ... rest of fields ...
}

// New model
model SlideElement {
  id          String @id @default(cuid())
  slideId     String // FK to SlideEmbedding.id
  elementId   String // Google Slides objectId
  elementType String // "shape" | "text" | "image" | "table" | "group"
  positionX   Float  // EMU (English Metric Units)
  positionY   Float  // EMU
  width       Float  // EMU
  height      Float  // EMU
  contentText String @default("")
  fontSize    Float?
  fontColor   String?
  isBold      Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  slide SlideEmbedding @relation(fields: [slideId], references: [id], onDelete: Cascade)

  @@index([slideId])
  @@unique([slideId, elementId])
}

// Add to Template
model Template {
  // ... existing fields ...
  contentClassification String?  // null | "template" | "example"
}
```

### Classification UI in Template Card
```typescript
// In template-card.tsx dropdown menu, add:
<DropdownMenuItem onClick={() => openClassificationDialog()}>
  <Tag className="mr-2 h-4 w-4" />
  Classify
</DropdownMenuItem>

// Classification dialog with inline touch selector for "Example" type
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only slide extraction | Full pageElement structural data | This phase | Enables downstream slide manipulation |
| Classification-only LLM call | Separate description + classification calls | This phase | Richer slide metadata for search and assembly |
| Implicit content types | Explicit Template/Example classification | This phase | Better content organization for deck intelligence |

## Open Questions

1. **Description storage format**
   - What we know: Description has 4 fields (purpose, visualComposition, keyContent, useCases)
   - What's unclear: Store as JSON string in TEXT column (like classificationJson) or as 4 separate columns?
   - Recommendation: JSON TEXT column on SlideEmbedding (consistent with classificationJson pattern, parse on read). Single column is simpler for raw SQL updates.

2. **Element map for grouped elements**
   - What we know: Groups contain child elements recursively
   - What's unclear: Should group children be stored as separate rows or nested JSON?
   - Recommendation: Separate rows with parent reference (null for top-level). Downstream manipulation needs individual element access.

3. **Backfill ordering**
   - What we know: Auto-detect on startup, queue for re-ingestion
   - What's unclear: Priority order for backfill queue
   - Recommendation: Most recently ingested first (users likely care about recent content more). Simple `ORDER BY lastIngestedAt DESC`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `classify-metadata.ts` -- established `@google/genai` + `responseSchema` pattern
- Codebase analysis: `slide-extractor.ts` -- `presentations.get` already returns full pageElements
- Codebase analysis: `ingest-template.ts` -- raw SQL INSERT/UPDATE pattern for SlideEmbedding
- Codebase analysis: `ingestion-queue.ts` -- sequential queue with deduplication
- Codebase analysis: `template-utils.ts` -- STATUS_CONFIG badge system
- Codebase analysis: `template-card.tsx` -- dropdown menu actions pattern
- Codebase analysis: Prisma schema -- all existing models and constraints
- Google Slides API docs -- `Schema$PageElement` structure (transform, size, shape, image, table, elementGroup)

### Secondary (MEDIUM confidence)
- Google Slides API EMU units -- 914400 EMU = 1 inch (standard conversion, well-documented)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- all patterns extend existing codebase patterns with clear precedents
- Pitfalls: HIGH -- identified from direct codebase analysis (raw SQL requirements, nullable columns, dedup)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependency changes expected)
