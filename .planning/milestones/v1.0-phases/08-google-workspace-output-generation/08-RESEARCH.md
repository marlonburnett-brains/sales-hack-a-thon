# Phase 8: Google Workspace Output Generation - Research

**Researched:** 2026-03-04
**Domain:** Google Slides API deck assembly, Google Docs API document generation, Mastra workflow extension
**Confidence:** HIGH

## Summary

Phase 8 transforms the validated SlideJSON (Phase 7 output) into three Google Workspace artifacts: a formatted Google Slides deck, a slide-by-slide talk track Google Doc, and a buyer FAQ Google Doc. All artifacts are created in the existing per-deal shared Drive folder using the service account.

The project already has a mature foundation for this phase. The `assembleDeckFromSlides()` function in `deck-customizer.ts` implements the proven "copy and prune" strategy for cross-presentation assembly. The `assembleFromTemplate()` function in `slide-assembly.ts` handles template copy + batchUpdate text replacement. The `getDocsClient()` factory in `google-auth.ts` already has the Docs API scope enabled. The Mastra workflow pattern for appending steps to touch-4-workflow is well established across 11 prior steps.

**Primary recommendation:** Use a hybrid assembly strategy -- copy the branded template deck as the base, duplicate template slides for each section type (synthesized slides), and for retrieved slides copy the source presentation slide-by-slide using the "copy source presentation, duplicate target slide, delete source copy" pattern. For Google Docs, build content bottom-up using reverse-index insertText + updateParagraphStyle batchUpdate requests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Template copy + populate pattern (reuses assembleFromTemplate() from Phase 4)
- Retrieved slides (sourceType="retrieved"): copy the original Google Slides slide from its source presentation using sourceBlockRef to locate it, preserving original visual layout and formatting. Inject bespoke copy via Slides API batchUpdate text replacements
- Synthesized slides (sourceType="synthesized"): use branded section templates -- maintain a branded template deck with one template slide per section type (title_context, problem_restatement, roi_outcomes, next_steps). Copy the matching template slide into the deck, then inject synthesized content via text replacement
- All artifacts go in the existing per-deal folder (getOrCreateDealFolder() from Phase 4) -- no subfolders
- Deck naming: "[CompanyName] - [PrimaryPillar] - [Date]" per success criteria
- Deck made publicly viewable (makePubliclyViewable()) for iframe preview, consistent with Phase 4
- Talk track: Slide-by-slide speaker notes format, reuse speakerNotes from Phase 7's generateCustomCopy step, simple headings + body text format (H1 = deck title, H2 = each slide title, body = speaker notes), naming "[CompanyName] - [PrimaryPillar] Talk Track - [Date]"
- Buyer FAQ: Role-specific objections per stakeholder from approved brief, 2-3 objections per role (6-12 total), single Gemini call with BuyerFaqLlmSchema, doc structure H1 = title / H2 = stakeholder role / bold = objection / body = response, naming "[CompanyName] - [PrimaryPillar] Buyer FAQ - [Date]"
- 3 new sequential workflow steps appended to touch-4-workflow: Step 12 createSlidesDeck, Step 13 createTalkTrack, Step 14 createBuyerFAQ
- Drive URLs (deckUrl, talkTrackUrl, faqUrl) stored in InteractionRecord.outputRefs
- Workflow output schema updated to: deckUrl, talkTrackUrl, faqUrl, slideCount, dealFolderId
- No new API endpoints -- Phase 8 is purely workflow steps

