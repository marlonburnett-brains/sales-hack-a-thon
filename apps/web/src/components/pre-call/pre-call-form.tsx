"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PipelineStepper } from "../touch/pipeline-stepper";
import { PRE_CALL_PIPELINE_STEPS } from "../touch/pipeline-steps";
import { mapToFriendlyError } from "@/lib/error-messages";
import { BUYER_PERSONAS } from "@lumenalta/schemas";
import {
  generatePreCallBriefingAction,
  checkPreCallStatusAction,
} from "@/lib/actions/touch-actions";
import { PreCallResults } from "./pre-call-results";

interface PreCallFormProps {
  dealId: string;
  companyName: string;
  industry: string;
}

type FormState = "idle" | "generating" | "complete" | "error";

interface BriefingData {
  companyResearch: {
    companyName: string;
    keyInitiatives: string[];
    recentNews: string[];
    financialHighlights: string[];
    industryPosition: string;
    relevantLumenaltaSolutions: string[];
  };
  hypotheses: {
    buyerRole: string;
    hypotheses: Array<{
      hypothesis: string;
      evidence: string;
      lumenaltaSolution: string;
    }>;
  };
  discoveryQuestions: {
    questions: Array<{
      question: string;
      priority: string;
      rationale: string;
      mappedSolution: string;
    }>;
  };
  caseStudies: Array<{ title: string; content: string }>;
  docUrl: string;
}

