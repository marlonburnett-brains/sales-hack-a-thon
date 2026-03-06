"use client";

import type { SlideData } from "@/lib/actions/slide-actions";

interface ClassificationPanelProps {
  slide: SlideData;
  templateId: string;
  onUpdated: (slide: SlideData) => void;
}

export function ClassificationPanel({
  slide,
}: ClassificationPanelProps) {
  return (
    <div className="p-4">
      <p className="text-sm text-slate-500">
        Classification for slide {slide.slideIndex + 1}
      </p>
    </div>
  );
}
