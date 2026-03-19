import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { AnimatedCursor } from "./effects/AnimatedCursor";
import { Callout } from "./effects/Callout";
import { ShortcutBadge } from "./effects/ShortcutBadge";
import { StepBadge } from "./effects/StepBadge";
import { ZoomPan } from "./effects/ZoomPan";

type TutorialStepProps = {
  tutorialName: string;
  stepId: string;
  audioFile: string;
  durationInFrames: number;
  hasAudio: boolean;
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
  cursorTarget?: {
    x: number;
    y: number;
  };
  cursorFrom?: {
    x: number;
    y: number;
  };
  hasCursorAction: boolean;
  stepIndex: number;
  totalSteps: number;
};

export const TutorialStep: React.FC<TutorialStepProps> = ({
  tutorialName,
  stepId,
  audioFile,
  durationInFrames,
  hasAudio,
  zoomTarget,
  callout,
  shortcutKey,
  cursorTarget,
  cursorFrom,
  hasCursorAction,
  stepIndex,
  totalSteps,
}) => {
  const screenshotSrc = staticFile(`output/${tutorialName}/${stepId}.png`);
  const audioSrc = staticFile(`audio/${tutorialName}/${audioFile}`);

  return (
    <AbsoluteFill>
      <ZoomPan
        scale={zoomTarget?.scale}
        x={zoomTarget?.x}
        y={zoomTarget?.y}
        durationInFrames={durationInFrames}
      >
        <Img
          src={screenshotSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </ZoomPan>

      <StepBadge current={stepIndex} total={totalSteps} />

      {callout ? <Callout text={callout.text} x={callout.x} y={callout.y} /> : null}

      {shortcutKey ? (
        <div
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
          }}
        >
          <ShortcutBadge shortcut={shortcutKey} />
        </div>
      ) : null}

      {hasCursorAction && cursorTarget ? (
        <AnimatedCursor from={cursorFrom} to={cursorTarget} showClickRipple />
      ) : null}

      {hasAudio && <Audio src={audioSrc} />}
    </AbsoluteFill>
  );
};
