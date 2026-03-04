"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Lightbulb } from "lucide-react";
import { BriefApprovalBar } from "./brief-approval-bar";
import { BriefEditMode } from "./brief-edit-mode";
import type { SalesBrief, ROIFraming } from "@lumenalta/schemas";

interface BriefDisplayProps {
  briefData: SalesBrief;
  roiFramingData: ROIFraming;
  interactionId: string;
  // Phase 6: Approval mode
  approvalMode?: boolean;
  briefId?: string;
  runId?: string;
  approvalStatus?: string;
  rejectionFeedback?: string | null;
  onApprove?: (reviewerName: string) => Promise<void>;
  onReject?: (reviewerName: string, feedback: string) => Promise<void>;
  onEdit?: (editedBrief: SalesBrief) => Promise<void>;
}

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  pending_approval: {
    className: "bg-amber-100 text-amber-800",
    label: "Awaiting Approval",
  },
  approved: {
    className: "bg-green-100 text-green-800",
    label: "Approved",
  },
  changes_requested: {
    className: "bg-red-100 text-red-800",
    label: "Changes Requested",
  },
};

export function BriefDisplay({
  briefData,
  roiFramingData,
  interactionId,
  approvalMode,
  briefId,
  runId,
  approvalStatus,
  rejectionFeedback,
  onApprove,
  onReject,
  onEdit,
}: BriefDisplayProps) {
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localBriefData, setLocalBriefData] = useState(briefData);

  const handleApprove = async (reviewerName: string) => {
    if (!onApprove) return;
    setIsSubmitting(true);
    try {
      await onApprove(reviewerName);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (reviewerName: string, feedback: string) => {
    if (!onReject) return;
    setIsSubmitting(true);
    try {
      await onReject(reviewerName, feedback);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async (editedBrief: SalesBrief) => {
    if (!onEdit) return;
    setIsSubmitting(true);
    try {
      await onEdit(editedBrief);
      setLocalBriefData(editedBrief);
      setEditMode(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit mode: render BriefEditMode in place of read-only display
  if (approvalMode && editMode) {
    return (
      <BriefEditMode
        briefData={localBriefData}
        roiFramingData={roiFramingData}
        onSave={handleEditSave}
        onCancel={() => setEditMode(false)}
        isSaving={isSubmitting}
      />
    );
  }

  const statusBadgeInfo = approvalStatus
    ? STATUS_BADGE[approvalStatus]
    : undefined;

  const showApprovalBar =
    approvalMode &&
    (approvalStatus === "pending_approval" ||
      approvalStatus === "changes_requested");

  return (
    <div className="space-y-4">
      {/* Header: Company, Industry, Subsector */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {localBriefData.companyName}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {localBriefData.industry}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {localBriefData.subsector}
        </Badge>
      </div>

      {/* Approval status badge */}
      {approvalMode && statusBadgeInfo && (
        <Badge className={statusBadgeInfo.className}>
          {statusBadgeInfo.label}
        </Badge>
      )}

      {/* Primary Pillar */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
              Primary Pillar
            </span>
          </div>
          <CardTitle className="text-lg text-slate-900">
            {localBriefData.primaryPillar}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">
            {localBriefData.evidence}
          </p>
        </CardContent>
      </Card>

      {/* Secondary Pillars */}
      {localBriefData.secondaryPillars.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            Secondary Pillars:
          </span>
          {localBriefData.secondaryPillars.map((pillar) => (
            <Badge
              key={pillar}
              variant="secondary"
              className="bg-slate-100 text-slate-700"
            >
              {pillar}
            </Badge>
          ))}
        </div>
      )}

      {/* Use Cases */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">Use Cases</h4>
        {localBriefData.useCases.map((useCase) => {
          // Find matching ROI framing for this use case
          const roiMatch = roiFramingData.useCases.find(
            (r) =>
              r.useCaseName.toLowerCase() === useCase.name.toLowerCase()
          );
          const roiOutcomes = roiMatch?.roiOutcomes ?? [useCase.roiOutcome];
          const valueHypothesis =
            roiMatch?.valueHypothesis ?? useCase.valueHypothesis;

          return (
            <Card key={useCase.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{useCase.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  {useCase.description}
                </p>

                {/* ROI Outcomes */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-700">
                      ROI Outcomes
                    </span>
                  </div>
                  <ul className="ml-5 list-disc space-y-0.5">
                    {roiOutcomes.map((outcome, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-slate-600"
                      >
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Value Hypothesis */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">
                      Value Hypothesis
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {valueHypothesis}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Approval Bar -- below the brief content */}
      {showApprovalBar && briefId && runId && (
        <BriefApprovalBar
          briefId={briefId}
          runId={runId}
          onApprove={handleApprove}
          onReject={handleReject}
          onStartEdit={() => setEditMode(true)}
          isSubmitting={isSubmitting}
          rejectionFeedback={rejectionFeedback}
        />
      )}
    </div>
  );
}
