import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ZoomPanProps = {
  children: React.ReactNode;
  scale?: number;
  x?: number;
  y?: number;
  durationInFrames?: number;
  zoomInFrames?: number;
  zoomOutFrames?: number;
};

export const ZoomPan: React.FC<ZoomPanProps> = ({
  children,
  scale,
  x,
  y,
  durationInFrames,
  zoomInFrames,
  zoomOutFrames,
}) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();

  const totalFrames = durationInFrames ?? video.durationInFrames;
  const entryFrames = zoomInFrames ?? Math.max(Math.round(video.fps * 0.5), 1);
  const exitFrames = zoomOutFrames ?? Math.max(Math.round(video.fps * 0.5), 1);
  const exitStartFrame = Math.max(totalFrames - exitFrames, entryFrames);
  const targetScale = scale ?? 1;

  const hasTarget =
    targetScale > 1 && typeof x === "number" && typeof y === "number";

  const animatedScale = hasTarget
    ? interpolate(frame, [0, entryFrames, exitStartFrame, totalFrames], [1, targetScale, targetScale, 1], {
        easing: Easing.inOut(Easing.ease),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const translate = useMemo(() => {
    if (!hasTarget) {
      return { x: 0, y: 0 };
    }

    const translateX = (0.5 - x) * video.width * (animatedScale - 1);
    const translateY = (0.5 - y) * video.height * (animatedScale - 1);

    return { x: translateX, y: translateY };
  }, [animatedScale, hasTarget, video.height, video.width, x, y]);

  if (!hasTarget) {
    return <>{children}</>;
  }

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${animatedScale})`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
