/**
 * ROIFramingLlmSchema — ROI Outcome Framing per Use Case
 *
 * Generates ROI outcome statements and value hypotheses for each
 * identified use case. Used to enrich the sales brief and inform
 * deck content personalization.
 *
 * Gemini-safe: flat/shallow object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const ROIFramingLlmSchema = z.object({
  useCases: z
    .array(
      z.object({
        useCaseName: z.string().meta({
          description: "Name of the use case being framed.",
        }),
        roiOutcomes: z.array(z.string()).meta({
          description:
            "2-3 specific ROI outcome statements for this use case (e.g., 'Reduce processing time by 40%').",
        }),
        valueHypothesis: z.string().meta({
          description:
            "Hypothesis for how Lumenalta delivers measurable value for this use case.",
        }),
      })
    )
    .meta({
      description:
        "ROI framing for each identified use case in the deal.",
    }),
});

export type ROIFraming = z.infer<typeof ROIFramingLlmSchema>;
