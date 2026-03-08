"use client";

import type { ReactNode } from "react";
import { Columns2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  HitlStageStepper,
  type HitlStage,
} from "./hitl-stage-stepper";
import { StageApprovalBar } from "./stage-approval-bar";
import { useTouchPreferences } from "@/lib/hooks/use-touch-preferences";

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
}: TouchPageShellProps) {
  const { layoutMode, updateLayoutMode } = useTouchPreferences();

  const isFinalStage = currentStage === "highfi";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          Touch {touchNumber}: {touchName}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateLayoutMode(layoutMode === "full" ? "split" : "full")
          }
          className="cursor-pointer gap-1.5 text-xs"
          aria-label={
            layoutMode === "full"
              ? "Switch to split layout"
              : "Switch to full-width layout"
          }
        >
          {layoutMode === "full" ? (
            <>
              <Columns2 className="h-3.5 w-3.5" />
              Split
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5" />
              Full Width
            </>
          )}
        </Button>
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
      <div
        className={
          layoutMode === "split"
            ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
            : ""
        }
      >
        <div className="min-w-0 space-y-4">
          {children}

          {/* Approval bar when a stage is active */}
          {currentStage && (
            <StageApprovalBar
              stage={currentStage}
              onApprove={onStageApprove}
              isApproving={isApproving}
              isFinalStage={isFinalStage}
            />
          )}
        </div>

        {/* Right panel placeholder for Phase 45 chat bar in split mode */}
        {layoutMode === "split" && (
          <div className="hidden lg:block">
            {/* Phase 45 chat bar renders here */}
          </div>
        )}
      </div>

      {/* History section */}
      {historySection}
    </div>
  );
}
