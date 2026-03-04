"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Pencil,
  Upload,
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";
import { GenerationProgress } from "./generation-progress";
import { DeckPreview } from "./deck-preview";
import {
  generateTouch1PagerAction,
  checkTouch1StatusAction,
  approveTouch1Action,
} from "@/lib/actions/touch-actions";
import { uploadTouch1Override } from "@/lib/api-client";

interface Touch1FormProps {
  dealId: string;
  companyName: string;
  industry: string;
  salespersonName?: string;
  onClose: () => void;
}

type FormState = "input" | "generating" | "review" | "assembling" | "result";

interface PagerContent {
  companyName: string;
  industry: string;
  headline: string;
  valueProposition: string;
  keyCapabilities: string[];
  callToAction: string;
}

export function Touch1Form({
  dealId,
  companyName,
  industry,
  salespersonName,
  onClose,
}: Touch1FormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("input");
  const [context, setContext] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] =
    useState<PagerContent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<PagerContent | null>(null);
  const [resultData, setResultData] = useState<{
    presentationId: string;
    driveUrl: string;
    decision: string;
  } | null>(null);
  const [progressMessage, setProgressMessage] = useState(
    "Generating pager content..."
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll workflow status until it reaches a target state
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
          const status = await checkTouch1StatusAction(currentRunId);

          // Check if workflow is suspended (awaiting seller approval)
          if (status.status === "suspended") {
            // Extract generated content from the suspend payload
            const steps = status.steps ?? {};
            const approvalStep = steps["await-seller-approval"];
            if (approvalStep?.payload) {
              const payload = approvalStep.payload as Record<string, unknown>;
              const content = payload.generatedContent as PagerContent;
              if (content) {
                return { status: "suspended", content };
              }
            }
            // Fallback: check generateContent step output
            const genStep = steps["generate-pager-content"];
            if (genStep?.output) {
              const output = genStep.output as Record<string, unknown>;
              const content = output.generatedContent as PagerContent;
              if (content) {
                return { status: "suspended", content };
              }
            }
            return { status: "suspended", content: null };
          }

          // Check if completed
          if (
            targetStatuses.includes(status.status) ||
            status.status === "completed"
          ) {
            // Extract result from the last step
            const steps = status.steps ?? {};
            const recordStep = steps["record-interaction"];
            if (recordStep?.output) {
              const output = recordStep.output as Record<string, unknown>;
              return {
                status: "completed",
                result: {
                  presentationId: output.presentationId as string,
                  driveUrl: output.driveUrl as string,
                  decision: output.decision as string,
                },
              };
            }
            return { status: status.status, content: null };
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

  // Step 1: Submit form -> generate content
  const handleGenerate = async () => {
    if (!context.trim()) return;
    setError(null);
    setState("generating");

    try {
      const result = await generateTouch1PagerAction(dealId, {
        companyName,
        industry,
        context,
        salespersonName,
      });

      setRunId(result.runId);

      // Poll until workflow suspends for seller review
      const pollResult = await pollStatus(
        result.runId,
        ["suspended"],
        "Generating pager content..."
      );

      if (pollResult.status === "suspended" && pollResult.content) {
        setGeneratedContent(pollResult.content as PagerContent);
        setEditedContent(pollResult.content as PagerContent);
        setState("review");
      } else {
        throw new Error("Expected content generation but got unexpected state");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setState("input");
    }
  };

  // Step 2a: Approve content as-is
  const handleApprove = async () => {
    if (!runId) return;
    setError(null);
    setState("assembling");
    setProgressMessage("Assembling Google Slides deck...");

    try {
      const result = await approveTouch1Action(
        runId,
        "await-seller-approval",
        "approved"
      );

      // Poll until workflow completes
      if (result.status === "completed") {
        // Result already available
        const steps = result.steps ?? {};
        const recordStep = steps["record-interaction"];
        if (recordStep?.output) {
          const output = recordStep.output as Record<string, unknown>;
          setResultData({
            presentationId: output.presentationId as string,
            driveUrl: output.driveUrl as string,
            decision: output.decision as string,
          });
          setState("result");
          router.refresh();
          return;
        }
      }

      // Poll for completion
      const pollResult = await pollStatus(
        runId,
        ["completed"],
        "Assembling deck and saving to Drive..."
      );

      if (pollResult.result) {
        setResultData(
          pollResult.result as {
            presentationId: string;
            driveUrl: string;
            decision: string;
          }
        );
        setState("result");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
      setState("review");
    }
  };

  // Step 2b: Approve with edits
  const handleApproveEdited = async () => {
    if (!runId || !editedContent) return;
    setError(null);
    setState("assembling");
    setProgressMessage("Assembling Google Slides deck with your edits...");

    try {
      const result = await approveTouch1Action(
        runId,
        "await-seller-approval",
        "edited",
        editedContent as unknown as Record<string, unknown>
      );

      // Poll for completion
      if (result.status === "completed") {
        const steps = result.steps ?? {};
        const recordStep = steps["record-interaction"];
        if (recordStep?.output) {
          const output = recordStep.output as Record<string, unknown>;
          setResultData({
            presentationId: output.presentationId as string,
            driveUrl: output.driveUrl as string,
            decision: output.decision as string,
          });
          setState("result");
          router.refresh();
          return;
        }
      }

      const pollResult = await pollStatus(
        runId,
        ["completed"],
        "Assembling deck and saving to Drive..."
      );

      if (pollResult.result) {
        setResultData(
          pollResult.result as {
            presentationId: string;
            driveUrl: string;
            decision: string;
          }
        );
        setState("result");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Edit approval failed"
      );
      setState("review");
    }
  };

  // Step 2c: Upload custom override
  const handleUpload = async (file: File) => {
    setError(null);
    setState("assembling");
    setProgressMessage("Uploading custom deck to Drive...");

    try {
      const result = await uploadTouch1Override(dealId, file);
      setResultData({
        presentationId: result.presentationId,
        driveUrl: result.driveUrl,
        decision: result.decision,
      });
      setState("result");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("review");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
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
            Generate Touch 1 Pager
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
            <Label htmlFor="context">Additional Context</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Enterprise fintech modernization, focusing on payment infrastructure..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!context.trim()}
            className="w-full cursor-pointer"
          >
            Generate Pager
          </Button>
        </div>
      </div>
    );
  }

  // Generating / Assembling state
  if (state === "generating" || state === "assembling") {
    return (
      <div className="pt-2">
        <Separator className="mb-4" />
        <GenerationProgress message={progressMessage} />
      </div>
    );
  }

  // Review state
  if (state === "review" && generatedContent) {
    const displayContent = editMode ? editedContent! : generatedContent;

    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Review Generated Content
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

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {editMode ? (
                <Input
                  value={displayContent.headline}
                  onChange={(e) =>
                    setEditedContent((prev) =>
                      prev ? { ...prev, headline: e.target.value } : prev
                    )
                  }
                  className="text-base font-semibold"
                />
              ) : (
                displayContent.headline
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">
                Value Proposition
              </p>
              {editMode ? (
                <Textarea
                  value={displayContent.valueProposition}
                  onChange={(e) =>
                    setEditedContent((prev) =>
                      prev
                        ? { ...prev, valueProposition: e.target.value }
                        : prev
                    )
                  }
                  rows={2}
                />
              ) : (
                <p className="text-slate-700">
                  {displayContent.valueProposition}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">
                Key Capabilities
              </p>
              {editMode ? (
                <div className="space-y-1">
                  {displayContent.keyCapabilities.map((cap, i) => (
                    <Input
                      key={i}
                      value={cap}
                      onChange={(e) => {
                        const updated = [...displayContent.keyCapabilities];
                        updated[i] = e.target.value;
                        setEditedContent((prev) =>
                          prev
                            ? { ...prev, keyCapabilities: updated }
                            : prev
                        );
                      }}
                    />
                  ))}
                </div>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {displayContent.keyCapabilities.map((cap, i) => (
                    <li key={i}>{cap}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">
                Call to Action
              </p>
              {editMode ? (
                <Input
                  value={displayContent.callToAction}
                  onChange={(e) =>
                    setEditedContent((prev) =>
                      prev ? { ...prev, callToAction: e.target.value } : prev
                    )
                  }
                />
              ) : (
                <p className="text-slate-700">{displayContent.callToAction}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          {!editMode ? (
            <>
              <Button
                onClick={handleApprove}
                className="w-full cursor-pointer gap-2 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                Approve and Generate Deck
              </Button>
              <Button
                onClick={() => setEditMode(true)}
                variant="outline"
                className="w-full cursor-pointer gap-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
              >
                <Pencil className="h-4 w-4" />
                Edit and Generate
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full cursor-pointer gap-2 border-blue-400 text-blue-700 hover:bg-blue-50"
              >
                <Upload className="h-4 w-4" />
                Upload Custom Override
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx,.ppt,application/vnd.google-apps.presentation,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          ) : (
            <>
              <Button
                onClick={handleApproveEdited}
                className="w-full cursor-pointer gap-2 bg-yellow-600 hover:bg-yellow-700"
              >
                <Check className="h-4 w-4" />
                Generate Deck with Edits
              </Button>
              <Button
                onClick={() => {
                  setEditMode(false);
                  setEditedContent(generatedContent);
                }}
                variant="outline"
                className="w-full cursor-pointer"
              >
                Cancel Edits
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Result state
  if (state === "result" && resultData) {
    const decisionLabel =
      resultData.decision === "approved"
        ? "Approved"
        : resultData.decision === "edited"
          ? "Edited"
          : "Overridden";

    const decisionColor =
      resultData.decision === "approved"
        ? "bg-green-600"
        : resultData.decision === "edited"
          ? "bg-yellow-600"
          : "bg-blue-600";

    return (
      <div className="space-y-4 pt-2">
        <Separator />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Generated Deck
          </h3>
          <Badge className={decisionColor}>{decisionLabel}</Badge>
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
