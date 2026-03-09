import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAssembleDeckFromSlides,
  mockGetDriveClient,
  mockGetSlidesClient,
  mockShareWithOrg,
} = vi.hoisted(() => ({
  mockAssembleDeckFromSlides: vi.fn(),
  mockGetDriveClient: vi.fn(),
  mockGetSlidesClient: vi.fn(),
  mockShareWithOrg: vi.fn(),
}));

vi.mock("../../lib/deck-customizer", () => ({
  assembleDeckFromSlides: mockAssembleDeckFromSlides,
}));

vi.mock("../../lib/google-auth", () => ({
  getDriveClient: mockGetDriveClient,
  getSlidesClient: mockGetSlidesClient,
}));

vi.mock("../../lib/drive-folders", () => ({
  shareWithOrg: mockShareWithOrg,
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

function makePresentation(slideIds: string[], slideTextById: Record<string, string[]> = {}) {
  return {
    data: {
      slides: slideIds.map((slideId) => ({
        objectId: slideId,
        pageElements: (slideTextById[slideId] ?? []).map((text, index) => ({
          objectId: `${slideId}-shape-${index + 1}`,
          shape: {
            text: {
              textElements: [{ textRun: { content: text } }],
            },
          },
          size: {
            height: { magnitude: 100, unit: "PT" },
            width: { magnitude: 200, unit: "PT" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 10 + index,
            translateY: 20 + index,
            unit: "PT",
          },
        })),
      })),
    },
  };
}

function makeDriveClient(overrides?: {
  copy?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
}) {
  return {
    files: {
      copy:
        overrides?.copy ??
        vi
          .fn()
          .mockResolvedValueOnce({ data: { id: "primary-copy" } })
          .mockResolvedValueOnce({ data: { id: "secondary-copy-1" } })
          .mockResolvedValueOnce({ data: { id: "secondary-copy-2" } }),
      delete: overrides?.delete ?? vi.fn().mockResolvedValue({}),
    },
  };
}

function makeSlidesClient(overrides?: {
  get?: ReturnType<typeof vi.fn>;
  batchUpdate?: ReturnType<typeof vi.fn>;
}) {
  return {
    presentations: {
      get:
        overrides?.get ??
        vi
          .fn()
          .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
          .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
          .mockResolvedValueOnce(makePresentation(["s4", "sx"], { s4: ["Secondary intro"] }))
          .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
          .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"])),
      batchUpdate: overrides?.batchUpdate ?? vi.fn().mockResolvedValue({}),
    },
  };
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
    mockShareWithOrg.mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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

  it("copies the primary source, injects secondary slides, reorders the deck, and shares the assembled presentation", async () => {
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient();
    mockGetDriveClient.mockReturnValue(driveClient);
    mockGetSlidesClient.mockReturnValue(slidesClient);

    const plan = buildMultiSourcePlan(
      makePlan([
        makeEntry("p1", "pres-a", "tpl-a"),
        makeEntry("s4", "pres-b", "tpl-b"),
        makeEntry("p2", "pres-a", "tpl-a"),
      ]),
      new Map([
        ["pres-a", ["p1", "p2", "p3"]],
        ["pres-b", ["s4", "sx"]],
      ]),
    );

    const result = await assembleMultiSourceDeck({
      plan,
      targetFolderId: "folder-1",
      deckName: "My Deck",
      ownerEmail: "owner@lumenalta.com",
    });

    expect(mockAssembleDeckFromSlides).not.toHaveBeenCalled();
    expect(driveClient.files.copy).toHaveBeenNthCalledWith(1, {
      fileId: "pres-a",
      requestBody: {
        name: "My Deck",
        parents: ["folder-1"],
      },
      supportsAllDrives: true,
    });
    expect(driveClient.files.copy).toHaveBeenNthCalledWith(2, {
      fileId: "pres-b",
      requestBody: {
        name: "_temp_secondary_tpl-b_1",
      },
      supportsAllDrives: true,
    });

    expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(1, {
      presentationId: "primary-copy",
      requestBody: {
        requests: [{ deleteObject: { objectId: "p3" } }],
      },
    });

    expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(2, {
      presentationId: "primary-copy",
      requestBody: {
        requests: [
          { createSlide: { objectId: "generated-s4", insertionIndex: 2 } },
          {
            createShape: {
              objectId: "generated-s4-shape-1",
              shapeType: "TEXT_BOX",
              elementProperties: {
                pageObjectId: "generated-s4",
                size: {
                  height: { magnitude: 100, unit: "PT" },
                  width: { magnitude: 200, unit: "PT" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: 10,
                  translateY: 20,
                  unit: "PT",
                },
              },
            },
          },
          {
            insertText: {
              objectId: "generated-s4-shape-1",
              insertionIndex: 0,
              text: "Secondary intro",
            },
          },
        ],
      },
    });

    expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(3, {
      presentationId: "primary-copy",
      requestBody: {
        requests: [
          { updateSlidesPosition: { slideObjectIds: ["p1"], insertionIndex: 0 } },
          { updateSlidesPosition: { slideObjectIds: ["p2"], insertionIndex: 2 } },
          {
            updateSlidesPosition: { slideObjectIds: ["generated-s4"], insertionIndex: 1 },
          },
        ],
      },
    });

    expect(driveClient.files.delete).toHaveBeenCalledWith({
      fileId: "secondary-copy-1",
      supportsAllDrives: true,
    });
    expect(mockShareWithOrg).toHaveBeenCalledWith({
      fileId: "primary-copy",
      ownerEmail: "owner@lumenalta.com",
    });
    expect(result).toEqual({
      presentationId: "primary-copy",
      driveUrl: "https://docs.google.com/presentation/d/primary-copy/edit",
    });
  });

  it("skips primary delete batchUpdate when there are no primary slides to prune", async () => {
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"])),
    });
    mockGetDriveClient.mockReturnValue(driveClient);
    mockGetSlidesClient.mockReturnValue(slidesClient);

    const result = await assembleMultiSourceDeck({
      plan: {
        primarySource: {
          templateId: "tpl-a",
          presentationId: "pres-a",
          keepSlideIds: ["p1", "p2"],
          deleteSlideIds: [],
        },
        secondarySources: [
          {
            templateId: "tpl-b",
            presentationId: "pres-b",
            slideIds: [],
          },
        ],
        finalSlideOrder: ["p1", "p2"],
      },
      targetFolderId: "folder-1",
      deckName: "No Prune Deck",
    });

    expect(slidesClient.presentations.batchUpdate).toHaveBeenCalledOnce();
    expect(slidesClient.presentations.batchUpdate).toHaveBeenCalledWith({
      presentationId: "primary-copy",
      requestBody: {
        requests: [
          { updateSlidesPosition: { slideObjectIds: ["p1"], insertionIndex: 0 } },
          { updateSlidesPosition: { slideObjectIds: ["p2"], insertionIndex: 1 } },
        ],
      },
    });
    expect(result.presentationId).toBe("primary-copy");
  });

  it("warns and skips missing secondary slides while continuing assembly", async () => {
    const warnSpy = vi.mocked(console.warn);
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["sx"], { sx: ["Other"] }))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"])),
    });
    mockGetDriveClient.mockReturnValue(driveClient);
    mockGetSlidesClient.mockReturnValue(slidesClient);

    const result = await assembleMultiSourceDeck({
      plan: buildMultiSourcePlan(
        makePlan([
          makeEntry("p1", "pres-a", "tpl-a"),
          makeEntry("s5", "pres-b", "tpl-b"),
          makeEntry("p2", "pres-a", "tpl-a"),
        ]),
        new Map([
          ["pres-a", ["p1", "p2", "p3"]],
          ["pres-b", ["s5", "sx"]],
        ]),
      ),
      targetFolderId: "folder-1",
      deckName: "Missing Slide Deck",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing secondary slide s5 in pres-b, skipping"),
    );
    expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(2, {
      presentationId: "primary-copy",
      requestBody: {
        requests: [
          { updateSlidesPosition: { slideObjectIds: ["p1"], insertionIndex: 0 } },
          { updateSlidesPosition: { slideObjectIds: ["p2"], insertionIndex: 1 } },
        ],
      },
    });
    expect(result.presentationId).toBe("primary-copy");
  });

  it("continues assembling when a secondary copy fails", async () => {
    const errorSpy = vi.mocked(console.error);
    const copy = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "primary-copy" } })
      .mockResolvedValueOnce({ data: { id: "secondary-copy-1" } })
      .mockRejectedValueOnce(new Error("copy failed"));
    const driveClient = makeDriveClient({ copy });
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["s4"], { s4: ["Secondary intro"] }))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"])),
    });
    mockGetDriveClient.mockReturnValue(driveClient);
    mockGetSlidesClient.mockReturnValue(slidesClient);

    const result = await assembleMultiSourceDeck({
      plan: {
        primarySource: {
          templateId: "tpl-a",
          presentationId: "pres-a",
          keepSlideIds: ["p1", "p2"],
          deleteSlideIds: ["p3"],
        },
        secondarySources: [
          {
            templateId: "tpl-b",
            presentationId: "pres-b",
            slideIds: ["s4"],
          },
          {
            templateId: "tpl-c",
            presentationId: "pres-c",
            slideIds: ["s6"],
          },
        ],
        finalSlideOrder: ["p1", "s4", "p2", "s6"],
      },
      targetFolderId: "folder-1",
      deckName: "Partial Deck",
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to copy secondary presentation pres-c"),
    );
    expect(driveClient.files.delete).toHaveBeenCalledTimes(1);
    expect(result.presentationId).toBe("primary-copy");
  });

  it("logs cleanup failures without throwing and continues deleting remaining temp copies", async () => {
    const warnSpy = vi.mocked(console.warn);
    const deleteMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("delete failed"))
      .mockResolvedValueOnce({});
    const driveClient = makeDriveClient({ delete: deleteMock });
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(makePresentation(["s4"], { s4: ["Secondary intro"] }))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
        .mockResolvedValueOnce(makePresentation(["s6"], { s6: ["Secondary close"] }))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4", "generated-s6"]))
        .mockResolvedValueOnce(
          makePresentation(["p1", "p2", "generated-s4", "generated-s6"]),
        ),
    });
    const copy = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "primary-copy" } })
      .mockResolvedValueOnce({ data: { id: "secondary-copy-1" } })
      .mockResolvedValueOnce({ data: { id: "secondary-copy-2" } });
    driveClient.files.copy = copy;
    mockGetDriveClient.mockReturnValue(driveClient);
    mockGetSlidesClient.mockReturnValue(slidesClient);

    const result = await assembleMultiSourceDeck({
      plan: {
        primarySource: {
          templateId: "tpl-a",
          presentationId: "pres-a",
          keepSlideIds: ["p1", "p2"],
          deleteSlideIds: ["p3"],
        },
        secondarySources: [
          {
            templateId: "tpl-b",
            presentationId: "pres-b",
            slideIds: ["s4"],
          },
          {
            templateId: "tpl-c",
            presentationId: "pres-c",
            slideIds: ["s6"],
          },
        ],
        finalSlideOrder: ["p1", "s4", "p2", "s6"],
      },
      targetFolderId: "folder-1",
      deckName: "Cleanup Deck",
    });

    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to clean up temp file secondary-copy-1"),
    );
    expect(result.presentationId).toBe("primary-copy");
  });
});
