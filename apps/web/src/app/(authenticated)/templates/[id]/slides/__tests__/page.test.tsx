import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockListSlidesAction = vi.fn();
const mockGetSlideThumbnailsAction = vi.fn();
const mockListTemplatesAction = vi.fn();

vi.mock("@/lib/actions/slide-actions", () => ({
  listSlidesAction: (...args: unknown[]) => mockListSlidesAction(...args),
  getSlideThumbnailsAction: (...args: unknown[]) =>
    mockGetSlideThumbnailsAction(...args),
}));

vi.mock("@/lib/actions/template-actions", () => ({
  listTemplatesAction: (...args: unknown[]) => mockListTemplatesAction(...args),
}));

vi.mock("../slide-viewer-client", () => ({
  SlideViewerClient: ({
    templateId,
    templateName,
    contentClassification,
    touchTypes,
    artifactType,
  }: {
    templateId: string;
    templateName: string;
    contentClassification?: string | null;
    touchTypes?: string[];
    artifactType?: string | null;
  }) => (
    <div data-testid="slide-viewer-client">
      <span>{templateId}</span>
      <span>{templateName}</span>
      <span>{contentClassification ?? "null"}</span>
      <span>{JSON.stringify(touchTypes ?? [])}</span>
      <span>{artifactType ?? "null"}</span>
    </div>
  ),
}));

import SlidesPage from "../page";

describe("SlidesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSlidesAction.mockResolvedValue([
      {
        id: "slide-1",
        slideIndex: 0,
        slideObjectId: "obj-1",
        contentText: "Slide 1",
        classificationJson: null,
        confidence: 88,
        needsReReview: false,
        reviewStatus: "unreviewed",
        industry: null,
        solutionPillar: null,
        persona: null,
        funnelStage: null,
        contentType: "template",
      },
    ]);
    mockGetSlideThumbnailsAction.mockResolvedValue({ thumbnails: [] });
    mockListTemplatesAction.mockResolvedValue([
      {
        id: "tmpl-1",
        name: "Persisted Deck",
        contentClassification: "example",
        touchTypes: JSON.stringify(["touch_4"]),
        artifactType: "talk_track",
      },
    ]);
  });

  it("reads persisted artifactType from the template and passes it to SlideViewerClient", async () => {
    const page = await SlidesPage({ params: Promise.resolve({ id: "tmpl-1" }) });

    render(page);

    expect(screen.getByTestId("slide-viewer-client")).toHaveTextContent("tmpl-1");
    expect(screen.getByTestId("slide-viewer-client")).toHaveTextContent("Persisted Deck");
    expect(screen.getByTestId("slide-viewer-client")).toHaveTextContent("example");
    expect(screen.getByTestId("slide-viewer-client")).toHaveTextContent(
      JSON.stringify(["touch_4"]),
    );
    expect(screen.getByTestId("slide-viewer-client")).toHaveTextContent("talk_track");
  });
});
