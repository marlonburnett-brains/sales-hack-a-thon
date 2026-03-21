"use client";

import dynamicImport from "next/dynamic";

export const TutorialVideoPlayerDynamic = dynamicImport(
  () =>
    import("@/components/tutorials/tutorial-video-player").then(
      (m) => m.TutorialVideoPlayer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video w-full animate-pulse rounded-lg bg-slate-200" />
    ),
  },
);
