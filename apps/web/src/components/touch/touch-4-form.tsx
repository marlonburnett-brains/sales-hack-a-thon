"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { X, Loader2, CheckCircle, RotateCcw, Pencil, Info } from "lucide-react";
import { GenerationProgress } from "./generation-progress";
import { FieldReview } from "./field-review";
import { BriefDisplay } from "./brief-display";
import {
  generateTouch4BriefAction,
  checkTouch4StatusAction,
  resumeTouch4FieldReviewAction,
  approveBriefAction,
  rejectBriefAction,
  editBriefAction,
} from "@/lib/actions/touch-actions";
import { INDUSTRIES, SUBSECTORS } from "@lumenalta/schemas";
import type { SalesBrief, ROIFraming } from "@lumenalta/schemas";

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
  | "awaitingApproval"
  | "rejected"
  | "editing"
  | "resubmitting"
  | "approved"
  | "assetGenerating"
  | "awaitingAssetReview"
  | "delivered";

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
  const [briefData, setBriefData] = useState<SalesBrief | null>(null);
  const [roiFramingData, setRoiFramingData] = useState<ROIFraming | null>(null);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState<string | null>(
    null
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
      pollMessage: string,
      interval: number = 2000
    ) => {
      setProgressMessage(pollMessage);
      const maxAttempts = 120;
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, interval));
        attempts++;

        try {
          const status = await checkTouch4StatusAction(currentRunId);

          // Check if workflow is suspended
          if (
            status.status === "suspended" &&
            targetStatuses.includes("suspended")
          ) {
            const steps = status.steps ?? {};

            // Check for brief approval suspend (second suspend point)
            const approvalStep = steps["await-brief-approval"];
            if (approvalStep?.payload) {
              const payload = approvalStep.payload as Record<string, unknown>;
              // Grab brief data from record-interaction output
              const recordStep = steps["record-interaction"];
              const recordOutput = recordStep?.output as
                | Record<string, unknown>
                | undefined;
              return {
                status: "awaiting_approval" as const,
                briefId: payload.briefId as string,
                interactionId: payload.interactionId as string,
                briefData: recordOutput?.briefData as SalesBrief | undefined,
                roiFramingData: recordOutput?.roiFramingData as
                  | ROIFraming
                  | undefined,
              };
            }

            // Check for field review suspend (first suspend point)
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
                  briefData: output.briefData as SalesBrief,
                  roiFramingData: output.roiFramingData as ROIFraming,
                },
              };
            }
            if (status.result) {
              const result = status.result as Record<string, unknown>;
              return {
                status: "completed" as const,
                result: {
                  interactionId: (result.interactionId as string) ?? "",
                  briefId: (result.briefId as string) ?? "",
                  transcriptId: (result.transcriptId as string) ?? "",
                  briefData: result.briefData as SalesBrief | undefined,
                  roiFramingData: result.roiFramingData as ROIFraming | undefined,
                },
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

  // Step 2: Continue from field review -> generate brief -> await approval
  const handleContinueFromReview = async (reviewedFields: TranscriptFields) => {
    if (!runId) return;
    setError(null);
    setState("generating");

    try {
      // Resume workflow with seller-reviewed fields
      await resumeTouch4FieldReviewAction(
        runId,
        "await-field-review",
        reviewedFields
      );

      // Poll until workflow suspends at brief approval (second suspend point)
      // Use 3-second interval for the approval phase polling
      setProgressMessage("Mapping solution pillars...");
      const pollResult = await pollStatus(
        runId,
        ["suspended", "completed"],
        "Generating brief...",
        3000
      );

      if (
        pollResult.status === "awaiting_approval" &&
        pollResult.briefId
      ) {
        setBriefId(pollResult.briefId);
        if (pollResult.interactionId)
          setInteractionId(pollResult.interactionId);
        if (pollResult.briefData)
          setBriefData(pollResult.briefData);
        if (pollResult.roiFramingData)
          setRoiFramingData(pollResult.roiFramingData);
        setState("awaitingApproval");
        router.refresh();
      } else if (pollResult.status === "completed" && pollResult.result) {
        // Workflow completed without second suspend (shouldn't happen in normal flow)
        const resultData = pollResult.result as Record<string, unknown>;
        if (resultData.briefData)
          setBriefData(resultData.briefData as SalesBrief);
        if (resultData.roiFramingData)
          setRoiFramingData(resultData.roiFramingData as ROIFraming);
        if (resultData.interactionId)
          setInteractionId(resultData.interactionId as string);
        if (resultData.briefId) setBriefId(resultData.briefId as string);
        setState("approved");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Brief generation failed"
      );
      setState("fieldReview");
    }
  };

  // Approval handlers
  const handleApprove = async (reviewerName: string) => {
    if (!briefId || !runId) return;
    try {
      await approveBriefAction(briefId, { reviewerName, runId });
      setState("approved");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Approval failed"
      );
    }
  };

  const handleReject = async (reviewerName: string, feedback: string) => {
    if (!briefId) return;
    try {
      await rejectBriefAction(briefId, { reviewerName, feedback });
      setRejectionFeedback(feedback);
      setState("rejected");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rejection failed"
      );
    }
  };

  const handleEditBrief = async (editedBrief: SalesBrief) => {
    if (!briefId) return;
    try {
      await editBriefAction(briefId, {
        editedBrief: editedBrief as unknown as Record<string, unknown>,
        reviewerName: "Seller",
      });
      setBriefData(editedBrief);
      setState("awaitingApproval");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Edit failed"
      );
    }
  };

  // Rejection resubmit: Edit extracted fields and regenerate
  const handleResubmitFromFields = () => {
    // Reset to fieldReview with original extracted fields, start a fresh workflow
    setRunId(null);
    setBriefId(null);
    setRejectionFeedback(null);
    setState("fieldReview");
  };

  // Rejection resubmit: Edit brief directly
  const handleResubmitFromBrief = () => {
    setState("awaitingApproval");
    // The BriefDisplay will allow inline editing
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
          onContinue={async (reviewedFields: TranscriptFields) => {
            if (!runId) {
              // Fresh workflow needed (e.g., after rejection -> edit fields -> regenerate)
              setIsSubmitting(true);
              setState("generating");
              try {
                const result = await generateTouch4BriefAction(dealId, {
                  companyName,
                  industry: selectedIndustry,
                  subsector: selectedSubsector,
                  transcript,
                  additionalNotes: additionalNotes || undefined,
                });
                setRunId(result.runId);
                // Poll for first suspend
                const pollResult = await pollStatus(
                  result.runId,
                  ["suspended"],
                  "Extracting fields from transcript..."
                );
                if (
                  pollResult.status === "suspended" &&
                  pollResult.extractedFields
                ) {
                  // Immediately resume with reviewed fields
                  await resumeTouch4FieldReviewAction(
                    result.runId,
                    "await-field-review",
                    reviewedFields
                  );
                  // Poll for second suspend
                  const secondPoll = await pollStatus(
                    result.runId,
                    ["suspended", "completed"],
                    "Generating brief...",
                    3000
                  );
                  if (
                    secondPoll.status === "awaiting_approval" &&
                    secondPoll.briefId
                  ) {
                    setBriefId(secondPoll.briefId);
                    if (secondPoll.interactionId)
                      setInteractionId(secondPoll.interactionId);
                    if (secondPoll.briefData)
                      setBriefData(secondPoll.briefData);
                    if (secondPoll.roiFramingData)
                      setRoiFramingData(secondPoll.roiFramingData);
                    setState("awaitingApproval");
                    router.refresh();
                  }
                }
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Brief generation failed"
                );
                setState("fieldReview");
              } finally {
                setIsSubmitting(false);
              }
            } else {
              handleContinueFromReview(reviewedFields);
            }
          }}
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

  // Resubmitting state
  if (state === "resubmitting") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message="Regenerating brief..." />
      </div>
    );
  }

  // Awaiting Approval state -- brief generated, waiting for reviewer action
  if (state === "awaitingApproval" && briefData && roiFramingData) {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Brief Approval
          </h3>
          <Badge className="bg-amber-100 text-amber-800">
            Awaiting Approval
          </Badge>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <BriefDisplay
          briefData={briefData}
          roiFramingData={roiFramingData}
          interactionId={interactionId ?? ""}
          approvalMode={true}
          briefId={briefId ?? undefined}
          runId={runId ?? undefined}
          approvalStatus="pending_approval"
          rejectionFeedback={rejectionFeedback}
          onApprove={handleApprove}
          onReject={handleReject}
          onEdit={handleEditBrief}
        />
      </div>
    );
  }

  // Rejected state -- show feedback and two resubmit paths
  if (state === "rejected") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <Alert variant="destructive">
          <AlertTitle>Changes Requested</AlertTitle>
          <AlertDescription>
            {rejectionFeedback}
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Choose how to address the feedback:
          </p>
          <Button
            onClick={handleResubmitFromFields}
            className="w-full cursor-pointer gap-2"
            variant="default"
          >
            <RotateCcw className="h-4 w-4" />
            Edit Extracted Fields & Regenerate Brief
          </Button>
          <Button
            onClick={handleResubmitFromBrief}
            variant="outline"
            className="w-full cursor-pointer gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Brief Directly & Resubmit
          </Button>
        </div>
      </div>
    );
  }

  // Approved state -- show brief with success indicator
  if (state === "approved") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Sales Brief
          </h3>
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Brief Approved</span>
          </div>
        </div>

        {briefData && roiFramingData ? (
          <BriefDisplay
            briefData={briefData}
            roiFramingData={roiFramingData}
            interactionId={interactionId ?? ""}
            approvalMode={true}
            approvalStatus="approved"
          />
        ) : (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-slate-700">
            <p className="font-medium">Brief approved successfully</p>
            <p className="mt-1 text-xs text-slate-500">
              Refresh the page to see the updated status.
            </p>
          </div>
        )}

        {/* Asset generation info note */}
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">
            Generating proposal assets
          </AlertTitle>
          <AlertDescription className="text-blue-700">
            Generating proposal assets (deck, talk track, and FAQ). You will
            find the review link on the deal page when they are ready.
          </AlertDescription>
        </Alert>

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

  // Asset Generating state
  if (state === "assetGenerating") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message="Generating proposal assets..." />
      </div>
    );
  }

  // Awaiting Asset Review state
  if (state === "awaitingAssetReview") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">
            Assets ready for review
          </AlertTitle>
          <AlertDescription className="text-blue-700">
            Generated assets are ready for review. Visit the deal page to access
            the review link.
          </AlertDescription>
        </Alert>
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

  // Delivered state
  if (state === "delivered") {
    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Assets Delivered</AlertTitle>
          <AlertDescription>
            All assets have been approved and delivered successfully.
          </AlertDescription>
        </Alert>
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
