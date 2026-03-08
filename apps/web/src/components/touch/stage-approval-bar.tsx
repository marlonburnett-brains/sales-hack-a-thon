"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HitlStage } from "./hitl-stage-stepper";

interface StageApprovalBarProps {
  stage: HitlStage;
  onApprove: () => void;
  isApproving?: boolean;
  isFinalStage?: boolean;
}

export function StageApprovalBar({
  stage,
  onApprove,
  isApproving = false,
  isFinalStage = false,
}: StageApprovalBarProps) {
  const buttonLabel = isFinalStage ? "Mark as Ready" : "Approve & Continue";

  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between border-t bg-white/95 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs text-slate-500">Refine via chat before approving</p>
      <Button
        onClick={onApprove}
        disabled={isApproving}
        className="min-h-[44px] min-w-[120px] cursor-pointer"
      >
        {isApproving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          buttonLabel
        )}
      </Button>
    </div>
  );
}
