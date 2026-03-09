import type { slides_v1 } from "googleapis";
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

function makeSize(): slides_v1.Schema$Size {
  return {
    height: { magnitude: 100, unit: "PT" },
    width: { magnitude: 200, unit: "PT" },
  };
}

function makeTransform(offset = 0): slides_v1.Schema$AffineTransform {
  return {
    scaleX: 1,
    scaleY: 1,
    shearX: 0,
    shearY: 0,
    translateX: 10 + offset,
    translateY: 20 + offset,
    unit: "PT",
  };
}

function makeTextShapeElement(
  objectId: string,
  text: string,
  index = 0,
  shapeType = "TEXT_BOX",
): slides_v1.Schema$PageElement {
  return {
    objectId,
    shape: {
      shapeType,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: {
            color: { rgbColor: { red: 1, green: 0, blue: 0 } },
          },
        },
      },
      text: {
        textElements: [
          {
            textRun: {
              content: text,
              style: { bold: true },
            },
            startIndex: 0,
            endIndex: text.length,
          },
          {
            paragraphMarker: {
              style: { alignment: "CENTER" },
              bullet: { listId: "bullet-1" },
            },
            startIndex: 0,
            endIndex: text.length,
          }
        ],
      },
    },
    size: makeSize(),
    transform: makeTransform(index),
  };
}

function makeImageElement(
  objectId: string,
  sourceUrl: string,
  index = 0,
): slides_v1.Schema$PageElement {
  return {
    objectId,
    image: {
      sourceUrl,
    },
    size: makeSize(),
    transform: makeTransform(index),
  };
}

function makeShapeElement(
  objectId: string,
  shapeType: string,
  index = 0,
  text?: string,
): slides_v1.Schema$PageElement {
  return {
    objectId,
    shape: {
      shapeType,
      text: text
        ? {
            textElements: [{ textRun: { content: text } }],
          }
        : undefined,
    },
    size: makeSize(),
    transform: makeTransform(index),
  };
}

function makeTableElement(
  objectId: string,
  rows: string[][],
  index = 0,
): slides_v1.Schema$PageElement {
  return {
    objectId,
    table: {
      rows: rows.length,
      columns: rows[0]?.length ?? 0,
      tableRows: rows.map((row) => ({
        tableCells: row.map((text) => ({
          text: text
            ? {
                textElements: [{ textRun: { content: text } }],
              }
            : undefined,
        })),
      })),
    },
    size: makeSize(),
    transform: makeTransform(index),
  };
}

function makeGroupElement(
  objectId: string,
  children: slides_v1.Schema$PageElement[],
): slides_v1.Schema$PageElement {
  return {
    objectId,
    elementGroup: {
      children,
    },
  };
}

function makeUnsupportedVideoElement(
  objectId: string,
  index = 0,
): slides_v1.Schema$PageElement {
  return {
    objectId,
    video: {},
    size: makeSize(),
    transform: makeTransform(index),
  };
}

