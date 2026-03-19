import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type CalloutProps = {
  text: string;
  x: number;
  y: number;
};

export const Callout: React.FC<CalloutProps> = ({ text, x, y }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const opacity = interpolate(frame, [0, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 9], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pointX = x * width;
  const pointY = y * height;
  const labelWidth = 420;
  const labelHeight = 84;
  const left = Math.min(Math.max(pointX - labelWidth / 2, 24), width - labelWidth - 24);
  const preferredTop = pointY - 132;
  const top = preferredTop < 32 ? pointY + 42 : preferredTop;
  const arrowLeft = Math.min(Math.max(pointX - left - 14, 32), labelWidth - 32);
  const arrowPointsUp = preferredTop < 32;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: labelWidth,
          minHeight: labelHeight,
          padding: "18px 20px",
          borderRadius: 22,
          backgroundColor: "rgba(15, 23, 42, 0.82)",
          color: "#FFFFFF",
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 30,
          fontWeight: 500,
          lineHeight: 1.35,
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.32)",
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {text}
        <div
          style={{
            position: "absolute",
            left: arrowLeft,
            [arrowPointsUp ? "top" : "bottom"]: -14,
            width: 28,
            height: 28,
            backgroundColor: "rgba(15, 23, 42, 0.82)",
            transform: "rotate(45deg)",
            borderRadius: 4,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
