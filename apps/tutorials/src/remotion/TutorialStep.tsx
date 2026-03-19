import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Audio } from "@remotion/media";

type TutorialStepProps = {
  tutorialName: string;
  stepId: string;
  audioFile: string;
  durationMs: number;
  hasAudio: boolean;
};

export const TutorialStep: React.FC<TutorialStepProps> = ({
  tutorialName,
  stepId,
  audioFile,
  hasAudio,
}) => {
  const screenshotSrc = staticFile(`output/${tutorialName}/${stepId}.png`);
  const audioSrc = staticFile(`audio/${tutorialName}/${audioFile}`);

  return (
    <AbsoluteFill>
      <Img
        src={screenshotSrc}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {hasAudio && <Audio src={audioSrc} />}
    </AbsoluteFill>
  );
};