### Claude's Discretion
- How to handle slides where source presentation is unavailable (fallback to section template)
- Exact batchUpdate request sequencing for slide copying and text injection
- Google Docs API request structure for heading/paragraph styling
- BuyerFaqLlmSchema field definitions
- Error handling for Google API failures during artifact creation
- How to read live objectIds from copied slides for text replacement targeting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASSET-03 | System creates a formatted Google Slides deck in shared Lumenalta Drive via Google Slides API using service account credentials | createSlidesDeck workflow step: hybrid assembly using copy-and-prune for retrieved slides + branded section templates for synthesized slides, batchUpdate replaceAllText with pageObjectIds scoping for text injection |
| ASSET-04 | System generates a slide-by-slide talk track as a Google Doc in shared Lumenalta Drive | createTalkTrack workflow step: Google Docs API documents.create + batchUpdate with insertText and updateParagraphStyle, content sourced from SlideJSON speakerNotes already generated in Phase 7 |
| ASSET-05 | System generates a buyer FAQ Google Doc with anticipated objections and recommended responses based on stakeholder roles and business context | createBuyerFAQ workflow step: single Gemini 2.5 Flash call with BuyerFaqLlmSchema structured output, Google Docs API for formatted document creation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | (existing) | Google Slides API v1, Docs API v1, Drive API v3 | Already configured with service account auth via `google-auth.ts` |
| @google/genai | (existing) | Gemini 2.5 Flash for FAQ generation | Established pattern across all LLM calls in the project |
| @mastra/core | 1.8.0 | Workflow step creation with createStep/createWorkflow | 11 prior steps in touch-4-workflow use this exact pattern |
| zod | 4.x | Schema definitions for BuyerFaqLlmSchema and workflow I/O | Project-wide schema standard |
| @lumenalta/schemas | (workspace) | Shared schema package for LLM schemas | New BuyerFaqLlmSchema goes here, exported via barrel |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client | (existing) | InteractionRecord.outputRefs update | Step 14 updates outputRefs with all three Drive URLs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hybrid assembly (copy source + prune) | Programmatic slide recreation via createSlide + insertText | Recreation loses visual formatting; copy-and-prune preserves original layout |
| Google Docs API batchUpdate | Drive API HTML-to-Docs conversion | HTML approach is simpler but gives less control over exact heading styles |
| Sequential 3-step workflow | Single monolithic step | Sequential is more debuggable, matches project pattern, allows partial recovery |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
  lib/
    deck-assembly.ts           # NEW: Phase 8 deck assembly from SlideJSON (ASSET-03)
    doc-builder.ts             # NEW: Google Docs document builder utilities
  mastra/workflows/
    touch-4-workflow.ts        # MODIFIED: append steps 12-14
packages/schemas/
  llm/
    buyer-faq.ts               # NEW: BuyerFaqLlmSchema
  index.ts                     # MODIFIED: export BuyerFaqLlmSchema
```

### Pattern 1: Retrieved Slide Assembly (copy-and-prune per source presentation)

**What:** For each retrieved slide in the SlideJSON, copy the original source presentation, extract the target slide, inject bespoke copy, then clean up.

**When to use:** Every slide with `sourceType === "retrieved"` and a valid `sourceBlockRef`.

**How it works:**

The SlideJSON contains `sourceBlockRef` which is the deterministic document ID (SHA-256 of presentationId:slideObjectId). The search results in AtlusAI also store `presentationId` and `slideObjectId` in the document description metadata. Phase 8 needs to:

1. Look up the original `presentationId` and `slideObjectId` for each retrieved slide from the AtlusAI metadata (query by sourceBlockRef).
2. For each unique source presentation, copy it to a temp location via `drive.files.copy()`.
3. Use `presentations.get()` to read the copy and find the target slide's page objectId.
4. Use `duplicateObject` to duplicate that slide within the source copy.
5. Copy the duplicated slide's content into the target deck.

**Critical constraint:** The Google Slides API does NOT support copying slides between presentations. The only cross-presentation mechanism is `drive.files.copy()` of the entire presentation, then pruning.

**Recommended approach (per-source batch):**

```typescript
// Source: Verified against existing deck-customizer.ts copy-and-prune pattern
// and Google Slides API batchUpdate reference docs

// Group retrieved slides by source presentationId
const slidesBySource = new Map<string, SlideInfo[]>();
for (const slide of retrievedSlides) {
  const key = slide.presentationId;
  if (!slidesBySource.has(key)) slidesBySource.set(key, []);
  slidesBySource.get(key)!.push(slide);
}

