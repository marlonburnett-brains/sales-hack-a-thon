/**
 * TDD tests for FeedbackWidget component.
 * RED phase: written before the component exists — all tests must FAIL initially.
 * GREEN phase: tests pass once FeedbackWidget.tsx is implemented.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

// Mock the server action to avoid "use server" boundary issues in jsdom
vi.mock("@/lib/actions/feedback-actions", () => ({
  submitFeedbackAction: vi.fn(),
}));

// Mock sonner toast to capture calls
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules for assertions
import { submitFeedbackAction } from "@/lib/actions/feedback-actions";
import { toast } from "sonner";

// Import the component under test — will fail RED until FeedbackWidget.tsx is created
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

const BASE_PROPS = {
  sourceType: "tutorial",
  sourceId: "tutorial-123",
};

describe("FeedbackWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: renders both tab options
  it('renders "Tutorial feedback" and "Feature feedback" tab triggers', () => {
    render(<FeedbackWidget {...BASE_PROPS} />);
    expect(screen.getByRole("tab", { name: /tutorial feedback/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /feature feedback/i })).toBeDefined();
  });

  // Test 2: submit button disabled when comment is empty
  it("submit button is disabled when comment is empty string", () => {
    render(<FeedbackWidget {...BASE_PROPS} />);
    const submitButton = screen.getByRole("button", { name: /submit feedback/i });
    expect(submitButton).toBeDisabled();
  });

  // Test 3: submit button disabled when comment exceeds 500 characters
  it("submit button is disabled when comment.length > 500", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget {...BASE_PROPS} />);
    const textarea = screen.getByRole("textbox");
    const longComment = "a".repeat(501);
    await user.type(textarea, longComment);
    const submitButton = screen.getByRole("button", { name: /submit feedback/i });
    expect(submitButton).toBeDisabled();
  });

  // Test 4: character counter shows "X/500" when comment.length > 0; not shown when empty
  it('character counter shows "X/500" when comment.length > 0; not shown when empty', async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget {...BASE_PROPS} />);

    // Counter not shown when empty
    expect(screen.queryByText(/\/500/)).toBeNull();

    // Counter shows after typing
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "hello");
    expect(screen.getByText("5/500")).toBeDefined();
  });

  // Test 5: submit calls submitFeedbackAction with correct args
  it("submit calls submitFeedbackAction with sourceType, sourceId, feedbackType, and comment", async () => {
    const user = userEvent.setup();
    vi.mocked(submitFeedbackAction).mockResolvedValueOnce(undefined);
    render(<FeedbackWidget {...BASE_PROPS} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Great tutorial!");

    const submitButton = screen.getByRole("button", { name: /submit feedback/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitFeedbackAction).toHaveBeenCalledWith({
        sourceType: "tutorial",
        sourceId: "tutorial-123",
        feedbackType: "tutorial_feedback",
        comment: "Great tutorial!",
      });
    });
  });

  // Test 6: on success — toast.success fires AND form resets
  it("on successful submit: toast.success fires and form resets to default state", async () => {
    const user = userEvent.setup();
    vi.mocked(submitFeedbackAction).mockResolvedValueOnce(undefined);
    render(<FeedbackWidget {...BASE_PROPS} />);

    // Type a comment
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Nice tutorial");

    // Submit
    const submitButton = screen.getByRole("button", { name: /submit feedback/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Thanks for your feedback!");
    });

    // Textarea should be cleared
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("");
    });

    // Tutorial feedback tab should be active (default)
    await waitFor(() => {
      const tutorialTab = screen.getByRole("tab", { name: /tutorial feedback/i });
      expect(tutorialTab).toHaveAttribute("data-state", "active");
    });
  });

  // Test 7: on failure — toast.error fires AND textarea retains content
  it("on failed submit: toast.error fires and textarea retains its content", async () => {
    const user = userEvent.setup();
    vi.mocked(submitFeedbackAction).mockRejectedValueOnce(new Error("Network error"));
    render(<FeedbackWidget {...BASE_PROPS} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "This is my comment");

    const submitButton = screen.getByRole("button", { name: /submit feedback/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to submit feedback. Please try again."
      );
    });

    // Textarea should still have its content
    expect((textarea as HTMLTextAreaElement).value).toBe("This is my comment");
  });
});
