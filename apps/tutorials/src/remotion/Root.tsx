import React from "react";
import { Composition } from "remotion";
import { TutorialComposition } from "./TutorialComposition";

export type StepInput = {
  stepId: string;
  audioFile: string;
  durationMs: number;
};

export type TutorialProps = {
  tutorialName: string;
  steps: StepInput[];
  totalDurationMs: number;
};

const FPS = 30;
const FALLBACK_DURATION_MS = 3000;

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
        steps: [],
        totalDurationMs: 0,
      }}
      calculateMetadata={({ props }) => {
        const totalFrames = props.steps.reduce((acc, step) => {
          const ms = step.durationMs > 0 ? step.durationMs : FALLBACK_DURATION_MS;
          return acc + Math.ceil((ms / 1000) * FPS);
        }, 0);

        return {
          durationInFrames: Math.max(totalFrames, 1),
        };
      }}
    />
  );
};
