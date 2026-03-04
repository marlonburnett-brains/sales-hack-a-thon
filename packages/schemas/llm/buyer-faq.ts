import { z } from "zod";

export const BuyerFaqLlmSchema = z.object({
  stakeholders: z
    .array(
      z.object({
        role: z.string().meta({
          description: "Stakeholder role from the approved brief (e.g., CIO, CFO, VP Engineering).",
        }),
        objections: z
          .array(
            z.object({
              objection: z.string().meta({
                description: "Anticipated buyer objection specific to this stakeholder role.",
              }),
              response: z.string().meta({
                description: "Recommended response addressing the objection with evidence from the brief.",
              }),
            })
          )
          .meta({
            description: "2-3 objections per stakeholder role.",
          }),
      })
    )
    .meta({
      description: "Stakeholder-grouped objections and responses.",
    }),
});

export type BuyerFaq = z.infer<typeof BuyerFaqLlmSchema>;
