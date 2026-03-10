/**
 * Modification Planner — Element-Level Slide Content Planning
 *
 * Examines a slide's element map and deal context to produce a surgical
 * ModificationPlan specifying which text elements to change and what the
 * new content should be. Downstream Phase 55 (Modification Executor) calls
 * planSlideModifications() per-slide.
 *
 * Key behaviors:
 *   - Only targets text-bearing elements (text, shape with text)
 *   - Distinguishes deal-specific content (modify) from structural content (preserve)
 *   - Falls back to empty modifications + usedFallback when no element maps exist
 *   - Post-validates LLM response against known element IDs (hallucination guard)
 */

import type { DealContext } from "@lumenalta/schemas";

import {
  type ModificationPlan,
  MODIFICATION_PLAN_SCHEMA,
} from "./modification-plan-schema";
import {
  createJsonResponseOptions,
  executeRuntimeProviderNamedAgent,
} from "../lib/agent-executor";
import { prisma } from "../lib/db";

// ────────────────────────────────────────────────────────────
// Public Interfaces
// ────────────────────────────────────────────────────────────

export interface DraftContent {
  headline: string;
  valueProposition: string;
  keyCapabilities: string[];
  callToAction: string;
  companyName: string;
  [key: string]: unknown;
}

export interface PlanModificationsParams {
  /** SlideEmbedding database ID */
  slideId: string;
  /** Google Slides page object ID (from assembled presentation, not DB) */
  slideObjectId: string;
  /** Deal context for content tailoring */
  dealContext: DealContext;
  /** Approved draft content from the Draft step */
  draftContent?: DraftContent;
}

