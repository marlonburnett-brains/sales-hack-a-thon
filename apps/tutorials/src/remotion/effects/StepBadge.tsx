import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

type StepBadgeProps = {
  current: number;
  total: number;
};

export const StepBadge: React.FC<StepBadgeProps> = ({ current, total }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          padding: "10px 16px",
          borderRadius: 999,
          backgroundColor: "rgba(15, 23, 42, 0.82)",
          color: "#FFFFFF",
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "0.02em",
          boxShadow: "0 14px 30px rgba(15, 23, 42, 0.24)",
          opacity,
        }}
      >
        Step {current} of {total}
      </div>
    </AbsoluteFill>
  );
};