// For each source presentation: copy, prune to needed slides, copy slides to target
for (const [sourcePresentationId, slides] of slidesBySource) {
  // 1. Copy source to temp
  const tempCopy = await drive.files.copy({
    fileId: sourcePresentationId,
    requestBody: { name: `_temp_source_${Date.now()}` },
    supportsAllDrives: true,
  });

  // 2. Read all slides from temp copy
  const presentation = await slidesClient.presentations.get({
    presentationId: tempCopy.data.id!,
  });

  // 3. Get objectIds for needed slides
  const neededObjectIds = new Set(slides.map(s => s.slideObjectId));
  const allPageIds = (presentation.data.slides ?? []).map(s => s.objectId!);

  // 4. Delete unneeded slides
  const deleteRequests = allPageIds
    .filter(id => !neededObjectIds.has(id))
    .map(objectId => ({ deleteObject: { objectId } }));

  if (deleteRequests.length > 0) {
    await slidesClient.presentations.batchUpdate({
      presentationId: tempCopy.data.id!,
      requestBody: { requests: deleteRequests },
    });
  }

  // 5. For each remaining slide, inject bespoke copy using replaceAllText
  //    with pageObjectIds to scope to individual slides
  for (const slide of slides) {
    // Read current slide elements to discover text shapes
    const page = await slidesClient.presentations.pages.get({
      presentationId: tempCopy.data.id!,
      pageObjectId: slide.slideObjectId,
    });

    // Use insertText to target specific shape objectIds
    // (Approach detailed below in "Text Injection" pattern)
  }

  // 6. Clean up temp copy after extracting content
  await drive.files.delete({
    fileId: tempCopy.data.id!,
    supportsAllDrives: true,
  });
}
```

**Simplification:** Since retrieved slides need bespoke copy injected anyway, a better approach is:

1. Start with the branded template deck as the base (copy via `drive.files.copy()`).
2. For each retrieved slide, copy its source presentation, find the slide, duplicate it into the target deck using a two-step intermediary approach.

However, **the Slides API cannot copy slides across presentations**. The pragmatic solution:

**Recommended final approach for retrieved slides:**
1. Copy each unique source presentation to a temp location.
2. Delete all slides except the needed one(s).
3. Use Drive API to export the temp presentation, then use the temp as a "slide donor" -- duplicate the needed slides within the temp, then use the temp's content to populate a newly created slide in the target deck.

**Actually, the simplest proven approach (matching existing `deck-customizer.ts` pattern):**
1. Create the target deck by copying the branded template.
2. For each retrieved slide: the bespoke copy has already been generated by Phase 7's `generateCustomCopy` step. The SlideJSON already contains the final `slideTitle`, `bullets`, and `speakerNotes`.
3. Use the branded section template slides as visual containers. For retrieved slides with `sectionType === "primary_capability"` or `"secondary_capability"`, use a "capability" template slide. For `"case_study"`, use a case study template slide.
4. Duplicate the appropriate template slide within the deck, inject bespoke copy via `replaceAllText` with `pageObjectIds` scoping.

This preserves brand consistency while injecting the bespoke content. The decision says "copy the original Google Slides slide from its source presentation" but this is technically challenging. The pragmatic middle ground: **copy the source slide for visual layout, then inject bespoke copy**.

### Pattern 2: Synthesized Slide Assembly

**What:** For synthesized slides (title_context, problem_restatement, roi_outcomes, next_steps), use branded section template slides from the template deck.

**When to use:** Every slide with `sourceType === "synthesized"`.

```typescript
// The template deck has one template slide per section type.
// After copying the template deck:
// 1. Map section types to template slide objectIds via presentations.get
// 2. For each synthesized slide: duplicate the matching template
// 3. Inject content via replaceAllText scoped to the duplicated slide

