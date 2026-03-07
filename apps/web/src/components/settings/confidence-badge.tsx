"use client";

import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number;
  exampleCount: number;
  color: "green" | "yellow" | "red";
  label: string;
}

const colorClasses = {
  green: {
    bar: "bg-green-500",
    text: "text-green-700",
  },
  yellow: {
    bar: "bg-amber-500",
    text: "text-amber-700",
  },
  red: {
    bar: "bg-red-500",
    text: "text-red-700",
  },
};

export function ConfidenceBadge({
  score,
  exampleCount,
  color,
  label,
}: ConfidenceBadgeProps) {
  const colors = colorClasses[color];

  return (
    <div
      className="flex items-center gap-3"
      title={`${label}: Confidence based on ${exampleCount} classified example(s). More examples improve accuracy.`}
    >
      <span className={cn("text-sm font-semibold", colors.text)}>
        {score}%
      </span>
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", colors.bar)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">
        {exampleCount} {exampleCount === 1 ? "example" : "examples"}
      </span>
    </div>
  );
}
