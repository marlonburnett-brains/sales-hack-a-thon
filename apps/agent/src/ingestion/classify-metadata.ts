/**
 * LLM-Powered Metadata Classification
 *
 * Classifies each extracted slide with structured metadata tags
 * using LLM structured output mode.
 *
 * Primary backend: gpt-oss-120b via OpenAI SDK on Vertex AI (MaaS)
 * Fallback backend: Gemini 2.0 Flash via Google GenAI SDK
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
import { GoogleAuth } from "google-auth-library";
import OpenAI from "openai";
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
  confidence: number;
}

// ────────────────────────────────────────────────────────────
// LLM JSON Schema (Gemini — uses @google/genai Type.* format)
// ────────────────────────────────────────────────────────────

const LLM_RESPONSE_SCHEMA = {
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
    confidence: {
      type: Type.NUMBER,
      description:
        "Overall confidence score (0-100) for this classification. 100 = highly confident all tags are correct, 50 = moderate confidence, below 30 = low confidence/ambiguous content.",
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
    "confidence",
  ],
};

// ────────────────────────────────────────────────────────────
// Plain JSON Schema for gpt-oss system prompt
// (gpt-oss uses json_object mode — schema must be in prompt)
// ────────────────────────────────────────────────────────────

const JSON_SCHEMA_FOR_PROMPT = {
  type: "object",
  properties: {
    industries: {
      type: "array",
      items: { type: "string", enum: [...INDUSTRIES] },
      description:
        "Industries this slide content is relevant to. Select all that apply.",
    },
    subsectors: {
      type: "array",
      items: { type: "string" },
      description:
        'Identify 1-3 specific subsectors within the classified industries. Use concise labels like "Digital Banking", "Telehealth", "EdTech". If too generic, return an empty array.',
    },
    solutionPillars: {
      type: "array",
      items: { type: "string" },
      description:
        "Lumenalta solution pillars this slide addresses. Use exact names from the AVAILABLE SOLUTION PILLARS list.",
    },
    funnelStages: {
      type: "array",
      items: { type: "string", enum: [...FUNNEL_STAGES] },
      description:
        "Which GTM touch point funnel stages this slide is designed for. Can be multi-value.",
    },
    contentType: {
      type: "string",
      enum: [...CONTENT_TYPES],
      description: "The type of content this slide represents.",
    },
    slideCategory: {
      type: "string",
      enum: [...SLIDE_CATEGORIES],
      description: "The functional category of this slide within a deck.",
    },
    buyerPersonas: {
      type: "array",
      items: { type: "string", enum: [...BUYER_PERSONAS] },
      description: "Buyer personas this content is most relevant to.",
    },
    touchType: {
      type: "array",
      items: { type: "string", enum: [...TOUCH_TYPES] },
      description:
        "Which GTM touch type(s) this slide is associated with. touch_1 = First Contact, touch_2 = Intro Conversation, touch_3 = Capability Alignment, touch_4 = Solution Proposal.",
    },
    confidence: {
      type: "number",
      description:
        "Overall confidence score (0-100) for this classification.",
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
    "confidence",
  ],
};

// ────────────────────────────────────────────────────────────
// Vertex AI access token for gpt-oss (OpenAI-compatible endpoint)
// ────────────────────────────────────────────────────────────

/**
 * Get a short-lived access token from the service account credentials.
 * google-auth-library caches tokens internally so repeated calls are cheap.
 */
async function getVertexAccessToken(): Promise<string> {
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain Vertex AI access token from service account");
  }
  return tokenResponse.token;
}

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
// Backend: gpt-oss-120b via OpenAI SDK on Vertex AI
// ────────────────────────────────────────────────────────────

/**
 * Classify a slide using gpt-oss-120b via the Vertex AI OpenAI-compatible endpoint.
 * A fresh OpenAI client is created per call (access tokens are short-lived).
 */
async function classifySlideWithGptOss(prompt: string): Promise<string> {
  const accessToken = await getVertexAccessToken();

  const client = new OpenAI({
    baseURL: `https://${env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_CLOUD_PROJECT}/locations/${env.GOOGLE_CLOUD_LOCATION}/endpoints/openapi`,
    apiKey: accessToken,
  });

  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-120b-maas",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You must respond with valid JSON matching the following schema:\n${JSON.stringify(JSON_SCHEMA_FOR_PROMPT, null, 2)}`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("gpt-oss returned empty response");
  }
  return content;
}

// ────────────────────────────────────────────────────────────
// Backend: Gemini 2.0 Flash via Google GenAI SDK
// ────────────────────────────────────────────────────────────

/**
 * Classify a slide using Gemini 2.0 Flash with structured output (responseSchema).
 */
async function classifySlideWithGemini(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: LLM_RESPONSE_SCHEMA,
    },
  });

  return response.text ?? "{}";
}

// ────────────────────────────────────────────────────────────
// Single slide classification (dual-backend with fallback)
// ────────────────────────────────────────────────────────────

