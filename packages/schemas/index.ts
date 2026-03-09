/**
 * @lumenalta/schemas — Shared Schema Package
 *
 * Barrel exports for all domain schemas, constants, and utilities.
 * Consumed by both apps/agent and apps/web via workspace dependency.
 */

// Constants (single source of truth)
export {
  INDUSTRIES,
  FUNNEL_STAGES,
  CONTENT_TYPES,
  SLIDE_CATEGORIES,
  BUYER_PERSONAS,
  TOUCH_TYPES,
  ARTIFACT_TYPES,
  ARTIFACT_TYPE_LABELS,
  SUBSECTORS,
  SOLUTION_PILLARS,
  ACTION_TYPES,
  type ArtifactType,
  type ActionType,
} from "./constants.ts";

export {
  AGENT_CATALOG,
  AGENT_IDS,
  type AgentCatalogEntry,
  type AgentFamily,
  type AgentId,
} from "./agent-catalog.ts";

export {
  dealChatAnswerSchema,
  dealChatBindingSchema,
  dealChatConfirmationChipSchema,
  dealChatKnowledgeMatchCardSchema,
  dealChatMetaSchema,
  dealChatPromptVersionSchema,
  dealChatRefineBeforeSaveSchema,
  dealChatRouteContextSchema,
  dealChatSectionSchema,
  dealChatSendRequestSchema,
  dealChatSuggestionSchema,
  dealChatTranscriptUploadSchema,
  dealChatTouchTypeSchema,
  dealContextSourceSchema,
  type DealChatAnswer,
  type DealChatBinding,
  type DealChatConfirmationChip,
  type DealChatKnowledgeMatchCard,
  type DealChatMeta,
  type DealChatPromptVersion,
  type DealChatRefineBeforeSave,
  type DealChatRouteContext,
  type DealChatSection,
  type DealChatSendRequest,
  type DealChatSuggestion,
  type DealChatTranscriptUpload,
  type DealChatTouchType,
  type DealContextSource,
} from "./deal-chat.ts";

// Helper
export { zodToLlmJsonSchema } from "./llm-json-schema.ts";

// LLM schemas (LLM-safe: flat, no transforms)
export {
  TranscriptFieldsLlmSchema,
  type TranscriptFields,
} from "./llm/transcript-fields.ts";
export { SalesBriefLlmSchema, type SalesBrief } from "./llm/sales-brief.ts";
export {
  SlideAssemblyLlmSchema,
  type SlideAssembly,
} from "./llm/slide-assembly.ts";
export { ROIFramingLlmSchema, type ROIFraming } from "./llm/roi-framing.ts";
export { PagerContentLlmSchema, type PagerContent } from "./llm/pager-content.ts";
export {
  IntroDeckSelectionLlmSchema,
  type IntroDeckSelection,
} from "./llm/intro-deck-selection.ts";
export {
  CapabilityDeckSelectionLlmSchema,
  type CapabilityDeckSelection,
} from "./llm/capability-deck-selection.ts";
export {
  CompanyResearchLlmSchema,
  type CompanyResearch,
} from "./llm/company-research.ts";
export { HypothesesLlmSchema, type Hypotheses } from "./llm/hypotheses.ts";
export {
  DiscoveryQuestionsLlmSchema,
  type DiscoveryQuestions,
} from "./llm/discovery-questions.ts";
export {
  SlideMetadataSchema,
  type SlideMetadata,
} from "./llm/slide-metadata.ts";
export {
  SlideDescriptionLlmSchema,
  type SlideDescription,
} from "./llm/slide-description.ts";
export {
  ProposalCopyLlmSchema,
  type ProposalCopy,
} from "./llm/proposal-copy.ts";
export {
  TemplateAutoClassificationLlmSchema,
  type TemplateAutoClassification,
} from "./llm/template-auto-classification.ts";
export {
  SolutionPillarTaxonomyLlmSchema,
  type SolutionPillarTaxonomy,
} from "./llm/solution-pillar-taxonomy.ts";
export {
  BuyerFaqLlmSchema,
  type BuyerFaq,
} from "./llm/buyer-faq.ts";

// App schemas (internal, may use transforms/optionals)
export {
  InteractionRecordSchema,
  type InteractionRecord,
} from "./app/interaction-record.ts";
export {
  FeedbackSignalSchema,
  type FeedbackSignal,
} from "./app/feedback-signal.ts";
