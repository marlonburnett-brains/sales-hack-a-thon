import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type OutroSlateProps = {
  nextTutorialName?: string;
};

export const OutroSlate: React.FC<OutroSlateProps> = ({ nextTutorialName }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOutStart = Math.max(durationInFrames - 30, 0);
  const overlayOpacity = interpolate(frame, [fadeOutStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0F172A 0%, #020617 100%)",
        color: "#FFFFFF",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          textAlign: "center",
          padding: "120px 160px",
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
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05 }}>
          Tutorial Complete
        </div>
        {nextTutorialName ? (
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.35,
              color: "rgba(255, 255, 255, 0.82)",
            }}
          >
            Next: {nextTutorialName}
          </div>
        ) : null}
      </div>
      <AbsoluteFill style={{ backgroundColor: "#000000", opacity: overlayOpacity }} />
    </AbsoluteFill>
  );
};
