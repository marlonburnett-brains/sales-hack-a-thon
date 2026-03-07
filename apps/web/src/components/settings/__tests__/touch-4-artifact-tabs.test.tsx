import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckStructureDetail, DeckStructureSummary } from "@/lib/api-client";

const mockGetDeckStructuresAction = vi.fn();
const mockGetDeckStructureAction = vi.fn();

vi.mock("@/lib/actions/deck-structure-actions", () => ({
  getDeckStructuresAction: (...args: unknown[]) =>
    mockGetDeckStructuresAction(...args),
  getDeckStructureAction: (...args: unknown[]) =>
    mockGetDeckStructureAction(...args),
}));

vi.mock("@/components/settings/touch-type-detail-view", () => ({
  TouchTypeDetailView: ({
    touchType,
    label,
    artifactType,
  }: {
    touchType: string;
    label: string;
    artifactType?: string;
  }) => (
    <div data-testid="touch-type-detail-view">
      {touchType}:{label}:{artifactType ?? "none"}
    </div>
  ),
}));

import { Touch4ArtifactTabs } from "../touch-4-artifact-tabs";

function makeSummary(overrides: Partial<DeckStructureSummary>): DeckStructureSummary {
  return {
    id: `summary-${overrides.artifactType ?? "proposal"}`,
    touchType: "touch_4",
    artifactType: "proposal",
    exampleCount: 0,
    confidence: 0,
    confidenceColor: "red",
    confidenceLabel: "Low confidence",
    sectionCount: 0,
    inferredAt: null,
    lastChatAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<DeckStructureDetail> = {}): DeckStructureDetail {
  return {
    touchType: "touch_4",
    artifactType: "proposal",
    structure: {
      sections: [],
      sequenceRationale: "",
    },
    exampleCount: 0,
    confidence: 0,
    confidenceColor: "red",
    confidenceLabel: "Low confidence",
    chatMessages: [],
    slideIdToThumbnail: {},
    inferredAt: null,
    lastChatAt: null,
    ...overrides,
  };
}

describe("Touch4ArtifactTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDeckStructuresAction.mockResolvedValue([
      makeSummary({
        artifactType: "proposal",
        confidence: 82,
        confidenceColor: "green",
        confidenceLabel: "High confidence",
        exampleCount: 9,
      }),
      makeSummary({
        artifactType: "talk_track",
        confidence: 38,
        confidenceColor: "red",
        confidenceLabel: "Low confidence",
        exampleCount: 1,
      }),
      makeSummary({
        artifactType: "faq",
        confidence: 61,
        confidenceColor: "yellow",
        confidenceLabel: "Medium confidence",
        exampleCount: 4,
      }),
    ]);

    mockGetDeckStructureAction.mockImplementation(
      async (_touchType: string, artifactType?: string) =>
        makeDetail({ artifactType: artifactType ?? "proposal" }),
    );
  });

  it("renders Proposal, Talk Track, and FAQ tabs with Proposal active by default", async () => {
    render(<Touch4ArtifactTabs touchType="touch_4" label="Touch 4" />);

    const proposalTab = await screen.findByRole("tab", { name: /proposal/i });
    const talkTrackTab = screen.getByRole("tab", { name: /talk track/i });
    const faqTab = screen.getByRole("tab", { name: /faq/i });

    expect(proposalTab).toHaveAttribute("data-state", "active");
    expect(talkTrackTab).toHaveAttribute("data-state", "inactive");
    expect(faqTab).toHaveAttribute("data-state", "inactive");
    expect(screen.getByTestId("touch-type-detail-view")).toHaveTextContent(
      "touch_4:Touch 4:proposal",
    );
  });

  it("shows each tab trigger's own confidence and example-count context", async () => {
    render(<Touch4ArtifactTabs touchType="touch_4" label="Touch 4" />);

    await screen.findByRole("tab", { name: /proposal/i });

    expect(screen.getByRole("tab", { name: /proposal/i })).toHaveTextContent(
      "High confidence",
    );
    expect(screen.getByRole("tab", { name: /proposal/i })).toHaveTextContent(
      "9 examples",
    );

    expect(screen.getByRole("tab", { name: /talk track/i })).toHaveTextContent(
      "Low confidence",
    );
    expect(screen.getByRole("tab", { name: /talk track/i })).toHaveTextContent(
      "1 example",
    );

    expect(screen.getByRole("tab", { name: /faq/i })).toHaveTextContent(
      "Medium confidence",
    );
    expect(screen.getByRole("tab", { name: /faq/i })).toHaveTextContent(
      "4 examples",
    );
  });

  it("switches tabs using artifact-specific detail data and reuses previously loaded artifacts", async () => {
    const user = userEvent.setup();
    render(<Touch4ArtifactTabs touchType="touch_4" label="Touch 4" />);

    await waitFor(() => {
      expect(mockGetDeckStructureAction).toHaveBeenCalledWith(
        "touch_4",
        "proposal",
      );
    });

    await user.click(screen.getByRole("tab", { name: /faq/i }));

    await waitFor(() => {
      expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_4", "faq");
    });

    expect(screen.getByTestId("touch-type-detail-view")).toHaveTextContent(
      "touch_4:Touch 4:faq",
    );

    await user.click(screen.getByRole("tab", { name: /proposal/i }));

    await waitFor(() => {
      expect(screen.getByTestId("touch-type-detail-view")).toHaveTextContent(
        "touch_4:Touch 4:proposal",
      );
    });

    expect(mockGetDeckStructureAction).toHaveBeenCalledTimes(2);
  });
});