function makePresentation(
  slideIds: string[],
  slideElementsById: Record<string, Array<string | slides_v1.Schema$PageElement>> = {},
) {
  return {
    data: {
      slides: slideIds.map((slideId) => ({
        objectId: slideId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: { rgbColor: { red: 1, green: 1, blue: 1 } },
            },
          },
        },
        pageElements: (slideElementsById[slideId] ?? []).map((element, index) =>
          typeof element === "string"
            ? makeTextShapeElement(`${slideId}-shape-${index + 1}`, element, index)
            : element,
        ),
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

  it("copies the primary source, rebuilds supported secondary elements, surfaces unsupported ones, reorders the deck, and shares the assembled presentation", async () => {
    const warnSpy = vi.mocked(console.warn);
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(
          makePresentation(["s4", "sx"], {
            s4: [
              makeImageElement("s4-image-1", "https://example.com/image.png", 0),
              makeShapeElement("s4-shape-1", "RECTANGLE", 1),
              makeTableElement(
                "s4-table-1",
                [
                  ["Revenue", "Growth"],
                  ["$10M", "20%"],
                ],
                2,
              ),
              makeGroupElement("s4-group-1", [
                makeShapeElement("s4-group-child-shape", "ROUND_RECTANGLE", 3, "Grouped text"),
                makeImageElement("s4-group-child-image", "https://example.com/group.png", 4),
              ]),
              makeUnsupportedVideoElement("s4-video-1", 5),
            ],
          }),
        )
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"])),
    });
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
        parents: ["folder-1"],
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
            updatePageProperties: {
              objectId: "generated-s4",
              pageProperties: {
                pageBackgroundFill: {
                  solidFill: {
                    color: { rgbColor: { red: 1, green: 1, blue: 1 } },
                  },
                },
              },
              fields: "pageBackgroundFill",
            },
          },
          {
            createImage: {
              objectId: "generated-s4-ima-s4-image-1-1-42a31bacc0b7",
              url: "https://example.com/image.png",
              elementProperties: {
                pageObjectId: "generated-s4",
                size: makeSize(),
                transform: makeTransform(0),
              },
            },
          },
          {
            createShape: {
              objectId: "generated-s4-sha-s4-shape-1-1-92c42adeca25",
              shapeType: "RECTANGLE",
              elementProperties: {
                pageObjectId: "generated-s4",
                size: makeSize(),
                transform: makeTransform(1),
              },
            },
          },
          {
            createTable: {
              objectId: "generated-s4-tab-s4-table-1-1-1d1d5fa7cbe9",
              rows: 2,
              columns: 2,
              elementProperties: {
                pageObjectId: "generated-s4",
                size: makeSize(),
                transform: makeTransform(2),
              },
            },
          },
          {
            insertText: {
              objectId: "generated-s4-tab-s4-table-1-1-1d1d5fa7cbe9",
              cellLocation: {
                rowIndex: 0,
                columnIndex: 0,
              },
              insertionIndex: 0,
              text: "Revenue",
            },
          },
          {
            insertText: {
              objectId: "generated-s4-tab-s4-table-1-1-1d1d5fa7cbe9",
              cellLocation: {
                rowIndex: 0,
                columnIndex: 1,
              },
              insertionIndex: 0,
              text: "Growth",
            },
          },
          {
            insertText: {
              objectId: "generated-s4-tab-s4-table-1-1-1d1d5fa7cbe9",
              cellLocation: {
                rowIndex: 1,
                columnIndex: 0,
              },
              insertionIndex: 0,
              text: "$10M",
            },
          },
          {
            insertText: {
              objectId: "generated-s4-tab-s4-table-1-1-1d1d5fa7cbe9",
              cellLocation: {
                rowIndex: 1,
                columnIndex: 1,
              },
              insertionIndex: 0,
              text: "20%",
            },
          },
          {
            createShape: {
              objectId: "generated-s4-sha-s4-group-c-2-1a7f3f8a891f",
              shapeType: "ROUND_RECTANGLE",
              elementProperties: {
                pageObjectId: "generated-s4",
                size: makeSize(),
                transform: makeTransform(3),
              },
            },
          },
          {
            insertText: {
              objectId: "generated-s4-sha-s4-group-c-2-1a7f3f8a891f",
              insertionIndex: 0,
              text: "Grouped text",
            },
          },
          {
            createImage: {
              objectId: "generated-s4-ima-s4-group-c-2-d7dcb427e603",
              url: "https://example.com/group.png",
              elementProperties: {
                pageObjectId: "generated-s4",
                size: makeSize(),
                transform: makeTransform(4),
              },
            },
          },
          {
            createShape: {
              objectId: "generated-s4-pla-s4-video-1-1-6aec0cd78457",
              shapeType: "TEXT_BOX",
              elementProperties: {
                pageObjectId: "generated-s4",
                size: makeSize(),
                transform: makeTransform(5),
              },
            },
          },
          {
            insertText: {
              objectId: "generated-s4-pla-s4-video-1-1-6aec0cd78457",
              insertionIndex: 0,
              text: "Unsupported element: video\nSource slide: s4\nElement: s4-video-1",
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
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported element s4-video-1 (video) on source slide s4"),
    );
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

  it("generates unique rebuilt object ids even when long source ids share the same suffix", async () => {
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce(
          makePresentation(["s4"], {
            s4: [
              makeImageElement(
                "extremely-long-source-element-alpha-shared-suffix-1234567890",
                "https://example.com/alpha.png",
                0,
              ),
              makeImageElement(
                "extremely-long-source-element-beta-shared-suffix-1234567890",
                "https://example.com/beta.png",
                1,
              ),
            ],
          }),
        )
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"])),
    });
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
        ["pres-b", ["s4"]],
      ]),
    );

    await assembleMultiSourceDeck({
      plan,
      targetFolderId: "folder-1",
      deckName: "Collision Deck",
    });

    const rebuildRequests = vi.mocked(slidesClient.presentations.batchUpdate).mock.calls[1]?.[0]
      ?.requestBody?.requests;
    const createdImageIds = (rebuildRequests ?? [])
      .map((request) => request.createImage?.objectId)
      .filter((objectId): objectId is string => Boolean(objectId));

    expect(createdImageIds).toHaveLength(2);
    expect(new Set(createdImageIds).size).toBe(2);
    expect(createdImageIds.every((objectId) => objectId.length <= 50)).toBe(true);
  });

  it("uses a safe fallback transform for unsupported placeholders when source transform is non-invertible", async () => {
    const warnSpy = vi.mocked(console.warn);
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce({
          data: {
            slides: [
              {
                objectId: "s4",
                pageElements: [
                  {
                    objectId: "unsupported-line",
                    line: {},
                    size: makeSize(),
                    transform: {
                      scaleX: 1,
                      scaleY: 0,
                      shearX: 0,
                      shearY: 0,
                      translateX: 42,
                      translateY: 84,
                      unit: "PT",
                    },
                  },
                ],
              },
            ],
          },
        })
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"])),
    });
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
        ["pres-b", ["s4"]],
      ]),
    );

    await assembleMultiSourceDeck({
      plan,
      targetFolderId: "folder-1",
      deckName: "Transform Fallback Deck",
    });

    const rebuildRequests = vi.mocked(slidesClient.presentations.batchUpdate).mock.calls[1]?.[0]
      ?.requestBody?.requests;
    const placeholderRequest = (rebuildRequests ?? []).find((request) => request.createShape)
      ?.createShape;

    expect(placeholderRequest?.shapeType).toBe("TEXT_BOX");
    expect(placeholderRequest?.elementProperties?.transform).toEqual({
      scaleX: 1,
      scaleY: 1,
      shearX: 0,
      shearY: 0,
      translateX: 42,
      translateY: 84,
      unit: "PT",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported element unsupported-line (line) on source slide s4"),
    );
  });

  it("normalizes supported element transforms so Slides requests always include invertible affine matrices", async () => {
    const driveClient = makeDriveClient();
    const slidesClient = makeSlidesClient({
      get: vi
        .fn()
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "p3"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2"]))
        .mockResolvedValueOnce({
          data: {
            slides: [
              {
                objectId: "s4",
                pageElements: [
                  {
                    objectId: "line-backed-shape",
                    shape: {
                      shapeType: "RECTANGLE",
                    },
                    size: makeSize(),
                    transform: {
                      scaleY: 0.0702,
                      translateX: 6824638.545,
                      translateY: 1753607.6825,
                      unit: "EMU",
                    },
                  },
                ],
              },
            ],
          },
        })
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"]))
        .mockResolvedValueOnce(makePresentation(["p1", "p2", "generated-s4"])),
    });
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
        ["pres-b", ["s4"]],
      ]),
    );

    await assembleMultiSourceDeck({
      plan,
      targetFolderId: "folder-1",
      deckName: "Normalized Transform Deck",
    });

    const rebuildRequests = vi.mocked(slidesClient.presentations.batchUpdate).mock.calls[1]?.[0]
      ?.requestBody?.requests;
    const shapeRequest = (rebuildRequests ?? []).find((request) => request.createShape)?.createShape;

    expect(shapeRequest?.elementProperties?.transform).toEqual({
      scaleX: 1,
      scaleY: 0.0702,
      shearX: 0,
      shearY: 0,
      translateX: 6824638.545,
      translateY: 1753607.6825,
      unit: "EMU",
    });
  });
});
