import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { AnimatedCursor } from "./effects/AnimatedCursor";
import { Callout } from "./effects/Callout";
import { ShortcutBadge } from "./effects/ShortcutBadge";
import { StepBadge } from "./effects/StepBadge";
import { ZoomPan } from "./effects/ZoomPan";

type Point = { x: number; y: number };

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
  cursorTarget?: Point;
  cursorFrom?: Point;
  hasCursorAction: boolean;
  stepIndex: number;
  totalSteps: number;
};

/**
 * Transform a normalized screenshot-space coordinate to viewport-space,
 * accounting for the active zoom/pan transform.
 * When no zoom is active, returns the coordinate unchanged.
 */
function toViewport(
  point: Point,
  zoom?: { scale: number; x: number; y: number },
): Point {
  if (!zoom || zoom.scale <= 1) return point;
  return {
    x: (point.x - zoom.x) * zoom.scale + zoom.x,
    y: (point.y - zoom.y) * zoom.scale + zoom.y,
  };
}

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
  const screenshotSrc = staticFile(`output/screenshots/${tutorialName}/${stepId}.png`);
  const audioSrc = staticFile(`output/audio/${tutorialName}/${audioFile}`);

  // Transform overlay coordinates from screenshot-space to viewport-space
  const viewCallout = callout
    ? { text: callout.text, ...toViewport({ x: callout.x, y: callout.y }, zoomTarget) }
    : undefined;
  const viewCursorTo = cursorTarget ? toViewport(cursorTarget, zoomTarget) : undefined;
  const viewCursorFrom = cursorFrom ? toViewport(cursorFrom, zoomTarget) : undefined;

  return (
    <AbsoluteFill>
      <ZoomPan
        scale={zoomTarget?.scale}
        x={zoomTarget?.x}
        y={zoomTarget?.y}
        durationInFrames={durationInFrames}
      >
        <AbsoluteFill>
          <Img
            src={screenshotSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      </ZoomPan>

      {viewCallout ? <Callout text={viewCallout.text} x={viewCallout.x} y={viewCallout.y} /> : null}

      {hasCursorAction && viewCursorTo ? (
        <AnimatedCursor from={viewCursorFrom} to={viewCursorTo} showClickRipple />
      ) : null}

      <StepBadge current={stepIndex} total={totalSteps} />

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

      {hasAudio && <Audio src={audioSrc} />}
    </AbsoluteFill>
  );
};
