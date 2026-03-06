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
  SUBSECTORS,
  SOLUTION_PILLARS,
  ACTION_TYPES,
  type ActionType,
} from "./constants.ts";

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
  ProposalCopyLlmSchema,
  type ProposalCopy,
} from "./llm/proposal-copy.ts";
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
