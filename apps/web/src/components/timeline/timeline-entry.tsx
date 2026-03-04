"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Clock } from "lucide-react";
import type { InteractionRecord } from "@/lib/api-client";

interface TimelineEntryProps {
  interaction: InteractionRecord;
}

const TOUCH_COLORS: Record<string, string> = {
  touch_1: "bg-blue-100 text-blue-800",
  touch_2: "bg-green-100 text-green-800",
  touch_3: "bg-purple-100 text-purple-800",
  touch_4: "bg-orange-100 text-orange-800",
};

const TOUCH_LABELS: Record<string, string> = {
  touch_1: "Touch 1",
  touch_2: "Touch 2",
  touch_3: "Touch 3",
  touch_4: "Touch 4",
};

const DECISION_COLORS: Record<string, string> = {
  approved: "bg-green-600",
  edited: "bg-yellow-600",
  overridden: "bg-blue-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  generating: "Generating",
  pending_approval: "Awaiting Approval",
  pending_review: "Awaiting Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  completed: "Completed",
  edited: "Edited",
  overridden: "Overridden",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-400",
  generating: "bg-blue-400",
  pending_approval: "bg-amber-500 text-white",
  pending_review: "bg-amber-500 text-white",
  changes_requested: "bg-red-500 text-white",
  approved: "bg-green-600",
  completed: "bg-green-600",
};

function parseJSON(str: string | null): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function TimelineEntry({ interaction }: TimelineEntryProps) {
  const touchColor =
    TOUCH_COLORS[interaction.touchType] ?? "bg-slate-100 text-slate-800";
  const touchLabel =
    TOUCH_LABELS[interaction.touchType] ?? interaction.touchType;
  const decisionColor = interaction.decision
    ? DECISION_COLORS[interaction.decision] ?? "bg-slate-600"
    : "bg-slate-400";

  const inputs = parseJSON(interaction.inputs) as Record<
    string,
    unknown
  > | null;
  const generatedContent = parseJSON(interaction.generatedContent) as Record<
    string,
    unknown
  > | null;
  const outputRefs = parseJSON(interaction.outputRefs) as string[] | null;
  const feedbackSignals = interaction.feedbackSignals ?? [];
  const brief = interaction.brief;

  const driveUrl =
    interaction.driveFileId
      ? `https://docs.google.com/presentation/d/${interaction.driveFileId}/edit`
      : outputRefs?.[0] ?? null;

  // Show approval lifecycle status for touch_4 entries
  const isTouch4 = interaction.touchType === "touch_4";
  const statusLabel = STATUS_LABELS[interaction.status] ?? interaction.status;
  const statusColor = STATUS_COLORS[interaction.status] ?? "bg-slate-400";

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value={interaction.id}
        className="rounded-lg border px-4"
      >
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex flex-1 items-center gap-3">
            <Badge className={touchColor} variant="secondary">
              {touchLabel}
            </Badge>

            {/* Approval lifecycle status for touch_4 */}
            {isTouch4 && (
              <Badge className={statusColor}>
                {statusLabel}
              </Badge>
            )}

            {/* Decision badge for non-touch-4 or when also showing decision */}
            {interaction.decision && !isTouch4 && (
              <Badge className={decisionColor}>
                {interaction.decision.charAt(0).toUpperCase() +
                  interaction.decision.slice(1)}
              </Badge>
            )}

            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              <span>
                {new Date(interaction.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="flex-1" />

            {driveUrl && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="space-y-3 text-sm">
            {/* Brief reviewer info (Touch 4) */}
            {brief?.reviewerName && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-slate-500">
                  Reviewed by
                </p>
                <p className="text-sm text-slate-700">
                  {brief.reviewerName}
                </p>
              </div>
            )}

            {/* Brief rejection feedback (Touch 4) */}
            {brief?.rejectionFeedback && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-slate-500">
                  Rejection Feedback
                </p>
                <p className="text-sm text-red-600">
                  {brief.rejectionFeedback}
                </p>
              </div>
            )}

            {/* Generated Content Summary */}
            {generatedContent && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-slate-500">
                  Generated Content
                </p>
                {typeof generatedContent.headline === "string" && (
                  <p className="font-medium text-slate-800">
                    {generatedContent.headline}
                  </p>
                )}
                {typeof generatedContent.valueProposition === "string" && (
                  <p className="text-slate-600">
                    {generatedContent.valueProposition}
                  </p>
                )}
                {Array.isArray(generatedContent.keyCapabilities) && (
                  <ul className="list-disc pl-4 text-slate-600">
                    {(generatedContent.keyCapabilities as string[]).map(
                      (cap, i) => (
                        <li key={i}>{cap}</li>
                      )
                    )}
                  </ul>
                )}
              </div>
            )}

            {/* Input Parameters */}
            {inputs && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-slate-500">
                  Input Parameters
                </p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(inputs).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-slate-400">{key}: </span>
                      <span className="text-slate-600">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback Signals */}
            {feedbackSignals.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-slate-500">
                  Feedback Signals
                </p>
                {feedbackSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Badge variant="outline" className="text-xs">
                      {signal.signalType}
                    </Badge>
                    <span className="text-slate-500">{signal.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
