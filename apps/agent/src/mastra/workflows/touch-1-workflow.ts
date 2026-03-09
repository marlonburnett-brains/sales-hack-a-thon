/**
 * Touch 1 Pager Generation Workflow (3-Stage HITL)
 *
 * Full workflow: Generate content outline (Skeleton) -> Suspend for skeleton approval ->
 * Generate full draft text (Low-fi) -> Suspend for draft approval ->
 * Assemble Google Slides deck (High-fi) -> Suspend for final approval ->
 * Record interaction + feedback.
 *
 * 3-stage HITL model:
 *   Skeleton = content outline (companyName, headline, valueProposition, keyCapabilities summary)
 *   Low-fi   = full draft text (all PagerContent fields fleshed out)
 *   High-fi  = Google Slides pager (assembled deck)
 *
 * Uses Mastra suspend/resume for each stage boundary.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  PagerContentLlmSchema,
  zodToLlmJsonSchema,
} from "@lumenalta/schemas";
import { executeNamedAgent } from "../../lib/agent-executor";
import { assembleFromTemplate } from "../../lib/slide-assembly";
import { getOrCreateDealFolder, resolveRootFolderId, shareWithOrg, archiveExistingFile } from "../../lib/drive-folders";
import { ingestDocument } from "../../lib/atlusai-client";
import { prisma } from "../../lib/db";
import { env } from "../../env";
import { resolveGenerationStrategy, executeStructureDrivenPipeline, buildDealContext } from "../../generation/route-strategy";

const agentVersionsSchema = z.object({
  firstContactPagerWriter: z.string(),
});

// Skeleton content schema: content outline for review
const SkeletonContentSchema = z.object({
  companyName: z.string(),
  headline: z.string(),
  valueProposition: z.string(),
  keyCapabilities: z.array(z.string()),
});

// Common passthrough fields for Touch 1
const touch1BaseFields = {
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  context: z.string(),
  salespersonName: z.string().optional(),
  interactionId: z.string(),
};

// ────────────────────────────────────────────────────────────
// Step 1: Create InteractionRecord + Generate pager content outline (Skeleton)
// ────────────────────────────────────────────────────────────

const generateContent = createStep({
  id: "generate-pager-content",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
  }),
  outputSchema: z.object({
    ...touch1BaseFields,
    skeletonContent: SkeletonContentSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // Create InteractionRecord at the start so we have an ID for stage tracking
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_1",
        status: "in_progress",
        decision: null,
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          context: inputData.context,
          salespersonName: inputData.salespersonName,
        }),
      },
    });

    const prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Generate a CONTENT OUTLINE (skeleton) for a pager targeting this company.

Company: ${inputData.companyName}
Industry: ${inputData.industry}
Additional Context: ${inputData.context}
${inputData.salespersonName ? `Salesperson: ${inputData.salespersonName}` : ""}

Generate a content outline with:
- A compelling headline tailored to the company's industry and situation
- A clear value proposition connecting Lumenalta's capabilities to the company's needs
- 3-5 key Lumenalta capabilities most relevant to this company (as brief bullet points)

Keep the tone professional but engaging. Focus on the company's likely challenges based on their industry.
This is a SKELETON outline -- concise summaries, not full paragraphs.`;

    const response = await executeNamedAgent<z.infer<typeof SkeletonContentSchema>>({
      agentId: "first-contact-pager-writer",
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(SkeletonContentSchema) as Record<string, unknown>,
        },
      },
    });

    const parsed = SkeletonContentSchema.parse(response.object ?? JSON.parse(response.text ?? "{}"));

    // Update hitlStage to skeleton
    await prisma.interactionRecord.update({
      where: { id: interaction.id },
      data: {
        hitlStage: "skeleton",
        stageContent: JSON.stringify(parsed),
      },
    });

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      interactionId: interaction.id,
      skeletonContent: parsed,
      agentVersions: {
        firstContactPagerWriter: response.promptVersion.id,
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Await Skeleton Approval (SUSPEND 1)
// ────────────────────────────────────────────────────────────

const awaitSkeletonApproval = createStep({
  id: "await-skeleton-approval",
  inputSchema: z.object({
    ...touch1BaseFields,
    skeletonContent: SkeletonContentSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    ...touch1BaseFields,
    approvedSkeleton: SkeletonContentSchema,
    agentVersions: agentVersionsSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedContent: SkeletonContentSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("skeleton"),
    content: SkeletonContentSchema,
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "skeleton" as const,
        content: inputData.skeletonContent,
        dealId: inputData.dealId,
        interactionId: inputData.interactionId,
      });
    }

    const approvedSkeleton = resumeData.refinedContent ?? inputData.skeletonContent;

    // Update stageContent with approved skeleton if refined
    if (resumeData.refinedContent) {
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: { stageContent: JSON.stringify(approvedSkeleton) },
      });
    }

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      interactionId: inputData.interactionId,
      approvedSkeleton,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Generate Full Draft Text (Low-fi)
// ────────────────────────────────────────────────────────────

const generateDraftText = createStep({
  id: "generate-draft-text",
  inputSchema: z.object({
    ...touch1BaseFields,
    approvedSkeleton: SkeletonContentSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    ...touch1BaseFields,
    draftContent: PagerContentLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    const skeleton = inputData.approvedSkeleton;

    const prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Based on the approved content outline below, generate the FULL DRAFT TEXT for the pager.

Company: ${inputData.companyName}
Industry: ${inputData.industry}
Additional Context: ${inputData.context}
${inputData.salespersonName ? `Salesperson: ${inputData.salespersonName}` : ""}

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

    const response = await executeNamedAgent<z.infer<typeof PagerContentLlmSchema>>({
      agentId: "first-contact-pager-writer",
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(PagerContentLlmSchema) as Record<string, unknown>,
        },
      },
    });

    const parsed = PagerContentLlmSchema.parse(response.object ?? JSON.parse(response.text ?? "{}"));

    // Update hitlStage to lowfi
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        hitlStage: "lowfi",
        stageContent: JSON.stringify(parsed),
      },
    });

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      interactionId: inputData.interactionId,
      draftContent: parsed,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Await Low-fi Approval (SUSPEND 2)
// ────────────────────────────────────────────────────────────

const awaitLowfiApproval = createStep({
  id: "await-lowfi-approval",
  inputSchema: z.object({
    ...touch1BaseFields,
    draftContent: PagerContentLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    ...touch1BaseFields,
    finalContent: PagerContentLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedContent: PagerContentLlmSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("lowfi"),
    content: PagerContentLlmSchema,
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "lowfi" as const,
        content: inputData.draftContent,
        dealId: inputData.dealId,
        interactionId: inputData.interactionId,
      });
    }

    const finalContent = resumeData.refinedContent ?? inputData.draftContent;

    if (resumeData.refinedContent) {
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: { stageContent: JSON.stringify(finalContent) },
      });
    }

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      interactionId: inputData.interactionId,
      finalContent,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 5: Assemble Google Slides deck from approved content (High-fi)
// ────────────────────────────────────────────────────────────

const assembleDeck = createStep({
  id: "assemble-deck",
  inputSchema: z.object({
    ...touch1BaseFields,
    finalContent: PagerContentLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    ...touch1BaseFields,
    finalContent: PagerContentLlmSchema,
    presentationId: z.string(),
    driveUrl: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // Get or create per-deal folder using user's root folder setting
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const rootFolderId = await resolveRootFolderId(deal.ownerId ?? undefined);
    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: rootFolderId,
    });

    // Update deal with folder ID if not set
    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: folderId },
      });
    }

    // Archive previous file if re-generating
    const existingInteraction = await prisma.interactionRecord.findFirst({
      where: { dealId: inputData.dealId, touchType: "touch_1", driveFileId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { driveFileId: true },
    });
    if (existingInteraction?.driveFileId) {
      try {
        await archiveExistingFile({ dealFolderId: folderId, fileId: existingInteraction.driveFileId });
      } catch (err) {
        console.warn("[touch-1-workflow] Archive failed, continuing:", err);
      }
    }

    const content = inputData.finalContent;
    const deckName = `Touch 1 Pager - ${inputData.companyName} - ${new Date().toISOString().split("T")[0]}`;

    // Route: structure-driven pipeline or legacy template assembly
    const dealContext = buildDealContext("touch_1", {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
    });
    const strategy = await resolveGenerationStrategy("touch_1", null, dealContext);
    console.log(`[touch-1-workflow] Using ${strategy.type} generation path`);

    let result;
    if (strategy.type !== "legacy") {
      result = await executeStructureDrivenPipeline({
        blueprint: strategy.blueprint,
        targetFolderId: folderId,
        deckName,
        dealContext,
        ownerEmail: deal.ownerEmail ?? undefined,
      });
    } else {
      // Legacy: Assemble deck from template with text replacements
      result = await assembleFromTemplate({
        templateId: env.GOOGLE_TEMPLATE_PRESENTATION_ID,
        targetFolderId: folderId,
        deckName,
        textReplacements: {
          "{{company-name}}": content.companyName,
          "{{headline}}": content.headline,
          "{{value-proposition}}": content.valueProposition,
          "{{capabilities}}": content.keyCapabilities.join(", "),
          "{{call-to-action}}": content.callToAction,
        },
      });
    }

    // Share with deal owner as editor (domain sharing handled by assembleFromTemplate)
    if (deal.ownerEmail) {
      await shareWithOrg({ fileId: result.presentationId, ownerEmail: deal.ownerEmail });
    }

    // Update hitlStage to highfi
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        hitlStage: "highfi",
        stageContent: JSON.stringify({
          presentationId: result.presentationId,
          driveUrl: result.driveUrl,
        }),
      },
    });

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      interactionId: inputData.interactionId,
      finalContent: inputData.finalContent,
      presentationId: result.presentationId,
      driveUrl: result.driveUrl,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 6: Await High-fi Approval (SUSPEND 3 -- existing await-seller-approval)
// ────────────────────────────────────────────────────────────

const awaitApproval = createStep({
  id: "await-seller-approval",
  inputSchema: z.object({
    ...touch1BaseFields,
    finalContent: PagerContentLlmSchema,
    presentationId: z.string(),
    driveUrl: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    ...touch1BaseFields,
    finalContent: PagerContentLlmSchema,
    decision: z.enum(["approved", "edited"]),
    presentationId: z.string(),
    driveUrl: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "edited"]),
    editedContent: PagerContentLlmSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("highfi"),
    presentationId: z.string(),
    driveUrl: z.string(),
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "highfi" as const,
        presentationId: inputData.presentationId,
        driveUrl: inputData.driveUrl,
        dealId: inputData.dealId,
        interactionId: inputData.interactionId,
      });
    }

    const finalContent =
      resumeData.decision === "edited" && resumeData.editedContent
        ? resumeData.editedContent
        : inputData.finalContent;

    // Mark as ready after high-fi approval
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: { hitlStage: "ready" },
    });

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      interactionId: inputData.interactionId,
      finalContent,
      decision: resumeData.decision,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 7: Record interaction + feedback signals + AtlusAI ingestion
// ────────────────────────────────────────────────────────────

const recordInteraction = createStep({
  id: "record-interaction",
  inputSchema: z.object({
    ...touch1BaseFields,
    finalContent: PagerContentLlmSchema,
    decision: z.enum(["approved", "edited"]),
    presentationId: z.string(),
    driveUrl: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    decision: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Update the existing interaction record with final content
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        status: inputData.decision,
        decision: inputData.decision,
        generatedContent: JSON.stringify(inputData.finalContent),
        outputRefs: JSON.stringify([inputData.driveUrl]),
        driveFileId: inputData.presentationId,
      },
    });

    // Create feedback signal
    const signalType = inputData.decision === "approved" ? "positive" : "negative";
    const source =
      inputData.decision === "approved" ? "touch_1_approve" : "touch_1_edit";

    await prisma.feedbackSignal.create({
      data: {
        interactionId: inputData.interactionId,
        signalType,
        source,
        content: JSON.stringify({
          finalContent: inputData.finalContent,
          decision: inputData.decision,
        }),
      },
    });

    // Ingest the generated deck into AtlusAI
    try {
      await ingestDocument(
        {
          documentId: `touch1-${inputData.interactionId}`,
          presentationId: inputData.presentationId,
          presentationName: `Touch 1 Pager - ${inputData.companyName}`,
          slideObjectId: "full-deck",
          slideIndex: 0,
          folderPath: `deals/${inputData.companyName}`,
          textContent: `${inputData.finalContent.headline}\n\n${inputData.finalContent.valueProposition}\n\nCapabilities: ${inputData.finalContent.keyCapabilities.join(", ")}\n\n${inputData.finalContent.callToAction}`,
          speakerNotes: "",
          isLowContent: false,
          metadata: {
            touchType: "touch_1",
            industry: inputData.industry,
            companyName: inputData.companyName,
            decision: inputData.decision,
          },
        },
        env.GOOGLE_DRIVE_FOLDER_ID
      );
    } catch (err) {
      // AtlusAI ingestion is non-blocking — log and continue
      console.error("[touch-1-workflow] AtlusAI ingestion failed:", err);
    }

    return {
      interactionId: inputData.interactionId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      decision: inputData.decision,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 1 Pager Generation (3-Stage HITL)
// ────────────────────────────────────────────────────────────

export const touch1Workflow = createWorkflow({
  id: "touch-1-workflow",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
    decision: z.string(),
  }),
})
  .then(generateContent)
  .then(awaitSkeletonApproval)
  .then(generateDraftText)
  .then(awaitLowfiApproval)
  .then(assembleDeck)
  .then(awaitApproval)
  .then(recordInteraction)
  .commit();