const RATE_LIMIT_DELAY = 300; // ms between LLM calls
const MAX_CONSECUTIVE_FAILURES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ClassifyResult {
  classified: ClassifiedSlide;
  backend: "gpt-oss" | "gemini";
  gptOssFailed: boolean;
}

/**
 * Classify a single slide using LLM structured output.
 *
 * Tries gpt-oss-120b first (via OpenAI SDK on Vertex AI).
 * Falls back to Gemini 2.0 Flash on gpt-oss failure.
 *
 * @param useGeminiOnly - Skip gpt-oss and use Gemini directly (set after consecutive failures)
 */
async function classifySlideInternal(
  slide: ExtractedSlide,
  titleSlideText: string,
  solutionPillarList: string[],
  useGeminiOnly = false
): Promise<ClassifyResult> {
  const prompt = buildClassificationPrompt(
    slide,
    titleSlideText,
    solutionPillarList
  );

  let text: string;
  let backend: "gpt-oss" | "gemini";
  let gptOssFailed = false;

  if (useGeminiOnly) {
    text = await classifySlideWithGemini(prompt);
    backend = "gemini";
  } else {
    try {
      text = await classifySlideWithGptOss(prompt);
      backend = "gpt-oss";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `  WARNING: gpt-oss failed for slide ${slide.slideIndex}, falling back to Gemini: ${message}`
      );
      gptOssFailed = true;
      text = await classifySlideWithGemini(prompt);
      backend = "gemini";
    }
  }

  console.log(
    `  Slide ${slide.slideIndex} classified via ${backend}`
  );

  let metadata: SlideMetadata;
  let confidence = 50;

  try {
    const parsed = JSON.parse(text);
    // Extract confidence before Zod strips it (it's not in SlideMetadata schema)
    if (typeof parsed.confidence === "number") {
      confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));
    }
    // Validate with Zod to ensure conformity
    metadata = SlideMetadataSchema.parse(parsed);
  } catch (parseError) {
    console.warn(
      `  WARNING: Failed to parse LLM response for slide ${slide.slideIndex} of "${slide.presentationName}". Using defaults.`
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

  return {
    classified: { ...slide, metadata, confidence },
    backend,
    gptOssFailed,
  };
}

/**
 * Public API — classify a single slide (returns ClassifiedSlide only).
 * Used by test scripts and callers that don't need backend tracking.
 */
export async function classifySlide(
  slide: ExtractedSlide,
  titleSlideText: string,
  solutionPillarList: string[],
  _legacyApiKey?: string,
  useGeminiOnly = false
): Promise<ClassifiedSlide> {
  const { classified } = await classifySlideInternal(
    slide,
    titleSlideText,
    solutionPillarList,
    useGeminiOnly
  );
  return classified;
}

// ────────────────────────────────────────────────────────────
// Batch classification
// ────────────────────────────────────────────────────────────

/**
 * Classify all slides using LLM.
 *
 * Groups slides by presentation so all slides from the same deck
 * share title slide context. Classifies sequentially with rate limiting.
 *
 * Uses gpt-oss-120b as primary backend. After MAX_CONSECUTIVE_FAILURES
 * consecutive gpt-oss failures, switches remaining slides to Gemini-only.
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
  let consecutiveGptOssFailures = 0;
  let useGeminiOnly = false;

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
        const result = await classifySlideInternal(
          slide,
          titleSlideText,
          solutionPillarList,
          useGeminiOnly
        );
        classified.push(result.classified);

        // Track gpt-oss consecutive failures for circuit breaker
        if (!useGeminiOnly) {
          if (result.gptOssFailed) {
            consecutiveGptOssFailures++;
            if (consecutiveGptOssFailures >= MAX_CONSECUTIVE_FAILURES) {
              console.warn(
                `  WARNING: gpt-oss failed ${MAX_CONSECUTIVE_FAILURES} consecutive times, switching to Gemini for remaining slides`
              );
              useGeminiOnly = true;
            }
          } else {
            // gpt-oss succeeded — reset counter
            consecutiveGptOssFailures = 0;
          }
        }
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
          confidence: 50,
        });

        // Both backends failed — count as gpt-oss failure too
        if (!useGeminiOnly) {
          consecutiveGptOssFailures++;
          if (consecutiveGptOssFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(
              `  WARNING: gpt-oss failed ${MAX_CONSECUTIVE_FAILURES} consecutive times, switching to Gemini for remaining slides`
            );
            useGeminiOnly = true;
          }
        }
      }

      totalProcessed++;
      if (totalProcessed % 5 === 0) {
        console.log(
          `  Progress: ${totalProcessed}/${slides.length} slides classified`
        );
      }

      // Rate limit between LLM calls
      await delay(RATE_LIMIT_DELAY);
    }
  }

  console.log(
    `\nClassification complete: ${classified.length}/${slides.length} slides classified`
  );
  return classified;
}
