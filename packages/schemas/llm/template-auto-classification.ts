import { z } from "zod";

export const TemplateAutoClassificationLlmSchema = z.object({
  contentClassification: z.enum(["template", "example"]).meta({
    description:
      '"template" for reusable placeholder content, "example" for real client or deal-specific decks.',
  }),
  touchTypes: z.array(z.enum(["touch_1", "touch_2", "touch_3", "touch_4"])).meta({
    description:
      "The GTM touch types the presentation best supports based on its structure and content.",
  }),
});

export type TemplateAutoClassification = z.infer<
  typeof TemplateAutoClassificationLlmSchema
>;
