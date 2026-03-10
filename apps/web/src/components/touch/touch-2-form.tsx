"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { VisualQADialog } from "./visual-qa-dialog";
import { PipelineStepper } from "./pipeline-stepper";
import { GenerationLogFeed, type GenerationLogEntry } from "./generation-log-feed";
import { TOUCH_2_PIPELINE_STEPS } from "./pipeline-steps";
import { mapToFriendlyError } from "@/lib/error-messages";
import { DeckPreview } from "./deck-preview";
import {
  generateTouch2DeckAction,
  checkTouch2StatusAction,
} from "@/lib/actions/touch-actions";
import { getInteractionsAction } from "@/lib/actions/deal-actions";
import type { InteractionRecord } from "@/lib/api-client";

interface Touch2FormProps {
  dealId: string;
  companyName: string;
  industry: string;
  salespersonName?: string;
  onClose: () => void;
}

type FormState = "input" | "generating" | "error" | "result";

export function Touch2Form({
  dealId,
  companyName,
  industry,
  salespersonName: initialSalespersonName,
  onClose,
}: Touch2FormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("input");
  const [salespersonName, setSalespersonName] = useState(
    initialSalespersonName ?? ""
  );
  const [salespersonPhotoUrl, setSalespersonPhotoUrl] = useState("");
  const [customerLogoUrl, setCustomerLogoUrl] = useState("");
  const [context, setContext] = useState("");
  const [resultData, setResultData] = useState<{
    presentationId: string;
    driveUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visual QA dialog state
  const [showQADialog, setShowQADialog] = useState(false);

  // Pipeline stepper state
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([]);
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up log polling on unmount
  useEffect(() => {
    return () => {
      if (logPollRef.current) {
        clearInterval(logPollRef.current);
        logPollRef.current = null;
      }
    };
  }, []);

  const startLogPolling = useCallback(() => {
    if (logPollRef.current) clearInterval(logPollRef.current);
    logPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/generation-logs?dealId=${encodeURIComponent(dealId)}&touchType=touch_2`,
        );
        if (res.ok) {
          const data = (await res.json()) as { logs: GenerationLogEntry[] };
          if (data.logs && data.logs.length > 0) {
            setGenerationLogs(data.logs);
          }
        }
      } catch {
        // Non-critical
      }
    }, 1500);
  }, [dealId]);

  const stopLogPolling = useCallback(() => {
    if (logPollRef.current) {
      clearInterval(logPollRef.current);
      logPollRef.current = null;
    }
    setGenerationLogs([]);
  }, []);

  // Poll workflow status until completion
  const pollStatus = useCallback(async (runId: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    // Start real-time log polling alongside status polling
    startLogPolling();

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const status = await checkTouch2StatusAction(runId);

        // Derive step progress
        const steps = status.steps ?? {};
        const newCompleted = new Set(completedSteps);
        Object.entries(steps).forEach(([id, step]) => {
          if ((step as Record<string, unknown>).status === "completed")
            newCompleted.add(id);
        });
        setCompletedSteps(newCompleted);

        const active = TOUCH_2_PIPELINE_STEPS.find(
          (s) =>
            !newCompleted.has(s.id) &&
            steps[s.id] &&
            ((steps[s.id] as Record<string, unknown>).status === "running" ||
              (steps[s.id] as Record<string, unknown>).status === "waiting")
        );
        setActiveStep(active?.id ?? null);

        if (status.status === "completed") {
          // Extract result from record-interaction step
          const steps = status.steps ?? {};
          const recordStep = steps["record-interaction"];
          if (recordStep?.output) {
            const output = recordStep.output as Record<string, unknown>;
            return {
              presentationId: output.presentationId as string,
              driveUrl: output.driveUrl as string,
            };
          }
          // Try top-level result
          if (status.result) {
            const result = status.result as Record<string, unknown>;
            return {
              presentationId: result.presentationId as string,
              driveUrl: result.driveUrl as string,
            };
          }
          throw new Error("Workflow completed but no result found");
        }

        if (status.status === "failed") {
          throw new Error("Workflow failed");
        }
      } catch (err) {
        if (attempts >= maxAttempts) throw err;
      }
    }

    throw new Error("Polling timeout - workflow did not complete in time");
  }, [startLogPolling]);

  // Gather prior touch outputs for cross-touch context
  const getPriorTouchOutputs = async (): Promise<string[]> => {
    try {
      const interactions: InteractionRecord[] = await getInteractionsAction(dealId);
      return interactions
        .filter(
          (i) =>
            i.outputRefs &&
            (i.status === "approved" ||
              i.status === "edited" ||
              i.status === "overridden")
        )
        .map((i) => {
          const inputs = JSON.parse(i.inputs ?? "{}");
          const refs = JSON.parse(i.outputRefs ?? "[]");
          return `${i.touchType}: ${inputs.companyName ?? ""} (${inputs.industry ?? ""}) -> ${refs[0] ?? "no output"}`;
        });
    } catch {
      return [];
    }
  };

  const handleGenerateClick = () => {
    setShowQADialog(true);
  };

  const handleGenerate = async (enableVisualQA: boolean) => {
    setShowQADialog(false);
    setError(null);
    setIsSubmitting(true);
    setState("generating");

    try {
      const priorOutputs = await getPriorTouchOutputs();

      const result = await generateTouch2DeckAction(dealId, {
        companyName,
        industry,
        salespersonName: salespersonName || undefined,
        salespersonPhotoUrl: salespersonPhotoUrl || undefined,
        customerName: companyName,
        customerLogoUrl: customerLogoUrl || undefined,
        context: context || undefined,
        priorTouchOutputs: priorOutputs.length > 0 ? priorOutputs : undefined,
        enableVisualQA,
      });

      const pollResult = await pollStatus(result.runId);
      setResultData(pollResult);
      setState("result");
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Generation failed";
      const friendly = mapToFriendlyError(raw);
      toast.error(friendly);
      setErrorStep(activeStep);
      setErrorMessage(friendly);
      setState("error");
    } finally {
      setIsSubmitting(false);
      stopLogPolling();
    }
  };

  const handleRegenerate = () => {
    setResultData(null);
    setCompletedSteps(new Set());
    setActiveStep(null);
    setErrorStep(null);
    setErrorMessage(null);
    setError(null);
    setGenerationLogs([]);
    setState("input");
  };

  // ────────────────────────────────────────────────────────────
  // Render states
  // ────────────────────────────────────────────────────────────

  if (state === "input") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Generate Meet Lumenalta Deck
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-500">Company</div>
            <div className="font-medium">{companyName}</div>
            <div className="text-slate-500">Industry</div>
            <div className="font-medium">{industry}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="touch2-salesperson">Salesperson Name</Label>
            <Input
              id="touch2-salesperson"
              value={salespersonName}
              onChange={(e) => setSalespersonName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="touch2-photo">
              Salesperson Photo URL{" "}
              <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="touch2-photo"
              value={salespersonPhotoUrl}
              onChange={(e) => setSalespersonPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="touch2-logo">
              Customer Logo URL{" "}
              <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="touch2-logo"
              value={customerLogoUrl}
              onChange={(e) => setCustomerLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="touch2-context">
              Additional Context{" "}
              <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="touch2-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Focus on data engineering capabilities for financial services..."
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            onClick={handleGenerateClick}
            disabled={isSubmitting}
            className="w-full cursor-pointer gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Intro Deck
          </Button>

          <VisualQADialog
            open={showQADialog}
            onConfirm={handleGenerate}
            onCancel={() => setShowQADialog(false)}
          />
        </div>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <h3 className="text-sm font-medium text-slate-700">
          Generating Intro Deck
        </h3>
        <PipelineStepper
          steps={TOUCH_2_PIPELINE_STEPS}
          completedStepIds={completedSteps}
          activeStepId={activeStep}
          errorStepId={errorStep}
          errorMessage={errorMessage}
        />
        <GenerationLogFeed logs={generationLogs} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <h3 className="text-sm font-medium text-slate-700">
          Generating Intro Deck
        </h3>
        <PipelineStepper
          steps={TOUCH_2_PIPELINE_STEPS}
          completedStepIds={completedSteps}
          activeStepId={activeStep}
          errorStepId={errorStep}
          errorMessage={errorMessage}
        />
        <GenerationLogFeed logs={generationLogs} />
        <Button
          onClick={handleRegenerate}
          variant="outline"
          className="w-full cursor-pointer gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  if (state === "result" && resultData) {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Generated Intro Deck
          </h3>
          <Badge className="bg-green-600">Complete</Badge>
        </div>

        <DeckPreview presentationId={resultData.presentationId} />

        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            className="flex-1 cursor-pointer gap-2"
          >
            <a
              href={resultData.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Google Slides
            </a>
          </Button>
          <Button
            onClick={handleRegenerate}
            variant="outline"
            className="cursor-pointer"
          >
            Regenerate
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="cursor-pointer"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
