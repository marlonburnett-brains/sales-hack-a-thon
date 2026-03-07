"use client";

import { useEffect, useRef } from "react";

interface ThumbnailStripProps {
  thumbnails: Array<{ slideIndex: number; thumbnailUrl: string | null }>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function ThumbnailStrip({
  thumbnails,
  currentIndex,
  onSelect,
}: ThumbnailStripProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [currentIndex]);

  if (thumbnails.length === 0) {
    return null;
  }

  return (
    <div className="w-full border-t border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {thumbnails.map((thumb) => {
          const isActive = thumb.slideIndex === currentIndex;
          return (
            <button
              key={thumb.slideIndex}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(thumb.slideIndex)}
              className={`flex-shrink-0 cursor-pointer overflow-hidden rounded transition-all duration-150 ${
                isActive
                  ? "ring-2 ring-blue-500 ring-offset-1"
                  : "border border-slate-200 hover:border-slate-300"
              }`}
              aria-label={`Go to slide ${thumb.slideIndex + 1}`}
              aria-current={isActive ? "true" : undefined}
            >
              {thumb.thumbnailUrl ? (
                <img
                  src={thumb.thumbnailUrl}
                  alt={`Thumbnail for slide ${thumb.slideIndex + 1}`}
                  className="h-[68px] w-[120px] object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex h-[68px] w-[120px] items-center justify-center bg-slate-100">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
