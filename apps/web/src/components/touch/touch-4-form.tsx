"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2, CheckCircle } from "lucide-react";
import { GenerationProgress } from "./generation-progress";
import { FieldReview } from "./field-review";
import {
  generateTouch4BriefAction,
  checkTouch4StatusAction,
  resumeTouch4FieldReviewAction,
} from "@/lib/actions/touch-actions";
import { INDUSTRIES, SUBSECTORS } from "@lumenalta/schemas";

interface Touch4FormProps {
  dealId: string;
  companyName: string;
  industry: string;
  onClose: () => void;
}

type FormState =
  | "input"
  | "extracting"
  | "fieldReview"
  | "generating"
  | "briefResult";

interface TranscriptFields {
  customerContext: string;
  businessOutcomes: string;
  constraints: string;
  stakeholders: string;
  timeline: string;
  budget: string;
}

export function Touch4Form({
  dealId,
  companyName,
  industry,
  onClose,
}: Touch4FormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("input");
  const [selectedIndustry, setSelectedIndustry] = useState<string>(industry);
  const [selectedSubsector, setSelectedSubsector] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] =
    useState<TranscriptFields | null>(null);
  const [fieldSeverity, setFieldSeverity] = useState<Record<
    string,
    string
  > | null>(null);
  const [hasErrors, setHasErrors] = useState(false);
  const [progressMessage, setProgressMessage] = useState(
    "Extracting fields from transcript..."
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableSubsectors = selectedIndustry
    ? SUBSECTORS[selectedIndustry] ?? []
    : [];

  const handleIndustryChange = (value: string) => {
    setSelectedIndustry(value);
    setSelectedSubsector("");
  };

  // Poll workflow status until a target condition is met
  const pollStatus = useCallback(
    async (
      currentRunId: string,
      targetStatuses: string[],
      pollMessage: string
    ) => {
      setProgressMessage(pollMessage);
      const maxAttempts = 120;
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;

        try {
          const status = await checkTouch4StatusAction(currentRunId);

          // Check if workflow is suspended (awaiting field review)
          if (
            status.status === "suspended" &&
            targetStatuses.includes("suspended")
          ) {
            const steps = status.steps ?? {};
            const reviewStep = steps["await-field-review"];
            if (reviewStep?.payload) {
              const payload = reviewStep.payload as Record<string, unknown>;
              return {
                status: "suspended" as const,
                extractedFields: payload.extractedFields as TranscriptFields,
                fieldSeverity: payload.fieldSeverity as Record<string, string>,
                hasErrors: payload.hasErrors as boolean,
                stepId: "await-field-review",
              };
            }
            return { status: "suspended" as const };
          }

          // Check if completed
          if (
            targetStatuses.includes(status.status) ||
            status.status === "completed"
          ) {
            const steps = status.steps ?? {};
            const recordStep = steps["record-interaction"];
            if (recordStep?.output) {
              const output = recordStep.output as Record<string, unknown>;
              return {
                status: "completed" as const,
                result: {
                  interactionId: output.interactionId as string,
                  briefId: output.briefId as string,
                  transcriptId: output.transcriptId as string,
                },
              };
            }
            if (status.result) {
              return {
                status: "completed" as const,
                result: status.result as Record<string, unknown>,
              };
            }
            return { status: status.status };
          }

          // Check for failure
          if (status.status === "failed") {
            throw new Error("Workflow failed");
          }
        } catch (err) {
          if (attempts >= maxAttempts) {
            throw err;
          }
          // Continue polling on transient errors
        }
      }

      throw new Error("Polling timeout - workflow did not complete in time");
    },
    []
  );

  // Step 1: Submit form -> extract fields from transcript
  const handleProcessTranscript = async () => {
    if (!transcript.trim() || !selectedSubsector) return;
    setError(null);
    setIsSubmitting(true);
    setState("extracting");

    try {
      const result = await generateTouch4BriefAction(dealId, {
        companyName,
        industry: selectedIndustry,
        subsector: selectedSubsector,
        transcript,
        additionalNotes: additionalNotes || undefined,
      });

      setRunId(result.runId);

      // Poll until workflow suspends for field review
      const pollResult = await pollStatus(
        result.runId,
        ["suspended"],
        "Extracting fields from transcript..."
      );

      if (pollResult.status === "suspended" && pollResult.extractedFields) {
        setExtractedFields(pollResult.extractedFields);
        if (pollResult.fieldSeverity) {
          setFieldSeverity(pollResult.fieldSeverity);
        }
        if (pollResult.hasErrors !== undefined) {
          setHasErrors(pollResult.hasErrors as boolean);
        }
        setState("fieldReview");
      } else {
        throw new Error(
          "Expected field extraction but got unexpected state"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setState("input");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Continue from field review -> generate brief
  const handleContinueFromReview = async (reviewedFields: TranscriptFields) => {
    if (!runId) return;
    setError(null);
    setState("generating");

    try {
      // Resume workflow with seller-reviewed fields
      const result = await resumeTouch4FieldReviewAction(
        runId,
        "await-field-review",
        reviewedFields
      );

      // If already completed
      if (result.status === "completed") {
        setState("briefResult");
        router.refresh();
        return;
      }

      // Poll for completion with step-by-step messages
      setProgressMessage("Mapping solution pillars...");
      const pollResult = await pollStatus(
        runId,
        ["completed"],
        "Generating brief..."
      );

      if (pollResult.status === "completed") {
        setState("briefResult");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Brief generation failed"
      );
      setState("fieldReview");
    }
  };

  // ────────────────────────────────────────────────────────────
  // Render states
  // ────────────────────────────────────────────────────────────

  // Input state
  if (state === "input") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Process Meeting Transcript
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
          {/* Pre-filled company name (read-only) */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-500">Company</div>
            <div className="font-medium">{companyName}</div>
          </div>

          {/* Industry select (pre-selected but editable) */}
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select
              value={selectedIndustry}
              onValueChange={handleIndustryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cascading subsector select */}
          {selectedIndustry && (
            <div className="space-y-2">
              <Label>Subsector</Label>
              <Select
                value={selectedSubsector}
                onValueChange={setSelectedSubsector}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subsector" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubsectors.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Transcript textarea */}
          <div className="space-y-2">
            <Label htmlFor="transcript">Meeting Transcript</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript here..."
              rows={8}
              className="min-h-[160px]"
            />
          </div>

          {/* Optional additional notes */}
          <div className="space-y-2">
            <Label htmlFor="additional-notes">
              Additional Meeting Notes{" "}
              <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="additional-notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any context not captured in the transcript..."
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            onClick={handleProcessTranscript}
            disabled={
              !transcript.trim() || !selectedSubsector || isSubmitting
            }
            className="w-full cursor-pointer gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Process Transcript
          </Button>
        </div>
      </div>
    );
  }

  // Extracting state
  if (state === "extracting") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message={progressMessage} />
      </div>
    );
  }

  // Field Review state -- seller reviews/edits extracted fields
  if (state === "fieldReview" && extractedFields && fieldSeverity) {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Review Extracted Fields
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <FieldReview
          extractedFields={extractedFields}
          fieldSeverity={fieldSeverity}
          hasErrors={hasErrors}
          onContinue={handleContinueFromReview}
        />
      </div>
    );
  }

  // Generating state (brief generation in progress)
  if (state === "generating") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message="Generating sales brief..." />
      </div>
    );
  }

  // Brief Result state (PLACEHOLDER - Plan 03 will build the full brief-display component)
  if (state === "briefResult") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Brief Generated
          </h3>
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>

        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-slate-700">
          <p className="mb-2 font-medium">
            Brief generated successfully
          </p>
          <p className="text-xs text-slate-500">
            Plan 03 will build the full brief-display component with
            pillar cards, use cases, and ROI framing.
          </p>
        </div>

        <Button
          onClick={onClose}
          variant="outline"
          className="w-full cursor-pointer"
        >
          Done
        </Button>
      </div>
    );
  }

  return null;
}