// Template slide mapping (discovered at runtime via presentations.get):
interface TemplateSlideMap {
  title_context: string;       // objectId of the title/context template slide
  problem_restatement: string; // objectId of the problem restatement template
  roi_outcomes: string;        // objectId of the ROI outcomes template
  next_steps: string;          // objectId of the next steps template
  primary_capability: string;  // objectId of the capability template (for retrieved)
  secondary_capability: string;// same as primary_capability (or a variant)
  case_study: string;          // objectId of the case study template
}
```

### Pattern 3: Google Docs Document Builder (Reverse-Index Insertion)

**What:** Build Google Docs content using batchUpdate with insertText + updateParagraphStyle. Content is inserted in reverse order so indices remain stable.

**When to use:** Talk track and FAQ document creation.

```typescript
// Source: Google Docs API official documentation
// https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request

// Create document via Docs API
const docs = getDocsClient();
const doc = await docs.documents.create({
  requestBody: { title: docTitle },
});
const documentId = doc.data.documentId!;

// Move document to deal folder via Drive API
await drive.files.update({
  fileId: documentId,
  addParents: dealFolderId,
  supportsAllDrives: true,
});

// Build content in reverse order so indices stay stable
// Each section: heading text + newline + body text + newline
// Insert from bottom to top

interface DocSection {
  heading: string;
  headingLevel: 'HEADING_1' | 'HEADING_2';
  body: string;
  boldRanges?: Array<{ start: number; end: number }>;
}

function buildDocRequests(sections: DocSection[]): any[] {
  const requests: any[] = [];
  let currentIndex = 1; // Documents start at index 1

  // Process sections in forward order, tracking indices
  for (const section of sections) {
    const headingStart = currentIndex;
    const headingText = section.heading + '\n';
    const headingEnd = headingStart + headingText.length;

    // Insert heading text
    requests.push({
      insertText: {
        location: { index: headingStart },
        text: headingText,
      },
    });

    // Apply heading style
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: headingStart,
          endIndex: headingEnd - 1, // Exclude the newline
        },
        paragraphStyle: {
          namedStyleType: section.headingLevel,
        },
        fields: 'namedStyleType',
      },
    });

    currentIndex = headingEnd;

    // Insert body text
    const bodyText = section.body + '\n';
    const bodyStart = currentIndex;
    const bodyEnd = bodyStart + bodyText.length;

    requests.push({
      insertText: {
        location: { index: bodyStart },
        text: bodyText,
      },
    });

    currentIndex = bodyEnd;

    // Apply bold ranges if specified (for FAQ objections)
    if (section.boldRanges) {
      for (const range of section.boldRanges) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: bodyStart + range.start,
              endIndex: bodyStart + range.end,
            },
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      }
    }
  }

  return requests;
}

// Execute all requests in a single batchUpdate
await docs.documents.batchUpdate({
  documentId,
  requestBody: { requests },
});
```

**IMPORTANT:** The simpler alternative is to build the entire content string first, insert it in one `insertText` call, then apply styles. This avoids index calculation errors:

```typescript
// Simpler approach: insert all text first, then style
// 1. Build full text content with newlines
// 2. Single insertText at index 1
// 3. Walk through text to find heading boundaries
// 4. Apply styles in a second batchUpdate
```

### Pattern 4: BuyerFaqLlmSchema Structured Output

**What:** Gemini 2.5 Flash generates role-specific objections using the project's established zodToGeminiSchema pattern.

```typescript
// New schema in packages/schemas/llm/buyer-faq.ts
import { z } from "zod";

export const BuyerFaqLlmSchema = z.object({
  stakeholders: z
    .array(
      z.object({
        role: z.string().meta({
          description: "Stakeholder role from the approved brief (e.g., CIO, CFO, VP Engineering).",
        }),
        objections: z
          .array(
            z.object({
              objection: z.string().meta({
                description: "Anticipated buyer objection specific to this stakeholder role.",
              }),
              response: z.string().meta({
                description: "Recommended response addressing the objection with evidence from the brief.",
              }),
            })
          )
          .meta({
            description: "2-3 objections per stakeholder role.",
          }),
      })
    )
    .meta({
      description: "Stakeholder-grouped objections and responses.",
    }),
});

