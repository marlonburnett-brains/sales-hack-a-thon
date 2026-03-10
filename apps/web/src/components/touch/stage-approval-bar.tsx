"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { HitlStage } from "./hitl-stage-stepper";

interface StageApprovalBarProps {
  stage: HitlStage;
  onApprove: () => void;
  isApproving?: boolean;
  isFinalStage?: boolean;
  onRegenerate?: (feedback?: string, wipeData?: boolean) => void;
  isRegenerating?: boolean;
}

export function StageApprovalBar({
  stage,
  onApprove,
  isApproving = false,
  isFinalStage = false,
  onRegenerate,
  isRegenerating = false,
}: StageApprovalBarProps) {
  const buttonLabel = isFinalStage ? "Mark as Ready" : "Approve & Continue";
  const [feedbackText, setFeedbackText] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [wipeData, setWipeData] = useState(false);

  const handleSkip = () => {
    setPopoverOpen(false);
    setFeedbackText("");
    onRegenerate?.(undefined, wipeData);
    setWipeData(false);
  };

  const handleSubmitFeedback = () => {
    setPopoverOpen(false);
    const text = feedbackText.trim();
    setFeedbackText("");
    onRegenerate?.(text || undefined, wipeData);
    setWipeData(false);
  };

  const handleRegenerateClick = () => {
    setShowWipeDialog(true);
  };

  const handleWipeAndRegenerate = () => {
    setShowWipeDialog(false);
    setWipeData(true);
    setPopoverOpen(true);
  };

  const handleJustRegenerate = () => {
    setShowWipeDialog(false);
    setWipeData(false);
    setPopoverOpen(true);
  };

  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between border-t bg-white/95 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs text-slate-500">Refine via chat before approving</p>
      <div className="flex items-center gap-2">
        {onRegenerate && (
          <>
            {/* Wipe confirmation dialog */}
            <AlertDialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start fresh?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Would you like to wipe all previous data for this step and
                    start from scratch, or just re-generate the current stage?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleJustRegenerate}
                    className={buttonVariants({ variant: "outline" }) + " cursor-pointer"}
                  >
                    Just Re-generate
                  </AlertDialogAction>
                  <AlertDialogAction
                    onClick={handleWipeAndRegenerate}
                    className={buttonVariants({ variant: "destructive" }) + " cursor-pointer"}
                  >
                    Wipe &amp; Re-generate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Re-generate button opens wipe dialog first */}
            <Button
              variant="outline"
              disabled={isRegenerating || isApproving}
              className="min-h-[44px] cursor-pointer gap-2"
              onClick={handleRegenerateClick}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Re-generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Re-generate
                </>
              )}
            </Button>

            {/* Feedback popover (opens after wipe dialog choice) */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <span />
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">
                    Add feedback (optional)
                  </label>
                  <Textarea
                    placeholder="e.g. Make the headline more aggressive, focus on cost savings..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      className="cursor-pointer"
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitFeedback}
                      className="cursor-pointer"
                    >
                      Re-generate
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
        <Button
          onClick={onApprove}
          disabled={isApproving || isRegenerating}
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
    </div>
  );
}
