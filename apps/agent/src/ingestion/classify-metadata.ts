/**
 * LLM-Powered Metadata Classification
 *
 * Classifies each extracted slide with structured metadata tags
 * using Gemini 2.0 Flash with native structured output (responseSchema).
 *
 * Tags assigned per slide:
 *   - industries (multi-value enum)
 *   - subsectors (free-text array, maps to ~62 subsectors in PROJECT.md)
 *   - solutionPillars (from extracted taxonomy)
 *   - funnelStages (multi-value enum aligned to GTM touch points)
 *   - contentType (single enum)
 *   - slideCategory (single enum)
 *   - buyerPersonas (multi-value enum)
 *   - touchType (multi-value enum)
 */

import { z } from "zod";
import { env } from "../env";
import type { ExtractedSlide } from "../lib/slide-extractor";
import {
  createJsonResponseOptions,
  executeRuntimeProviderNamedAgent,
} from "../lib/agent-executor";
import {
  SlideMetadataSchema,
  zodToLlmJsonSchema,
  type SlideMetadata,
} from "@lumenalta/schemas";

export interface ClassifiedSlide extends ExtractedSlide {
  metadata: SlideMetadata;
  confidence: number;
}

const SlideMetadataClassificationSchema = SlideMetadataSchema.extend({
  confidence: z.number(),
});

// ────────────────────────────────────────────────────────────
// Classification prompt
// ────────────────────────────────────────────────────────────

function buildClassificationPrompt(
  slide: ExtractedSlide,
  titleSlideText: string,
  solutionPillarList: string[]
): string {
  const lowContentNote = slide.isLowContent
    ? "\nNOTE: This is a title/divider slide with minimal text. Set slideCategory accordingly (title or divider)."
    : "";

  return `You are classifying a single slide from a Lumenalta sales deck for a knowledge base.

DECK CONTEXT:
- Deck name: ${slide.presentationName}
- Folder path: ${slide.folderPath || "(root folder)"}
- Slide index: ${slide.slideIndex} (0-based)
- Title slide content: ${titleSlideText || "(no title slide text)"}
${lowContentNote}

AVAILABLE SOLUTION PILLARS:
${solutionPillarList.length > 0 ? solutionPillarList.map((p) => `- ${p}`).join("\n") : "- (no pillars defined yet)"}

SLIDE CONTENT:
${slide.textContent || "(empty)"}

SPEAKER NOTES:
${slide.speakerNotes || "(none)"}

CLASSIFICATION INSTRUCTIONS:
1. Select ALL industries that apply -- a general capabilities slide may apply to multiple industries.
2. For subsectors: identify 1-3 specific subsectors within the classified industries. Use concise labels like "Digital Banking", "Telehealth", "EdTech". If the slide content is too generic to identify a subsector, return an empty array.
3. For solutionPillars: only use names from the AVAILABLE SOLUTION PILLARS list above.
4. For funnelStages: a slide can belong to multiple stages. Map based on the content's purpose:
   - First Contact = high-level overview, one-pager content
   - Intro Conversation = company intro, capabilities overview
   - Capability Alignment = detailed solutions, technical depth
   - Solution Proposal = specific proposals, pricing, timelines
5. For touchType: map to the same stages using touch_1/2/3/4 format.
6. For contentType: template = reusable template, example = real proposal/deck, case_study = client case study, brand_guide = brand guidelines, resource = general resource.
7. For slideCategory: use title for title slides, divider for section dividers, and the most specific category that fits for content slides.
8. For buyerPersonas: select the personas most likely interested in this slide's content.

Classify this slide with all applicable tags.`;
}

// ────────────────────────────────────────────────────────────
// Gemini 2.0 Flash classification
// ────────────────────────────────────────────────────────────

const RATE_LIMIT_DELAY = 300; // ms between LLM calls

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify a single slide using Gemini 2.0 Flash with native structured output.
 * Gemini's responseSchema guarantees valid JSON matching the schema.
 */
export async function classifySlide(
  slide: ExtractedSlide,
  titleSlideText: string,
  solutionPillarList: string[],
  _legacyApiKey?: string
): Promise<ClassifiedSlide> {
  const prompt = buildClassificationPrompt(
    slide,
    titleSlideText,
    solutionPillarList
  );

  const response = await executeRuntimeProviderNamedAgent({
    agentId: "slide-metadata-classifier",
    messages: [{ role: "user", content: prompt }],
    options: createJsonResponseOptions(
      zodToLlmJsonSchema(SlideMetadataClassificationSchema) as Record<
        string,
        unknown
      >,
    ),
  });

  const text = response.text ?? "{}";

  let metadata: SlideMetadata;
  let confidence = 50;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.confidence === "number") {
      confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));
    }
    metadata = SlideMetadataSchema.parse(parsed);
  } catch (parseError) {
    console.warn(
      `  WARNING: Failed to parse Gemini response for slide ${slide.slideIndex} of "${slide.presentationName}". Using defaults.`
    );
    console.warn(`  Raw response: ${text.substring(0, 200)}`);
    metadata = {
      industries: [],
      subsectors: [],
      solutionPillars: [],
      funnelStages: [],
      contentType: "resource",
      slideCategory: "other",
      buyerPersonas: ["General"],
      touchType: [],
    };
    confidence = 50;
  }

  return { ...slide, metadata, confidence };
}

// ────────────────────────────────────────────────────────────
// Batch classification
// ────────────────────────────────────────────────────────────

/**
 * Classify all slides using Gemini 2.0 Flash.
 *
 * Groups slides by presentation so all slides from the same deck
 * share title slide context. Classifies sequentially with rate limiting.
 */
export async function classifyAllSlides(
  slides: ExtractedSlide[],
  solutionPillarList: string[],
  _legacyApiKey?: string
): Promise<ClassifiedSlide[]> {
  // Group slides by presentationId
  const byPresentation = new Map<string, ExtractedSlide[]>();
  for (const slide of slides) {
    const existing = byPresentation.get(slide.presentationId) ?? [];
    existing.push(slide);
    byPresentation.set(slide.presentationId, existing);
  }

  const classified: ClassifiedSlide[] = [];
  let totalProcessed = 0;

  for (const [presId, presSlides] of byPresentation) {
    presSlides.sort((a, b) => a.slideIndex - b.slideIndex);
    const titleSlideText = presSlides[0]?.textContent ?? "";
    const presName = presSlides[0]?.presentationName ?? presId;

    console.log(
      `Classifying ${presSlides.length} slides from "${presName}"...`
    );

    for (const slide of presSlides) {
      try {
        const result = await classifySlide(
          slide,
          titleSlideText,
          solutionPillarList,
        );
        classified.push(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `  ERROR classifying slide ${slide.slideIndex} of "${presName}": ${message}`
        );
        classified.push({
          ...slide,
          metadata: {
            industries: [],
            subsectors: [],
            solutionPillars: [],
            funnelStages: [],
            contentType: "resource",
            slideCategory: "other",
            buyerPersonas: ["General"],
            touchType: [],
          },
          confidence: 50,
        });
      }

      totalProcessed++;
      if (totalProcessed % 5 === 0) {
        console.log(
          `  Progress: ${totalProcessed}/${slides.length} slides classified`
        );
      }

      await delay(RATE_LIMIT_DELAY);
    }
  }

  console.log(
    `\nClassification complete: ${classified.length}/${slides.length} slides classified`
  );
  return classified;
}
