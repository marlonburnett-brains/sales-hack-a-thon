import type { PipelineStep } from "./pipeline-stepper";

/** Touch 1: Initial generation (before seller approval suspend) */
export const TOUCH_1_PIPELINE_STEPS: PipelineStep[] = [
  { id: "generate-pager-content", label: "Generating pager content" },
  { id: "assemble-deck", label: "Assembling Google Slides deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

/** Touch 1: Assembly phase (after approve/edit, during deck assembly) */
export const TOUCH_1_ASSEMBLING_STEPS: PipelineStep[] = [
  { id: "assemble-deck", label: "Assembling Google Slides deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

/** Touch 2: Meet Lumenalta intro deck */
export const TOUCH_2_PIPELINE_STEPS: PipelineStep[] = [
  { id: "select-slides", label: "Selecting slides" },
  { id: "assemble-deck", label: "Assembling deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

/** Touch 3: Capability alignment deck */
export const TOUCH_3_PIPELINE_STEPS: PipelineStep[] = [
  { id: "select-slides", label: "Selecting capability slides" },
  { id: "assemble-deck", label: "Assembling deck" },
  { id: "record-interaction", label: "Saving to Drive" },
];

/** Touch 4: Transcript extraction phase */
export const TOUCH_4_EXTRACT_STEPS: PipelineStep[] = [
  { id: "parse-transcript", label: "Parsing transcript" },
  { id: "validate-fields", label: "Validating extracted fields" },
];

/** Touch 4: Brief generation phase (after field review) */
export const TOUCH_4_BRIEF_STEPS: PipelineStep[] = [
  { id: "map-pillars-generate-brief", label: "Mapping solution pillars" },
  { id: "generate-roi-framing", label: "Generating ROI framing" },
  { id: "record-interaction", label: "Recording interaction" },
];

/** Touch 4: Asset generation pipeline (after brief approval) */
export const TOUCH_4_ASSET_PIPELINE_STEPS: PipelineStep[] = [
  { id: "rag-retrieval", label: "Retrieving relevant content" },
  { id: "assemble-slide-json", label: "Planning slide structure" },
  { id: "generate-custom-copy", label: "Writing slide content" },
  { id: "create-slides-deck", label: "Creating Google Slides deck" },
  { id: "create-talk-track", label: "Generating talk track" },
  { id: "create-buyer-faq", label: "Generating buyer FAQ" },
  { id: "check-brand-compliance", label: "Checking brand compliance" },
];

/** Pre-call briefing pipeline */
export const PRE_CALL_PIPELINE_STEPS: PipelineStep[] = [
  { id: "research-company", label: "Researching company" },
  { id: "query-case-studies", label: "Finding relevant case studies" },
  { id: "generate-hypotheses", label: "Generating hypotheses" },
  { id: "generate-discovery-questions", label: "Creating discovery questions" },
  { id: "build-briefing-doc", label: "Building briefing document" },
  { id: "record-interaction", label: "Saving to Drive" },
];
