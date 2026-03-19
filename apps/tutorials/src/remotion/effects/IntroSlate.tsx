import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

type IntroSlateProps = {
  title: string;
  description: string;
};

export const IntroSlate: React.FC<IntroSlateProps> = ({ title, description }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at top, #1E293B 0%, #020617 62%)",
        color: "#FFFFFF",
        fontFamily: "Inter, Arial, sans-serif",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          padding: "120px 160px",
          gap: 28,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#93C5FD",
          }}
        >
          AtlusDeck
        </div>
        <div
          style={{
            maxWidth: 1180,
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            maxWidth: 1100,
            fontSize: 34,
            lineHeight: 1.4,
            color: "rgba(255, 255, 255, 0.8)",
          }}
        >
          {description}
        </div>
      </div>
    </AbsoluteFill>
  );
};
