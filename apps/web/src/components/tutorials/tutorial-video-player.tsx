"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  updateTutorialProgressAction,
  markTutorialWatchedAction,
} from "@/lib/actions/tutorial-actions";

interface TutorialVideoPlayerProps {
  tutorialId: string;
  slug: string;
  gcsUrl: string;
  title: string;
  description?: string;
  durationSec: number;
  initialWatched: boolean;
  initialLastPosition: number;
  prevTutorial: { slug: string; title: string } | null;
  nextTutorial: { slug: string; title: string } | null;
}

function formatDuration(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function TutorialVideoPlayer({
  tutorialId,
  gcsUrl,
  title,
  description,
  durationSec,
  initialWatched,
  initialLastPosition,
  prevTutorial,
  nextTutorial,
}: TutorialVideoPlayerProps) {
  const [isWatched, setIsWatched] = useState(initialWatched);
  const [showEndScreen, setShowEndScreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasMarkedWatched = useRef<boolean>(false);

  // Auto-seek to last position on loadedmetadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video || initialLastPosition <= 0) return;

    function handleLoadedMetadata() {
      if (video) {
        video.currentTime = initialLastPosition;
      }
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [initialLastPosition]);

  // Play/pause/timeupdate handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handlePlay() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        if (video) {
          void updateTutorialProgressAction(tutorialId, video.currentTime ?? 0);
        }
      }, 10_000);
    }

    function handlePause() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (video) {
        void updateTutorialProgressAction(tutorialId, video.currentTime ?? 0);
      }
    }

    function handleTimeUpdate() {
      if (!video) return;
      if (
        !hasMarkedWatched.current &&
        video.duration > 0 &&
        video.currentTime / video.duration >= 0.9
      ) {
        hasMarkedWatched.current = true;
        setIsWatched(true);
        setShowEndScreen(true);
        void markTutorialWatchedAction(tutorialId, video.currentTime);
      }
    }

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [tutorialId]);

  const durationLabel = formatDuration(durationSec);

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-8">
      {/* Video container */}
      <div
        className="relative aspect-video w-full rounded-lg overflow-hidden bg-black"
        role="region"
        aria-label="tutorial video"
      >
        <video
          ref={videoRef}
          src={gcsUrl}
          controls
          className="h-full w-full"
          preload="metadata"
          aria-label="tutorial video"
        />

        {/* End-screen overlay */}
        {showEndScreen && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 rounded-lg">
            <CheckCircle className="h-12 w-12 text-emerald-400" />
            <p className="text-lg font-semibold text-white">Complete!</p>
            {nextTutorial ? (
              <Link
                href={`/tutorials/${nextTutorial.slug}`}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
              >
                Watch next: {nextTutorial.title} →
              </Link>
            ) : (
              <Link
                href="/tutorials"
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Back to Tutorials
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Title row */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex-1">{title}</h1>
        {isWatched && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            ✓ Watched
          </Badge>
        )}
      </div>

      {/* Duration */}
      <p className="text-sm text-slate-500">{durationLabel}</p>

      {/* Description */}
      {description && <p className="text-slate-600">{description}</p>}

      {/* Prev/Next navigation */}
      <div className="flex items-center justify-between">
        {prevTutorial ? (
          <Link
            href={`/tutorials/${prevTutorial.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
            {prevTutorial.title}
          </Link>
        ) : (
          <span />
        )}
        {nextTutorial ? (
          <Link
            href={`/tutorials/${nextTutorial.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            {nextTutorial.title}
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

export default TutorialVideoPlayer;
