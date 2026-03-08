import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ArtifactType } from "@lumenalta/schemas";
import type {
  DeckStructureDetail,
  DeckStructureSummary,
} from "@/lib/api-client";

const mockGetDeckStructuresAction = vi.fn();
const mockGetDeckStructureAction = vi.fn();
const accordionProps = vi.fn();

vi.mock("@/lib/actions/deck-structure-actions", () => ({
  getDeckStructuresAction: (...args: unknown[]) =>
    mockGetDeckStructuresAction(...args),
  getDeckStructureAction: (...args: unknown[]) =>
    mockGetDeckStructureAction(...args),
}));

vi.mock("../touch-type-accordion", () => ({
  TouchTypeAccordion: (props: {
    touchType: string;
    label?: string;
    artifactType?: ArtifactType;
    structure: DeckStructureDetail | null;
  }) => {
    accordionProps(props);
    return React.createElement(
      "div",
      { "data-testid": "accordion-row" },
      props.label ?? props.touchType,
    );
  },
}));

import { DeckStructureView } from "../deck-structure-view";

function makeSummary(
  touchType: string,
  overrides: Partial<DeckStructureSummary> = {},
): DeckStructureSummary {
  return {
    id: `${touchType}-${overrides.artifactType ?? "base"}`,
    touchType,
    artifactType: null,
    exampleCount: 3,
    confidence: 82,
    confidenceColor: "green",
    confidenceLabel: "High confidence",
    sectionCount: 2,
    inferredAt: null,
    lastChatAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeDetail(
  touchType: string,
  artifactType: ArtifactType | null = null,
): DeckStructureDetail {
  return {
    touchType,
    artifactType,
    structure: {
      sections: [],
      sequenceRationale: "",
    },
    exampleCount: 3,
    confidence: 82,
    confidenceColor: "green",
    confidenceLabel: "High confidence",
    chatMessages: [],
    slideIdToThumbnail: {},
    inferredAt: null,
    lastChatAt: null,
  };
}

describe("DeckStructureView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDeckStructuresAction.mockResolvedValue([
      makeSummary("touch_1"),
      makeSummary("touch_2"),
      makeSummary("touch_3"),
      makeSummary("touch_4", { artifactType: "proposal" }),
      makeSummary("touch_4", { artifactType: "talk_track" }),
      makeSummary("touch_4", { artifactType: "faq" }),
    ]);

    mockGetDeckStructureAction.mockImplementation(
      async (touchType: string, artifactType?: ArtifactType) =>
        makeDetail(touchType, artifactType ?? null),
    );
  });

  it("renders separate artifact-qualified Touch 4 rows and requests each matching detail", async () => {
    render(<DeckStructureView />);

    await waitFor(() => {
      expect(mockGetDeckStructureAction).toHaveBeenCalledTimes(6);
    });

    expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_1", undefined);
    expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_2", undefined);
    expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_3", undefined);
    expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_4", "proposal");
    expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_4", "talk_track");
    expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_4", "faq");

    const renderedRows = await screen.findAllByTestId("accordion-row");
    expect(renderedRows).toHaveLength(6);
    expect(renderedRows.map((row) => row.textContent)).toEqual([
      "Touch 1",
      "Touch 2",
      "Touch 3",
      "Proposal",
      "Talk Track",
      "FAQ",
    ]);

    expect(accordionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        touchType: "touch_4",
        artifactType: "proposal",
        label: "Proposal",
      }),
    );
    expect(accordionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        touchType: "touch_4",
        artifactType: "talk_track",
        label: "Talk Track",
      }),
    );
    expect(accordionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        touchType: "touch_4",
        artifactType: "faq",
        label: "FAQ",
      }),
    );
  });

  it("keeps non-Touch-4 rows single and unqualified", async () => {
    render(<DeckStructureView />);

    const renderedRows = await screen.findAllByTestId("accordion-row");
    expect(renderedRows).toHaveLength(6);

    expect(accordionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        touchType: "touch_1",
        artifactType: undefined,
        label: "Touch 1",
      }),
    );
    expect(accordionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        touchType: "touch_2",
        artifactType: undefined,
        label: "Touch 2",
      }),
    );
    expect(accordionProps).toHaveBeenCalledWith(
      expect.objectContaining({
        touchType: "touch_3",
        artifactType: undefined,
        label: "Touch 3",
      }),
    );
  });
});
