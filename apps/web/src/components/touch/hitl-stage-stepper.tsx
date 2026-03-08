"use client";

import { Fragment } from "react";
import { CheckCircle } from "lucide-react";

export type HitlStage = "skeleton" | "lowfi" | "highfi";

export const HITL_STAGES: readonly { key: HitlStage; label: string }[] = [
  { key: "skeleton", label: "Outline" },
  { key: "lowfi", label: "Draft" },
  { key: "highfi", label: "Final" },
] as const;

interface HitlStageStepperProps {
  currentStage: HitlStage;
  completedStages: Set<HitlStage>;
  onStageClick: (stage: HitlStage) => void;
  disabled?: boolean;
}

export function HitlStageStepper({
  currentStage,
  completedStages,
  onStageClick,
  disabled = false,
}: HitlStageStepperProps) {
  const activeIndex = HITL_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-0" role="list" aria-label="HITL review stages">
      {HITL_STAGES.map((stage, index) => {
        const isCompleted = completedStages.has(stage.key);
        const isActive = stage.key === currentStage;
        const isFuture = index > activeIndex && !isCompleted;
        const isClickable = (isCompleted || isActive) && !disabled;

        return (
          <Fragment key={stage.key}>
            {index > 0 && (
              <div
                className={`h-px w-6 transition-colors duration-200 ${
                  isCompleted || index <= activeIndex ? "bg-green-400" : "bg-slate-200"
                }`}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              aria-disabled={!isClickable}
              disabled={!isClickable}
              onClick={() => isClickable && onStageClick(stage.key)}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 ${
                isCompleted
                  ? "cursor-pointer bg-green-100 text-green-800 hover:bg-green-200"
                  : isActive
                    ? "cursor-pointer bg-blue-100 text-blue-800 hover:bg-blue-200"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                disabled ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {isCompleted && <CheckCircle className="h-3.5 w-3.5" />}
              {stage.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
