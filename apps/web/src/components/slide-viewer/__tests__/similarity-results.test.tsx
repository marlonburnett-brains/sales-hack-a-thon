/**
 * Phase 21 - SLIDE-09: Similarity search functionality
 *
 * Tests the SimilarityResults component rendering and the
 * similarity color logic, classification tag parsing, and empty/loading states.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { SimilarityResults } from "../similarity-results";
import type { SimilarSlide } from "@/lib/actions/slide-actions";

// Mock next/link for test environment
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

// Mock Dialog to render children directly (avoid portal issues in tests)
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? React.createElement("div", { "data-testid": "dialog" }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dialog-content" }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
}));

// Mock Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
}));

function makeSimilarSlide(overrides: Partial<SimilarSlide> = {}): SimilarSlide {
  return {
    id: "sim-1",
    templateId: "tmpl-1",
    slideIndex: 2,
    slideObjectId: "obj-sim-1",
    contentText: "Similar content",
    classificationJson: JSON.stringify({
      industries: ["Healthcare"],
      solutionPillars: ["AI, ML & LLM"],
    }),
    confidence: 90,
    reviewStatus: "unreviewed",
    similarity: 0.85,
    ...overrides,
  };
}

describe("SLIDE-09: Similarity search results display", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders similar slides with similarity score as percentage", () => {
    const results: SimilarSlide[] = [
      makeSimilarSlide({ id: "s1", similarity: 0.92 }),
      makeSimilarSlide({ id: "s2", similarity: 0.67, slideIndex: 5 }),
    ];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "Test Template"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    expect(container.textContent).toContain("Similar Slides");
    expect(container.textContent).toContain("92%");
    expect(container.textContent).toContain("67%");
  });

  it("shows template name for each result", () => {
    const results = [makeSimilarSlide()];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "My Presentation"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    expect(container.textContent).toContain("My Presentation");
  });

  it("shows 'Unknown Template' when template name not found", () => {
    const results = [makeSimilarSlide({ templateId: "unknown-tmpl" })];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map()}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    expect(container.textContent).toContain("Unknown Template");
  });

  it("shows slide index as 1-based label", () => {
    const results = [makeSimilarSlide({ slideIndex: 4 })];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "Test"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    expect(container.textContent).toContain("Slide 5");
  });

  it("shows classification tags (industry and pillar) from classificationJson", () => {
    const results = [
      makeSimilarSlide({
        classificationJson: JSON.stringify({
          industries: ["Education"],
          solutionPillars: ["Cloud & Infrastructure"],
        }),
      }),
    ];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "Test"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    expect(container.textContent).toContain("Education");
    expect(container.textContent).toContain("Cloud & Infrastructure");
  });

  it("displays loading skeletons when isLoading is true", () => {
    render(
      <SimilarityResults
        results={[]}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map()}
        onClose={vi.fn()}
        isLoading={true}
      />
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state message when no similar slides found", () => {
    const { container } = render(
      <SimilarityResults
        results={[]}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map()}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    expect(container.textContent).toContain("No similar slides found");
  });

  it("renders links to per-template viewer for each result", () => {
    const results = [
      makeSimilarSlide({ id: "s1", templateId: "tmpl-abc" }),
    ];

    render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-abc", "Template ABC"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "/templates/tmpl-abc/slides");
  });

  it("applies green color class for similarity >= 80%", () => {
    const results = [makeSimilarSlide({ similarity: 0.85, id: "green-test" })];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "Test"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    // Find the percentage text element and check its class
    const pctElements = container.querySelectorAll(".text-green-600");
    expect(pctElements.length).toBeGreaterThanOrEqual(1);
    // Verify the text content contains the expected percentage
    const greenPct = Array.from(pctElements).find(el => el.textContent?.includes("85%"));
    expect(greenPct).toBeTruthy();
  });

  it("applies amber color class for similarity >= 60% and < 80%", () => {
    const results = [makeSimilarSlide({ similarity: 0.72, id: "amber-test" })];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "Test"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    const pctElements = container.querySelectorAll(".text-amber-600");
    expect(pctElements.length).toBeGreaterThanOrEqual(1);
    const amberPct = Array.from(pctElements).find(el => el.textContent?.includes("72%"));
    expect(amberPct).toBeTruthy();
  });

  it("applies slate color class for similarity < 60%", () => {
    const results = [makeSimilarSlide({ similarity: 0.45, id: "slate-test" })];

    const { container } = render(
      <SimilarityResults
        results={results}
        sourceSlideId="src-1"
        thumbnails={new Map()}
        templateNames={new Map([["tmpl-1", "Test"]])}
        onClose={vi.fn()}
        isLoading={false}
      />
    );

    const pctElements = container.querySelectorAll(".text-slate-500");
    expect(pctElements.length).toBeGreaterThanOrEqual(1);
    const slatePct = Array.from(pctElements).find(el => el.textContent?.includes("45%"));
    expect(slatePct).toBeTruthy();
  });
});
