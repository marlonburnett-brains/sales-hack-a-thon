/**
 * Touch 4 Transcript Processing Workflow (17-Step Pipeline with HITL-1 Approval + RAG Retrieval + Google Workspace Output + HITL-2 Asset Review)
 *
 * Workflow: parseTranscript -> validateFields -> awaitFieldReview (SUSPEND 1)
 *           -> mapPillarsAndGenerateBrief -> generateROIFraming
 *           -> recordInteraction (persists with status "pending_approval")
 *           -> awaitBriefApproval (SUSPEND 2)
 *           -> finalizeApproval (updates to "approved", creates FeedbackSignal)
 *           -> ragRetrieval -> assembleSlideJSON -> generateCustomCopy
 *           -> createSlidesDeck -> createTalkTrack -> createBuyerFAQ
 *           -> checkBrandCompliance -> awaitAssetReview (SUSPEND 3) -> finalizeDelivery
 *
 * Step 1: LLM extracts 6 structured fields from the raw transcript
 * Step 2: Pure logic validates fields and assigns tiered severity
 * Step 3: Suspends for seller review -- seller edits/fills gaps, then resumes
 * Step 4: LLM maps transcript to Lumenalta solution pillars and generates sales brief
 * Step 5: LLM enriches use cases with specific ROI outcome statements
 * Step 6: Persists InteractionRecord, Transcript, Brief to database (status: pending_approval)
 * Step 7: Suspends for brief approval -- HITL Checkpoint 1 (hard stop)
 * Step 8: Finalizes approval -- updates Brief/InteractionRecord status, creates FeedbackSignal
 * Step 9: RAG retrieval from AtlusAI (multi-pass: primary pillar, secondary pillars, case studies)
 * Step 10: Assembles SlideJSON with LLM-powered weighted slide selection
 * Step 11: Generates bespoke copy per retrieved slide, grounded in approved brief
 * Step 12: createSlidesDeck -- Google Slides deck from SlideJSON
 * Step 13: createTalkTrack -- slide-by-slide talk track Google Doc
 * Step 14: createBuyerFAQ -- role-specific buyer FAQ Google Doc + outputRefs persistence
 * Step 15: checkBrandCompliance -- pure-logic brand compliance checks on SlideJSON
 * Step 16: awaitAssetReview -- suspends for HITL Checkpoint 2 (asset review approval)
 * Step 17: finalizeDelivery -- updates status to "delivered", creates approval FeedbackSignal
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  TranscriptFieldsLlmSchema,
  SalesBriefLlmSchema,
  ROIFramingLlmSchema,
  BuyerFaqLlmSchema,
  zodToLlmJsonSchema,
  SOLUTION_PILLARS,
} from "@lumenalta/schemas";
import { executeNamedAgent } from "../../lib/agent-executor";
import { searchForProposal } from "../../lib/atlusai-search";
import {
  filterByMetadata,
  buildSlideJSON,
  generateSlideCopy,
} from "../../lib/proposal-assembly";
import { createSlidesDeckFromJSON } from "../../lib/deck-assembly";
import { createGoogleDoc } from "../../lib/doc-builder";
import type { DocSection } from "../../lib/doc-builder";
import { runBrandComplianceChecks } from "../../lib/brand-compliance";
import { getOrCreateDealFolder } from "../../lib/drive-folders";
import { prisma } from "../../lib/db";

// ────────────────────────────────────────────────────────────
// Shared schemas
// ────────────────────────────────────────────────────────────

const fieldSeveritySchema = z.record(
  z.string(),
  z.enum(["error", "warning", "ok"]),
);

const agentVersionsSchema = z.object({
  transcriptExtractor: z.string(),
  salesBriefStrategist: z.string(),
  roiFramingAnalyst: z.string(),
  proposalSlideSelector: z.string(),
  buyerFaqStrategist: z.string(),
});

// ────────────────────────────────────────────────────────────
// Step 1: Parse Transcript via LLM
// ────────────────────────────────────────────────────────────

const parseTranscript = createStep({
  id: "parse-transcript",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // Create InteractionRecord early so we can track hitlStage from the first suspend
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_4",
        status: "in_progress",
        decision: null,
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          subsector: inputData.subsector,
        }),
      },
    });

    const prompt = `You are an expert sales intelligence analyst at Lumenalta, a technology consulting company specializing in ${SOLUTION_PILLARS.join(", ")}.

You are extracting structured fields from a sales discovery call transcript for the ${inputData.industry} industry, specifically the "${inputData.subsector}" subsector.

Company: ${inputData.companyName}
Industry: ${inputData.industry}
Subsector: ${inputData.subsector}

TRANSCRIPT:
---
${inputData.transcript}
---
${inputData.additionalNotes ? `\nADDITIONAL MEETING NOTES:\n---\n${inputData.additionalNotes}\n---` : ""}

EXTRACTION RULES:
1. Extract INDIRECT and implied mentions, not just explicit statements. For example:
   - If someone says "we have limited resources" or "this needs to fit within Q2 allocation", extract that as budget context.
   - If someone mentions "our VP of Engineering is driving this", extract that as a stakeholder.
   - If the conversation implies urgency ("before the board meeting in June"), extract that as timeline.
2. Use the industry (${inputData.industry}) and subsector (${inputData.subsector}) context to interpret domain-specific language and jargon.
3. Treat the additional meeting notes (if provided) as supplementary context that may fill gaps in the transcript.
4. Return an EMPTY STRING ("") for a field ONLY when the topic is completely absent from both the transcript and additional notes. Do not return empty string if there is even a vague or indirect reference.
5. Be thorough and include all relevant details for each field, even if they span multiple parts of the conversation.

Extract the following 6 fields:
- customerContext: The customer's current situation, pain points, and business context
- businessOutcomes: Desired business outcomes and goals mentioned by the customer
- constraints: Technical, budgetary, or organizational constraints mentioned
- stakeholders: Key stakeholders, decision makers, and their roles
- timeline: Timeline expectations, deadlines, or urgency indicators
- budget: Budget information, investment range, or financial constraints`;

    const response = await executeNamedAgent<z.infer<typeof TranscriptFieldsLlmSchema>>({
      agentId: "transcript-extractor",
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(TranscriptFieldsLlmSchema) as Record<string, unknown>,
        },
      },
    });

    const parsed = TranscriptFieldsLlmSchema.parse(response.object ?? JSON.parse(response.text ?? "{}"));

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      interactionId: interaction.id,
      extractedFields: parsed,
      agentVersions: {
        transcriptExtractor: response.promptVersion.id,
        salesBriefStrategist: "",
        roiFramingAnalyst: "",
        proposalSlideSelector: "",
        buyerFaqStrategist: "",
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Validate Fields -- Pure Logic (No LLM)
// ────────────────────────────────────────────────────────────

const validateFields = createStep({
  id: "validate-fields",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    const fields = inputData.extractedFields;

    // Tiered severity:
    // - customerContext & businessOutcomes: "error" if empty (hard requirements)
    // - constraints, stakeholders, timeline, budget: "warning" if empty (soft requirements)
    const fieldSeverity: Record<string, "error" | "warning" | "ok"> = {
      customerContext:
        fields.customerContext.trim() === "" ? "error" : "ok",
      businessOutcomes:
        fields.businessOutcomes.trim() === "" ? "error" : "ok",
      constraints:
        fields.constraints.trim() === "" ? "warning" : "ok",
      stakeholders:
        fields.stakeholders.trim() === "" ? "warning" : "ok",
      timeline:
        fields.timeline.trim() === "" ? "warning" : "ok",
      budget:
        fields.budget.trim() === "" ? "warning" : "ok",
    };

    const hasErrors = Object.values(fieldSeverity).some(
      (severity) => severity === "error"
    );

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      interactionId: inputData.interactionId,
      extractedFields: inputData.extractedFields,
      fieldSeverity,
      hasErrors,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Await Field Review (SUSPEND 1 for seller review -- Skeleton stage)
// ────────────────────────────────────────────────────────────

const awaitFieldReview = createStep({
  id: "await-field-review",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    reviewedFields: TranscriptFieldsLlmSchema,
    decision: z.enum(["continued"]),
    agentVersions: agentVersionsSchema,
  }),
  resumeSchema: z.object({
    reviewedFields: TranscriptFieldsLlmSchema,
  }),
  suspendSchema: z.object({
    reason: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      // Update hitlStage to skeleton before suspending
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: {
          hitlStage: "skeleton",
          stageContent: JSON.stringify({
            extractedFields: inputData.extractedFields,
            fieldSeverity: inputData.fieldSeverity,
            hasErrors: inputData.hasErrors,
          }),
        },
      });

      // First execution: suspend and wait for seller review
      return await suspend({
        reason: "Seller field review required",
        extractedFields: inputData.extractedFields,
        fieldSeverity: inputData.fieldSeverity,
        hasErrors: inputData.hasErrors,
        dealId: inputData.dealId,
        interactionId: inputData.interactionId,
      });
    }

    // Resumed with seller-reviewed fields
    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      interactionId: inputData.interactionId,
      extractedFields: inputData.extractedFields,
      fieldSeverity: inputData.fieldSeverity,
      hasErrors: inputData.hasErrors,
      reviewedFields: resumeData.reviewedFields,
      decision: "continued" as const,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Map Pillars & Generate Brief (LLM)
// ────────────────────────────────────────────────────────────

const mapPillarsAndGenerateBrief = createStep({
  id: "map-pillars-generate-brief",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    reviewedFields: TranscriptFieldsLlmSchema,
    decision: z.enum(["continued"]),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    const fields = inputData.reviewedFields;

    const prompt = `You are a senior sales strategist at Lumenalta, a technology consulting company. Your job is to create a comprehensive sales brief that maps customer needs to Lumenalta's solution pillars.

COMPANY INFORMATION:
- Company Name: ${inputData.companyName}
- Industry: ${inputData.industry}
- Subsector: ${inputData.subsector}

SELLER-REVIEWED FIELDS (ground truth -- use these as the primary source):
- Customer Context: ${fields.customerContext}
- Business Outcomes: ${fields.businessOutcomes}
- Constraints: ${fields.constraints}
- Stakeholders: ${fields.stakeholders}
- Timeline: ${fields.timeline}
- Budget: ${fields.budget}

LUMENALTA SOLUTION PILLARS (choose from these ONLY):
${SOLUTION_PILLARS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

INSTRUCTIONS:
1. Select a PRIMARY pillar -- the single most relevant Lumenalta service area based on the customer's needs. Provide clear evidence from the reviewed fields explaining why this pillar is the best fit.
2. Select at least ONE secondary pillar that complements the primary. Secondary pillars should address adjacent needs mentioned in the transcript.
3. Generate 2-4 USE CASES specific to this customer's situation:
   - Each use case must be grounded in the reviewed fields -- do NOT hallucinate capabilities or needs not present in the data
   - Each use case needs a descriptive name, a brief description of what it entails, an initial ROI outcome estimate, and a value hypothesis explaining how Lumenalta delivers value
4. Populate all brief fields (customerContext, businessOutcomes, constraints, stakeholders, timeline, budget) by synthesizing the reviewed fields -- you may rephrase for clarity but do NOT add information not present in the source data.

OUTPUT: A complete sales brief with pillar mapping, evidence, and use cases.`;

    const response = await executeNamedAgent<z.infer<typeof SalesBriefLlmSchema>>({
      agentId: "sales-brief-strategist",
      pinnedVersionId: inputData.agentVersions.salesBriefStrategist || undefined,
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(SalesBriefLlmSchema) as Record<string, unknown>,
        },
      },
    });

    const brief = SalesBriefLlmSchema.parse(response.object ?? JSON.parse(response.text ?? "{}"));

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      interactionId: inputData.interactionId,
      reviewedFields: inputData.reviewedFields,
      brief,
      agentVersions: {
        ...inputData.agentVersions,
        salesBriefStrategist:
          inputData.agentVersions.salesBriefStrategist || response.promptVersion.id,
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 5: Generate ROI Framing (LLM enrichment)
// ────────────────────────────────────────────────────────────

const generateROIFraming = createStep({
  id: "generate-roi-framing",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
    roiFraming: ROIFramingLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    const { brief } = inputData;

    const useCaseSummary = brief.useCases
      .map(
        (uc, i) =>
          `${i + 1}. ${uc.name}: ${uc.description}\n   Initial ROI: ${uc.roiOutcome}\n   Initial Hypothesis: ${uc.valueHypothesis}`
      )
      .join("\n\n");

    const prompt = `You are an ROI analyst at Lumenalta, a technology consulting company. Your job is to create specific, quantifiable ROI outcome statements for each use case in a sales brief.

COMPANY: ${inputData.companyName}
INDUSTRY: ${inputData.industry} (${inputData.subsector})
PRIMARY PILLAR: ${brief.primaryPillar}

USE CASES FROM BRIEF:
${useCaseSummary}

CUSTOMER CONTEXT:
${brief.customerContext}

BUSINESS OUTCOMES DESIRED:
${brief.businessOutcomes}

INSTRUCTIONS:
1. For EACH use case, generate 2-3 SPECIFIC, quantifiable ROI outcome statements:
   - Reference industry benchmarks where applicable (e.g., "Reduce claim processing time by 40%", "Decrease infrastructure costs by 25-30%")
   - Make outcomes measurable with specific metrics, percentages, or timeframes
   - Ground outcomes in the customer's actual situation -- do not invent generic statistics
   - Each outcome should be a complete, actionable statement

2. For EACH use case, generate a refined value hypothesis:
   - Connect Lumenalta's delivery model (agile pods, deep domain expertise, end-to-end delivery) to the customer's specific needs
   - Explain HOW Lumenalta uniquely delivers this value vs. generic consultancies
   - Keep it concise but compelling (2-3 sentences)

OUTPUT: ROI framing for each use case with useCaseName matching the brief's use case names exactly.`;

    const response = await executeNamedAgent<z.infer<typeof ROIFramingLlmSchema>>({
      agentId: "roi-framing-analyst",
      pinnedVersionId: inputData.agentVersions.roiFramingAnalyst || undefined,
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(ROIFramingLlmSchema) as Record<string, unknown>,
        },
      },
    });

    const roiFraming = ROIFramingLlmSchema.parse(response.object ?? JSON.parse(response.text ?? "{}"));

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      interactionId: inputData.interactionId,
      reviewedFields: inputData.reviewedFields,
      brief: inputData.brief,
      roiFraming,
      agentVersions: {
        ...inputData.agentVersions,
        roiFramingAnalyst:
          inputData.agentVersions.roiFramingAnalyst || response.promptVersion.id,
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 6: Record Interaction (Database persistence, no LLM)
// Now UPDATES (not creates) the InteractionRecord created in parseTranscript
// ────────────────────────────────────────────────────────────

const recordInteraction = createStep({
  id: "record-interaction",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    interactionId: z.string(),
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
    roiFraming: ROIFramingLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    const { brief, roiFraming, reviewedFields } = inputData;

    // a. Update InteractionRecord (created in parseTranscript) with status "pending_approval"
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        status: "pending_approval",
        generatedContent: JSON.stringify({
          primaryPillar: brief.primaryPillar,
          secondaryPillars: brief.secondaryPillars,
          useCaseCount: brief.useCases.length,
        }),
      },
    });

    // b. Create Transcript record
    const transcript = await prisma.transcript.create({
      data: {
        interactionId: inputData.interactionId,
        rawText: inputData.transcript,
        additionalNotes: inputData.additionalNotes ?? null,
        subsector: inputData.subsector,
        customerContext: reviewedFields.customerContext,
        businessOutcomes: reviewedFields.businessOutcomes,
        constraints: reviewedFields.constraints,
        stakeholders: reviewedFields.stakeholders,
        timeline: reviewedFields.timeline,
        budget: reviewedFields.budget,
      },
    });

    // c. Create Brief record with approvalStatus "pending_approval"
    // workflowRunId left null -- will be set by the approve endpoint
    const briefRecord = await prisma.brief.create({
      data: {
        interactionId: inputData.interactionId,
        primaryPillar: brief.primaryPillar,
        secondaryPillars: JSON.stringify(brief.secondaryPillars),
        evidence: brief.evidence,
        customerContext: brief.customerContext,
        businessOutcomes: brief.businessOutcomes,
        constraints: brief.constraints,
        stakeholders: brief.stakeholders,
        timeline: brief.timeline,
        budget: brief.budget,
        useCases: JSON.stringify(brief.useCases),
        roiFraming: JSON.stringify(roiFraming.useCases),
        approvalStatus: "pending_approval",
      },
    });

    // Note: FeedbackSignal is NOT created here -- moved to finalizeApproval step

    return {
      interactionId: inputData.interactionId,
      transcriptId: transcript.id,
      briefId: briefRecord.id,
      briefData: brief,
      roiFramingData: roiFraming,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 7: Await Brief Approval (SUSPEND 2 -- HITL Checkpoint 1)
// The workflow cannot progress past this point without explicit human approval.
// Rejection/edit operations happen via custom API endpoints, not workflow resume.
// ────────────────────────────────────────────────────────────

const awaitBriefApproval = createStep({
  id: "await-brief-approval",
  inputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    editedBrief: SalesBriefLlmSchema.optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    briefId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      // Update hitlStage to lowfi before suspending (brief = low-fi draft content)
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: {
          hitlStage: "lowfi",
          stageContent: JSON.stringify({
            briefData: inputData.briefData,
            roiFramingData: inputData.roiFramingData,
          }),
        },
      });

      // First execution: suspend and wait for brief approval
      return await suspend({
        reason: "Brief approval required -- HITL Checkpoint 1",
        briefId: inputData.briefId,
        interactionId: inputData.interactionId,
      });
    }

    // Resumed with approval decision
    return {
      interactionId: inputData.interactionId,
      transcriptId: inputData.transcriptId,
      briefId: inputData.briefId,
      briefData: resumeData.editedBrief ?? inputData.briefData,
      roiFramingData: inputData.roiFramingData,
      decision: resumeData.decision,
      reviewerName: resumeData.reviewerName,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 8: Finalize Approval (Updates status, creates FeedbackSignal)
// ────────────────────────────────────────────────────────────

const finalizeApproval = createStep({
  id: "finalize-approval",
  inputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Update Brief status to "approved"
    await prisma.brief.update({
      where: { id: inputData.briefId },
      data: {
        approvalStatus: "approved",
        reviewerName: inputData.reviewerName,
        approvedAt: new Date(),
      },
    });

    // b. Update InteractionRecord status to "completed" and decision to "approved"
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        status: "completed",
        decision: "approved",
      },
    });

    // c. If brief data was edited during approval, update Brief fields in-place
    // (The awaitBriefApproval step already swapped briefData to editedBrief if provided)
    const brief = inputData.briefData;
    await prisma.brief.update({
      where: { id: inputData.briefId },
      data: {
        primaryPillar: brief.primaryPillar,
        secondaryPillars: JSON.stringify(brief.secondaryPillars),
        evidence: brief.evidence,
        customerContext: brief.customerContext,
        businessOutcomes: brief.businessOutcomes,
        constraints: brief.constraints,
        stakeholders: brief.stakeholders,
        timeline: brief.timeline,
        budget: brief.budget,
        useCases: JSON.stringify(brief.useCases),
      },
    });

    // d. Create FeedbackSignal for approval
    await prisma.feedbackSignal.create({
      data: {
        interactionId: inputData.interactionId,
        signalType: "positive",
        source: "brief_approved",
        content: JSON.stringify({
          reviewerName: inputData.reviewerName,
          primaryPillar: brief.primaryPillar,
          secondaryPillars: brief.secondaryPillars,
          useCaseCount: brief.useCases.length,
          briefId: inputData.briefId,
        }),
      },
    });

    return {
      interactionId: inputData.interactionId,
      transcriptId: inputData.transcriptId,
      briefId: inputData.briefId,
      briefData: inputData.briefData,
      roiFramingData: inputData.roiFramingData,
      decision: inputData.decision,
      reviewerName: inputData.reviewerName,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 9: RAG Retrieval from AtlusAI (multi-pass: primary, secondary, case studies)
// ────────────────────────────────────────────────────────────

const ragRetrieval = createStep({
  id: "rag-retrieval",
  inputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    candidateSlides: z.string(),
    retrievalSummary: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Fetch Brief from DB for industry context
    const brief = await prisma.brief.findUniqueOrThrow({
      where: { id: inputData.briefId },
      include: {
        interaction: {
          include: { deal: { include: { company: true } } },
        },
      },
    });

    const industry = brief.interaction.deal.company.industry;

    // b. Get subsector from Transcript record
    const transcript = await prisma.transcript.findFirst({
      where: { interactionId: brief.interactionId },
    });
    const subsector = transcript?.subsector ?? "";

    // c. Multi-pass retrieval: primary pillar, secondary pillars, case studies
    const result = await searchForProposal({
      industry,
      subsector,
      primaryPillar: inputData.briefData.primaryPillar,
      secondaryPillars: inputData.briefData.secondaryPillars,
      useCases: inputData.briefData.useCases,
    });

    // d. Post-retrieval metadata filtering
    const filtered = filterByMetadata(
      result.candidates,
      industry,
      inputData.briefData.primaryPillar
    );

    // e. Build retrieval summary
    const retrievalSummary = `Retrieved ${result.candidates.length} candidates (${result.primaryCount} primary, ${result.secondaryCount} secondary, ${result.caseStudyCount} case studies). Post-filter: ${filtered.length} slides.`;

    console.log(`[rag-retrieval] ${retrievalSummary}`);

    // f. Serialize filtered candidates as JSON string for workflow passthrough
    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      briefData: inputData.briefData,
      roiFramingData: inputData.roiFramingData,
      candidateSlides: JSON.stringify(filtered),
      retrievalSummary,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 10: Assemble SlideJSON with LLM-powered weighted slide selection
// ────────────────────────────────────────────────────────────

const assembleSlideJSON = createStep({
  id: "assemble-slide-json",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    candidateSlides: z.string(),
    retrievalSummary: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    slideJSON: z.string(),
    slideCount: z.number(),
    retrievalSummary: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Deserialize candidate slides from JSON string
    const candidates = JSON.parse(inputData.candidateSlides) as Array<{
      slideId: string;
      documentTitle: string;
      textContent: string;
      speakerNotes: string;
      metadata: Record<string, unknown>;
      presentationId?: string;
      slideObjectId?: string;
    }>;

    // b. Use LLM to select best 8-12 slides from candidates
    const candidateList = candidates
      .map(
        (c, i) =>
          `${i + 1}. ID: "${c.slideId}" | Title: "${c.documentTitle}" | Content: "${(c.textContent || "").substring(0, 300)}" | Metadata: ${JSON.stringify(c.metadata).substring(0, 200)}`
      )
      .join("\n");

    const useCaseNames = inputData.briefData.useCases
      .map((uc) => uc.name)
      .join(", ");

    const selectionPrompt = `You are selecting slides for a solution proposal deck.

BRIEF CONTEXT:
- Industry: ${inputData.briefData.industry}
- Primary Pillar: ${inputData.briefData.primaryPillar}
- Secondary Pillars: ${inputData.briefData.secondaryPillars.join(", ")}
- Use Cases: ${useCaseNames}

CANDIDATE SLIDES (${candidates.length} total):
${candidateList}

INSTRUCTIONS:
Select 8-12 slides for a solution proposal deck. Follow this allocation:
- ~70% of slides for primary pillar (${inputData.briefData.primaryPillar})
- ~15% each for secondary pillars
- Include 1-2 case study slides if available
- ONLY return slide IDs from the provided candidate list above
- Do NOT invent or create new slide IDs

Provide the selected slide IDs and brief reasoning for your selection.`;

    const selectionSchema = z.object({
      selectedSlideIds: z.array(z.string()).meta({
        description: "Array of slideId values selected from the candidate list.",
      }),
      reasoning: z.string().meta({
        description: "Brief explanation of the selection rationale.",
      }),
    });

    const selectionResponse = await executeNamedAgent<z.infer<typeof selectionSchema>>({
      agentId: "proposal-slide-selector",
      pinnedVersionId: inputData.agentVersions.proposalSlideSelector || undefined,
      messages: [{ role: "user", content: selectionPrompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(selectionSchema) as Record<string, unknown>,
        },
      },
    });

    const selection = selectionSchema.parse(
      selectionResponse.object ?? JSON.parse(selectionResponse.text ?? "{}")
    );

    console.log(
      `[assemble-slide-json] Selected ${selection.selectedSlideIds.length} slides: ${selection.reasoning}`
    );

    // c. Filter candidates to only selected slides
    const selectedIdSet = new Set(selection.selectedSlideIds);
    const selectedSlides = candidates.filter((c) =>
      selectedIdSet.has(c.slideId)
    );

    // d. Build SlideJSON using the assembly function
    const slideAssembly = buildSlideJSON({
      brief: inputData.briefData,
      roiFraming: inputData.roiFramingData,
      selectedSlides: selectedSlides as any, // SlideSearchResult compatible shape
    });

    // e. Serialize and return
    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      briefData: inputData.briefData,
      roiFramingData: inputData.roiFramingData,
      slideJSON: JSON.stringify(slideAssembly),
      slideCount: slideAssembly.slides.length,
      retrievalSummary: inputData.retrievalSummary,
      agentVersions: {
        ...inputData.agentVersions,
        proposalSlideSelector:
          inputData.agentVersions.proposalSlideSelector || selectionResponse.promptVersion.id,
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 11: Generate bespoke copy per retrieved slide, grounded in approved brief
// ────────────────────────────────────────────────────────────

const BRAND_GUIDELINES =
  "Lumenalta brand voice: Professional, outcome-focused, concise. Avoid jargon and buzzwords. Lead with business outcomes, not technology features. Use active voice. Be specific with metrics and results when available. Address the customer's situation directly.";

const generateCustomCopy = createStep({
  id: "generate-custom-copy",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    slideJSON: z.string(),
    slideCount: z.number(),
    retrievalSummary: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    retrievalSummary: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Deserialize slideJSON from JSON string to SlideAssembly
    const slideAssembly = JSON.parse(inputData.slideJSON) as {
      slides: Array<{
        slideTitle: string;
        bullets: string[];
        speakerNotes: string;
        sourceBlockRef: string;
        sectionType: string;
        sourceType: string;
      }>;
    };

    const totalSlides = slideAssembly.slides.length;

    // b. Process each slide sequentially (per-slide for quality, avoids rate limiting)
    for (let i = 0; i < slideAssembly.slides.length; i++) {
      const slide = slideAssembly.slides[i];

      console.log(
        `[generate-custom-copy] Generating copy for slide ${i + 1}/${totalSlides}: ${slide.slideTitle}`
      );

      // Skip synthesized slides -- they already have final content from buildSlideJSON
      if (slide.sourceType === "synthesized") {
        console.log(
          `[generate-custom-copy] Skipping synthesized slide: ${slide.slideTitle}`
        );
        continue;
      }

      // Generate bespoke copy for retrieved slides
      const copy = await generateSlideCopy({
        slide: {
          slideTitle: slide.slideTitle,
          textContent: slide.bullets.join("\n"),
          speakerNotes: slide.speakerNotes,
          sourceBlockRef: slide.sourceBlockRef,
        },
        brief: inputData.briefData,
        brandGuidelines: BRAND_GUIDELINES,
      });

      // Replace slide content with generated copy
      slideAssembly.slides[i] = {
        ...slide,
        slideTitle: copy.slideTitle,
        bullets: copy.bullets,
        speakerNotes: copy.speakerNotes,
      };
    }

    // c. Re-serialize the updated SlideAssembly
    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      slideJSON: JSON.stringify(slideAssembly),
      slideCount: totalSlides,
      retrievalSummary: inputData.retrievalSummary,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 12: Create Google Slides Deck from SlideJSON
// ────────────────────────────────────────────────────────────

const createSlidesDeck = createStep({
  id: "create-slides-deck",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    retrievalSummary: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    deckUrl: z.string(),
    dealFolderId: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Fetch brief + deal + company for naming and folder
    const brief = await prisma.brief.findUniqueOrThrow({
      where: { id: inputData.briefId },
      include: {
        interaction: {
          include: { deal: { include: { company: true } } },
        },
      },
    });

    const deal = brief.interaction.deal;
    const company = deal.company;
    const primaryPillar = brief.primaryPillar;

    // b. Get or create per-deal Drive folder
    const dealFolderId = await getOrCreateDealFolder({
      companyName: company.name,
      dealName: deal.name,
      parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
    });

    // Update deal's driveFolderId if not set
    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: dealFolderId },
      });
    }

    // c. Deserialize SlideJSON
    const slideAssembly = JSON.parse(inputData.slideJSON);

    // d. Create the deck
    const result = await createSlidesDeckFromJSON({
      slideJSON: slideAssembly,
      companyName: company.name,
      primaryPillar,
      dealFolderId,
    });

    console.log(
      `[create-slides-deck] Created deck: ${result.deckUrl} (${result.slideCount} slides)`
    );

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      slideJSON: inputData.slideJSON,
      slideCount: result.slideCount,
      deckUrl: result.deckUrl,
      dealFolderId,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 13: Create Talk Track Google Doc (speaker notes from Phase 7)
// No additional LLM call -- uses speakerNotes already in SlideJSON
// ────────────────────────────────────────────────────────────

const createTalkTrack = createStep({
  id: "create-talk-track",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    deckUrl: z.string(),
    dealFolderId: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    dealFolderId: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Fetch brief for naming
    const brief = await prisma.brief.findUniqueOrThrow({
      where: { id: inputData.briefId },
      include: {
        interaction: {
          include: { deal: { include: { company: true } } },
        },
      },
    });

    const companyName = brief.interaction.deal.company.name;
    const primaryPillar = brief.primaryPillar;
    const dateStr = new Date().toISOString().split("T")[0];

    // b. Deserialize SlideJSON to extract speaker notes
    const slideAssembly = JSON.parse(inputData.slideJSON) as {
      slides: Array<{
        slideTitle: string;
        bullets: string[];
        speakerNotes: string;
        sectionType: string;
        sourceType: string;
      }>;
    };

    // c. Build doc sections: H1 = deck title, H2 = each slide title, body = speaker notes
    const deckTitle = `${companyName} - ${primaryPillar} Solution Proposal`;
    const sections: DocSection[] = [
      {
        heading: deckTitle,
        headingLevel: "HEADING_1",
        body: `Talk track for ${slideAssembly.slides.length} slides. Prepared ${dateStr}.`,
      },
    ];

    for (const slide of slideAssembly.slides) {
      sections.push({
        heading: slide.slideTitle,
        headingLevel: "HEADING_2",
        body: slide.speakerNotes || "No speaker notes for this slide.",
      });
    }

    // d. Create the Google Doc
    const docTitle = `${companyName} - ${primaryPillar} Talk Track - ${dateStr}`;
    const result = await createGoogleDoc({
      title: docTitle,
      dealFolderId: inputData.dealFolderId,
      sections,
    });

    console.log(`[create-talk-track] Created talk track: ${result.docUrl}`);

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      slideJSON: inputData.slideJSON,
      slideCount: inputData.slideCount,
      deckUrl: inputData.deckUrl,
      talkTrackUrl: result.docUrl,
      dealFolderId: inputData.dealFolderId,
      agentVersions: inputData.agentVersions,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 14: Create Buyer FAQ Google Doc (LLM-generated role-specific objections)
// Persists all 3 artifact URLs to InteractionRecord.outputRefs
// ────────────────────────────────────────────────────────────

const createBuyerFAQ = createStep({
  id: "create-buyer-faq",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    dealFolderId: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
    agentVersions: agentVersionsSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Fetch brief for naming and FAQ context
    const brief = await prisma.brief.findUniqueOrThrow({
      where: { id: inputData.briefId },
      include: {
        interaction: {
          include: { deal: { include: { company: true } } },
        },
      },
    });

    const companyName = brief.interaction.deal.company.name;
    const primaryPillar = brief.primaryPillar;
    const dateStr = new Date().toISOString().split("T")[0];

    // b. Generate FAQ via LLM
    const useCaseSummary = JSON.parse(brief.useCases)
      .map((uc: { name: string; description: string }) => `- ${uc.name}: ${uc.description}`)
      .join("\n");

    const prompt = `You are a sales strategist at Lumenalta preparing a buyer FAQ document.

APPROVED BRIEF:
- Company: ${companyName}
- Industry: ${brief.interaction.deal.company.industry}
- Primary Pillar: ${primaryPillar}
- Secondary Pillars: ${JSON.parse(brief.secondaryPillars).join(", ")}
- Customer Context: ${brief.customerContext}
- Business Outcomes: ${brief.businessOutcomes}
- Constraints: ${brief.constraints}
- Stakeholders: ${brief.stakeholders}
- Timeline: ${brief.timeline}
- Budget: ${brief.budget}
- Use Cases:
${useCaseSummary}

INSTRUCTIONS:
1. For EACH stakeholder role identified in the brief, generate 2-3 anticipated objections.
2. Each objection should be specific to that role's perspective and concerns.
3. Each response should reference specific brief evidence, Lumenalta capabilities, or ROI outcomes.
4. Frame responses constructively -- acknowledge the concern, then address it.

EXAMPLES of role-specific objections:
- CIO: "How does this integrate with our existing tech stack?"
- CFO: "What's the expected payback period?"
- VP Engineering: "Do we have internal capacity to maintain this?"`;

    const response = await executeNamedAgent<z.infer<typeof BuyerFaqLlmSchema>>({
      agentId: "buyer-faq-strategist",
      pinnedVersionId: inputData.agentVersions.buyerFaqStrategist || undefined,
      messages: [{ role: "user", content: prompt }],
      options: {
        structuredOutput: {
          schema: zodToLlmJsonSchema(BuyerFaqLlmSchema) as Record<string, unknown>,
        },
      },
    });

    const faq = BuyerFaqLlmSchema.parse(response.object ?? JSON.parse(response.text ?? "{}"));

    console.log(
      `[create-buyer-faq] Generated FAQ with ${faq.stakeholders.length} stakeholder groups`
    );

    // c. Build doc sections: H1 = title, H2 = stakeholder role, bold objection + body response
    const docSections: DocSection[] = [
      {
        heading: `${companyName} - Buyer FAQ`,
        headingLevel: "HEADING_1",
        body: `Anticipated objections and recommended responses for the ${primaryPillar} proposal.`,
      },
    ];

    for (const stakeholder of faq.stakeholders) {
      for (const obj of stakeholder.objections) {
        // Each objection as H2 with role prefix, bold objection text in body
        const bodyText = `${obj.objection}\n\n${obj.response}`;
        const boldEnd = obj.objection.length;

        docSections.push({
          heading: stakeholder.role,
          headingLevel: "HEADING_2",
          body: bodyText,
          boldRanges: [{ start: 0, end: boldEnd }],
        });
      }
    }

    // d. Create the Google Doc
    const docTitle = `${companyName} - ${primaryPillar} Buyer FAQ - ${dateStr}`;
    const result = await createGoogleDoc({
      title: docTitle,
      dealFolderId: inputData.dealFolderId,
      sections: docSections,
    });

    console.log(`[create-buyer-faq] Created FAQ doc: ${result.docUrl}`);

    // e. Store all three artifact URLs in InteractionRecord.outputRefs
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        outputRefs: JSON.stringify({
          deckUrl: inputData.deckUrl,
          talkTrackUrl: inputData.talkTrackUrl,
          faqUrl: result.docUrl,
          dealFolderId: inputData.dealFolderId,
        }),
      },
    });

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      deckUrl: inputData.deckUrl,
      talkTrackUrl: inputData.talkTrackUrl,
      faqUrl: result.docUrl,
      slideJSON: inputData.slideJSON,
      slideCount: inputData.slideCount,
      dealFolderId: inputData.dealFolderId,
      agentVersions: {
        ...inputData.agentVersions,
        buyerFaqStrategist:
          inputData.agentVersions.buyerFaqStrategist || response.promptVersion.id,
      },
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 15: Brand Compliance Check -- Pure Logic (No LLM)
// Validates SlideJSON against brand and structural rules
// ────────────────────────────────────────────────────────────

const complianceCheckSchema = z.object({
  check: z.string(),
  message: z.string(),
  severity: z.enum(["pass", "warn"]),
});

const complianceResultSchema = z.object({
  passed: z.boolean(),
  warnings: z.array(complianceCheckSchema),
});

const checkBrandCompliance = createStep({
  id: "check-brand-compliance",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideJSON: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
    complianceResult: complianceResultSchema,
  }),
  execute: async ({ inputData }) => {
    // a. Deserialize slideJSON
    const slideAssembly = JSON.parse(inputData.slideJSON) as {
      slides: Array<{
        slideTitle: string;
        bullets: string[];
        speakerNotes: string;
        sectionType: string;
        sourceType: string;
      }>;
    };

    // b. Fetch brief for companyName
    const brief = await prisma.brief.findUniqueOrThrow({
      where: { id: inputData.briefId },
      include: {
        interaction: {
          include: { deal: { include: { company: true } } },
        },
      },
    });

    const companyName = brief.interaction.deal.company.name;

    // c. Run brand compliance checks (pure logic, no LLM)
    const complianceResult = runBrandComplianceChecks({
      slideJSON: slideAssembly,
      companyName,
    });

    console.log(
      `[check-brand-compliance] Passed: ${complianceResult.passed}, Warnings: ${complianceResult.warnings.filter((w) => w.severity === "warn").length}`
    );

    // d. Update InteractionRecord status to "pending_asset_review"
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: { status: "pending_asset_review" },
    });

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      deckUrl: inputData.deckUrl,
      talkTrackUrl: inputData.talkTrackUrl,
      faqUrl: inputData.faqUrl,
      slideCount: inputData.slideCount,
      dealFolderId: inputData.dealFolderId,
      complianceResult,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 16: Await Asset Review -- HITL Checkpoint 2 (SUSPEND 3)
// Workflow suspends until reviewer approves assets
// ────────────────────────────────────────────────────────────

const awaitAssetReview = createStep({
  id: "await-asset-review",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
    complianceResult: complianceResultSchema,
  }),
  suspendSchema: z.object({
    reason: z.string(),
    interactionId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    complianceResult: complianceResultSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
    reviewerRole: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
    reviewerName: z.string(),
    reviewerRole: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      // Update hitlStage to highfi before suspending (final assets = high-fi)
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: {
          hitlStage: "highfi",
          stageContent: JSON.stringify({
            deckUrl: inputData.deckUrl,
            talkTrackUrl: inputData.talkTrackUrl,
            faqUrl: inputData.faqUrl,
            complianceResult: inputData.complianceResult,
          }),
        },
      });

      // First execution: suspend for asset review
      await suspend({
        reason: "Asset review required -- HITL Checkpoint 2",
        interactionId: inputData.interactionId,
        deckUrl: inputData.deckUrl,
        talkTrackUrl: inputData.talkTrackUrl,
        faqUrl: inputData.faqUrl,
        complianceResult: inputData.complianceResult,
      });

      // This line is never reached (suspend halts execution)
      throw new Error("Unreachable after suspend");
    }

    // Resumed with approval -- update hitlStage to ready
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: { hitlStage: "ready" },
    });

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      deckUrl: inputData.deckUrl,
      talkTrackUrl: inputData.talkTrackUrl,
      faqUrl: inputData.faqUrl,
      slideCount: inputData.slideCount,
      dealFolderId: inputData.dealFolderId,
      reviewerName: resumeData.reviewerName,
      reviewerRole: resumeData.reviewerRole,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 17: Finalize Delivery -- Updates status, creates approval FeedbackSignal
// ────────────────────────────────────────────────────────────

const finalizeDelivery = createStep({
  id: "finalize-delivery",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
    reviewerName: z.string(),
    reviewerRole: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
  }),
  execute: async ({ inputData }) => {
    // a. Update InteractionRecord status to "delivered" and decision to "approved"
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        status: "delivered",
        decision: "approved",
      },
    });

    // b. Create positive FeedbackSignal for asset review approval
    await prisma.feedbackSignal.create({
      data: {
        interactionId: inputData.interactionId,
        signalType: "positive",
        source: "asset_review",
        content: JSON.stringify({
          reviewerName: inputData.reviewerName,
          reviewerRole: inputData.reviewerRole,
          decision: "approved",
          deckUrl: inputData.deckUrl,
          talkTrackUrl: inputData.talkTrackUrl,
          faqUrl: inputData.faqUrl,
        }),
      },
    });

    console.log(
      `[finalize-delivery] Delivery finalized by ${inputData.reviewerName} (${inputData.reviewerRole})`
    );

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      deckUrl: inputData.deckUrl,
      talkTrackUrl: inputData.talkTrackUrl,
      faqUrl: inputData.faqUrl,
      slideCount: inputData.slideCount,
      dealFolderId: inputData.dealFolderId,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 4 Transcript Processing (17-Step Pipeline)
// ────────────────────────────────────────────────────────────

export const touch4Workflow = createWorkflow({
  id: "touch-4-workflow",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    deckUrl: z.string(),
    talkTrackUrl: z.string(),
    faqUrl: z.string(),
    slideCount: z.number(),
    dealFolderId: z.string(),
  }),
})
  .then(parseTranscript)
  .then(validateFields)
  .then(awaitFieldReview)
  .then(mapPillarsAndGenerateBrief)
  .then(generateROIFraming)
  .then(recordInteraction)
  .then(awaitBriefApproval)
  .then(finalizeApproval)
  .then(ragRetrieval)
  .then(assembleSlideJSON)
  .then(generateCustomCopy)
  .then(createSlidesDeck)
  .then(createTalkTrack)
  .then(createBuyerFAQ)
  .then(checkBrandCompliance)
  .then(awaitAssetReview)
  .then(finalizeDelivery)
  .commit();
