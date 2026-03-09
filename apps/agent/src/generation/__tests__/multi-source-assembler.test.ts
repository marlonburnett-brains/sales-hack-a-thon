import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAssembleDeckFromSlides } = vi.hoisted(() => ({
  mockAssembleDeckFromSlides: vi.fn(),
}));

vi.mock("../../lib/deck-customizer", () => ({
  assembleDeckFromSlides: mockAssembleDeckFromSlides,
}));

import type { SlideSelectionEntry, SlideSelectionPlan } from "@lumenalta/schemas";
import {
  assembleMultiSourceDeck,
  buildMultiSourcePlan,
  groupSlidesBySource,
} from "../multi-source-assembler";

function makeEntry(
  slideId: string,
  sourcePresentationId: string,
  templateId = `tpl-${sourcePresentationId}`,
): SlideSelectionEntry {
  return {
    sectionName: `Section for ${slideId}`,
    slideId,
    sourcePresentationId,
    templateId,
    matchRationale: `Matched ${slideId}`,
  };
}

function makePlan(selections: SlideSelectionEntry[]): SlideSelectionPlan {
  return { selections };
}

describe("groupSlidesBySource", () => {
  it("groups slides by source presentationId across multiple sources", () => {
    const groups = groupSlidesBySource([
      makeEntry("s1", "pres-a"),
      makeEntry("s2", "pres-a"),
      makeEntry("s3", "pres-a"),
      makeEntry("s4", "pres-b"),
      makeEntry("s5", "pres-b"),
      makeEntry("s6", "pres-c"),
    ]);

    expect(groups.size).toBe(3);
    expect([...groups.keys()]).toEqual(["pres-a", "pres-b", "pres-c"]);
    expect(groups.get("pres-a")?.map((entry) => entry.slideId)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
    expect(groups.get("pres-b")?.map((entry) => entry.slideId)).toEqual([
      "s4",
      "s5",
    ]);
    expect(groups.get("pres-c")?.map((entry) => entry.slideId)).toEqual(["s6"]);
  });

  it("returns a single group when all slides share one source", () => {
    const groups = groupSlidesBySource([
      makeEntry("s1", "pres-a"),
      makeEntry("s2", "pres-a"),
    ]);

    expect(groups.size).toBe(1);
    expect(groups.get("pres-a")?.map((entry) => entry.slideId)).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("returns an empty map for empty selections", () => {
    expect(groupSlidesBySource([]).size).toBe(0);
  });
});

describe("buildMultiSourcePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a plan with primary keep/delete ids, secondary sources, and final order", () => {
    const selectionPlan = makePlan([
      makeEntry("s1", "pres-a", "tpl-a"),
      makeEntry("s2", "pres-a", "tpl-a"),
      makeEntry("s3", "pres-a", "tpl-a"),
      makeEntry("s4", "pres-b", "tpl-b"),
    ]);

    const plan = buildMultiSourcePlan(
      selectionPlan,
      new Map([
        ["pres-a", ["s1", "s2", "s3", "s99"]],
        ["pres-b", ["s4", "s100"]],
      ]),
    );

    expect(plan).toEqual({
      primarySource: {
        templateId: "tpl-a",
        presentationId: "pres-a",
        keepSlideIds: ["s1", "s2", "s3"],
        deleteSlideIds: ["s99"],
      },
      secondarySources: [
        {
          templateId: "tpl-b",
          presentationId: "pres-b",
          slideIds: ["s4"],
        },
      ],
      finalSlideOrder: ["s1", "s2", "s3", "s4"],
    });
  });

  it("uses insertion order to break ties for the primary source", () => {
    const selectionPlan = makePlan([
      makeEntry("s1", "pres-a", "tpl-a"),
      makeEntry("s2", "pres-a", "tpl-a"),
      makeEntry("s3", "pres-b", "tpl-b"),
      makeEntry("s4", "pres-b", "tpl-b"),
    ]);

    const plan = buildMultiSourcePlan(
      selectionPlan,
      new Map([
        ["pres-a", ["s1", "s2", "sx"]],
        ["pres-b", ["s3", "s4", "sy"]],
      ]),
    );

    expect(plan.primarySource.presentationId).toBe("pres-a");
    expect(plan.primarySource.keepSlideIds).toEqual(["s1", "s2"]);
    expect(plan.secondarySources).toEqual([
      {
        templateId: "tpl-b",
        presentationId: "pres-b",
        slideIds: ["s3", "s4"],
      },
    ]);
  });

  it("returns an empty secondarySources array for single-source selections", () => {
    const selectionPlan = makePlan([
      makeEntry("s1", "pres-a", "tpl-a"),
      makeEntry("s2", "pres-a", "tpl-a"),
    ]);

    const plan = buildMultiSourcePlan(
      selectionPlan,
      new Map([["pres-a", ["s1", "s2", "s3"]]]),
    );

    expect(plan.primarySource.presentationId).toBe("pres-a");
    expect(plan.primarySource.keepSlideIds).toEqual(["s1", "s2"]);
    expect(plan.primarySource.deleteSlideIds).toEqual(["s3"]);
    expect(plan.secondarySources).toEqual([]);
    expect(plan.finalSlideOrder).toEqual(["s1", "s2"]);
  });
});

describe("assembleMultiSourceDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates single-source plans to assembleDeckFromSlides", async () => {
    mockAssembleDeckFromSlides.mockResolvedValue({
      presentationId: "assembled-1",
      driveUrl: "https://docs.google.com/presentation/d/assembled-1/edit",
    });

    const plan = buildMultiSourcePlan(
      makePlan([
        makeEntry("s1", "pres-a", "tpl-a"),
        makeEntry("s2", "pres-a", "tpl-a"),
      ]),
      new Map([["pres-a", ["s1", "s2", "s3"]]]),
    );

    const result = await assembleMultiSourceDeck({
      plan,
      targetFolderId: "folder-1",
      deckName: "My Deck",
    });

    expect(mockAssembleDeckFromSlides).toHaveBeenCalledOnce();
    expect(mockAssembleDeckFromSlides).toHaveBeenCalledWith({
      sourcePresentationId: "pres-a",
      selectedSlideIds: ["s1", "s2"],
      slideOrder: ["s1", "s2"],
      targetFolderId: "folder-1",
      deckName: "My Deck",
    });
    expect(result).toEqual({
      presentationId: "assembled-1",
      driveUrl: "https://docs.google.com/presentation/d/assembled-1/edit",
    });
  });

  it("throws a not implemented error for multi-source plans until plan 02", async () => {
    const plan = buildMultiSourcePlan(
      makePlan([
        makeEntry("s1", "pres-a", "tpl-a"),
        makeEntry("s2", "pres-a", "tpl-a"),
        makeEntry("s3", "pres-b", "tpl-b"),
      ]),
      new Map([
        ["pres-a", ["s1", "s2"]],
        ["pres-b", ["s3"]],
      ]),
    );

    await expect(
      assembleMultiSourceDeck({
        plan,
        targetFolderId: "folder-1",
        deckName: "My Deck",
      }),
    ).rejects.toThrow("Not implemented");

    expect(mockAssembleDeckFromSlides).not.toHaveBeenCalled();
  });
});
