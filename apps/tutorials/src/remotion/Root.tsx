import React from "react";
import { Composition } from "remotion";
import { TutorialComposition } from "./TutorialComposition";

type NormalizedPoint = {
  x: number;
  y: number;
};

export type StepInput = {
  stepId: string;
  audioFile: string;
  durationMs: number;
  zoomTarget?: {
    scale: number;
    x: number;
    y: number;
  };
  callout?: {
    text: string;
    x: number;
    y: number;
  };
  shortcutKey?: string;
  cursorTarget?: NormalizedPoint;
  cursorFrom?: NormalizedPoint;
  hasCursorAction: boolean;
  stepIndex: number;
  totalSteps: number;
};

export type TutorialProps = {
  tutorialName: string;
  title: string;
  description: string;
  nextTutorialName?: string;
  steps: StepInput[];
  totalDurationMs: number;
};

export const FPS = 30;
export const FALLBACK_DURATION_MS = 3000;
export const INTRO_DURATION_FRAMES = 90;
export const OUTRO_DURATION_FRAMES = 120;
export const TRANSITION_DURATION_FRAMES = 15;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="tutorial"
      component={TutorialComposition}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{
        tutorialName: "",
        title: "",
        description: "",
        steps: [],
        totalDurationMs: 0,
      }}
      calculateMetadata={({ props }) => {
        const stepFrames = props.steps.reduce((acc, step) => {
          const ms = step.durationMs > 0 ? step.durationMs : FALLBACK_DURATION_MS;
          return acc + Math.ceil((ms / 1000) * FPS);
        }, 0);

        const transitionCount = props.steps.length + 1;
        const totalFrames =
          INTRO_DURATION_FRAMES +
          stepFrames +
          OUTRO_DURATION_FRAMES -
          transitionCount * TRANSITION_DURATION_FRAMES;

        return {
          durationInFrames: Math.max(totalFrames, 1),
        };
      }}
    />
  );
};