export type BuyerFaq = z.infer<typeof BuyerFaqLlmSchema>;
```

### Anti-Patterns to Avoid
- **Hardcoding slide objectIds:** ObjectIds are Google-generated and change on copy. Always read from `presentations.get()` response after copying.
- **Using `replaceAllText` without `pageObjectIds` scoping:** Replaces text across ALL slides. Must scope to specific slide page objectIds for per-slide injection.
- **Building Google Docs content top-down:** Inserting text shifts all subsequent indices. Either build bottom-up (reverse order) or insert all text first, then apply styles.
- **Creating slides across presentations via Slides API:** The API has NO cross-presentation slide copy. Use Drive `files.copy()` + prune approach.
- **Assuming template slide positions:** Template slides may be reordered. Use `presentations.get()` to discover template slides by their content/placeholder text patterns, not by position index.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-presentation slide assembly | Custom slide element recreation via createShape/insertText | Copy-and-prune via Drive files.copy + Slides batchUpdate deleteObject | Element recreation loses fonts, colors, images, positioning; copy preserves everything |
| Per-deal Drive folder management | Custom folder creation logic | `getOrCreateDealFolder()` from `drive-folders.ts` | Idempotent, handles shared Drive, already used by Touch 1-3 |
| Google API client instantiation | Manual OAuth / JWT setup | `getSlidesClient()`, `getDriveClient()`, `getDocsClient()` from `google-auth.ts` | Configured with correct scopes, service account credentials |
| Public viewing permission | Manual permission management | `makePubliclyViewable()` from `drive-folders.ts` | Consistent with all prior phases |
| Gemini structured output | Manual JSON prompt engineering | `zodToGeminiSchema()` + JSON parse + Zod `.parse()` | Round-trip validation pattern used in all 10+ prior LLM calls |
| Workflow step definition | Raw function calls | `createStep()` from `@mastra/core/workflows` | Schema validation, error handling, suspend/resume, state management |

**Key insight:** Phase 8 is primarily a composition phase -- assembling existing infrastructure (Google auth, Drive folders, template assembly, Gemini structured output, Mastra workflow steps) into three new concrete steps. The risk is in the Slides API batchUpdate sequencing, not in the infrastructure.

## Common Pitfalls

### Pitfall 1: ObjectId Drift After Copy
**What goes wrong:** After `drive.files.copy()`, the copied presentation has THE SAME objectIds as the original. But after `duplicateObject`, the duplicated slide gets NEW objectIds. Code that assumes objectIds are stable across operations breaks.
**Why it happens:** Google preserves objectIds on file copy but generates new ones on duplicate. This is by design for deduplication.
**How to avoid:** After ANY mutation (copy, duplicate, delete), re-read the presentation via `presentations.get()` to get current objectIds before the next operation.
**Warning signs:** "Object not found" errors from batchUpdate, text replacements applying to wrong slides.

### Pitfall 2: ReplaceAllText Without Page Scoping
**What goes wrong:** `replaceAllText` without `pageObjectIds` replaces ALL occurrences across the entire presentation. If multiple slides use the same placeholder tag, all get the same replacement.
**Why it happens:** Default scope is the entire presentation.
**How to avoid:** Always include `pageObjectIds: [targetSlideObjectId]` in every `replaceAllText` request to scope to the specific slide being customized.
**Warning signs:** All slides showing the same customized content, slides that should be different looking identical.

### Pitfall 3: Google Docs Index Calculation Errors
**What goes wrong:** Text insertions shift all subsequent character indices. A second `insertText` at what was index 100 is now wrong because the first insertion shifted everything.
**Why it happens:** Google Docs uses character-based indexing. Each insertion changes all downstream indices.
**How to avoid:** Two strategies: (a) Insert all text in a single `insertText`, then apply styles in a second `batchUpdate`. (b) Build requests in reverse order so earlier indices remain stable.
**Warning signs:** Heading styles applied to wrong text sections, body text appearing in heading format.

### Pitfall 4: Source Presentation Unavailable
**What goes wrong:** A retrieved slide's `presentationId` points to a presentation that has been deleted, moved, or has restricted permissions.
**Why it happens:** AtlusAI metadata is a point-in-time snapshot. Source presentations can change after ingestion.
**How to avoid:** Wrap source copy in try/catch. On failure, fall back to a branded section template slide for that section type (use the synthesized slide approach). Log a warning but do not fail the entire deck generation.
**Warning signs:** 403/404 errors from Drive files.copy.

### Pitfall 5: Workflow Output Schema Mismatch
**What goes wrong:** The touch-4-workflow outputSchema must match the output of the LAST step. After Phase 8, the last step is createBuyerFAQ (step 14), not generateCustomCopy (step 11).
**Why it happens:** Mastra validates the workflow outputSchema against the final step's output at registration time.
**How to avoid:** Update the workflow's `outputSchema` to match step 14's output: `{ deckUrl, talkTrackUrl, faqUrl, slideCount, dealFolderId }`. The old fields (slideJSON, retrievalSummary) are consumed by step 12 and no longer needed in the workflow output.
**Warning signs:** Workflow registration errors, TypeScript type errors on workflow export.

### Pitfall 6: Google Docs File Not Moving to Deal Folder
**What goes wrong:** `documents.create()` creates the doc in the service account's root. It does not support a `parents` field.
**Why it happens:** The Docs API `create` method only accepts a title. File placement is a Drive concern, not a Docs concern.
**How to avoid:** After `documents.create()`, immediately use `drive.files.update({ addParents: dealFolderId, supportsAllDrives: true })` to move the doc to the deal folder.
**Warning signs:** Docs appearing in the service account's root Drive instead of the per-deal folder.

## Code Examples

### Creating a Google Doc in a Specific Drive Folder
```typescript
// Source: Google Docs API + Drive API pattern from existing project code
const docs = getDocsClient();
const drive = getDriveClient();

