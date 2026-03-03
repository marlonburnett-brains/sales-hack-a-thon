/**
 * FeedbackSignalSchema — Feedback Loop Signal Tracking
 *
 * Records individual feedback signals from seller interactions.
 * Signals are used to improve LLM prompts and content selection
 * over time (positive reinforcement, negative signals, overrides).
 *
 * App schema: NOT sent to Gemini. May use records, optionals, etc.
 */

import { z } from "zod";

export const FeedbackSignalSchema = z.object({
  id: z.string(),
  interactionId: z.string(),
  signalType: z.enum(["positive", "negative", "override"]),
  source: z.string(),
  content: z.record(z.unknown()),
  createdAt: z.string(),
});

export type FeedbackSignal = z.infer<typeof FeedbackSignalSchema>;
