/**
 * Touch 4 Transcript Processing Workflow (Complete 7-Step Pipeline)
 *
 * Workflow: parseTranscript -> validateFields -> awaitFieldReview (SUSPEND)
 *           -> mapPillarsAndGenerateBrief -> generateROIFraming -> recordInteraction
 *
 * Step 1: Gemini 2.5 Flash extracts 6 structured fields from the raw transcript
 * Step 2: Pure logic validates fields and assigns tiered severity
 * Step 3: Suspends for seller review -- seller edits/fills gaps, then resumes
 * Step 4: Gemini maps transcript to Lumenalta solution pillars and generates sales brief
 * Step 5: Gemini enriches use cases with specific ROI outcome statements
 * Step 6: Persists InteractionRecord, Transcript, Brief, and FeedbackSignal to database
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import {
  TranscriptFieldsLlmSchema,
  SalesBriefLlmSchema,
  ROIFramingLlmSchema,
  zodToGeminiSchema,
  SOLUTION_PILLARS,
} from "@lumenalta/schemas";
import { env } from "../../env";

// ────────────────────────────────────────────────────────────
// Prisma client singleton
// ────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────
// Shared schemas
// ────────────────────────────────────────────────────────────

const fieldSeveritySchema = z.record(z.enum(["error", "warning", "ok"]));

// ────────────────────────────────────────────────────────────
// Step 1: Parse Transcript via Gemini 2.5 Flash
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
    extractedFields: TranscriptFieldsLlmSchema,
  }),
  execute: async ({ inputData }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zodToGeminiSchema(TranscriptFieldsLlmSchema) as Record<
          string,
          unknown
        >,
      },
    });

    const text = response.text ?? "";
    const parsed = TranscriptFieldsLlmSchema.parse(JSON.parse(text));

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      extractedFields: parsed,
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
    extractedFields: TranscriptFieldsLlmSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
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
      extractedFields: inputData.extractedFields,
      fieldSeverity,
      hasErrors,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Await Field Review (SUSPEND for seller review)
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
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    reviewedFields: TranscriptFieldsLlmSchema,
    decision: z.enum(["continued"]),
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
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      // First execution: suspend and wait for seller review
      return await suspend({
        reason: "Seller field review required",
        extractedFields: inputData.extractedFields,
        fieldSeverity: inputData.fieldSeverity,
        hasErrors: inputData.hasErrors,
        dealId: inputData.dealId,
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
      extractedFields: inputData.extractedFields,
      fieldSeverity: inputData.fieldSeverity,
      hasErrors: inputData.hasErrors,
      reviewedFields: resumeData.reviewedFields,
      decision: "continued" as const,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Map Pillars & Generate Brief (Gemini 2.5 Flash)
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
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: fieldSeveritySchema,
    hasErrors: z.boolean(),
    reviewedFields: TranscriptFieldsLlmSchema,
    decision: z.enum(["continued"]),
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
  }),
  execute: async ({ inputData }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zodToGeminiSchema(SalesBriefLlmSchema) as Record<
          string,
          unknown
        >,
      },
    });

    const text = response.text ?? "";
    const brief = SalesBriefLlmSchema.parse(JSON.parse(text));

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      reviewedFields: inputData.reviewedFields,
      brief,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 5: Generate ROI Framing (Gemini 2.5 Flash enrichment)
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
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
  }),
  outputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
    roiFraming: ROIFramingLlmSchema,
  }),
  execute: async ({ inputData }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: zodToGeminiSchema(ROIFramingLlmSchema) as Record<
          string,
          unknown
        >,
      },
    });

    const text = response.text ?? "";
    const roiFraming = ROIFramingLlmSchema.parse(JSON.parse(text));

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      subsector: inputData.subsector,
      transcript: inputData.transcript,
      additionalNotes: inputData.additionalNotes,
      reviewedFields: inputData.reviewedFields,
      brief: inputData.brief,
      roiFraming,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 6: Record Interaction (Database persistence, no LLM)
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
    reviewedFields: TranscriptFieldsLlmSchema,
    brief: SalesBriefLlmSchema,
    roiFraming: ROIFramingLlmSchema,
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
  }),
  execute: async ({ inputData }) => {
    const { brief, roiFraming, reviewedFields } = inputData;

    // a. Create InteractionRecord
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_4",
        status: "completed",
        decision: "completed",
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          subsector: inputData.subsector,
        }),
        generatedContent: JSON.stringify({
          primaryPillar: brief.primaryPillar,
          secondaryPillars: brief.secondaryPillars,
          useCaseCount: brief.useCases.length,
        }),
        outputRefs: null,
      },
    });

    // b. Create Transcript record
    const transcript = await prisma.transcript.create({
      data: {
        interactionId: interaction.id,
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

    // c. Create Brief record
    const briefRecord = await prisma.brief.create({
      data: {
        interactionId: interaction.id,
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
      },
    });

    // d. Create FeedbackSignal
    await prisma.feedbackSignal.create({
      data: {
        interactionId: interaction.id,
        signalType: "positive",
        source: "touch_4_complete",
        content: JSON.stringify({
          primaryPillar: brief.primaryPillar,
          secondaryPillars: brief.secondaryPillars,
          useCaseCount: brief.useCases.length,
        }),
      },
    });

    return {
      interactionId: interaction.id,
      transcriptId: transcript.id,
      briefId: briefRecord.id,
      briefData: brief,
      roiFramingData: roiFraming,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 4 Transcript Processing (Complete Pipeline)
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
    transcriptId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
  }),
})
  .then(parseTranscript)
  .then(validateFields)
  .then(awaitFieldReview)
  .then(mapPillarsAndGenerateBrief)
  .then(generateROIFraming)
  .then(recordInteraction)
  .commit();