export function PreCallForm({
  dealId,
  companyName,
  industry,
}: PreCallFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [buyerRole, setBuyerRole] = useState<string>("General");
  const [meetingContext, setMeetingContext] = useState("");
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pipeline stepper state
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollStatus = useCallback(async (runId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const status = await checkPreCallStatusAction(runId);

        // Derive step progress
        const steps = status.steps ?? {};
        const newCompleted = new Set(completedSteps);
        Object.entries(steps).forEach(([id, step]) => {
          if ((step as Record<string, unknown>).status === "completed")
            newCompleted.add(id);
        });
        setCompletedSteps(newCompleted);

        const active = PRE_CALL_PIPELINE_STEPS.find(
          (s) =>
            !newCompleted.has(s.id) &&
            steps[s.id] &&
            ((steps[s.id] as Record<string, unknown>).status === "running" ||
              (steps[s.id] as Record<string, unknown>).status === "waiting")
        );
        setActiveStep(active?.id ?? null);

        if (status.status === "completed") {
          return status;
        }

        if (status.status === "failed") {
          throw new Error("Briefing generation failed");
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          throw err;
        }
      }
    }

    throw new Error("Briefing generation timed out");
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setState("generating");

    try {
      const result = await generatePreCallBriefingAction(dealId, {
        companyName,
        industry,
        buyerRole,
        meetingContext,
      });

      const completed = await pollStatus(result.runId);

      // Extract briefing data from workflow result
      // The workflow's final step (recordInteraction) outputs the full data
      const steps = completed.steps ?? {};
      const recordStep = steps["record-interaction"];
      const buildDocStep = steps["build-briefing-doc"];

      // Extract briefing data from workflow step outputs
      let companyResearch = null;
      let hypotheses = null;
      let discoveryQuestions = null;
      let caseStudies: Array<{ title: string; content: string }> = [];
      let docUrl = "";

      // Extract docUrl from record-interaction step output
      // record-interaction output has: { interactionId, docUrl, documentId }
      if (recordStep?.output) {
        const output = recordStep.output as Record<string, unknown>;
        if (output.docUrl) {
          docUrl = output.docUrl as string;
        }
      }

      // Fallback: extract from individual steps
      if (!companyResearch) {
        const researchStep = steps["research-company"];
        if (researchStep?.output) {
          const out = researchStep.output as Record<string, unknown>;
          const raw = out.companyResearch as string | undefined;
          if (raw) {
            try {
              companyResearch = JSON.parse(raw) as BriefingData["companyResearch"];
            } catch {
              // ignore
            }
          }
        }
      }

      if (!hypotheses) {
        const hypStep = steps["generate-hypotheses"];
        if (hypStep?.output) {
          const out = hypStep.output as Record<string, unknown>;
          const raw = out.hypotheses as string | undefined;
          if (raw) {
            try {
              hypotheses = JSON.parse(raw) as BriefingData["hypotheses"];
            } catch {
              // ignore
            }
          }
        }
      }

      if (!discoveryQuestions) {
        const qStep = steps["generate-discovery-questions"];
        if (qStep?.output) {
          const out = qStep.output as Record<string, unknown>;
          const raw = out.discoveryQuestions as string | undefined;
          if (raw) {
            try {
              discoveryQuestions = JSON.parse(raw) as BriefingData["discoveryQuestions"];
            } catch {
              // ignore
            }
          }
        }
      }

      if (!docUrl && buildDocStep?.output) {
        const out = buildDocStep.output as Record<string, unknown>;
        docUrl = (out.docUrl as string) ?? "";
      }

      if (!companyResearch || !hypotheses || !discoveryQuestions) {
        throw new Error("Could not extract briefing data from workflow result");
      }

      setBriefingData({
        companyResearch,
        hypotheses,
        discoveryQuestions,
        caseStudies,
        docUrl,
      });
      setState("complete");
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Briefing generation failed";
      const friendly = mapToFriendlyError(raw);
      toast.error(friendly);
      setError(friendly);
      setErrorStep(activeStep);
      setErrorMessage(friendly);
      setState("error");
    }
  };

  // Generating state
  if (state === "generating") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preparing Briefing</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineStepper
            steps={PRE_CALL_PIPELINE_STEPS}
            completedStepIds={completedSteps}
            activeStepId={activeStep}
            errorStepId={errorStep}
            errorMessage={errorMessage}
          />
        </CardContent>
      </Card>
    );
  }

  // Complete state
  if (state === "complete" && briefingData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Briefing Results
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setState("idle");
              setBriefingData(null);
              setMeetingContext("");
            }}
            className="cursor-pointer text-xs"
          >
            New Briefing
          </Button>
        </div>
        <PreCallResults {...briefingData} />
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preparing Briefing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PipelineStepper
            steps={PRE_CALL_PIPELINE_STEPS}
            completedStepIds={completedSteps}
            activeStepId={activeStep}
            errorStepId={errorStep}
            errorMessage={errorMessage}
          />
          <Button
            variant="outline"
            onClick={() => {
              setCompletedSteps(new Set());
              setActiveStep(null);
              setErrorStep(null);
              setErrorMessage(null);
              setError(null);
              setState("idle");
            }}
            className="w-full cursor-pointer"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Idle state - Form
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New Pre-Call Briefing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Read-only company info */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-slate-500">Company</div>
          <div className="font-medium">{companyName}</div>
          <div className="text-slate-500">Industry</div>
          <div className="font-medium">{industry}</div>
        </div>

        {/* Buyer Role Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="buyer-role">Buyer Role</Label>
          <Select value={buyerRole} onValueChange={setBuyerRole}>
            <SelectTrigger id="buyer-role" className="cursor-pointer">
              <SelectValue placeholder="Select buyer role" />
            </SelectTrigger>
            <SelectContent>
              {BUYER_PERSONAS.map((persona) => (
                <SelectItem
                  key={persona}
                  value={persona}
                  className="cursor-pointer"
                >
                  {persona}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Meeting Context */}
        <div className="space-y-2">
          <Label htmlFor="meeting-context">Meeting Context</Label>
          <Textarea
            id="meeting-context"
            value={meetingContext}
            onChange={(e) => setMeetingContext(e.target.value)}
            placeholder="Describe the meeting agenda, goals, previous conversations, or any concerns..."
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!meetingContext.trim()}
          className="w-full cursor-pointer gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generate Briefing
        </Button>
      </CardContent>
    </Card>
  );
}
