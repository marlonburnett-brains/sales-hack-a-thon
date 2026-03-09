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

export const dealChatTranscriptUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  text: z.string().min(1),
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

export const dealChatPromptVersionSchema = z.object({
  agentId: z.string(),
  id: z.string(),
  version: z.number().int(),
  publishedAt: z.string().datetime().nullable(),
  publishedBy: z.string().nullable(),
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
  promptVersion: dealChatPromptVersionSchema,
});

export const dealChatSendRequestSchema = z.object({
  dealId: z.string(),
  message: z.string().default(""),
  transcriptUpload: dealChatTranscriptUploadSchema.nullable().optional(),
  routeContext: dealChatRouteContextSchema,
  pendingBinding: dealChatBindingSchema.nullable().optional(),
  pendingRefineBeforeSave: dealChatRefineBeforeSaveSchema.nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.message.trim().length === 0 && !value.transcriptUpload) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["message"],
      message: "Either message or transcriptUpload is required",
    });
  }
});

export type DealChatSection = z.infer<typeof dealChatSectionSchema>;
export type DealChatTouchType = z.infer<typeof dealChatTouchTypeSchema>;
export type DealChatRouteContext = z.infer<typeof dealChatRouteContextSchema>;
export type DealChatSuggestion = z.infer<typeof dealChatSuggestionSchema>;
export type DealContextSource = z.infer<typeof dealContextSourceSchema>;
export type DealChatBinding = z.infer<typeof dealChatBindingSchema>;
export type DealChatRefineBeforeSave = z.infer<typeof dealChatRefineBeforeSaveSchema>;
export type DealChatTranscriptUpload = z.infer<typeof dealChatTranscriptUploadSchema>;
export type DealChatConfirmationChip = z.infer<typeof dealChatConfirmationChipSchema>;
export type DealChatKnowledgeMatchCard = z.infer<
  typeof dealChatKnowledgeMatchCardSchema
>;
export type DealChatPromptVersion = z.infer<typeof dealChatPromptVersionSchema>;
export type DealChatAnswer = z.infer<typeof dealChatAnswerSchema>;
export type DealChatMeta = z.infer<typeof dealChatMetaSchema>;
export type DealChatSendRequest = z.infer<typeof dealChatSendRequestSchema>;
