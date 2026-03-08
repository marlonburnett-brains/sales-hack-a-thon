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
import {
  TouchContextProvider,
  type TouchContext,
} from "@/components/touch/touch-context-provider";
import { useTouchPreferences } from "@/lib/hooks/use-touch-preferences";
import type { HitlStage } from "@/components/touch/hitl-stage-stepper";
import { HITL_STAGES } from "@/components/touch/hitl-stage-stepper";
import {
  generateTouch1PagerAction,
  checkTouch1StatusAction,
  generateTouch2DeckAction,
  checkTouch2StatusAction,
  generateTouch3DeckAction,
  checkTouch3StatusAction,
  generateTouch4BriefAction,
  checkTouch4StatusAction,
  transitionStageAction,
  revertStageAction,
} from "@/lib/actions/touch-actions";
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
  const { displayMode } = useTouchPreferences();

  // Active interaction is the most recent one (interactions are sorted desc)
  const activeInteraction = interactions[0] ?? null;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("Generating...");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
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

  const startPolling = useCallback(
    (currentRunId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      const checkStatus = getStatusChecker(touchType);

      pollRef.current = setInterval(async () => {
        try {
          const status = await checkStatus(currentRunId);

          if (
            status.status === "suspended" ||
            status.status === "completed"
          ) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setIsGenerating(false);
            router.refresh();
          }

          if (status.status === "failed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setIsGenerating(false);
            toast.error("Generation failed. Please try again.");
          }
        } catch {
          // Continue polling on transient errors
        }
      }, 2000);
    },
    [touchType, router]
  );

  // ────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationMessage("Starting generation...");

    try {
      const result = await startGeneration(
        touchType,
        dealId,
        companyName,
        industry
      );

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
        toast.error("No suspended step found to approve");
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
      if (result.status === "suspended" || result.status === "completed") {
        router.refresh();
      } else {
        // Workflow still running, poll for result
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
          <GenerationProgress message={generationMessage} />
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
              displayMode={displayMode}
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
      >
        {currentStage && stageContent ? (
          <TouchStageContent
            touchType={touchType}
            stage={currentStage}
            content={stageContent}
            displayMode={displayMode}
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

function getStatusChecker(touchType: string) {
  switch (touchType) {
    case "touch_1":
      return checkTouch1StatusAction;
    case "touch_2":
      return checkTouch2StatusAction;
    case "touch_3":
      return checkTouch3StatusAction;
    case "touch_4":
      return checkTouch4StatusAction;
    default:
      return checkTouch1StatusAction;
  }
}

async function startGeneration(
  touchType: string,
  dealId: string,
  companyName: string,
  industry: string
) {
  switch (touchType) {
    case "touch_1":
      return generateTouch1PagerAction(dealId, {
        companyName,
        industry,
        context: `Generate a first-contact pager for ${companyName} in ${industry}`,
      });
    case "touch_2":
      return generateTouch2DeckAction(dealId, {
        companyName,
        industry,
      });
    case "touch_3":
      return generateTouch3DeckAction(dealId, {
        companyName,
        industry,
        capabilityAreas: [],
      });
    case "touch_4":
      return generateTouch4BriefAction(dealId, {
        companyName,
        industry,
        subsector: industry,
        transcript: "",
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
