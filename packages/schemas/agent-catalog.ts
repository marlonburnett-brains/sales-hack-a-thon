export type AgentFamily =
  | "pre-call"
  | "touch-1"
  | "deck-selection"
  | "touch-4"
  | "knowledge-extraction"
  | "deck-intelligence"
  | "ingestion"
  | "validation";

export type AgentId =
  | "company-researcher"
  | "value-hypothesis-strategist"
  | "discovery-question-strategist"
  | "first-contact-pager-writer"
  | "deck-slide-selector"
  | "transcript-extractor"
  | "sales-brief-strategist"
  | "roi-framing-analyst"
  | "proposal-slide-selector"
  | "proposal-copywriter"
  | "buyer-faq-strategist"
  | "knowledge-result-extractor"
  | "deck-structure-analyst"
  | "deck-structure-refinement-assistant"
  | "slide-metadata-classifier"
  | "slide-description-writer"
  | "template-classification-analyst"
  | "schema-validation-auditor";

export interface AgentCatalogEntry {
  agentId: AgentId;
  name: string;
  responsibility: string;
  family: AgentFamily;
  isShared: boolean;
  touchTypes: string[];
  sourceSites: string[];
  sourceNotes: string;
}

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    agentId: "company-researcher",
    name: "Company Researcher",
    responsibility:
      "Research a target company and summarize the most relevant business context for a seller before a meeting.",
    family: "pre-call",
    isShared: false,
    touchTypes: ["pre_call"],
    sourceSites: ["apps/agent/src/mastra/workflows/pre-call-workflow.ts"],
    sourceNotes:
      "Owns the company-research prompt in the pre-call workflow research step.",
  },
  {
    agentId: "value-hypothesis-strategist",
    name: "Value Hypothesis Strategist",
    responsibility:
      "Turn company research and meeting context into prioritized value hypotheses tied to Lumenalta solution areas.",
    family: "pre-call",
    isShared: false,
    touchTypes: ["pre_call"],
    sourceSites: ["apps/agent/src/mastra/workflows/pre-call-workflow.ts"],
    sourceNotes:
      "Owns the generate-hypotheses prompt in the pre-call workflow.",
  },
  {
    agentId: "discovery-question-strategist",
    name: "Discovery Question Strategist",
    responsibility:
      "Generate prioritized discovery questions that validate the likely deal hypotheses for an upcoming meeting.",
    family: "pre-call",
    isShared: false,
    touchTypes: ["pre_call"],
    sourceSites: ["apps/agent/src/mastra/workflows/pre-call-workflow.ts"],
    sourceNotes:
      "Owns the discovery-question prompt in the pre-call workflow.",
  },
  {
    agentId: "first-contact-pager-writer",
    name: "First Contact Pager Writer",
    responsibility:
      "Write the personalized first-contact pager content for Touch 1 using company, industry, and seller context.",
    family: "touch-1",
    isShared: false,
    touchTypes: ["touch_1"],
    sourceSites: ["apps/agent/src/mastra/workflows/touch-1-workflow.ts"],
    sourceNotes:
      "Owns the Touch 1 pager-content generation prompt before HITL review.",
  },
  {
    agentId: "deck-slide-selector",
    name: "Deck Slide Selector",
    responsibility:
      "Select and order the best source slides for shared deck-building jobs across Touch 2 and Touch 3.",
    family: "deck-selection",
    isShared: true,
    touchTypes: ["touch_2", "touch_3"],
    sourceSites: ["apps/agent/src/lib/slide-selection.ts"],
    sourceNotes:
      "Shared slide-selection family with touch-specific prompt modes for intro and capability decks.",
  },
  {
    agentId: "transcript-extractor",
    name: "Transcript Extractor",
    responsibility:
      "Extract the six structured discovery fields from a raw Touch 4 transcript and meeting notes.",
    family: "touch-4",
    isShared: false,
    touchTypes: ["touch_4"],
    sourceSites: ["apps/agent/src/mastra/workflows/touch-4-workflow.ts"],
    sourceNotes:
      "Owns the initial Touch 4 transcript parsing prompt.",
  },
  {
    agentId: "sales-brief-strategist",
    name: "Sales Brief Strategist",
    responsibility:
      "Map seller-reviewed transcript facts to Lumenalta pillars and produce the structured sales brief for Touch 4.",
    family: "touch-4",
    isShared: false,
    touchTypes: ["touch_4"],
    sourceSites: ["apps/agent/src/mastra/workflows/touch-4-workflow.ts"],
    sourceNotes:
      "Owns the brief generation prompt after seller-reviewed fields become ground truth.",
  },
  {
    agentId: "roi-framing-analyst",
    name: "ROI Framing Analyst",
    responsibility:
      "Enrich approved Touch 4 use cases with quantified ROI outcomes and sharper value hypotheses.",
    family: "touch-4",
    isShared: false,
    touchTypes: ["touch_4"],
    sourceSites: ["apps/agent/src/mastra/workflows/touch-4-workflow.ts"],
    sourceNotes:
      "Owns the ROI framing prompt in the Touch 4 workflow.",
  },
  {
    agentId: "proposal-slide-selector",
    name: "Proposal Slide Selector",
    responsibility:
      "Choose the final proposal candidate slides that should make it into a Touch 4 solution deck.",
    family: "touch-4",
    isShared: false,
    touchTypes: ["touch_4"],
    sourceSites: ["apps/agent/src/mastra/workflows/touch-4-workflow.ts"],
    sourceNotes:
      "Owns the LLM selection prompt inside the assemble-slide-json step.",
  },
  {
    agentId: "proposal-copywriter",
    name: "Proposal Copywriter",
    responsibility:
      "Rewrite retrieved source slide content into customer-specific proposal copy without breaking grounding constraints.",
    family: "touch-4",
    isShared: false,
    touchTypes: ["touch_4"],
    sourceSites: ["apps/agent/src/lib/proposal-assembly.ts"],
    sourceNotes:
      "Owns per-slide bespoke proposal copy generation for retrieved slides.",
  },
  {
    agentId: "buyer-faq-strategist",
    name: "Buyer FAQ Strategist",
    responsibility:
      "Generate stakeholder-specific objections and grounded responses for the Touch 4 buyer FAQ artifact.",
    family: "touch-4",
    isShared: false,
    touchTypes: ["touch_4"],
    sourceSites: ["apps/agent/src/mastra/workflows/touch-4-workflow.ts"],
    sourceNotes:
      "Owns the buyer FAQ prompt used after deck and talk track generation.",
  },
  {
    agentId: "knowledge-result-extractor",
    name: "Knowledge Result Extractor",
    responsibility:
      "Transform raw AtlusAI search responses into normalized slide-search results the rest of the system can use.",
    family: "knowledge-extraction",
    isShared: true,
    touchTypes: ["touch_2", "touch_3", "touch_4", "pre_call"],
    sourceSites: ["apps/agent/src/lib/atlusai-search.ts"],
    sourceNotes:
      "Owns the adaptive extraction prompt that normalizes knowledge-base results.",
  },
  {
    agentId: "deck-structure-analyst",
    name: "Deck Structure Analyst",
    responsibility:
      "Infer the standard section flow, variations, and sequencing rationale for each deck type from examples and templates.",
    family: "deck-intelligence",
    isShared: true,
    touchTypes: ["touch_1", "touch_2", "touch_3", "touch_4"],
    sourceSites: ["apps/agent/src/deck-intelligence/infer-deck-structure.ts"],
    sourceNotes:
      "Owns deck-structure inference and stays separate from chat refinement.",
  },
  {
    agentId: "deck-structure-refinement-assistant",
    name: "Deck Structure Refinement Assistant",
    responsibility:
      "Explain deck-structure changes in natural language and update the stored structure from explicit user refinement feedback.",
    family: "deck-intelligence",
    isShared: true,
    touchTypes: ["touch_1", "touch_2", "touch_3", "touch_4"],
    sourceSites: ["apps/agent/src/deck-intelligence/chat-refinement.ts"],
    sourceNotes:
      "Owns both the conversational explanation prompt and the structured refinement prompt.",
  },
  {
    agentId: "slide-metadata-classifier",
    name: "Slide Metadata Classifier",
    responsibility:
      "Classify each ingested slide across industries, subsectors, pillars, funnel stages, personas, and touch bindings.",
    family: "ingestion",
    isShared: true,
    touchTypes: ["touch_1", "touch_2", "touch_3", "touch_4"],
    sourceSites: ["apps/agent/src/ingestion/classify-metadata.ts"],
    sourceNotes:
      "Owns the structured metadata-tagging prompt used during ingestion.",
  },
  {
    agentId: "slide-description-writer",
    name: "Slide Description Writer",
    responsibility:
      "Describe each ingested slide's purpose, visual composition, key content, and best-fit usage scenarios.",
    family: "ingestion",
    isShared: true,
    touchTypes: ["touch_1", "touch_2", "touch_3", "touch_4"],
    sourceSites: ["apps/agent/src/ingestion/describe-slide.ts"],
    sourceNotes:
      "Owns the narrative slide-description prompt used during ingestion enrichment.",
  },
  {
    agentId: "template-classification-analyst",
    name: "Template Classification Analyst",
    responsibility:
      "Decide whether a presentation is a reusable template or a real example and infer its touch bindings.",
    family: "ingestion",
    isShared: true,
    touchTypes: ["touch_1", "touch_2", "touch_3", "touch_4"],
    sourceSites: ["apps/agent/src/ingestion/auto-classify-templates.ts"],
    sourceNotes:
      "Owns auto-classification for templates versus examples in the ingestion pipeline.",
  },
  {
    agentId: "schema-validation-auditor",
    name: "Schema Validation Auditor",
    responsibility:
      "Exercise structured-output prompt contracts and verify the live model still returns JSON that matches shared schemas.",
    family: "validation",
    isShared: true,
    touchTypes: [],
    sourceSites: ["apps/agent/src/validation/validate-schemas.ts"],
    sourceNotes:
      "Owns the validation-script prompts that round-trip shared LLM schemas against the active model.",
  },
];

export const AGENT_IDS = AGENT_CATALOG.map((entry) => entry.agentId);
