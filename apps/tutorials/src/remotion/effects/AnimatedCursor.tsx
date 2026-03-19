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

const CURSOR_SIZE = 32;

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

  const start = from ?? { x: Math.max(to.x - 0.06, 0), y: Math.min(to.y + 0.06, 1) };
  const moveFrames = moveDurationFrames ?? Math.max(Math.round(fps * 0.4), 1);
  const easedProgress = interpolate(frame, [0, moveFrames], [0, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const x = interpolate(easedProgress, [0, 1], [start.x * width, to.x * width], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const baseY = interpolate(easedProgress, [0, 1], [start.y * height, to.y * height], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = baseY - Math.sin(easedProgress * Math.PI) * 16;

  const rippleStart = moveFrames;
  const rippleFrame = Math.max(frame - rippleStart, 0);
  const rippleProgress = spring({
    fps,
    frame: rippleFrame,
    config: { damping: 16, stiffness: 160 },
    durationInFrames: Math.max(Math.round(fps * 0.25), 1),
  });
  const rippleOpacity = showClickRipple
    ? interpolate(rippleProgress, [0, 1], [0.4, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const rippleScale = interpolate(rippleProgress, [0, 1], [0.3, 1.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {showClickRipple && rippleOpacity > 0 ? (
        <div
          style={{
            position: "absolute",
            left: to.x * width - 16,
            top: to.y * height - 16,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "2px solid rgba(147, 197, 253, 0.8)",
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: CURSOR_SIZE,
          height: CURSOR_SIZE,
          filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={CURSOR_SIZE}
          height={CURSOR_SIZE}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.5 3.21V20.8l4.86-4.86h3.49l4.86 4.86V3.21H5.5Z"
            style={{ display: "none" }}
          />
          <path
            d="M2 1 L2 21 L6.8 16.2 L10.6 24 L13.4 22.8 L9.6 15 L16 15 Z"
            fill="#FFFFFF"
            stroke="#1e293b"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