// 1. Create the document (lands in service account root)
const doc = await docs.documents.create({
  requestBody: { title: `${companyName} - ${primaryPillar} Talk Track - ${dateStr}` },
});
const documentId = doc.data.documentId!;

// 2. Move to per-deal folder via Drive API
await drive.files.update({
  fileId: documentId,
  addParents: dealFolderId,
  removeParents: 'root', // Remove from service account root
  supportsAllDrives: true,
  fields: 'id, parents',
});

// 3. Make publicly viewable
await makePubliclyViewable(documentId);

const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
```

### Talk Track Document Content Builder
```typescript
// Source: Google Docs API batchUpdate reference
// https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request

interface TalkTrackSlide {
  slideTitle: string;
  speakerNotes: string;
}

function buildTalkTrackRequests(
  deckTitle: string,
  slides: TalkTrackSlide[]
): any[] {
  // Build full text content first, then style
  let fullText = deckTitle + '\n\n';
  const styleRanges: Array<{
    start: number;
    end: number;
    style: 'HEADING_1' | 'HEADING_2' | 'NORMAL_TEXT';
  }> = [];

  // Track H1 for deck title
  styleRanges.push({
    start: 1,
    end: 1 + deckTitle.length,
    style: 'HEADING_1',
  });

  let offset = 1 + deckTitle.length + 2; // +2 for \n\n

  for (const slide of slides) {
    // H2 for slide title
    styleRanges.push({
      start: offset,
      end: offset + slide.slideTitle.length,
      style: 'HEADING_2',
    });

    fullText += slide.slideTitle + '\n';
    offset += slide.slideTitle.length + 1;

    // Body for speaker notes
    fullText += slide.speakerNotes + '\n\n';
    offset += slide.speakerNotes.length + 2;
  }

  const requests: any[] = [];

  // 1. Insert all text at once
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  // 2. Apply heading styles
  for (const range of styleRanges) {
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: range.start,
          endIndex: range.end,
        },
        paragraphStyle: {
          namedStyleType: range.style,
        },
        fields: 'namedStyleType',
      },
    });
  }

  return requests;
}
```

### ReplaceAllText with Page Scoping
```typescript
// Source: Google Slides API batchUpdate reference
// https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate

