/**
 * Phase 21 - PREV-01: Slide preview at presentation size with navigation
 *
 * Tests the SlideViewerClient component's navigation logic, slide counter display,
 * keyboard navigation, and thumbnail strip integration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SlideViewerClient } from "@/app/(authenticated)/templates/[id]/slides/slide-viewer-client";
import type { SlideData, SlideThumbnail } from "@/lib/actions/slide-actions";

const mockClassificationPanel = vi.fn(
  ({ artifactType }: { artifactType?: string | null }) =>
    React.createElement(
      "div",
      { "data-testid": "classification-panel-props" },
      artifactType ?? "null"
    )
);

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/components/slide-viewer/classification-panel", () => ({
  ClassificationPanel: (props: { artifactType?: string | null }) =>
    mockClassificationPanel(props),
}));

// Mock server actions
vi.mock("@/lib/actions/slide-actions", () => ({
  findSimilarSlidesAction: vi.fn().mockResolvedValue({ results: [] }),
  updateSlideClassificationAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

// Mock the Dialog component to render inline
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? React.createElement("div", null, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
}));

// Mock @lumenalta/schemas
vi.mock("@lumenalta/schemas", () => ({
  INDUSTRIES: ["Technology", "Healthcare"],
  SOLUTION_PILLARS: ["AI, ML & LLM", "Cloud & Infrastructure"],
  BUYER_PERSONAS: ["CIO", "CTO"],
  FUNNEL_STAGES: ["First Contact", "Intro Conversation"],
  CONTENT_TYPES: ["template", "example"],
  SLIDE_CATEGORIES: ["title", "industry_overview"],
}));

// Mock scrollIntoView which is not available in jsdom
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function makeSlides(count: number): SlideData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `slide-${i}`,
    slideIndex: i,
    slideObjectId: `obj-${i}`,
    contentText: `Content for slide ${i}`,
    classificationJson: JSON.stringify({
      industries: ["Technology"],
      solutionPillars: ["Cloud & Infrastructure"],
      buyerPersonas: ["CIO"],
      funnelStages: ["First Contact"],
      contentType: "template",
      slideCategory: "title",
    }),
    confidence: 80 + i,
    needsReReview: false,
    reviewStatus: "unreviewed",
    industry: "Technology",
    solutionPillar: "Cloud & Infrastructure",
    persona: "CIO",
    funnelStage: "First Contact",
    contentType: "template",
  }));
}

function makeThumbnails(count: number): SlideThumbnail[] {
  return Array.from({ length: count }, (_, i) => ({
    slideObjectId: `obj-${i}`,
    slideIndex: i,
    thumbnailUrl: `https://slides.example.com/thumb-${i}.png`,
  }));
}

describe("PREV-01: Slide viewer navigation and display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("forwards persisted artifactType into ClassificationPanel", () => {
    render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Artifact Deck"
        initialSlides={makeSlides(1)}
        initialThumbnails={makeThumbnails(1)}
        contentClassification="example"
        touchTypes={["touch_4"]}
        artifactType="proposal"
      />
    );

    expect(mockClassificationPanel.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        contentClassification: "example",
        touchTypes: ["touch_4"],
        artifactType: "proposal",
      }),
    );
    expect(screen.getByTestId("classification-panel-props")).toHaveTextContent(
      "proposal",
    );
  });

  it("shows slide counter as '1 of N' on initial render", () => {
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(5)}
        initialThumbnails={makeThumbnails(5)}
      />
    );

    expect(container.textContent).toContain("1 of 5");
  });

  it("displays template name as heading", () => {
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="My Presentation"
        initialSlides={makeSlides(3)}
        initialThumbnails={makeThumbnails(3)}
      />
    );

    expect(container.textContent).toContain("My Presentation");
  });

  it("navigates forward with next button and updates counter", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(5)}
        initialThumbnails={makeThumbnails(5)}
      />
    );

    const nextButtons = screen.getAllByRole("button", { name: /next slide/i });
    await user.click(nextButtons[0]);

    await waitFor(() => {
      expect(container.textContent).toContain("2 of 5");
    });
  });

  it("navigates backward with previous button", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(5)}
        initialThumbnails={makeThumbnails(5)}
      />
    );

    // Go forward first
    const nextButtons = screen.getAllByRole("button", { name: /next slide/i });
    await user.click(nextButtons[0]);
    await user.click(nextButtons[0]);

    await waitFor(() => {
      expect(container.textContent).toContain("3 of 5");
    });

    // Go back
    const prevButtons = screen.getAllByRole("button", { name: /previous slide/i });
    await user.click(prevButtons[0]);

    await waitFor(() => {
      expect(container.textContent).toContain("2 of 5");
    });
  });

  it("disables previous button on first slide", () => {
    render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(3)}
        initialThumbnails={makeThumbnails(3)}
      />
    );

    const prevButtons = screen.getAllByRole("button", { name: /previous slide/i });
    expect(prevButtons[0]).toBeDisabled();
  });

  it("disables next button on last slide", async () => {
    const user = userEvent.setup();
    const slides = makeSlides(2);
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={slides}
        initialThumbnails={makeThumbnails(2)}
      />
    );

    const nextButtons = screen.getAllByRole("button", { name: /next slide/i });
    await user.click(nextButtons[0]);

    await waitFor(() => {
      expect(container.textContent).toContain("2 of 2");
    });

    expect(nextButtons[0]).toBeDisabled();
  });

  it("navigates via ArrowRight keyboard shortcut", async () => {
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(5)}
        initialThumbnails={makeThumbnails(5)}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(container.textContent).toContain("2 of 5");
    });
  });

  it("navigates via ArrowLeft keyboard shortcut", async () => {
    const { container } = render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(5)}
        initialThumbnails={makeThumbnails(5)}
      />
    );

    // Go forward first
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(container.textContent).toContain("3 of 5");
    });

    fireEvent.keyDown(window, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(container.textContent).toContain("2 of 5");
    });
  });

  it("renders thumbnail images in the viewer", () => {
    render(
      <SlideViewerClient
        templateId="tmpl-1"
        templateName="Test Deck"
        initialSlides={makeSlides(4)}
        initialThumbnails={makeThumbnails(4)}
      />
    );

    // Thumbnails are rendered as img elements
    const thumbImages = screen.getAllByRole("img");
    // Main preview image + 4 thumbnails = at least 5
    expect(thumbImages.length).toBeGreaterThanOrEqual(4);
  });
});
