"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SlidePreviewProps {
  thumbnailUrl: string | undefined;
  slideIndex: number;
  isLoading: boolean;
}

export function SlidePreview({
  thumbnailUrl,
  slideIndex,
  isLoading,
}: SlidePreviewProps) {
  if (isLoading || !thumbnailUrl) {
    return (
      <div className="aspect-video w-full max-w-[1600px]">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full max-w-[1600px]">
      <img
        src={thumbnailUrl}
        alt={`Slide ${slideIndex + 1}`}
        className="h-full w-full rounded-lg object-contain"
        draggable={false}
      />
    </div>
  );
}