// After duplicating a template slide, inject content scoped to that slide
const slideObjectId = duplicatedSlide.objectId;

const requests = [
  {
    replaceAllText: {
      containsText: { text: '{{slide-title}}', matchCase: true },
      replaceText: slide.slideTitle,
      pageObjectIds: [slideObjectId], // Scope to this slide only
    },
  },
  {
    replaceAllText: {
      containsText: { text: '{{bullet-content}}', matchCase: true },
      replaceText: slide.bullets.join('\n'),
      pageObjectIds: [slideObjectId],
    },
  },
];

await slidesClient.presentations.batchUpdate({
  presentationId: targetPresentationId,
  requestBody: { requests },
});
```

### DuplicateObject for Template Slides
```typescript
// Source: Google Slides API slide operations
// https://developers.google.com/workspace/slides/api/samples/slides

// Duplicate a template slide within the presentation
const duplicateResponse = await slidesClient.presentations.batchUpdate({
  presentationId: targetPresentationId,
  requestBody: {
    requests: [{
      duplicateObject: {
        objectId: templateSlideObjectId,
        // objectIdsToUpdate is optional -- new IDs are auto-generated
      },
    }],
  },
});

// The response contains the mapping of old -> new objectIds
const reply = duplicateResponse.data.replies?.[0]?.duplicateObject;
const newSlideObjectId = reply?.objectId;
```

### Buyer FAQ Gemini Prompt Structure
```typescript
// Source: Established Gemini structured output pattern from touch-4-workflow.ts

const prompt = `You are a sales strategist at Lumenalta preparing a buyer FAQ document.

APPROVED BRIEF:
- Company: ${brief.companyName}
- Industry: ${brief.industry}
- Primary Pillar: ${brief.primaryPillar}
- Customer Context: ${brief.customerContext}
- Business Outcomes: ${brief.businessOutcomes}
- Constraints: ${brief.constraints}
- Stakeholders: ${brief.stakeholders}
- Timeline: ${brief.timeline}
- Budget: ${brief.budget}
- Use Cases: ${JSON.stringify(brief.useCases)}

INSTRUCTIONS:
1. For EACH stakeholder role identified in the brief, generate 2-3 anticipated objections.
2. Each objection should be specific to that role's perspective and concerns.
3. Each response should reference specific brief evidence, Lumenalta capabilities, or ROI outcomes.
4. Frame responses constructively -- acknowledge the concern, then address it.

EXAMPLES of role-specific objections:
- CIO: "How does this integrate with our existing tech stack?"
- CFO: "What's the expected payback period?"
- VP Engineering: "Do we have internal capacity to maintain this?"`;

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: zodToGeminiSchema(BuyerFaqLlmSchema) as Record<string, unknown>,
  },
});

const faq = BuyerFaqLlmSchema.parse(JSON.parse(response.text ?? '{}'));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recreate slides via createSlide + insertText | Copy-and-prune via Drive files.copy | Always (API limitation) | Only reliable way to preserve visual formatting across presentations |
| Global replaceAllText | pageObjectIds-scoped replaceAllText | Always available | Enables per-slide text injection without cross-contamination |
| Drive API v2 | Drive API v3 | Project decision | All Drive calls use v3 (established in Phase 1) |
| Sequential insertText with index tracking | Bulk insertText + post-hoc styling | Best practice | Eliminates index calculation bugs in Docs API |

**Deprecated/outdated:**
- There is no `ImportSlidesRequest` in the Slides API despite what some tutorials suggest. Cross-presentation copying requires Drive API workarounds.
- `endOfSegmentLocation` in Docs API can simplify appending text but does not support styling -- use explicit indices for styled content.

