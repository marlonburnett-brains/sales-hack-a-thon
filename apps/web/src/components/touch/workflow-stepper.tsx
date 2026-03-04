"use client";

import { Fragment } from "react";
import { CheckCircle } from "lucide-react";

const STAGES = [
  { key: "transcript", label: "Transcript" },
  { key: "brief", label: "Brief" },
  { key: "approved", label: "Approved" },
  { key: "assets", label: "Assets" },
  { key: "delivered", label: "Delivered" },
] as const;

const STATUS_TO_STAGE: Record<string, string> = {
  pending: "transcript",
  generating: "transcript",
  pending_approval: "brief",
  pending_review: "brief",
  changes_requested: "brief",
  approved: "approved",
  pending_asset_review: "assets",
  delivered: "delivered",
};

export function WorkflowStepper({ status }: { status: string }) {
  const activeStageKey = STATUS_TO_STAGE[status] ?? "transcript";
  const activeIndex = STAGES.findIndex((s) => s.key === activeStageKey);

  return (
    <div className="flex items-center gap-0" role="list" aria-label="Workflow stages">
      {STAGES.map((stage, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <Fragment key={stage.key}>
            {index > 0 && (
              <div
                className={`h-px w-4 ${isCompleted ? "bg-green-400" : "bg-slate-200"}`}
                aria-hidden="true"
              />
            )}
            <div
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCompleted
                  ? "bg-green-100 text-green-800"
                  : isActive
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {isCompleted && <CheckCircle className="h-3 w-3" />}
              {stage.label}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
