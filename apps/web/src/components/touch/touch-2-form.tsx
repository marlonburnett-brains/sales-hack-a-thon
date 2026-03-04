"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, Loader2 } from "lucide-react";
import { GenerationProgress } from "./generation-progress";
import { DeckPreview } from "./deck-preview";
import {
  generateTouch2DeckAction,
  checkTouch2StatusAction,
} from "@/lib/actions/touch-actions";
import { getInteractions } from "@/lib/api-client";
import type { InteractionRecord } from "@/lib/api-client";

interface Touch2FormProps {
  dealId: string;
  companyName: string;
  industry: string;
  salespersonName?: string;
  onClose: () => void;
}

type FormState = "input" | "generating" | "result";

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

  // Poll workflow status until completion
  const pollStatus = useCallback(async (runId: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const status = await checkTouch2StatusAction(runId);

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
  }, []);

  // Gather prior touch outputs for cross-touch context
  const getPriorTouchOutputs = async (): Promise<string[]> => {
    try {
      const interactions: InteractionRecord[] = await getInteractions(dealId);
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

  const handleGenerate = async () => {
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
      });

      const pollResult = await pollStatus(result.runId);
      setResultData(pollResult);
      setState("result");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setState("input");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = () => {
    setResultData(null);
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
            onClick={handleGenerate}
            disabled={isSubmitting}
            className="w-full cursor-pointer gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Intro Deck
          </Button>
        </div>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message="Selecting slides and assembling intro deck..." />
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
