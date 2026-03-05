"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { WorkflowStepper } from "@/components/touch/workflow-stepper";
import { BrandComplianceSection } from "@/components/touch/brand-compliance-section";
import { AssetReviewPanel } from "@/components/touch/asset-review-panel";
import { AssetApprovalBar } from "@/components/touch/asset-approval-bar";
import {
  approveAssetsAction,
  rejectAssetsAction,
} from "@/lib/actions/touch-actions";
import type { AssetReviewData } from "@/lib/api-client";

interface AssetReviewClientProps {
  reviewData: AssetReviewData;
  dealId: string;
  interactionId: string;
}

export function AssetReviewClient({
  reviewData,
  dealId,
  interactionId,
}: AssetReviewClientProps) {
  const router = useRouter();
  const [approvalStatus, setApprovalStatus] = useState(
    reviewData.interaction.status
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async (name: string, role: string) => {
    setIsSubmitting(true);
    try {
      await approveAssetsAction(interactionId, {
        reviewerName: name,
        reviewerRole: role,
        runId: reviewData.brief?.workflowRunId ?? "",
      });
      setApprovalStatus("delivered");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (
    name: string,
    role: string,
    feedback: string
  ) => {
    setIsSubmitting(true);
    try {
      await rejectAssetsAction(interactionId, {
        reviewerName: name,
        reviewerRole: role,
        feedback,
      });
      // Status stays as pending_asset_review after rejection
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDelivered = approvalStatus === "delivered";

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      {/* Deal context header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          {reviewData.deal.companyName}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{reviewData.deal.industry}</Badge>
          {reviewData.brief?.primaryPillar && (
            <Badge variant="outline">{reviewData.brief.primaryPillar}</Badge>
          )}
        </div>
        <p className="text-sm text-slate-500">{reviewData.deal.dealName}</p>
      </div>

      {/* Workflow Stepper */}
      <WorkflowStepper status={approvalStatus} />

      <Separator />

      {/* Delivered alert */}
      {isDelivered && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Assets Approved</AlertTitle>
          <AlertDescription>
            These assets have been approved for delivery.
          </AlertDescription>
        </Alert>
      )}

      {/* Brand Compliance */}
      <BrandComplianceSection result={reviewData.complianceResult} />

      {/* Asset Review Panel */}
      <AssetReviewPanel outputRefs={reviewData.interaction.outputRefs} />

      {/* Approval Bar */}
      <AssetApprovalBar
        onApprove={handleApprove}
        onReject={handleReject}
        isApproved={isDelivered}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
