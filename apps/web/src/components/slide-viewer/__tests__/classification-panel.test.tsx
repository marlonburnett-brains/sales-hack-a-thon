/**
 * Phase 21 - PREV-02: AI classification tag display
 * Phase 21 - PREV-03: Thumbs up/down rating
 * Phase 21 - PREV-04: Inline tag correction editing
 *
 * Tests the ClassificationPanel component rendering and interaction behavior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ClassificationPanel } from "../classification-panel";
import type { SlideData } from "@/lib/actions/slide-actions";

// Mock the server action
vi.mock("@/lib/actions/slide-actions", () => ({
  updateSlideClassificationAction: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the TagEditor to keep tests focused on ClassificationPanel logic
vi.mock("@/components/slide-viewer/tag-editor", () => ({
  TagEditor: ({
    onSave,
    onCancel,
    isSaving,
  }: {
    currentTags: unknown;
    onSave: (tags: unknown) => void;
    onCancel: () => void;
    isSaving: boolean;
  }) =>
    React.createElement("div", { "data-testid": "tag-editor" }, [
      React.createElement(
        "button",
        {
          key: "save",
          "data-testid": "save-corrections-btn",
          onClick: () =>
            onSave({
              industries: ["Healthcare"],
              solutionPillars: ["AI, ML & LLM"],
              buyerPersonas: ["CTO"],
              funnelStages: ["First Contact"],
              contentType: "template",
              slideCategory: "title",
            }),
          disabled: isSaving,
        },
        "Save Corrections"
      ),
      React.createElement(
        "button",
        { key: "cancel", "data-testid": "cancel-edit-btn", onClick: onCancel },
        "Cancel"
      ),
    ]),
}));

function makeSlide(overrides: Partial<SlideData> = {}): SlideData {
  return {
    id: "slide-1",
    slideIndex: 0,
    slideObjectId: "obj-1",
    contentText: "Test slide content",
    classificationJson: JSON.stringify({
      industries: ["Technology"],
      solutionPillars: ["Cloud & Infrastructure"],
      buyerPersonas: ["CIO"],
      funnelStages: ["Intro Conversation"],
      contentType: "template",
      slideCategory: "industry_overview",
      subsectors: [],
      touchType: [],
    }),
    confidence: 85,
    needsReReview: false,
    reviewStatus: "unreviewed",
    industry: "Technology",
    solutionPillar: "Cloud & Infrastructure",
    persona: "CIO",
    funnelStage: "Intro Conversation",
    contentType: "template",
    ...overrides,
  };
}

describe("PREV-02: AI classification tag display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("displays classification tags grouped by category from classificationJson", () => {
    const slide = makeSlide();
    const { container } = render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    // Check category labels exist (use getAllBy since React 19 may duplicate)
    expect(container.textContent).toContain("Industry");
    expect(container.textContent).toContain("Solution Pillar");
    expect(container.textContent).toContain("Buyer Persona");
    expect(container.textContent).toContain("Funnel Stage");
    expect(container.textContent).toContain("Content Type");
    expect(container.textContent).toContain("Slide Category");

    // Check tag values
    expect(container.textContent).toContain("Technology");
    expect(container.textContent).toContain("Cloud & Infrastructure");
    expect(container.textContent).toContain("CIO");
    expect(container.textContent).toContain("Intro Conversation");
    expect(container.textContent).toContain("template");
    expect(container.textContent).toContain("industry_overview");
  });

  it("falls back to single-value columns when classificationJson is null", () => {
    const slide = makeSlide({
      classificationJson: null,
    });
    const { container } = render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Technology");
    expect(container.textContent).toContain("Cloud & Infrastructure");
    expect(container.textContent).toContain("CIO");
  });

  it("displays confidence score as percentage with progress bar", () => {
    const slide = makeSlide({ confidence: 85 });
    const { container } = render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    expect(container.textContent).toContain("85% confident");
  });

  it("shows review status badge for unreviewed slide", () => {
    const slide = makeSlide({ reviewStatus: "unreviewed" });
    const { container } = render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Unreviewed");
  });

  it("shows review status badge for approved slide", () => {
    const slide = makeSlide({ reviewStatus: "approved" });
    const { container } = render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    expect(container.textContent).toContain("Approved");
  });
});

describe("PREV-03: Thumbs up/down rating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("shows Approve and Correct buttons", () => {
    const slide = makeSlide();
    const { container } = render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    const approveButtons = screen.getAllByRole("button", { name: /approve classification/i });
    expect(approveButtons.length).toBeGreaterThanOrEqual(1);

    const rejectButtons = screen.getAllByRole("button", { name: /reject classification and edit tags/i });
    expect(rejectButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls updateSlideClassificationAction with approved status on thumbs up", async () => {
    const { updateSlideClassificationAction } = await import(
      "@/lib/actions/slide-actions"
    );
    const mockUpdate = vi.mocked(updateSlideClassificationAction);
    mockUpdate.mockResolvedValueOnce({ success: true });

    const onUpdated = vi.fn();
    const slide = makeSlide();
    const user = userEvent.setup();

    render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={onUpdated}
      />
    );

    const approveButtons = screen.getAllByRole("button", { name: /approve classification/i });
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("slide-1", "tmpl-1", {
        reviewStatus: "approved",
      });
    });

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: "approved",
          needsReReview: false,
        })
      );
    });
  });

  it("switches to editing mode on thumbs down click", async () => {
    const slide = makeSlide();
    const user = userEvent.setup();

    render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    // Initially, no tag editor visible
    expect(screen.queryByTestId("tag-editor")).not.toBeInTheDocument();

    const rejectButtons = screen.getAllByRole("button", { name: /reject classification and edit tags/i });
    await user.click(rejectButtons[0]);

    // Tag editor should now be visible
    await waitFor(() => {
      expect(screen.getByTestId("tag-editor")).toBeInTheDocument();
    });
  });
});

describe("PREV-04: Inline tag correction editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("saves corrections via updateSlideClassificationAction with needs_correction status", async () => {
    const { updateSlideClassificationAction } = await import(
      "@/lib/actions/slide-actions"
    );
    const mockUpdate = vi.mocked(updateSlideClassificationAction);
    mockUpdate.mockResolvedValueOnce({ success: true });

    const onUpdated = vi.fn();
    const slide = makeSlide();
    const user = userEvent.setup();

    render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={onUpdated}
      />
    );

    // Enter edit mode
    const rejectButtons = screen.getAllByRole("button", { name: /reject classification and edit tags/i });
    await user.click(rejectButtons[0]);

    // Wait for tag editor
    await waitFor(() => {
      expect(screen.getByTestId("tag-editor")).toBeInTheDocument();
    });

    // Click Save Corrections (from mocked TagEditor)
    const saveBtn = screen.getByTestId("save-corrections-btn");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("slide-1", "tmpl-1", {
        reviewStatus: "needs_correction",
        correctedTags: expect.objectContaining({
          industries: ["Healthcare"],
          solutionPillars: ["AI, ML & LLM"],
          contentType: "template",
          slideCategory: "title",
        }),
      });
    });

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: "needs_correction",
          industry: "Healthcare",
          solutionPillar: "AI, ML & LLM",
        })
      );
    });
  });

  it("cancels editing and returns to tag display", async () => {
    const slide = makeSlide();
    const user = userEvent.setup();

    render(
      <ClassificationPanel
        slide={slide}
        templateId="tmpl-1"
        onUpdated={vi.fn()}
      />
    );

    // Enter edit mode
    const rejectButtons = screen.getAllByRole("button", { name: /reject classification and edit tags/i });
    await user.click(rejectButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("tag-editor")).toBeInTheDocument();
    });

    // Cancel
    const cancelBtn = screen.getByTestId("cancel-edit-btn");
    await user.click(cancelBtn);

    // Tag editor should be gone, regular tags back
    await waitFor(() => {
      expect(screen.queryByTestId("tag-editor")).not.toBeInTheDocument();
    });

    const { container } = screen.getByText("Industry").closest("div")!.parentElement!
      ? { container: document.body }
      : { container: document.body };
    expect(document.body.textContent).toContain("Technology");
  });
});
