"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REVIEWER_ROLES = ["Seller", "SME", "Marketing", "Solutions"] as const;

interface AssetApprovalBarProps {
  onApprove: (name: string, role: string) => Promise<void>;
  onReject: (name: string, role: string, feedback: string) => Promise<void>;
  isApproved: boolean;
  isSubmitting: boolean;
}

export function AssetApprovalBar({
  onApprove,
  onReject,
  isApproved,
  isSubmitting,
}: AssetApprovalBarProps) {
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerRole, setReviewerRole] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (isApproved) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="text-sm font-medium text-green-800">
          Assets Approved
        </span>
      </div>
    );
  }

  const canAct = reviewerName.trim().length > 0 && reviewerRole.length > 0;

  const handleApprove = async () => {
    if (!canAct) return;
    await onApprove(reviewerName.trim(), reviewerRole);
  };

  const handleRejectSubmit = async () => {
    if (!canAct || feedback.trim().length < 10) return;
    await onReject(reviewerName.trim(), reviewerRole, feedback.trim());
    setShowRejectForm(false);
    setFeedback("");
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {/* Reviewer identity fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="reviewer-name">Your Name</Label>
          <Input
            id="reviewer-name"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Enter your name"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reviewer-role">Your Role</Label>
          <Select
            value={reviewerRole}
            onValueChange={setReviewerRole}
            disabled={isSubmitting}
          >
            <SelectTrigger id="reviewer-role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {REVIEWER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reject feedback form */}
      {showRejectForm && (
        <div className="space-y-2">
          <Label htmlFor="reject-feedback">
            Feedback{" "}
            <span className="text-xs text-slate-400">(min 10 characters)</span>
          </Label>
          <Textarea
            id="reject-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Describe what needs to be changed..."
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleRejectSubmit}
              disabled={!canAct || feedback.trim().length < 10 || isSubmitting}
              variant="destructive"
              className="min-h-[44px] cursor-pointer"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Rejection
            </Button>
            <Button
              onClick={() => {
                setShowRejectForm(false);
                setFeedback("");
              }}
              variant="outline"
              className="min-h-[44px] cursor-pointer"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showRejectForm && (
        <div className="flex gap-3">
          <Button
            onClick={handleApprove}
            disabled={!canAct || isSubmitting}
            className="min-h-[44px] flex-1 cursor-pointer bg-green-600 hover:bg-green-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Assets
          </Button>
          <Button
            onClick={() => setShowRejectForm(true)}
            disabled={!canAct || isSubmitting}
            variant="outline"
            className="min-h-[44px] flex-1 cursor-pointer border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Request Changes
          </Button>
        </div>
      )}
    </div>
  );
}
