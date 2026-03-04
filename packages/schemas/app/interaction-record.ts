/**
 * InteractionRecordSchema — HITL Interaction Tracking
 *
 * Records each human-in-the-loop interaction where a seller
 * reviews, approves, edits, or overrides LLM-generated content.
 * Used for feedback loops and audit trails.
 *
 * App schema: NOT sent to Gemini. May use records, optionals, etc.
 */

import { z } from "zod";

export const InteractionRecordSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  touchType: z.enum(["touch_1", "touch_2", "touch_3", "touch_4"]),
  companyName: z.string(),
  industry: z.string(),
  inputs: z.record(z.string(), z.unknown()),
  decision: z.enum(["approved", "overridden", "edited"]),
  outputRefs: z.array(z.string()),
  createdAt: z.string(),
});

export type InteractionRecord = z.infer<typeof InteractionRecordSchema>;
