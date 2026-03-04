/**
 * Gemini-Powered Metadata Classification
 *
 * Classifies each extracted slide with structured metadata tags
 * using Google Gemini's structured output mode.
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

import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../env";
import type { ExtractedSlide } from "../lib/slide-extractor";
import {
  INDUSTRIES,
  FUNNEL_STAGES,
  CONTENT_TYPES,
  SLIDE_CATEGORIES,
  BUYER_PERSONAS,
  TOUCH_TYPES,
  SlideMetadataSchema,
  type SlideMetadata,
} from "@lumenalta/schemas";

export interface ClassifiedSlide extends ExtractedSlide {
  metadata: SlideMetadata;
}

// ────────────────────────────────────────────────────────────
// Gemini JSON Schema (hand-crafted for Gemini structured output)
// zod-to-json-schema does not support Zod 4.x
// ────────────────────────────────────────────────────────────

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    industries: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [...INDUSTRIES],
      },
      description:
        "Industries this slide content is relevant to. Select all that apply.",
    },
    subsectors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Identify 1-3 specific subsectors within the classified industries. Use concise labels like "Digital Banking", "Telehealth", "EdTech". If the slide content is too generic to identify a subsector, return an empty array.',
    },
    solutionPillars: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Lumenalta solution pillars this slide addresses. Use exact names from the AVAILABLE SOLUTION PILLARS list in the prompt.",
    },
    funnelStages: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [...FUNNEL_STAGES],
      },
      description:
        "Which GTM touch point funnel stages this slide is designed for. Can be multi-value.",
    },
    contentType: {
      type: Type.STRING,
      enum: [...CONTENT_TYPES],
      description: "The type of content this slide represents.",
    },
    slideCategory: {
      type: Type.STRING,
      enum: [...SLIDE_CATEGORIES],
      description: "The functional category of this slide within a deck.",
    },
    buyerPersonas: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [...BUYER_PERSONAS],
      },
      description: "Buyer personas this content is most relevant to.",
    },
    touchType: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [...TOUCH_TYPES],
      },
      description:
        "Which GTM touch type(s) this slide is associated with. touch_1 = First Contact, touch_2 = Intro Conversation, touch_3 = Capability Alignment, touch_4 = Solution Proposal.",
    },
  },
  required: [
    "industries",
    "subsectors",
    "solutionPillars",
    "funnelStages",
    "contentType",
    "slideCategory",
    "buyerPersonas",
    "touchType",
  ],
};

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
// Single slide classification
// ────────────────────────────────────────────────────────────

const RATE_LIMIT_DELAY = 300; // ms between Gemini calls

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify a single slide using Gemini structured output.
 */
export async function classifySlide(
  slide: ExtractedSlide,
  titleSlideText: string,
  solutionPillarList: string[],
  _geminiApiKey?: string
): Promise<ClassifiedSlide> {
  const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });

  const prompt = buildClassificationPrompt(
    slide,
    titleSlideText,
    solutionPillarList
  );

  const response = await ai.models.generateContent({
    model: "openai/gpt-oss-120b-maas",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  const text = response.text ?? "{}";
  let metadata: SlideMetadata;

  try {
    const parsed = JSON.parse(text);
    // Validate with Zod to ensure conformity
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
  }

  return {
    ...slide,
    metadata,
  };
}

// ────────────────────────────────────────────────────────────
// Batch classification
// ────────────────────────────────────────────────────────────

/**
 * Classify all slides using Gemini.
 *
 * Groups slides by presentation so all slides from the same deck
 * share title slide context. Classifies sequentially with rate limiting.
 */
export async function classifyAllSlides(
  slides: ExtractedSlide[],
  solutionPillarList: string[],
  _geminiApiKey?: string
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
    // Sort by slideIndex to ensure title slide is first
    presSlides.sort((a, b) => a.slideIndex - b.slideIndex);

    // Get title slide text (first slide content for deck context)
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
        // Push with default metadata so we don't lose the slide
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
        });
      }

      totalProcessed++;
      if (totalProcessed % 5 === 0) {
        console.log(
          `  Progress: ${totalProcessed}/${slides.length} slides classified`
        );
      }

      // Rate limit between Gemini calls
      await delay(RATE_LIMIT_DELAY);
    }
  }

  console.log(
    `\nClassification complete: ${classified.length}/${slides.length} slides classified`
  );
  return classified;
}
