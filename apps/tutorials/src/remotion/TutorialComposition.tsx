import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TutorialStep } from "./TutorialStep";
import type { TutorialProps } from "./Root";

const FPS = 30;
const FALLBACK_DURATION_MS = 3000;

export const TutorialComposition: React.FC<TutorialProps> = ({
  tutorialName,
  steps,
}) => {
  let from = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {steps.map((step) => {
        const durationMs =
          step.durationMs > 0 ? step.durationMs : FALLBACK_DURATION_MS;
        const durationInFrames = Math.ceil((durationMs / 1000) * FPS);
        const currentFrom = from;
        from += durationInFrames;

        return (
          <Sequence
            key={step.stepId}
            from={currentFrom}
            durationInFrames={durationInFrames}
            name={step.stepId}
            layout="none"
          >
            <TutorialStep
              tutorialName={tutorialName}
              stepId={step.stepId}
              audioFile={step.audioFile}
              durationMs={durationMs}
              hasAudio={step.durationMs > 0}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
