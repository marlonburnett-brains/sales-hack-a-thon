/**
 * TranscriptFieldsLlmSchema — Discovery Call Transcript Extraction
 *
 * Extracts structured fields from a sales discovery call transcript.
 * All 6 fields are required strings — empty string if not found in transcript.
 * Phase 5 flags empty strings as missing fields for HITL review.
 *
 * LLM-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const TranscriptFieldsLlmSchema = z.object({
  customerContext: z.string().meta({
    description:
      "Customer's current situation, pain points, and business context extracted from the transcript. Empty string if not found.",
  }),
  businessOutcomes: z.string().meta({
    description:
      "Desired business outcomes and goals mentioned by the customer. Empty string if not found.",
  }),
  constraints: z.string().meta({
    description:
      "Technical, budgetary, or organizational constraints mentioned. Empty string if not found.",
  }),
  stakeholders: z.string().meta({
    description:
      "Key stakeholders, decision makers, and their roles mentioned. Empty string if not found.",
  }),
  timeline: z.string().meta({
    description:
      "Timeline expectations, deadlines, or urgency indicators. Empty string if not found.",
  }),
  budget: z.string().meta({
    description:
      "Budget information, investment range, or financial constraints. Empty string if not found.",
  }),
});

export type TranscriptFields = z.infer<typeof TranscriptFieldsLlmSchema>;
