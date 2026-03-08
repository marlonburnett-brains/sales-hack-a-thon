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
} from "./constants";

export {
  AGENT_CATALOG,
  AGENT_IDS,
  type AgentCatalogEntry,
  type AgentFamily,
  type AgentId,
} from "./agent-catalog";

export {
  dealChatAnswerSchema,
  dealChatBindingSchema,
  dealChatConfirmationChipSchema,
  dealChatKnowledgeMatchCardSchema,
  dealChatMetaSchema,
  dealChatRefineBeforeSaveSchema,
  dealChatRouteContextSchema,
  dealChatSectionSchema,
  dealChatSendRequestSchema,
  dealChatSuggestionSchema,
  dealChatTouchTypeSchema,
  dealContextSourceSchema,
  type DealChatAnswer,
  type DealChatBinding,
  type DealChatConfirmationChip,
  type DealChatKnowledgeMatchCard,
  type DealChatMeta,
  type DealChatRefineBeforeSave,
  type DealChatRouteContext,
  type DealChatSection,
  type DealChatSendRequest,
  type DealChatSuggestion,
  type DealChatTouchType,
  type DealContextSource,
} from "./deal-chat";

// Helper
export { zodToLlmJsonSchema } from "./llm-json-schema";

// LLM schemas (LLM-safe: flat, no transforms)
export {
  TranscriptFieldsLlmSchema,
  type TranscriptFields,
} from "./llm/transcript-fields";
export { SalesBriefLlmSchema, type SalesBrief } from "./llm/sales-brief";
export {
  SlideAssemblyLlmSchema,
  type SlideAssembly,
} from "./llm/slide-assembly";
export { ROIFramingLlmSchema, type ROIFraming } from "./llm/roi-framing";
export { PagerContentLlmSchema, type PagerContent } from "./llm/pager-content";
export {
  IntroDeckSelectionLlmSchema,
  type IntroDeckSelection,
} from "./llm/intro-deck-selection";
export {
  CapabilityDeckSelectionLlmSchema,
  type CapabilityDeckSelection,
} from "./llm/capability-deck-selection";
export {
  CompanyResearchLlmSchema,
  type CompanyResearch,
} from "./llm/company-research";
export { HypothesesLlmSchema, type Hypotheses } from "./llm/hypotheses";
export {
  DiscoveryQuestionsLlmSchema,
  type DiscoveryQuestions,
} from "./llm/discovery-questions";
export {
  SlideMetadataSchema,
  type SlideMetadata,
} from "./llm/slide-metadata";
export {
  SlideDescriptionLlmSchema,
  type SlideDescription,
} from "./llm/slide-description";
export {
  ProposalCopyLlmSchema,
  type ProposalCopy,
} from "./llm/proposal-copy";
export {
  TemplateAutoClassificationLlmSchema,
  type TemplateAutoClassification,
} from "./llm/template-auto-classification";
export {
  SolutionPillarTaxonomyLlmSchema,
  type SolutionPillarTaxonomy,
} from "./llm/solution-pillar-taxonomy";
export {
  BuyerFaqLlmSchema,
  type BuyerFaq,
} from "./llm/buyer-faq";

// App schemas (internal, may use transforms/optionals)
export {
  InteractionRecordSchema,
  type InteractionRecord,
} from "./app/interaction-record";
export {
  FeedbackSignalSchema,
  type FeedbackSignal,
} from "./app/feedback-signal";
