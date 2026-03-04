"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, X, Loader2, XCircle } from "lucide-react";
import { GenerationProgress } from "./generation-progress";
import { DeckPreview } from "./deck-preview";
import {
  generateTouch3DeckAction,
  checkTouch3StatusAction,
} from "@/lib/actions/touch-actions";
import { getInteractions } from "@/lib/api-client";
import type { InteractionRecord } from "@/lib/api-client";

interface Touch3FormProps {
  dealId: string;
  companyName: string;
  industry: string;
  onClose: () => void;
}

type FormState = "input" | "generating" | "result";

/** Lumenalta capability areas for Touch 3 deck generation */
const CAPABILITY_AREAS = [
  "Data Engineering",
  "Cloud Migration",
  "AI/ML",
  "Digital Transformation",
  "Product Development",
  "DevOps",
  "Analytics",
  "Cybersecurity",
  "IoT",
  "Blockchain",
] as const;

export function Touch3Form({
  dealId,
  companyName,
  industry,
  onClose,
}: Touch3FormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("input");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(
    []
  );
  const [context, setContext] = useState("");
  const [resultData, setResultData] = useState<{
    presentationId: string;
    driveUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCapability = (cap: string) => {
    setSelectedCapabilities((prev) => {
      if (prev.includes(cap)) {
        return prev.filter((c) => c !== cap);
      }
      // Max 2 selections
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, cap];
    });
  };

  const removeCapability = (cap: string) => {
    setSelectedCapabilities((prev) => prev.filter((c) => c !== cap));
  };

  // Poll workflow status until completion
  const pollStatus = useCallback(async (runId: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      try {
        const status = await checkTouch3StatusAction(runId);

        if (status.status === "completed") {
          const steps = status.steps ?? {};
          const recordStep = steps["record-interaction"];
          if (recordStep?.output) {
            const output = recordStep.output as Record<string, unknown>;
            return {
              presentationId: output.presentationId as string,
              driveUrl: output.driveUrl as string,
            };
          }
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
    if (selectedCapabilities.length === 0) return;
    setError(null);
    setIsSubmitting(true);
    setState("generating");

    try {
      const priorOutputs = await getPriorTouchOutputs();

      const result = await generateTouch3DeckAction(dealId, {
        companyName,
        industry,
        capabilityAreas: selectedCapabilities,
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
            Generate Capability Alignment Deck
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
            <Label>
              Capability Areas{" "}
              <span className="text-slate-400">(select 1-2)</span>
            </Label>

            {/* Selected capabilities as removable chips */}
            {selectedCapabilities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCapabilities.map((cap) => (
                  <Badge
                    key={cap}
                    variant="default"
                    className="cursor-pointer gap-1 bg-purple-600 hover:bg-purple-700"
                    onClick={() => removeCapability(cap)}
                  >
                    {cap}
                    <XCircle className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Capability options grid */}
            <div className="grid grid-cols-2 gap-2">
              {CAPABILITY_AREAS.map((cap) => {
                const isSelected = selectedCapabilities.includes(cap);
                const isDisabled =
                  !isSelected && selectedCapabilities.length >= 2;
                return (
                  <Button
                    key={cap}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCapability(cap)}
                    disabled={isDisabled}
                    className={`cursor-pointer text-xs ${
                      isSelected
                        ? "bg-purple-600 hover:bg-purple-700"
                        : isDisabled
                          ? "opacity-50"
                          : ""
                    }`}
                  >
                    {cap}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="touch3-context">
              Additional Context{" "}
              <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="touch3-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Focus on enterprise-scale implementations in healthcare..."
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            onClick={handleGenerate}
            disabled={selectedCapabilities.length === 0 || isSubmitting}
            className="w-full cursor-pointer gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Capability Deck
          </Button>
        </div>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message="Selecting capability slides and assembling deck..." />
      </div>
    );
  }

  if (state === "result" && resultData) {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Generated Capability Deck
          </h3>
          <Badge className="bg-purple-600">Complete</Badge>
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
