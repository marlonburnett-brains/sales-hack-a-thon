import { z } from "zod";

/**
 * Tutorial Script Schema
 *
 * Defines the structure for AI-generated tutorial scripts.
 * Each script describes a sequence of steps to capture for a tutorial video.
 * The capture engine consumes these scripts to automate screenshot capture.
 */

// Individual actions that can be performed at each step
const ClickActionSchema = z.object({
  type: z.literal("click"),
  selector: z.string(),
});

const FillActionSchema = z.object({
  type: z.literal("fill"),
  selector: z.string(),
  value: z.string(),
});

const SelectActionSchema = z.object({
  type: z.literal("select"),
  selector: z.string(),
  value: z.string(),
});

const WaitActionSchema = z.object({
  type: z.literal("wait"),
  selector: z.string(),
});

const HoverActionSchema = z.object({
  type: z.literal("hover"),
  selector: z.string(),
});

const KeyboardActionSchema = z.object({
  type: z.literal("keyboard"),
  key: z.string(),
});

export const ActionSchema = z.discriminatedUnion("type", [
  ClickActionSchema,
  FillActionSchema,
  SelectActionSchema,
  WaitActionSchema,
  HoverActionSchema,
  KeyboardActionSchema,
]);

export const StepSchema = z.object({
  /** Unique step identifier, e.g. "step-001" */
  id: z.string(),
  /** URL path to navigate to, e.g. "/deals" */
  url: z.string(),
  /** Conversational narration text for this step */
  narration: z.string(),
  /** Actions to perform before taking the screenshot */
  actions: z.array(ActionSchema).optional(),
  /** Selector to wait for before capturing the screenshot */
  waitFor: z.string().optional(),
  /** Zoom target for future zoom/pan effects (Phase 66) */
  zoomTarget: z
    .object({
      selector: z.string(),
      scale: z.number().default(1.5),
      /**
       * Normalized horizontal target position in the screenshot (0-1).
       * 0 = left edge, 1 = right edge.
       */
      x: z.number().min(0).max(1).optional(),
      /**
       * Normalized vertical target position in the screenshot (0-1).
       * 0 = top edge, 1 = bottom edge.
       */
      y: z.number().min(0).max(1).optional(),
    })
    .optional(),
  /** Optional annotation overlay positioned by normalized screenshot coordinates */
  callout: z
    .object({
      text: z.string(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
  /** Optional keyboard shortcut hint rendered as an overlay badge */
  shortcutKey: z.string().optional(),
  /** Optional cursor destination positioned by normalized screenshot coordinates */
  cursorTarget: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
  /** Step-specific fixture overrides merged onto shared fixtures */
  mockOverrides: z.record(z.string(), z.unknown()).optional(),
  /** HITL stage to set on mock server before this step executes */
  mockStage: z
    .enum(["idle", "generating", "skeleton", "lowfi", "hifi", "completed"])
    .optional(),
  /** Text to wait for on screen before taking screenshot (full-page text search) */
  waitForText: z.string().optional(),
  /** Sequence keys to reset on mock server before this step executes */
  resetSequences: z.array(z.string()).optional(),
  /** Pause in milliseconds before screenshot for UI settling */
  delayMs: z.number().optional(),
  /** Emotion hint for TTS narration (e.g. cheerful intro, encouraging completion) */
  emotion: z
    .enum(["cheerful", "encouraging", "calm", "professional", "excited"])
    .optional(),
});

export const TutorialScriptSchema = z.object({
  /** Unique tutorial identifier, e.g. "getting-started" */
  id: z.string(),
  /** Human-readable title, e.g. "Getting Started with AtlusDeck" */
  title: z.string(),
  /** Brief description of what the tutorial covers */
  description: z.string(),
  /** Ordered list of tutorial steps (minimum 1) */
  steps: z.array(StepSchema).min(1),
  /** Name of the fixture set to use (defaults to "shared") */
  fixtures: z.string().optional(),
  /** Touch type for HITL tutorials (determines stage progression) */
  touchType: z
    .enum(["touch-1", "touch-2", "touch-3", "touch-4", "pre-call"])
    .optional(),
});

export type TutorialScript = z.infer<typeof TutorialScriptSchema>;
export type TutorialStep = z.infer<typeof StepSchema>;
export type TutorialAction = z.infer<typeof ActionSchema>;
