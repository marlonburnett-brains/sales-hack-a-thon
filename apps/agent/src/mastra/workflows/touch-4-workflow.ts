/**
 * Touch 4 Transcript Processing Workflow (Steps 1-3)
 *
 * Workflow: parseTranscript -> validateFields -> awaitFieldReview (SUSPEND)
 *
 * Step 1: Gemini 2.5 Flash extracts 6 structured fields from the raw transcript
 * Step 2: Pure logic validates fields and assigns tiered severity
 * Step 3: Suspends for seller review — seller edits/fills gaps, then resumes
 *
 * Plan 03 will extend with: mapPillars, generateBrief, generateROIFraming, recordInteraction
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import {
  TranscriptFieldsLlmSchema,
  zodToGeminiSchema,
  SOLUTION_PILLARS,
} from "@lumenalta/schemas";
import { env } from "../../env";

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
// Step 2: Validate Fields — Pure Logic (No LLM)
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
// Workflow: Touch 4 Transcript Processing
// ────────────────────────────────────────────────────────────
// Steps 1-3 only. Plan 03 will add mapPillars, generateBrief,
// generateROIFraming, and recordInteraction steps.

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
})
  .then(parseTranscript)
  .then(validateFields)
  .then(awaitFieldReview)
  .commit();
