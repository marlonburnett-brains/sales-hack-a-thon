/**
 * Re-run LLM generation for the current HITL stage of an interaction.
 *
 * Instead of starting a brand-new workflow (which always begins at skeleton),
 * this function directly calls the LLM agent to regenerate content for
 * whichever stage the interaction is currently on, then updates stageContent.
 */

import { z } from "zod";
import {
  PagerContentLlmSchema,
  SectionDraftLlmSchema,
  zodToLlmJsonSchema,
} from "@lumenalta/schemas";
import { executeRuntimeNamedAgent as executeNamedAgent } from "./agent-executor";
import { assertLlmContentQuality } from "./validate-llm-content";
import { loadDeckSectionsWithElements, formatSectionsWithElementsForPrompt } from "./deck-structure-loader";
import type { SectionElementData } from "./deck-structure-loader";
import { prisma } from "./db";

export async function regenerateStage(
  interactionId: string,
  feedback?: string
): Promise<{ success: boolean; stage: string }> {
  const interaction = await prisma.interactionRecord.findUniqueOrThrow({
    where: { id: interactionId },
    include: { deal: { include: { company: true } } },
  });

  const stage = interaction.hitlStage ?? "skeleton";
  const inputs = JSON.parse(interaction.inputs ?? "{}");
  const companyName = inputs.companyName ?? interaction.deal?.company?.name ?? "Unknown";
  const industry = inputs.industry ?? "Technology";
  const context = inputs.context ?? "";
  const salespersonName = inputs.salespersonName;

  if (stage === "skeleton") {
    // Regenerate outline
    const prompt = buildSkeletonPrompt(companyName, industry, context, salespersonName, feedback);
    const SkeletonContentSchema = z.object({
      companyName: z.string(),
      headline: z.string(),
      valueProposition: z.string(),
      keyCapabilities: z.array(z.string()),
    });

    const response = await executeNamedAgent({
      agentId: "first-contact-pager-writer",
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(SkeletonContentSchema) as Record<string, unknown>,
        },
      },
    });

    const parsed = SkeletonContentSchema.parse(
      response.object ?? JSON.parse(response.text ?? "{}")
    );
    assertLlmContentQuality(parsed);

    await prisma.interactionRecord.update({
      where: { id: interactionId },
      data: { stageContent: JSON.stringify(parsed) },
    });
  } else if (stage === "lowfi") {
    // Regenerate draft from existing skeleton
    // The skeleton was approved earlier, so look at the previous stageContent
    // or reconstruct from the interaction's generatedContent/inputs
    const skeletonContent = await getApprovedSkeleton(interaction);

    // Check if DeckStructure sections are available for section-aware drafting
    const enriched = await loadDeckSectionsWithElements("touch_1");

    if (enriched && enriched.sections.length > 0) {
      const deckSections = enriched.sections;
      // Section-aware regeneration
      const sectionAwarePrompt = buildSectionAwareDraftPrompt(
        companyName, industry, context, salespersonName, skeletonContent, deckSections, enriched.elementsBySlideId, feedback,
      );

      const response = await executeNamedAgent<z.infer<typeof SectionDraftLlmSchema>>({
        agentId: "first-contact-pager-writer",
        messages: [{ role: "user", content: sectionAwarePrompt }],
        options: {
          structuredOutput: {
            schema: zodToLlmJsonSchema(SectionDraftLlmSchema) as Record<string, unknown>,
          },
        },
      });

      const parsed = SectionDraftLlmSchema.parse(
        response.object ?? JSON.parse(response.text ?? "{}"),
      );
      assertLlmContentQuality(parsed);

      await prisma.interactionRecord.update({
        where: { id: interactionId },
        data: { stageContent: JSON.stringify(parsed) },
      });
    } else {
      // Legacy regeneration
      const prompt = buildDraftPrompt(companyName, industry, context, salespersonName, skeletonContent, feedback);

      const response = await executeNamedAgent<z.infer<typeof PagerContentLlmSchema>>({
        agentId: "first-contact-pager-writer",
        messages: [{ role: "user", content: prompt }],
        options: {
          structuredOutput: {
            schema: zodToLlmJsonSchema(PagerContentLlmSchema) as Record<string, unknown>,
          },
        },
      });

      const parsed = PagerContentLlmSchema.parse(
        response.object ?? JSON.parse(response.text ?? "{}")
      );
      assertLlmContentQuality(parsed);

      await prisma.interactionRecord.update({
        where: { id: interactionId },
        data: { stageContent: JSON.stringify(parsed) },
      });
    }
  } else {
    throw new Error(`Regeneration not supported for stage: ${stage}`);
  }

  return { success: true, stage };
}

// ────────────────────────────────────────────────────────────
// Prompt builders (match the workflow step prompts)
// ────────────────────────────────────────────────────────────

