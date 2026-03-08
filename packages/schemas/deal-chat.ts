import { z } from "zod";

import { TOUCH_TYPES } from "./constants";

export const dealChatSectionSchema = z.enum(["overview", "briefing", "touch"]);

export const dealChatTouchTypeSchema = z.enum(TOUCH_TYPES).exclude(["pre_call"]);

export const dealChatRouteContextSchema = z.object({
  section: dealChatSectionSchema,
  touchType: dealChatTouchTypeSchema.nullable(),
  pathname: z.string(),
  pageLabel: z.string(),
});

export const dealChatSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
  kind: z.enum(["question", "save_note", "save_transcript", "next_step"]),
});

export const dealContextSourceSchema = z.object({
  id: z.string().nullable(),
  sourceType: z.enum(["note", "transcript"]),
  touchType: dealChatTouchTypeSchema.nullable(),
  title: z.string().nullable(),
  rawText: z.string(),
  refinedText: z.string().nullable(),
  routeContext: dealChatRouteContextSchema,
});

export const dealChatBindingSchema = z.object({
  status: z.enum(["needs_confirmation", "confirmed"]),
  source: dealContextSourceSchema,
  guessedTouchType: dealChatTouchTypeSchema.nullable(),
  confirmationLabel: z.string(),
  reason: z.string().nullable(),
});

export const dealChatRefineBeforeSaveSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
  suggestedPrompt: z.string().nullable(),
  draftText: z.string().nullable(),
});

export const dealChatConfirmationChipSchema = z.object({
  id: z.string(),
  label: z.string(),
  tone: z.enum(["success", "warning", "info"]),
  sourceType: z.enum(["note", "transcript"]).nullable(),
  touchType: dealChatTouchTypeSchema.nullable(),
});

export const dealChatKnowledgeMatchCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  whyFit: z.string(),
  summary: z.string(),
  sourceLabel: z.string(),
  touchType: dealChatTouchTypeSchema.nullable(),
});

export const dealChatAnswerSchema = z.object({
  directAnswer: z.string(),
  supportingBullets: z.array(z.string()),
  missingInfoCallouts: z.array(z.string()),
  nextSteps: z.array(z.string()),
  knowledgeMatches: z.array(dealChatKnowledgeMatchCardSchema),
});

export const dealChatMetaSchema = z.object({
  response: dealChatAnswerSchema,
  suggestions: z.array(dealChatSuggestionSchema),
  binding: dealChatBindingSchema.nullable(),
  refineBeforeSave: dealChatRefineBeforeSaveSchema.nullable(),
  confirmationChips: z.array(dealChatConfirmationChipSchema),
});

export const dealChatSendRequestSchema = z.object({
  dealId: z.string(),
  message: z.string().min(1),
  routeContext: dealChatRouteContextSchema,
  pendingBinding: dealChatBindingSchema.nullable().optional(),
  pendingRefineBeforeSave: dealChatRefineBeforeSaveSchema.nullable().optional(),
});

export type DealChatSection = z.infer<typeof dealChatSectionSchema>;
export type DealChatTouchType = z.infer<typeof dealChatTouchTypeSchema>;
export type DealChatRouteContext = z.infer<typeof dealChatRouteContextSchema>;
export type DealChatSuggestion = z.infer<typeof dealChatSuggestionSchema>;
export type DealContextSource = z.infer<typeof dealContextSourceSchema>;
export type DealChatBinding = z.infer<typeof dealChatBindingSchema>;
export type DealChatRefineBeforeSave = z.infer<typeof dealChatRefineBeforeSaveSchema>;
export type DealChatConfirmationChip = z.infer<typeof dealChatConfirmationChipSchema>;
export type DealChatKnowledgeMatchCard = z.infer<
  typeof dealChatKnowledgeMatchCardSchema
>;
export type DealChatAnswer = z.infer<typeof dealChatAnswerSchema>;
export type DealChatMeta = z.infer<typeof dealChatMetaSchema>;
export type DealChatSendRequest = z.infer<typeof dealChatSendRequestSchema>;