export interface PlanModificationsResult {
  /** The modification plan for this slide */
  plan: ModificationPlan;
  /** true if no element maps found — downstream should use replaceAllText */
  usedFallback: boolean;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 500;
const LOG_PREFIX = "[modification-planner]";

// ────────────────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────────────────

export async function planSlideModifications(
  params: PlanModificationsParams,
): Promise<PlanModificationsResult> {
  const { slideId, slideObjectId, dealContext, draftContent } = params;

  // 1. Load elements from database
  const allElements = await prisma.slideElement.findMany({
    where: { slideId },
  });

  // 2. Filter to text-bearing elements (FR-5.3)
  const textElements = allElements.filter(
    (el) =>
      (el.elementType === "text" || el.elementType === "shape") &&
      el.contentText.trim().length > 0,
  );

  // 3. Fallback: no text elements available (FR-5.6)
  if (textElements.length === 0) {
    return {
      plan: {
        slideId,
        slideObjectId,
        modifications: [],
        unmodifiedElements: [],
      },
      usedFallback: true,
    };
  }

  // 4. Build prompt and call LLM
  try {
    const prompt = buildPrompt(slideId, slideObjectId, dealContext, textElements, draftContent);

    // 5. Call LLM via executeRuntimeProviderNamedAgent
    const result = await executeRuntimeProviderNamedAgent({
      agentId: "modification-planner",
      messages: [{ role: "user", content: prompt }],
      options: createJsonResponseOptions(
        MODIFICATION_PLAN_SCHEMA as Record<string, unknown>,
      ),
    });

    // 6. Parse response
    const rawPlan = JSON.parse(result.text) as ModificationPlan;

    // 7. Post-validate against known element IDs (hallucination guard)
    const validatedPlan = postValidate(rawPlan, textElements, slideId, slideObjectId);

    return { plan: validatedPlan, usedFallback: false };
  } catch (error) {
    // Error path: return fallback plan gracefully (no throw)
    console.error(
      `${LOG_PREFIX} LLM call failed for slide ${slideId}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      plan: {
        slideId,
        slideObjectId,
        modifications: [],
        unmodifiedElements: textElements.map((el) => el.elementId),
      },
      usedFallback: true,
    };
  }
}

// ────────────────────────────────────────────────────────────
// Prompt Builder
// ────────────────────────────────────────────────────────────

interface TextElement {
  elementId: string;
  elementType: string;
  contentText: string;
}

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  return content.slice(0, MAX_CONTENT_LENGTH) + "... [truncated]";
}

function formatDraftContent(draftContent?: DraftContent): string {
  if (!draftContent) return "";
  return `

## Approved Draft Content (MUST USE)

The user approved the following draft content. You MUST use this content when modifying slide elements. Replace generic/placeholder text with the corresponding draft content:

- **Headline:** ${draftContent.headline}
- **Value Proposition:** ${draftContent.valueProposition}
- **Key Capabilities:** ${draftContent.keyCapabilities.join("; ")}
- **Call to Action:** ${draftContent.callToAction}
- **Company Name:** ${draftContent.companyName}

IMPORTANT: The draft content above was approved by the user. Prioritize using this exact content over generating new text. Match each slide element to the most relevant piece of draft content.`;
}

function buildPrompt(
  slideId: string,
  slideObjectId: string,
  dealContext: DealContext,
  elements: TextElement[],
  draftContent?: DraftContent,
): string {
  const elementList = elements
    .map(
      (el, i) =>
        `  ${i + 1}. elementId: "${el.elementId}" | type: ${el.elementType}\n     content: "${truncateContent(el.contentText)}"`,
    )
    .join("\n");

  return `You are a modification planner for sales presentation slides. Your job is to analyze a slide's text elements and decide which ones need deal-specific modifications.

## Deal Context

- **Company:** ${dealContext.companyName}
- **Industry:** ${dealContext.industry}
- **Solution Pillars:** ${dealContext.pillars.join(", ")}
- **Persona:** ${dealContext.persona}
- **Funnel Stage:** ${dealContext.funnelStage}
${formatDraftContent(draftContent)}

## Slide Identification

- **slideId:** "${slideId}"
- **slideObjectId:** "${slideObjectId}"

You MUST return these exact values in your response for slideId and slideObjectId.

## Text Elements on This Slide

${elementList}

## Modification Rules

### MODIFY (deal-specific content) -- change these to reference the target company:
- Company names or generic company references
- Industry references that should match the target industry
- Persona mentions that should match the target persona
- Generic summary bullets that should reference the target company
- Placeholder-like content (e.g., "[Company Name]", "Your Company")
- Headline/title text → replace with the approved draft headline
- Value proposition text → replace with the approved draft value proposition
- Capability/service descriptions → replace with approved draft capabilities
- CTA text → replace with the approved draft call to action

### PRESERVE (structural content) -- do NOT modify these:
- Methodology descriptions and framework explanations
- Capability definitions and service descriptions
- Case study specifics (specific client success stories, metrics from past work)
- Process step labels and numbered methodology steps
- Section headers that define the slide's purpose
- Numbered lists describing capabilities
- Specific client success stories with named companies and results

## Output Requirements

1. For each element you modify, provide the elementId, currentContent (exact current text), newContent (replacement text), and reason.
2. New content MUST be the same length or shorter than current content (to avoid text overflow).
3. Every element listed above MUST appear in either the "modifications" array OR the "unmodifiedElements" array.
4. Return the slideId and slideObjectId exactly as provided above.`;
}

// ────────────────────────────────────────────────────────────
// Post-Validation (Hallucination Guard)
// ────────────────────────────────────────────────────────────

function postValidate(
  rawPlan: ModificationPlan,
  knownElements: TextElement[],
  slideId: string,
  slideObjectId: string,
): ModificationPlan {
  const knownIds = new Set(knownElements.map((el) => el.elementId));

  // Strip modifications targeting unknown element IDs
  const validModifications = rawPlan.modifications.filter((mod) => {
    if (!knownIds.has(mod.elementId)) {
      console.warn(
        `${LOG_PREFIX} Stripped hallucinated modification for unknown elementId: ${mod.elementId}`,
      );
      return false;
    }
    return true;
  });

  // Strip unknown unmodified element IDs
  const validUnmodified = rawPlan.unmodifiedElements.filter((id) => {
    if (!knownIds.has(id)) {
      console.warn(
        `${LOG_PREFIX} Stripped hallucinated unmodifiedElement: ${id}`,
      );
      return false;
    }
    return true;
  });

  return {
    // Override slideId/slideObjectId with our known-good values
    slideId,
    slideObjectId,
    modifications: validModifications,
    unmodifiedElements: validUnmodified,
  };
}