function buildSkeletonPrompt(
  companyName: string,
  industry: string,
  context: string,
  salespersonName?: string,
  feedback?: string
): string {
  let prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Generate a CONTENT OUTLINE (skeleton) for a pager targeting this company.

Company: ${companyName}
Industry: ${industry}
Additional Context: ${context}
${salespersonName ? `Salesperson: ${salespersonName}` : ""}

Generate a content outline with:
- A compelling headline tailored to the company's industry and situation
- A clear value proposition connecting Lumenalta's capabilities to the company's needs
- 3-5 key Lumenalta capabilities most relevant to this company (as brief bullet points)

Keep the tone professional but engaging. Focus on the company's likely challenges based on their industry.
This is a SKELETON outline -- concise summaries, not full paragraphs.`;

  if (feedback) {
    prompt += `\n\nUser feedback for regeneration: ${feedback}`;
  }
  return prompt;
}

function buildDraftPrompt(
  companyName: string,
  industry: string,
  context: string,
  salespersonName: string | undefined,
  skeleton: { headline: string; valueProposition: string; keyCapabilities: string[] },
  feedback?: string
): string {
  let prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Based on the approved content outline below, generate the FULL DRAFT TEXT for the pager.

Company: ${companyName}
Industry: ${industry}
Additional Context: ${context}
${salespersonName ? `Salesperson: ${salespersonName}` : ""}

APPROVED OUTLINE:
- Headline: ${skeleton.headline}
- Value Proposition: ${skeleton.valueProposition}
- Key Capabilities: ${skeleton.keyCapabilities.join(", ")}

Now expand this outline into a complete, polished pager with:
- The headline (can be refined from the outline)
- A fully written value proposition paragraph
- Expanded capability descriptions
- A specific call to action for the next step

Keep the tone professional but engaging. This is the FULL DRAFT -- complete, publication-ready text.`;

  if (feedback) {
    prompt += `\n\nUser feedback for regeneration: ${feedback}`;
  }
  return prompt;
}

function buildSectionAwareDraftPrompt(
  companyName: string,
  industry: string,
  context: string,
  salespersonName: string | undefined,
  skeleton: { headline: string; valueProposition: string; keyCapabilities: string[] },
  deckSections: import("../deck-intelligence/deck-structure-schema").DeckSection[],
  elementsBySlideId: Map<string, SectionElementData[]>,
  feedback?: string,
): string {
  let prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Based on the approved outline and the TEMPLATE STRUCTURE below, generate section-specific content that maps to each template section.

Company: ${companyName}
Industry: ${industry}
Additional Context: ${context}
${salespersonName ? `Salesperson: ${salespersonName}` : ""}

APPROVED OUTLINE:
- Headline: ${skeleton.headline}
- Value Proposition: ${skeleton.valueProposition}
- Key Capabilities: ${skeleton.keyCapabilities.join(", ")}

TEMPLATE STRUCTURE (generate content for EACH section):
${formatSectionsWithElementsForPrompt(deckSections, elementsBySlideId)}

For each section, generate:
- contentText: The actual text content tailored to this section's purpose, personalized for the target company
- speakerNotes: Brief talking points for the presenter

Also provide an overall headline and call to action.
Keep tone professional but engaging. Content must fit the section's purpose.`;

  if (feedback) {
    prompt += `\n\nUser feedback for regeneration: ${feedback}`;
  }
  return prompt;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function getApprovedSkeleton(
  interaction: { id: string; stageContent: string | null; dealId: string }
): Promise<{ headline: string; valueProposition: string; keyCapabilities: string[] }> {
  // Current stageContent at lowfi IS the draft content.
  // We need the SKELETON that was approved. Look at feedback signals
  // or the previous interaction at skeleton stage.
  // Simplest: find the most recent skeleton-stage snapshot from feedbackSignals
  const signal = await prisma.feedbackSignal.findFirst({
    where: { interactionId: interaction.id },
    orderBy: { createdAt: "asc" },
    select: { content: true },
  });

  if (signal?.content) {
    try {
      const parsed = JSON.parse(signal.content);
      if (parsed.skeleton || parsed.approvedSkeleton) {
        return parsed.skeleton ?? parsed.approvedSkeleton;
      }
    } catch {
      // fall through
    }
  }

  // Fallback: parse skeleton from current stageContent (draft has all the fields)
  if (interaction.stageContent) {
    try {
      const draft = JSON.parse(interaction.stageContent);
      return {
        headline: draft.headline ?? "Untitled",
        valueProposition: draft.valueProposition ?? "",
        keyCapabilities: draft.keyCapabilities ?? [],
      };
    } catch {
      // fall through
    }
  }

  throw new Error("Could not find approved skeleton content for regeneration");
}
