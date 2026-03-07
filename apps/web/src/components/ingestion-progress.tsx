"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface IngestionProgressProps {
  current: number;
  total: number;
  className?: string;
}

/**
 * Shared progress bar with "Slide N of M" text for ingestion status.
 */
export function IngestionProgress({
  current,
  total,
  className,
}: IngestionProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={cn("space-y-1", className)}>
      <Progress value={percent} className="h-1.5" />
      <p className="text-xs text-indigo-600">
        Slide {current} of {total}
      </p>
    </div>
  );
}
