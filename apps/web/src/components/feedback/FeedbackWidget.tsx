"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitFeedbackAction } from "@/lib/actions/feedback-actions";

const MAX_CHARS = 500;

/**
 * Props for the FeedbackWidget component.
 */
export interface FeedbackWidgetProps {
  /**
   * The entity type this feedback is attached to (e.g. "tutorial").
   * Extend by passing a new string value; the AppFeedback table stores it verbatim.
   */
  sourceType: string;

  /**
   * The database ID of the entity (not a slug).
   * For tutorials, use tutorial.id.
   */
  sourceId: string;

  /**
   * Optional. Defaults to "tutorial_feedback".
   * Pass "feature_feedback" to pre-select the feature tab on pages where that is more relevant.
   */
  defaultFeedbackType?: "tutorial_feedback" | "feature_feedback";
}

export function FeedbackWidget({
  sourceType,
  sourceId,
  defaultFeedbackType,
}: FeedbackWidgetProps) {
  const defaultTab = defaultFeedbackType ?? "tutorial_feedback";
  const [feedbackType, setFeedbackType] = useState<
    "tutorial_feedback" | "feature_feedback"
  >(defaultTab);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisabled =
    isSubmitting || comment.trim().length === 0 || comment.length > MAX_CHARS;

  async function handleSubmit() {
    if (isDisabled) return;
    setIsSubmitting(true);
    try {
      await submitFeedbackAction({
        sourceType,
        sourceId,
        feedbackType,
        comment,
      });
      toast.success("Thanks for your feedback!");
      setComment("");
      setFeedbackType(defaultTab);
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <hr className="mb-4" />
      <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Leave feedback
      </p>
      <Tabs
        value={feedbackType}
        onValueChange={(val) =>
          setFeedbackType(val as "tutorial_feedback" | "feature_feedback")
        }
      >
        <TabsList className="mb-3">
          <TabsTrigger value="tutorial_feedback">Tutorial feedback</TabsTrigger>
          <TabsTrigger value="feature_feedback">Feature feedback</TabsTrigger>
        </TabsList>
      </Tabs>
      <Textarea
        rows={4}
        placeholder="Share your thoughts..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mb-1"
      />
      {comment.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground text-right">
          {comment.length}/{MAX_CHARS}
        </p>
      )}
      <Button disabled={isDisabled} onClick={handleSubmit}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit feedback"
        )}
      </Button>
    </div>
  );
}
