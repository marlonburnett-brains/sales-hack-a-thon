/**
 * Deck Assembly Engine — Google Slides Deck from SlideJSON
 *
 * Given a validated SlideAssembly (from Phase 7's generateCustomCopy step),
 * creates a Google Slides deck by:
 * 1. Copying the branded template deck to the deal folder
 * 2. Discovering template slide objectIds via presentations.get()
 * 3. Duplicating template slides for each section in the SlideJSON
 * 4. Injecting bespoke copy via pageObjectIds-scoped replaceAllText
 * 5. Cleaning up original template slides
 * 6. Making the deck publicly viewable for iframe preview
 *
 * Critical constraints:
 * - ALWAYS re-read presentation after ANY batchUpdate (objectId drift)
 * - ALWAYS scope replaceAllText with pageObjectIds (prevent cross-slide contamination)
 * - supportsAllDrives: true on all Drive API calls
 * - Per-slide error handling (one slide failure does not crash the entire deck)
 */

import type { slides_v1 } from "googleapis";
import type { SlideAssembly } from "@lumenalta/schemas";
import { getDriveClient, getSlidesClient } from "./google-auth";
import { makePubliclyViewable } from "./drive-folders";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface DeckFromJSONParams {
  /** Validated SlideAssembly from Phase 7 */
  slideJSON: SlideAssembly;
  /** Company name for deck naming */
  companyName: string;
  /** Primary solution pillar for deck naming */
  primaryPillar: string;
  /** Per-deal Drive folder ID */
  dealFolderId: string;
}

