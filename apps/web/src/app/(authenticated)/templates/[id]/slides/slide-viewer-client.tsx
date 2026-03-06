"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlidePreview } from "@/components/slide-viewer/slide-preview";
import { ThumbnailStrip } from "@/components/slide-viewer/thumbnail-strip";
import { ClassificationPanel } from "@/components/slide-viewer/classification-panel";
import type { SlideData, SlideThumbnail } from "@/lib/actions/slide-actions";

interface SlideViewerClientProps {
  templateId: string;
  templateName: string;
  initialSlides: SlideData[];
  initialThumbnails: SlideThumbnail[];
}

export function SlideViewerClient({
  templateId,
  templateName,
  initialSlides,
  initialThumbnails,
}: SlideViewerClientProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>(initialSlides);

  // Build a map from slideIndex to thumbnailUrl
  const thumbnailMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of initialThumbnails) {
      map.set(t.slideIndex, t.thumbnailUrl);
    }
    return map;
  }, [initialThumbnails]);

  // Sorted thumbnails for the strip
  const sortedThumbnails = useMemo(
    () =>
      initialThumbnails
        .slice()
        .sort((a, b) => a.slideIndex - b.slideIndex)
        .map((t) => ({
          slideIndex: t.slideIndex,
          thumbnailUrl: t.thumbnailUrl,
        })),
    [initialThumbnails]
  );

  const currentSlide = slides[currentIndex] ?? null;
  const totalSlides = slides.length;

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        setCurrentIndex(index);
      }
    },
    [totalSlides]
  );

  const goPrev = useCallback(() => goToSlide(currentIndex - 1), [currentIndex, goToSlide]);
  const goNext = useCallback(() => goToSlide(currentIndex + 1), [currentIndex, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore keyboard shortcuts when typing in an input/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  // Handle slide data refresh after rating/correction
  const handleSlideUpdated = useCallback(
    (updatedSlide: SlideData) => {
      setSlides((prev) =>
        prev.map((s) => (s.id === updatedSlide.id ? updatedSlide : s))
      );
    },
    []
  );

  const currentThumbnailUrl = currentSlide
    ? thumbnailMap.get(currentSlide.slideIndex)
    : undefined;

  // Find the thumbnail index by mapping slideIndex to array position
  const thumbnailCurrentIndex = currentSlide?.slideIndex ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer"
          onClick={() => router.push("/templates")}
          aria-label="Back to templates"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold text-slate-900">{templateName}</h1>
        <span className="ml-auto text-xs text-slate-500">
          {currentIndex + 1} of {totalSlides}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Slide preview area (~70%) */}
        <div className="relative flex flex-1 items-center justify-center bg-slate-100 p-4">
          {/* Prev arrow */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 z-10 h-10 w-10 cursor-pointer rounded-full bg-white/80 shadow-sm hover:bg-white"
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <SlidePreview
            thumbnailUrl={currentThumbnailUrl}
            slideIndex={currentSlide?.slideIndex ?? 0}
            isLoading={!currentSlide}
          />

          {/* Next arrow */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 z-10 h-10 w-10 cursor-pointer rounded-full bg-white/80 shadow-sm hover:bg-white"
            onClick={goNext}
            disabled={currentIndex === totalSlides - 1}
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Right sidebar (~30%) */}
        <div className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          {currentSlide && (
            <ClassificationPanel
              slide={currentSlide}
              templateId={templateId}
              onUpdated={handleSlideUpdated}
            />
          )}
        </div>
      </div>

      {/* Thumbnail strip at bottom */}
      <ThumbnailStrip
        thumbnails={sortedThumbnails}
        currentIndex={thumbnailCurrentIndex}
        onSelect={(slideIndex) => {
          // Find the array index for this slideIndex
          const arrayIndex = slides.findIndex(
            (s) => s.slideIndex === slideIndex
          );
          if (arrayIndex >= 0) {
            setCurrentIndex(arrayIndex);
          }
        }}
      />
    </div>
  );
}
