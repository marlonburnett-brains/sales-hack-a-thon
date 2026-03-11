"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TouchPageShell } from "@/components/touch/touch-page-shell";
import { TouchGuidedStart } from "@/components/touch/touch-guided-start";
import { TouchStageContent } from "@/components/touch/touch-stage-content";
import { TouchGenerationHistory } from "@/components/touch/touch-generation-history";
import { GenerationProgress } from "@/components/touch/generation-progress";
import type { GenerationLogEntry } from "@/components/touch/generation-log-feed";
import {
  TouchContextProvider,
  type TouchContext,
} from "@/components/touch/touch-context-provider";
import type { HitlStage } from "@/components/touch/hitl-stage-stepper";
import { HITL_STAGES } from "@/components/touch/hitl-stage-stepper";
import {
  generateTouch1PagerAction,
  generateTouch2DeckAction,
  generateTouch3DeckAction,
  generateTouch4BriefAction,
  transitionStageAction,
  revertStageAction,
  regenerateStageAction,
  markInteractionFailedAction,
  retryGenerationAction,
} from "@/lib/actions/touch-actions";
import { VisualQADialog } from "@/components/touch/visual-qa-dialog";
import { mapToFriendlyError } from "@/lib/error-messages";

interface InteractionData {
  id: string;
  dealId: string;
  touchType: string;
  status: string;
  inputs: string;
  decision: string | null;
  generatedContent: string | null;
  outputRefs: string | null;
  driveFileId: string | null;
  hitlStage: string | null;
  stageContent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TouchPageClientProps {
  dealId: string;
  touchNumber: number;
  touchType: string;
  touchName: string;
  companyName: string;
  industry: string;
  interactions: InteractionData[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function computeCompletedStages(currentStage: HitlStage | null): Set<HitlStage> {
  const completed = new Set<HitlStage>();
  if (!currentStage) return completed;

  const stageIndex = HITL_STAGES.findIndex((s) => s.key === currentStage);
  for (let i = 0; i < stageIndex; i++) {
    completed.add(HITL_STAGES[i].key);
  }
  return completed;
}

function parseStageContent(stageContentJson: string | null): unknown {
  if (!stageContentJson) return null;
  try {
    return JSON.parse(stageContentJson);
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Drive Status Badge
// ────────────────────────────────────────────────────────────

function DriveStatusBadge({
  driveFileId,
  outputRefs,
  touchType,
}: {
  driveFileId: string | null;
  outputRefs: string | null;
  touchType: string;
}) {
  // Parse outputRefs for Touch 4 multi-artifact display
  const parsedRefs = (() => {
    if (!outputRefs) return null;
    try {
      return JSON.parse(outputRefs);
    } catch {
      return null;
    }
  })();

  if (driveFileId) {
    const driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
          <span>Saved to Drive</span>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-green-700 underline-offset-2 hover:underline cursor-pointer"
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Touch 4: show all 3 artifact links */}
        {touchType === "touch_4" && parsedRefs && typeof parsedRefs === "object" && !Array.isArray(parsedRefs) && (
          <div className="flex flex-wrap gap-2 pl-6">
            {parsedRefs.deckUrl && (
              <a
                href={parsedRefs.deckUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-800 cursor-pointer"
              >
                Proposal Deck
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {parsedRefs.talkTrackUrl && (
              <a
                href={parsedRefs.talkTrackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-800 cursor-pointer"
              >
                Talk Track
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {parsedRefs.faqUrl && (
              <a
                href={parsedRefs.faqUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-800 cursor-pointer"
              >
                Buyer FAQ
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // No driveFileId yet -- show pending state
  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
      <span>Saving to Drive...</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function TouchPageClient({
  dealId,
  touchNumber,
  touchType,
  touchName,
  companyName,
  industry,
  interactions,
}: TouchPageClientProps) {
  const router = useRouter();
  // Active interaction is the most recent one (interactions are sorted desc)
  const activeInteraction = interactions[0] ?? null;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // True while the mount effect is checking whether the workflow is still alive.
  // Prevents flashing the approval screen for a dead workflow.
  const needsWorkflowCheck = activeInteraction?.status === "in_progress" && !!extractRunId(activeInteraction);
  const [isCheckingWorkflow, setIsCheckingWorkflow] = useState(needsWorkflowCheck);
  const [generationMessage, setGenerationMessage] = useState("Generating...");
  const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([]);
  const [showRetryQADialog, setShowRetryQADialog] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (logPollRef.current) {
        clearInterval(logPollRef.current);
        logPollRef.current = null;
      }
    };
  }, []);

  // Derive stage state from active interaction
  const currentStage: HitlStage | null =
    activeInteraction?.hitlStage === "ready"
      ? "highfi" // ready means all stages done, show highfi as completed
      : (activeInteraction?.hitlStage as HitlStage | null) ?? null;

  const isReady = activeInteraction?.hitlStage === "ready";
  const completedStages = computeCompletedStages(currentStage);

  // If ready, all stages are completed
  if (isReady) {
    completedStages.add("skeleton");
    completedStages.add("lowfi");
    completedStages.add("highfi");
  }

  const stageContent = parseStageContent(
    activeInteraction?.stageContent ?? null
  );

  // Current run ID -- extract from inputs or generatedContent
  const runId = extractRunId(activeInteraction);

  // ────────────────────────────────────────────────────────────
  // Polling helper
  // ────────────────────────────────────────────────────────────

  const stopLogPolling = useCallback(() => {
    if (logPollRef.current) {
      clearInterval(logPollRef.current);
      logPollRef.current = null;
    }
  }, []);

  const startLogPolling = useCallback(() => {
    stopLogPolling();
    console.log(`[gen-logs] Starting log poll for dealId=${dealId} touchType=${touchType}`);
    logPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/generation-logs?dealId=${encodeURIComponent(dealId)}&touchType=${encodeURIComponent(touchType)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { logs: GenerationLogEntry[] };
          console.log(`[gen-logs] Polled: ${data.logs?.length ?? 0} logs`);
          if (data.logs && data.logs.length > 0) {
            setGenerationLogs(data.logs);
          }
        } else {
          console.warn(`[gen-logs] Poll failed: ${res.status}`);
        }
      } catch (err) {
        console.warn("[gen-logs] Poll error:", err);
      }
    }, 1500);
  }, [dealId, touchType, stopLogPolling]);

  const startPolling = useCallback(
    (currentRunId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      const checkStatus = getStatusChecker(touchType);
      // Start log polling alongside status polling
      startLogPolling();

      pollRef.current = setInterval(async () => {
        try {
          const status = await checkStatus(currentRunId);

          if (
            status.status === "suspended" ||
            status.status === "completed" ||
            status.status === "success"
          ) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            stopLogPolling();
            setIsGenerating(false);
            setGenerationLogs([]);
            router.refresh();
          }

          if (status.status === "failed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            stopLogPolling();
            setIsGenerating(false);
            setGenerationLogs([]);
            toast.error("Generation failed. Please try again.");
            router.refresh();
          }
        } catch (err) {
          // 404 means the workflow run no longer exists (completed and cleaned up).
          // Stop polling and refresh to show the final state.
          if (err instanceof StatusCheckError && err.httpStatus === 404) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            stopLogPolling();
            setIsGenerating(false);
            setGenerationLogs([]);
            router.refresh();
            return;
          }
          // Continue polling on transient errors (500, network, etc.)
        }
      }, 2000);
    },
    [touchType, router, startLogPolling, stopLogPolling],
  );

  // ────────────────────────────────────────────────────────────
  // Restore generating state on mount/refresh
  // ────────────────────────────────────────────────────────────

  useEffect(() => {
    // If we already know the interaction is not in-progress, skip
    if (!activeInteraction || activeInteraction.status !== "in_progress") {
      setIsCheckingWorkflow(false);
      return;
    }

    const currentRunId = extractRunId(activeInteraction);
    if (!currentRunId) {
      setIsCheckingWorkflow(false);
      return;
    }

    // Check workflow status to see if it's still running
    let cancelled = false;
    const checkStatus = getStatusChecker(touchType);

    checkStatus(currentRunId)
      .then((status) => {
        if (cancelled) return;

        if (
          status.status === "running" ||
          status.status === "waiting" ||
          status.status === "pending"
        ) {
          // Workflow is still running -- restore generating state and resume polling
          setIsGenerating(true);
          setGenerationMessage("Generation in progress...");
          startPolling(currentRunId);
          setIsCheckingWorkflow(false);
        } else if (
          status.status === "suspended"
        ) {
          // Workflow is suspended (waiting for HITL approval).
          // The interaction DB record might be stale -- refresh to get latest hitlStage.
          setIsCheckingWorkflow(false);
          router.refresh();
        } else if (status.status === "failed") {
          // Workflow run died but interaction record is still in_progress.
          // Mark it as failed so the UI shows the recovery screen.
          if (activeInteraction) {
            markInteractionFailedAction(activeInteraction.id)
              .then(() => {
                if (!cancelled) {
                  setIsCheckingWorkflow(false);
                  router.refresh();
                }
              })
              .catch(() => {
                // Best-effort -- refresh anyway so user sees current state
                if (!cancelled) {
                  setIsCheckingWorkflow(false);
                  router.refresh();
                }
              });
          }
        } else {
          // For "completed", "success" -- the server data should already
          // reflect final state, so just let the normal render handle it.
          setIsCheckingWorkflow(false);
        }
      })
      .catch(() => {
        // Transient error -- don't block the UI
        setIsCheckingWorkflow(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationMessage("Starting generation...");
    setGenerationLogs([]);

    try {
      const result = await startGeneration(
        touchType,
        dealId,
        companyName,
        industry
      );

      // If workflow already completed/suspended (Mastra ran synchronously), just refresh
      if (result.status === "suspended" || result.status === "completed" || result.status === "success") {
        setIsGenerating(false);
        router.refresh();
        return;
      }

      if (!result.runId) {
        setIsGenerating(false);
        toast.error("Generation started but no run ID was returned. Please try again.");
        return;
      }
      setGenerationMessage("Generating content...");
      startPolling(result.runId);
    } catch (err) {
      setIsGenerating(false);
      const raw = err instanceof Error ? err.message : "Generation failed";
      toast.error(mapToFriendlyError(raw));
    }
  }, [touchType, dealId, companyName, industry, startPolling]);

  const handleStageApprove = useCallback(async () => {
    if (!activeInteraction || !runId || !currentStage) return;

    setIsApproving(true);
    try {
      // Find the suspend step ID from the workflow status
      const checkStatus = getStatusChecker(touchType);
      const status = await checkStatus(runId);

      // Find the suspended step
      const steps = status.steps ?? {};
      const suspendedStepId = Object.entries(steps).find(
        ([, step]) => (step as Record<string, unknown>).status === "suspended"
      )?.[0];

      if (!suspendedStepId) {
        // If the workflow has failed, mark the interaction and show recovery UI
        if (status.status === "failed" && activeInteraction) {
          await markInteractionFailedAction(activeInteraction.id);
          toast.error("This generation failed due to a transient error. Please start a new generation.");
          router.refresh();
        } else {
          toast.error("No suspended step found to approve");
        }
        setIsApproving(false);
        return;
      }

      const result = await transitionStageAction(
        activeInteraction.id,
        runId,
        suspendedStepId,
        touchType,
        "approved"
      );

      // After approval, workflow continues. Poll for next suspend or completion.
      // Mastra resume returns { message } not a full run result, so always poll.
      if (result.status === "suspended" || result.status === "completed" || result.status === "success") {
        router.refresh();
      } else {
        // Workflow still running (or resume returned { message }), poll for result
        setGenerationMessage("Processing next stage...");
        setIsGenerating(true);
        startPolling(runId);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Approval failed";
      toast.error(mapToFriendlyError(raw));
    } finally {
      setIsApproving(false);
    }
  }, [
    activeInteraction,
    runId,
    currentStage,
    touchType,
    router,
    startPolling,
  ]);

  const handleStageClick = useCallback(
    async (stage: HitlStage) => {
      if (!activeInteraction) return;

      // Only handle back-navigation (clicking a completed stage)
      if (!completedStages.has(stage)) return;
      if (stage === currentStage) return;

      setIsApproving(true);
      try {
        await revertStageAction(activeInteraction.id, stage);
        router.refresh();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Revert failed";
        toast.error(mapToFriendlyError(raw));
      } finally {
        setIsApproving(false);
      }
    },
    [activeInteraction, completedStages, currentStage, router]
  );

  const handleSelectHistoryRun = useCallback(
    (_interactionId: string) => {
      // For now, selecting a history run refreshes the page.
      // A future enhancement could show a read-only view of the old run.
      router.refresh();
    },
    [router]
  );

  const handleRegenerate = useCallback(
    async (feedback?: string, wipeData?: boolean) => {
      if (!activeInteraction) return;

      setIsRegenerating(true);
      try {
        // Re-generate the current stage's content directly (no new workflow).
        // This calls the LLM to regenerate content for the current HITL stage
        // and updates stageContent in place, then refreshes the page.
        await regenerateStageAction(activeInteraction.id, feedback, wipeData);
        setIsRegenerating(false);
        router.refresh();
      } catch (err) {
        setIsRegenerating(false);
        const raw = err instanceof Error ? err.message : "Re-generation failed";
        toast.error(mapToFriendlyError(raw));
      }
    },
    [activeInteraction, router]
  );

  const handleRetryClick = useCallback(() => {
    if (!activeInteraction) return;
    setShowRetryQADialog(true);
  }, [activeInteraction]);

  const handleRetryGeneration = useCallback(async (enableVisualQA: boolean) => {
    setShowRetryQADialog(false);
    if (!activeInteraction) return;

    setIsGenerating(true);
    setGenerationMessage("Retrying generation from where it left off...");
    setGenerationLogs([]);

    try {
      const result = await retryGenerationAction(activeInteraction.id, enableVisualQA);

      if (!result.runId) {
        setIsGenerating(false);
        toast.error("Retry started but no run ID was returned.");
        return;
      }

      setGenerationMessage("Generating deck from approved outline...");
      startPolling(result.runId);
    } catch (err) {
      setIsGenerating(false);
      const raw = err instanceof Error ? err.message : "Retry failed";
      toast.error(mapToFriendlyError(raw));
    }
  }, [activeInteraction, startPolling]);

  // ────────────────────────────────────────────────────────────
  // Touch context for Phase 45 chat bar
  // ────────────────────────────────────────────────────────────

  const touchContext: TouchContext = {
    touchNumber,
    touchType,
    currentStage: currentStage,
    stageContent,
    runId,
    interactionId: activeInteraction?.id ?? null,
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  // Generation in progress
  if (isGenerating) {
    return (
      <TouchContextProvider value={touchContext}>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-slate-900">
            Touch {touchNumber}: {touchName}
          </h1>
          <GenerationProgress message={generationMessage} logs={generationLogs} />
        </div>
      </TouchContextProvider>
    );
  }

  // No interactions: guided start
  if (!activeInteraction) {
    return (
      <TouchContextProvider value={touchContext}>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-slate-900">
            Touch {touchNumber}: {touchName}
          </h1>
          <TouchGuidedStart
            touchNumber={touchNumber}
            touchType={touchType}
            dealId={dealId}
            companyName={companyName}
            industry={industry}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>
      </TouchContextProvider>
    );
  }

  // Active interaction: show HITL workflow
  const historySection = (
    <TouchGenerationHistory
      interactions={interactions}
      currentInteractionId={activeInteraction.id}
      onSelectRun={handleSelectHistoryRun}
    />
  );

  // All stages completed (ready)
  if (isReady) {
    return (
      <TouchContextProvider value={touchContext}>
        <TouchPageShell
          touchNumber={touchNumber}
          touchName={touchName}
          dealId={dealId}
          currentStage={null}
          completedStages={completedStages}
          onStageClick={handleStageClick}
          onStageApprove={handleStageApprove}
          isApproving={isApproving}
          historySection={historySection}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        >
          <div className="space-y-4">
            {/* Drive save status */}
            <DriveStatusBadge
              driveFileId={activeInteraction.driveFileId}
              outputRefs={activeInteraction.outputRefs}
              touchType={touchType}
            />

            {/* Show final content */}
            <TouchStageContent
              touchType={touchType}
              stage="highfi"
              content={stageContent}
            />

            {/* Generate Another button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleGenerate}
                variant="outline"
                className="cursor-pointer gap-2"
                disabled={isGenerating}
              >
                <Plus className="h-4 w-4" />
                Generate Another
              </Button>
            </div>
          </div>
        </TouchPageShell>
      </TouchContextProvider>
    );
  }

  // Still checking whether the workflow is alive — show a brief loading state
  // instead of flashing the error/approval screen for a potentially active workflow.
  if (isCheckingWorkflow) {
    return (
      <TouchContextProvider value={touchContext}>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-slate-900">
            Touch {touchNumber}: {touchName}
          </h1>
          <GenerationProgress message="Checking generation status..." />
        </div>
      </TouchContextProvider>
    );
  }

  // Stale/failed interaction: either hitlStage and stageContent are both null
  // (workflow failed before completing the first step), or the interaction status
  // is explicitly "failed" (workflow died mid-execution, e.g. from a transient DB error).
  const isFailed = activeInteraction.status === "failed";
  // Can retry if the interaction has approved stage data (e.g., outline was approved but deck assembly failed)
  const canRetry = isFailed && activeInteraction.hitlStage === "lowfi" && activeInteraction.stageContent !== null
    && (touchType === "touch_2" || touchType === "touch_3");
  if (isFailed || (!currentStage && !stageContent)) {
    return (
      <TouchContextProvider value={touchContext}>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-slate-900">
            Touch {touchNumber}: {touchName}
          </h1>
          {canRetry ? (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The final deck generation failed, but your approved outline is preserved. You can retry the deck generation without starting over.
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRetryClick}
                  disabled={isGenerating}
                  className="cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    "Retry Deck Generation"
                  )}
                </Button>
                <Button
                  onClick={handleGenerate}
                  variant="outline"
                  disabled={isGenerating}
                  className="cursor-pointer"
                >
                  Start Over
                </Button>
              </div>
              <VisualQADialog
                open={showRetryQADialog}
                onConfirm={handleRetryGeneration}
                onCancel={() => setShowRetryQADialog(false)}
              />
            </>
          ) : (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                A previous generation did not complete. You can start a new generation below.
              </div>
              <TouchGuidedStart
                touchNumber={touchNumber}
                touchType={touchType}
                dealId={dealId}
                companyName={companyName}
                industry={industry}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            </>
          )}
          {interactions.length > 1 && historySection}
        </div>
      </TouchContextProvider>
    );
  }

  // Active stage
  return (
    <TouchContextProvider value={touchContext}>
      <TouchPageShell
        touchNumber={touchNumber}
        touchName={touchName}
        dealId={dealId}
        currentStage={currentStage}
        completedStages={completedStages}
        onStageClick={handleStageClick}
        onStageApprove={handleStageApprove}
        isApproving={isApproving}
        historySection={historySection}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
      >
        {currentStage && stageContent ? (
          <TouchStageContent
            touchType={touchType}
            stage={currentStage}
            content={stageContent}
          />
        ) : (
          <GenerationProgress message="Loading stage content..." />
        )}
      </TouchPageShell>
    </TouchContextProvider>
  );
}

// ────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────

/**
 * Returns a status-checker that uses a client-side fetch (Route Handler)
 * instead of a server action. This prevents polling requests from blocking
 * the Next.js server-action queue, which would otherwise stall client-side
 * navigation while generation polling is active.
 */
class StatusCheckError extends Error {
  httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

function getStatusChecker(touchType: string) {
  return async (runId: string) => {
    const params = new URLSearchParams({ runId, touchType });
    const res = await fetch(`/api/workflows/status?${params}`);
    if (!res.ok) {
      throw new StatusCheckError(`Status check failed: ${res.status}`, res.status);
    }
    return res.json() as Promise<{
      runId: string;
      status: string;
      steps?: Record<string, { status: string; output?: unknown; payload?: unknown }>;
      result?: unknown;
    }>;
  };
}

async function startGeneration(
  touchType: string,
  dealId: string,
  companyName: string,
  industry: string,
  feedback?: string
) {
  switch (touchType) {
    case "touch_1": {
      const baseContext = `Generate a first-contact pager for ${companyName} in ${industry}`;
      return generateTouch1PagerAction(dealId, {
        companyName,
        industry,
        context: feedback
          ? `${baseContext}. User feedback: ${feedback}`
          : baseContext,
      });
    }
    case "touch_2":
      return generateTouch2DeckAction(dealId, {
        companyName,
        industry,
        ...(feedback ? { context: feedback } : {}),
      });
    case "touch_3":
      return generateTouch3DeckAction(dealId, {
        companyName,
        industry,
        capabilityAreas: [],
        ...(feedback ? { context: feedback } : {}),
      });
    case "touch_4":
      return generateTouch4BriefAction(dealId, {
        companyName,
        industry,
        subsector: industry,
        transcript: "",
        ...(feedback ? { additionalNotes: feedback } : {}),
      });
    default:
      throw new Error(`Unknown touch type: ${touchType}`);
  }
}

function extractRunId(interaction: InteractionData | null): string | null {
  if (!interaction) return null;

  // Try to extract runId from inputs
  try {
    const inputs = JSON.parse(interaction.inputs);
    if (inputs.runId) return inputs.runId;
  } catch {
    // inputs may not be valid JSON
  }

  // Try generatedContent
  try {
    if (interaction.generatedContent) {
      const content = JSON.parse(interaction.generatedContent);
      if (content.runId) return content.runId;
    }
  } catch {
    // generatedContent may not be valid JSON
  }

  // Try outputRefs
  try {
    if (interaction.outputRefs) {
      const refs = JSON.parse(interaction.outputRefs);
      if (refs.runId) return refs.runId;
    }
  } catch {
    // outputRefs may not be valid JSON
  }

  return null;
}