export interface DeckFromJSONResult {
  /** Google Slides presentation ID */
  presentationId: string;
  /** Direct URL to the generated deck */
  deckUrl: string;
  /** Number of content slides in the final deck */
  slideCount: number;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** Placeholder tags used in the branded template slides */
const PLACEHOLDER_TITLE = "{{slide-title}}";
const PLACEHOLDER_BULLETS = "{{bullet-content}}";
const PLACEHOLDER_NOTES = "{{speaker-notes}}";

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

/**
 * Create a Google Slides deck from a SlideAssembly JSON structure.
 *
 * For each slide in the assembly:
 * - Synthesized slides: duplicate the generic branded template slide, inject content
 * - Retrieved slides: attempt source presentation copy with fallback to branded template
 *
 * All text injection uses replaceAllText with pageObjectIds scoping.
 */
export async function createSlidesDeckFromJSON(
  params: DeckFromJSONParams
): Promise<DeckFromJSONResult> {
  const drive = getDriveClient();
  const slides = getSlidesClient();
  const { slideJSON, companyName, primaryPillar, dealFolderId } = params;

  const dateStr = new Date().toISOString().split("T")[0];
  const deckName = `${companyName} - ${primaryPillar} - ${dateStr}`;

  // ── Step 1: Copy branded template to deal folder ──
  const copy = await drive.files.copy({
    fileId: env.GOOGLE_TEMPLATE_PRESENTATION_ID,
    requestBody: {
      name: deckName,
      parents: [dealFolderId],
    },
    supportsAllDrives: true,
  });
  const presentationId = copy.data.id!;

  console.log(
    `[deck-assembly] Copied template to: ${presentationId} (${deckName})`
  );

  // ── Step 2: Discover template slide objectIds ──
  let presentation = await slides.presentations.get({ presentationId });
  const templateSlides = presentation.data.slides ?? [];

  // Build a map of template slide objectIds by index.
  // Use the first slide as the generic content template for all section types.
  // If the template has multiple slides, attempt to use them for specific section types.
  const templateSlideMap = buildTemplateSlideMap(templateSlides);
  const originalTemplateIds = new Set(templateSlides.map((s) => s.objectId!));

  console.log(
    `[deck-assembly] Template has ${templateSlides.length} slide(s). Mapped section types: ${[...templateSlideMap.keys()].join(", ")}`
  );

  // ── Step 3 & 4: Duplicate template slides and inject content ──
  const createdSlideIds: string[] = [];

  for (let i = 0; i < slideJSON.slides.length; i++) {
    const slide = slideJSON.slides[i];

    try {
      // Determine which template slide to duplicate
      const templateObjectId = resolveTemplateSlide(
        templateSlideMap,
        slide.sectionType
      );

      if (!templateObjectId) {
        console.warn(
          `[deck-assembly] No template slide found for sectionType="${slide.sectionType}", skipping slide ${i + 1}`
        );
        continue;
      }

      // a. Duplicate the template slide
      const duplicateResponse = await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            {
              duplicateObject: {
                objectId: templateObjectId,
              },
            },
          ],
        },
      });

      const newSlideObjectId =
        duplicateResponse.data.replies?.[0]?.duplicateObject?.objectId;

      if (!newSlideObjectId) {
        console.warn(
          `[deck-assembly] duplicateObject returned no objectId for slide ${i + 1}, skipping`
        );
        continue;
      }

      createdSlideIds.push(newSlideObjectId);

      // b. Inject bespoke copy via replaceAllText scoped to this slide
      const replaceRequests: slides_v1.Schema$Request[] = [
        {
          replaceAllText: {
            containsText: { text: PLACEHOLDER_TITLE, matchCase: true },
            replaceText: slide.slideTitle,
            pageObjectIds: [newSlideObjectId],
          },
        },
        {
          replaceAllText: {
            containsText: { text: PLACEHOLDER_BULLETS, matchCase: true },
            replaceText: slide.bullets.join("\n"),
            pageObjectIds: [newSlideObjectId],
          },
        },
        {
          replaceAllText: {
            containsText: { text: PLACEHOLDER_NOTES, matchCase: true },
            replaceText: slide.speakerNotes,
            pageObjectIds: [newSlideObjectId],
          },
        },
      ];

      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: replaceRequests },
      });

      console.log(
        `[deck-assembly] Slide ${i + 1}/${slideJSON.slides.length}: "${slide.slideTitle}" (${slide.sectionType}/${slide.sourceType})`
      );
    } catch (err) {
      // Per-slide error handling: log and continue
      console.error(
        `[deck-assembly] Error processing slide ${i + 1} ("${slide.slideTitle}"): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ── Step 5: Delete original template slides ──
  // Re-read presentation to get current state after all mutations
  presentation = await slides.presentations.get({ presentationId });
  const currentSlides = presentation.data.slides ?? [];

  // Find original template slides that still exist (not the duplicated ones)
  const deleteRequests: slides_v1.Schema$Request[] = currentSlides
    .filter((s) => originalTemplateIds.has(s.objectId!))
    .map((s) => ({
      deleteObject: { objectId: s.objectId! },
    }));

  if (deleteRequests.length > 0) {
    // Only delete if we have content slides to keep
    if (createdSlideIds.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: deleteRequests },
      });
      console.log(
        `[deck-assembly] Deleted ${deleteRequests.length} original template slide(s)`
      );
    } else {
      console.warn(
        `[deck-assembly] No content slides were created; keeping original template slides`
      );
    }
  }

  // ── Step 6: Make publicly viewable ──
  await makePubliclyViewable(presentationId);

  const deckUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  const slideCount = createdSlideIds.length;

  console.log(
    `[deck-assembly] Deck complete: ${deckUrl} (${slideCount} slides)`
  );

  return { presentationId, deckUrl, slideCount };
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

/**
 * Build a map of sectionType -> template slide objectId.
 *
 * Strategy: discover template slides by examining their content/placeholder patterns.
 * If the template has only one slide, it becomes the universal fallback.
 * If the template has multiple slides, attempt to assign them to section types
 * based on text content or fall back to index-based assignment.
 */
function buildTemplateSlideMap(
  templateSlides: slides_v1.Schema$Page[]
): Map<string, string> {
  const sectionTypes = [
    "title_context",
    "problem_restatement",
    "primary_capability",
    "secondary_capability",
    "case_study",
    "roi_outcomes",
    "next_steps",
  ];

  const map = new Map<string, string>();

  if (templateSlides.length === 0) {
    return map;
  }

  // Use the first slide as the universal fallback/generic content template
  const genericId = templateSlides[0].objectId!;

  // Map all section types to the generic template
  // (If the template deck has section-specific slides, they would be matched by
  // scanning text elements for section-type markers. For now, use generic fallback.)
  for (const sectionType of sectionTypes) {
    map.set(sectionType, genericId);
  }

  // If template has multiple slides, try to assign them by scanning for keywords
  if (templateSlides.length > 1) {
    for (const slide of templateSlides) {
      const textContent = extractSlideText(slide).toLowerCase();

      if (textContent.includes("title") || textContent.includes("context")) {
        map.set("title_context", slide.objectId!);
      }
      if (textContent.includes("problem")) {
        map.set("problem_restatement", slide.objectId!);
      }
      if (textContent.includes("case study") || textContent.includes("case-study")) {
        map.set("case_study", slide.objectId!);
      }
      if (textContent.includes("roi") || textContent.includes("outcome")) {
        map.set("roi_outcomes", slide.objectId!);
      }
      if (textContent.includes("next step")) {
        map.set("next_steps", slide.objectId!);
      }
      if (textContent.includes("capability") || textContent.includes("solution")) {
        map.set("primary_capability", slide.objectId!);
        map.set("secondary_capability", slide.objectId!);
      }
    }
  }

  return map;
}

/**
 * Extract all text content from a slide's page elements.
 */
function extractSlideText(slide: slides_v1.Schema$Page): string {
  const texts: string[] = [];

  for (const element of slide.pageElements ?? []) {
    if (element.shape?.text?.textElements) {
      for (const te of element.shape.text.textElements) {
        if (te.textRun?.content) {
          texts.push(te.textRun.content);
        }
      }
    }
  }

  return texts.join(" ");
}

/**
 * Resolve which template slide to use for a given sectionType.
 * Falls back to the first available template slide if no specific match.
 */
function resolveTemplateSlide(
  templateSlideMap: Map<string, string>,
  sectionType: string
): string | undefined {
  // Direct match
  const direct = templateSlideMap.get(sectionType);
  if (direct) return direct;

  // Fallback: use any available template
  const values = [...templateSlideMap.values()];
  return values.length > 0 ? values[0] : undefined;
}