## Open Questions

1. **Template Slide Discovery**
   - What we know: The branded template deck (GOOGLE_TEMPLATE_PRESENTATION_ID) exists and has been used since Phase 1.
   - What's unclear: Whether the template currently has one slide per section type (title_context, problem_restatement, roi_outcomes, next_steps, capability, case_study) or needs additional slides added.
   - Recommendation: Read the template via `presentations.get()` during implementation. If section-specific template slides don't exist, use a single generic "content" template slide for all section types, differentiated only by injected content. A new env var (e.g., `BRANDED_SECTION_TEMPLATE_ID`) could point to a separate template deck with section-specific layouts.

2. **Retrieved Slide Visual Fidelity vs. Simplicity**
   - What we know: The decision says "copy the original Google Slides slide from its source presentation using sourceBlockRef." The SlideJSON stores `sourceBlockRef` (document ID hash) but needs `presentationId` and `slideObjectId` to locate the actual source slide.
   - What's unclear: Whether the source slide metadata (presentationId, slideObjectId) is reliably available at step 12 execution time, since it's serialized into the `slideJSON` string but the underlying `SlideSearchResult` fields may not be preserved through the workflow passthrough.
   - Recommendation: Augment the SlideJSON schema or the candidate slide data to include `presentationId` and `slideObjectId` alongside `sourceBlockRef`. If source metadata is unavailable, fall back to branded template with bespoke copy injection (which still looks professional since Phase 7 generated customer-specific content).

3. **Stakeholder Parsing from Brief**
   - What we know: The `stakeholders` field on the Brief is a freeform string (e.g., "CIO driving the initiative, CFO concerned about Q2 budget, VP Engineering evaluating integration complexity").
   - What's unclear: Whether Gemini can reliably parse distinct stakeholder roles from this freeform string to generate role-grouped objections.
   - Recommendation: Let Gemini parse roles from the freeform text -- this is within its capability and matches the project's pattern of using Gemini for text interpretation. The BuyerFaqLlmSchema constrains the output structure.

## Sources

### Primary (HIGH confidence)
- Google Slides API batchUpdate reference: https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate -- confirmed request types, no ImportSlidesRequest exists
- Google Docs API request types: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request -- insertText, updateParagraphStyle, updateTextStyle confirmed
- Google Docs API text formatting: https://developers.google.com/docs/api/how-tos/format-text -- namedStyleType values (HEADING_1, HEADING_2) and JSON structure confirmed
- Google Slides API slide operations: https://developers.google.com/workspace/slides/api/samples/slides -- DuplicateObjectRequest confirmed, no cross-presentation copy
- Existing codebase: `deck-customizer.ts` copy-and-prune pattern (HIGH confidence -- running in production for Touch 2/3)
- Existing codebase: `google-auth.ts` with Docs API scope already configured
- Existing codebase: `touch-4-workflow.ts` 11-step Mastra workflow pattern

### Secondary (MEDIUM confidence)
- Google Slides API replaceAllText pageObjectIds scoping: https://www.flashdocs.com/post/google-slides-api-comprehensive-guide-for-developers -- confirmed pageObjectIds field limits scope
- Google Docs insertText endOfSegmentLocation: https://gist.github.com/tanaikech/6aa646691f6c2224202fa6fb756e3862 -- reverse-insert pattern confirmed

### Tertiary (LOW confidence)
- None -- all findings verified against official Google API docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies needed
- Architecture: HIGH - patterns directly extend existing deck-customizer.ts and touch-4-workflow.ts
- Pitfalls: HIGH - objectId drift, index calculation, and source unavailability are documented in official API docs and project decision history
- Slides API cross-presentation limitation: HIGH - confirmed via official batchUpdate reference (no ImportSlidesRequest)
- Docs API formatting: HIGH - confirmed namedStyleType, insertText, updateParagraphStyle from official docs

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable APIs, no breaking changes expected)
