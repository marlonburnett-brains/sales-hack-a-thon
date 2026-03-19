import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type CursorPoint = {
  x: number;
  y: number;
};

type AnimatedCursorProps = {
  from?: CursorPoint;
  to?: CursorPoint;
  showClickRipple?: boolean;
  moveDurationFrames?: number;
};

const CURSOR_WIDTH = 40;
const CURSOR_HEIGHT = 56;

export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
  from,
  to,
  showClickRipple = true,
  moveDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (!to) {
    return null;
  }

  const start = from ?? { x: Math.max(to.x - 0.08, 0), y: Math.min(to.y + 0.08, 1) };
  const moveFrames = moveDurationFrames ?? Math.max(Math.round(fps * 0.5), 1);
  const easedProgress = interpolate(frame, [0, moveFrames], [0, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const arcHeight = 28;
  const x = interpolate(easedProgress, [0, 1], [start.x * width, to.x * width], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const baseY = interpolate(easedProgress, [0, 1], [start.y * height, to.y * height], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = baseY - Math.sin(easedProgress * Math.PI) * arcHeight;

  const rippleStart = moveFrames;
  const rippleFrame = Math.max(frame - rippleStart, 0);
  const rippleProgress = spring({
    fps,
    frame: rippleFrame,
    config: { damping: 14, stiffness: 130 },
    durationInFrames: Math.max(Math.round(fps * 0.3), 1),
  });
  const rippleOpacity = showClickRipple ? interpolate(rippleProgress, [0, 1], [0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) : 0;
  const rippleScale = interpolate(rippleProgress, [0, 1], [0.2, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {showClickRipple && rippleOpacity > 0 ? (
        <div
          style={{
            position: "absolute",
            left: to.x * width - 24,
            top: to.y * height - 24,
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid rgba(147, 197, 253, 0.95)",
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x - CURSOR_WIDTH * 0.2,
          top: y - CURSOR_HEIGHT * 0.15,
          width: CURSOR_WIDTH,
          height: CURSOR_HEIGHT,
          filter: "drop-shadow(0 12px 20px rgba(15, 23, 42, 0.24))",
        }}
      >
        <svg viewBox="0 0 40 56" width="40" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 3L31.5 28.75H18.25L24.5 52L15.5 54.5L9.25 31.25H3.5L5 3Z"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
