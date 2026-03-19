import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type CalloutProps = {
  text: string;
  x: number;
  y: number;
};

/**
 * Subtitle-style callout anchored at the bottom of the viewport.
 * No arrows or positioning math — the cursor guides attention,
 * the callout provides annotation text.
 */
export const Callout: React.FC<CalloutProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideY = interpolate(frame, [0, 10], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const maxWidth = Math.min(720, width * 0.6);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: `translateX(-50%) translateY(${slideY}px)`,
          maxWidth,
          padding: "14px 24px",
          borderRadius: 12,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          color: "#FFFFFF",
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.4,
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          opacity,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
