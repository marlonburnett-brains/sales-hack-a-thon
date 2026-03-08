/**
 * Touch 1 Pager Generation Workflow
 *
 * Full workflow: Generate pager content via LLM -> Suspend for seller approval ->
 * Assemble Google Slides deck from approved content -> Record interaction + feedback.
 *
 * Uses Mastra suspend/resume for the seller review step.
 * The web app displays the generated content for review, then resumes
 * the workflow with the seller's decision (approve/edit).
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  PagerContentLlmSchema,
  zodToLlmJsonSchema,
} from "@lumenalta/schemas";
import { executeNamedAgent } from "../../lib/agent-executor";
import { assembleFromTemplate } from "../../lib/slide-assembly";
import { getOrCreateDealFolder } from "../../lib/drive-folders";
import { ingestDocument } from "../../lib/atlusai-client";
import { prisma } from "../../lib/db";
import { env } from "../../env";

const agentVersionsSchema = z.object({
  firstContactPagerWriter: z.string(),
});

// ────────────────────────────────────────────────────────────
// Step 1: Generate pager content via LLM
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
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
    generatedContent: PagerContentLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    const prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Generate compelling, professional content for a pager targeting this company.

Company: ${inputData.companyName}
Industry: ${inputData.industry}
Additional Context: ${inputData.context}
${inputData.salespersonName ? `Salesperson: ${inputData.salespersonName}` : ""}

Generate a personalized one-pager with:
- A compelling headline tailored to the company's industry and situation
- A clear value proposition connecting Lumenalta's capabilities to the company's needs
- 3-5 key Lumenalta capabilities most relevant to this company
- A specific call to action for the next step

Keep the tone professional but engaging. Focus on the company's likely challenges based on their industry.`;

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

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      generatedContent: parsed,
      agentVersions: {
        firstContactPagerWriter: response.promptVersion.id,
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Suspend for seller approval
// ────────────────────────────────────────────────────────────

const awaitApproval = createStep({
  id: "await-seller-approval",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
    generatedContent: PagerContentLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
    finalContent: PagerContentLlmSchema,
    decision: z.enum(["approved", "edited"]),
    agentVersions: agentVersionsSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "edited"]),
    editedContent: PagerContentLlmSchema.optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    generatedContent: PagerContentLlmSchema,
    dealId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      // First execution: suspend and wait for seller review
      return await suspend({
        reason: "Seller review required",
        generatedContent: inputData.generatedContent,
        dealId: inputData.dealId,
      });
    }

    // Resumed with seller decision
    const finalContent =
      resumeData.decision === "edited" && resumeData.editedContent
        ? resumeData.editedContent
        : inputData.generatedContent;

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      salespersonName: inputData.salespersonName,
      finalContent,
      decision: resumeData.decision,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Assemble Google Slides deck from approved content
// ────────────────────────────────────────────────────────────

const assembleDeck = createStep({
  id: "assemble-deck",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
    finalContent: PagerContentLlmSchema,
    decision: z.enum(["approved", "edited"]),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
    finalContent: PagerContentLlmSchema,
    decision: z.enum(["approved", "edited"]),
    presentationId: z.string(),
    driveUrl: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // Get or create per-deal folder
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
    });

    // Update deal with folder ID if not set
    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: folderId },
      });
    }

    const content = inputData.finalContent;
    const deckName = `Touch 1 Pager - ${inputData.companyName} - ${new Date().toISOString().split("T")[0]}`;

    // Assemble deck from template with text replacements
    const result = await assembleFromTemplate({
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

    return {
      ...inputData,
      presentationId: result.presentationId,
      driveUrl: result.driveUrl,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Record interaction + feedback signals + AtlusAI ingestion
// ────────────────────────────────────────────────────────────

const recordInteraction = createStep({
  id: "record-interaction",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    context: z.string(),
    salespersonName: z.string().optional(),
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
    // Create interaction record
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_1",
        status: inputData.decision,
        decision: inputData.decision,
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          context: inputData.context,
          salespersonName: inputData.salespersonName,
        }),
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
        interactionId: interaction.id,
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
          documentId: `touch1-${interaction.id}`,
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
      interactionId: interaction.id,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
      decision: inputData.decision,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 1 Pager Generation
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
  .then(awaitApproval)
  .then(assembleDeck)
  .then(recordInteraction)
  .commit();
