"use client";

import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import {
  HitlStageStepper,
  type HitlStage,
} from "./hitl-stage-stepper";
import { StageApprovalBar } from "./stage-approval-bar";

interface TouchPageShellProps {
  touchNumber: number;
  touchName: string;
  dealId: string;
  children: ReactNode;
  currentStage: HitlStage | null;
  completedStages: Set<HitlStage>;
  onStageClick: (stage: HitlStage) => void;
  onStageApprove: () => void;
  isApproving?: boolean;
  historySection?: ReactNode;
  onRegenerate?: (feedback?: string) => void;
  isRegenerating?: boolean;
}

export function TouchPageShell({
  touchNumber,
  touchName,
  children,
  currentStage,
  completedStages,
  onStageClick,
  onStageApprove,
  isApproving = false,
  historySection,
  onRegenerate,
  isRegenerating = false,
}: TouchPageShellProps) {
  const isFinalStage = currentStage === "highfi";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          Touch {touchNumber}: {touchName}
        </h1>
      </div>

      {/* Stage stepper */}
      {currentStage && (
        <>
          <HitlStageStepper
            currentStage={currentStage}
            completedStages={completedStages}
            onStageClick={onStageClick}
            disabled={isApproving}
          />
          <Separator />
        </>
      )}

      {/* Main content area */}
      <div className="min-w-0 space-y-4">
        {children}

        {/* Approval bar when a stage is active */}
        {currentStage && (
          <StageApprovalBar
            stage={currentStage}
            onApprove={onStageApprove}
            isApproving={isApproving}
            isFinalStage={isFinalStage}
            onRegenerate={onRegenerate}
            isRegenerating={isRegenerating}
          />
        )}
      </div>

      {/* History section */}
      {historySection}
    </div>
  );
}
