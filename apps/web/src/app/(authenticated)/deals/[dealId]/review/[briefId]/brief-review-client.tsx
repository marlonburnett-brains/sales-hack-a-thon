"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { BriefDisplay } from "@/components/touch/brief-display";
import {
  approveBriefAction,
  rejectBriefAction,
  editBriefAction,
} from "@/lib/actions/touch-actions";
import type { BriefReviewData } from "@/lib/api-client";
import type { SalesBrief, ROIFraming } from "@lumenalta/schemas";

interface BriefReviewClientProps {
  reviewData: BriefReviewData;
  dealId: string;
  briefId: string;
}

function parseBriefData(reviewData: BriefReviewData): {
  briefData: SalesBrief;
  roiFramingData: ROIFraming;
} {
  const brief = reviewData.brief;
  const briefData: SalesBrief = {
    companyName: reviewData.deal.companyName,
    industry: reviewData.deal.industry,
    subsector: reviewData.transcript?.subsector ?? "",
    primaryPillar: brief.primaryPillar,
    secondaryPillars: JSON.parse(brief.secondaryPillars),
    evidence: brief.evidence,
    customerContext: brief.customerContext,
    businessOutcomes: brief.businessOutcomes,
    constraints: brief.constraints,
    stakeholders: brief.stakeholders,
    timeline: brief.timeline,
    budget: brief.budget,
    useCases: JSON.parse(brief.useCases),
  };
  const roiFramingData: ROIFraming = {
    useCases: JSON.parse(brief.roiFraming),
  };
  return { briefData, roiFramingData };
}

export function BriefReviewClient({
  reviewData,
  dealId,
  briefId,
}: BriefReviewClientProps) {
  const { briefData: initialBriefData, roiFramingData } =
    parseBriefData(reviewData);
  const [approvalStatus, setApprovalStatus] = useState(
    reviewData.brief.approvalStatus
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localBriefData, setLocalBriefData] = useState(initialBriefData);

  const handleApprove = async (reviewerName: string) => {
    setIsSubmitting(true);
    try {
      await approveBriefAction(briefId, {
        reviewerName,
        runId: reviewData.brief.workflowRunId ?? "",
      });
      setApprovalStatus("approved");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (reviewerName: string, feedback: string) => {
    setIsSubmitting(true);
    try {
      await rejectBriefAction(briefId, { reviewerName, feedback });
      setApprovalStatus("changes_requested");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (editedBrief: SalesBrief) => {
    setIsSubmitting(true);
    try {
      await editBriefAction(briefId, {
        editedBrief: editedBrief as unknown as Record<string, unknown>,
        reviewerName: "Reviewer",
      });
      setLocalBriefData(editedBrief);
      setApprovalStatus("pending_approval");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      {/* Deal context header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          {reviewData.deal.companyName}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{reviewData.deal.industry}</Badge>
          {reviewData.transcript?.subsector && (
            <Badge variant="outline">{reviewData.transcript.subsector}</Badge>
          )}
        </div>
        <p className="text-sm text-slate-500">{reviewData.deal.dealName}</p>
        {reviewData.transcript?.summary && (
          <p className="text-sm italic text-slate-600">
            {reviewData.transcript.summary}...
          </p>
        )}
      </div>

      <Separator />

      {/* Approval status alerts */}
      {approvalStatus === "approved" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Brief Approved</AlertTitle>
          <AlertDescription>
            This brief has been approved and will proceed to asset generation.
          </AlertDescription>
        </Alert>
      )}
      {approvalStatus === "changes_requested" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Changes Requested</AlertTitle>
          <AlertDescription>
            Feedback has been submitted. The seller will review and resubmit.
          </AlertDescription>
        </Alert>
      )}

      {/* Brief display with approval actions */}
      <BriefDisplay
        briefData={localBriefData}
        roiFramingData={roiFramingData}
        interactionId={reviewData.brief.interactionId}
        approvalMode={true}
        briefId={briefId}
        runId={reviewData.brief.workflowRunId ?? undefined}
        approvalStatus={approvalStatus}
        rejectionFeedback={reviewData.brief.rejectionFeedback}
        onApprove={handleApprove}
        onReject={handleReject}
        onEdit={handleEdit}
      />
    </div>
  );
}
