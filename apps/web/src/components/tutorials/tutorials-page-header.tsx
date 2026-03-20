"use client";

import { CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TutorialsPageHeaderProps {
  completedCount: number;
  totalCount: number;
  completionPercent: number;
}

export function TutorialsPageHeader({
  completedCount,
  totalCount,
  completionPercent,
}: TutorialsPageHeaderProps) {
  const isAllComplete =
    totalCount > 0 && completedCount === totalCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tutorials</h1>
        {isAllComplete ? (
          <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>All {totalCount} tutorials completed!</span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">
            {completedCount} of {totalCount} completed
          </span>
        )}
      </div>
      <Progress
        value={completionPercent}
        className={isAllComplete ? "bg-emerald-100 [&>*]:bg-emerald-500" : ""}
      />
    </div>
  );
}
