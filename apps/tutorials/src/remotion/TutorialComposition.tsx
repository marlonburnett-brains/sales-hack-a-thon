import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { type StepInput, type TutorialProps } from "./Root";
import { IntroSlate } from "./effects/IntroSlate";
import { OutroSlate } from "./effects/OutroSlate";
import { TutorialStep } from "./TutorialStep";

const FPS = 30;
const FALLBACK_DURATION_MS = 3000;
const INTRO_DURATION_FRAMES = 90;
const OUTRO_DURATION_FRAMES = 120;
const TRANSITION_DURATION_FRAMES = 15;

const transitionTiming = linearTiming({
  durationInFrames: TRANSITION_DURATION_FRAMES,
});

const getStepDurationInFrames = (step: StepInput): number => {
  const durationMs = step.durationMs > 0 ? step.durationMs : FALLBACK_DURATION_MS;
  return Math.ceil((durationMs / 1000) * FPS);
};

export const TutorialComposition: React.FC<TutorialProps> = ({
  tutorialName,
  title,
  description,
  nextTutorialName,
  steps,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={INTRO_DURATION_FRAMES}>
          <IntroSlate title={title} description={description} />
        </TransitionSeries.Sequence>

        {steps.length > 0 ? (
          <TransitionSeries.Transition
            presentation={fade()}
            timing={transitionTiming}
          />
        ) : null}

        {steps.map((step, index) => {
          const durationInFrames = getStepDurationInFrames(step);
          const isLastStep = index === steps.length - 1;

          return (
            <React.Fragment key={step.stepId}>
              <TransitionSeries.Sequence
                durationInFrames={durationInFrames}
                name={step.stepId}
                layout="none"
              >
                <TutorialStep
                  tutorialName={tutorialName}
                  stepId={step.stepId}
                  audioFile={step.audioFile}
                  durationInFrames={durationInFrames}
                  hasAudio={step.durationMs > 0}
                  zoomTarget={step.zoomTarget}
                  callout={step.callout}
                  shortcutKey={step.shortcutKey}
                  cursorTarget={step.cursorTarget}
                  cursorFrom={step.cursorFrom}
                  hasCursorAction={step.hasCursorAction}
                  stepIndex={step.stepIndex}
                  totalSteps={step.totalSteps}
                />
              </TransitionSeries.Sequence>
              <TransitionSeries.Transition
                presentation={fade()}
                timing={transitionTiming}
              />
            </React.Fragment>
          );
        })}

        <TransitionSeries.Sequence durationInFrames={OUTRO_DURATION_FRAMES}>
          <OutroSlate nextTutorialName={nextTutorialName} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
