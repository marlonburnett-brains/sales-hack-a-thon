"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Pencil, Loader2 } from "lucide-react";

interface BriefApprovalBarProps {
  briefId: string;
  runId: string;
  onApprove: (reviewerName: string) => Promise<void>;
  onReject: (reviewerName: string, feedback: string) => Promise<void>;
  onStartEdit: () => void;
  isSubmitting: boolean;
  rejectionFeedback?: string | null;
}

export function BriefApprovalBar({
  onApprove,
  onReject,
  onStartEdit,
  isSubmitting,
  rejectionFeedback,
}: BriefApprovalBarProps) {
  const [reviewerName, setReviewerName] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  const nameValid = reviewerName.trim().length > 0;
  const feedbackValid = feedback.trim().length > 0;

  const handleApprove = async () => {
    if (!nameValid) return;
    await onApprove(reviewerName.trim());
  };

  const handleReject = async () => {
    if (!nameValid || !feedbackValid) return;
    await onReject(reviewerName.trim(), feedback.trim());
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {/* Previous rejection feedback */}
      {rejectionFeedback && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-amber-800">
              Previous Feedback:
            </p>
            <p className="mt-1 text-sm text-amber-700">{rejectionFeedback}</p>
          </CardContent>
        </Card>
      )}

      {/* Reviewer name input */}
      <div className="space-y-2">
        <Label htmlFor="reviewer-name">Your Name</Label>
        <Input
          id="reviewer-name"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          placeholder="Enter your name to review"
          disabled={isSubmitting}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleApprove}
          disabled={!nameValid || isSubmitting}
          className="min-h-[44px] cursor-pointer gap-2 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Approve
        </Button>

        <Button
          onClick={() => setShowRejectForm(!showRejectForm)}
          disabled={!nameValid || isSubmitting}
          variant="destructive"
          className="min-h-[44px] cursor-pointer gap-2"
        >
          <XCircle className="h-4 w-4" />
          Request Changes
        </Button>

        <Button
          onClick={onStartEdit}
          disabled={!nameValid || isSubmitting}
          variant="outline"
          className="min-h-[44px] cursor-pointer gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Rejection feedback form */}
      {showRejectForm && (
        <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-3">
          <div className="space-y-2">
            <Label htmlFor="rejection-feedback">
              What needs to change?
            </Label>
            <Textarea
              id="rejection-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Explain what needs to change..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>
          <Button
            onClick={handleReject}
            disabled={!feedbackValid || isSubmitting}
            variant="destructive"
            className="min-h-[44px] cursor-pointer gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Submit Feedback
          </Button>
        </div>
      )}
    </div>
  );
}
