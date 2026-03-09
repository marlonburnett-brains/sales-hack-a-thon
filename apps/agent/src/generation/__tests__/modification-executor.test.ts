import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSlidesClient, mockGet, mockBatchUpdate } = vi.hoisted(() => ({
  mockGetSlidesClient: vi.fn(),
  mockGet: vi.fn(),
  mockBatchUpdate: vi.fn(),
}));

vi.mock("../../lib/google-auth", () => ({
  getSlidesClient: mockGetSlidesClient,
}));

import type { ModificationPlan } from "../modification-plan-schema";
import { executeModifications } from "../modification-executor";

function makePlan(
  slideId: string,
  slideObjectId: string,
  modifications: ModificationPlan["modifications"],
): ModificationPlan {
  return {
    slideId,
    slideObjectId,
    modifications,
    unmodifiedElements: [],
  };
}

function makePresentation(
  slides: Array<{ objectId: string; elementIds: string[] }>,
) {
  return {
    data: {
      slides: slides.map((slide) => ({
        objectId: slide.objectId,
        pageElements: slide.elementIds.map((elementId) => ({ objectId: elementId })),
      })),
    },
  };
}

function makeSlidesClient() {
  return {
    presentations: {
      get: mockGet,
      batchUpdate: mockBatchUpdate,
    },
  };
}

describe("executeModifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlidesClient.mockReturnValue(makeSlidesClient());
    mockGet.mockResolvedValue(makePresentation([]));
    mockBatchUpdate.mockResolvedValue({});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("builds deleteText ALL + insertText pairs for each modification", async () => {
    mockGet.mockResolvedValue(
      makePresentation([{ objectId: "slide-1", elementIds: ["el-1", "el-2"] }]),
    );

    await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-1",
            currentContent: "Current A",
            newContent: "Updated A",
            reason: "Tailor company name",
          },
          {
            elementId: "el-2",
            currentContent: "Current B",
            newContent: "Updated B",
            reason: "Tailor industry",
          },
        ]),
      ],
    });

    expect(mockBatchUpdate).toHaveBeenCalledOnce();
    expect(mockBatchUpdate).toHaveBeenCalledWith({
      presentationId: "presentation-1",
      requestBody: {
        requests: [
          {
            deleteText: {
              objectId: "el-1",
              textRange: { type: "ALL" },
            },
          },
          {
            insertText: {
              objectId: "el-1",
              insertionIndex: 0,
              text: "Updated A",
            },
          },
          {
            deleteText: {
              objectId: "el-2",
              textRange: { type: "ALL" },
            },
          },
          {
            insertText: {
              objectId: "el-2",
              insertionIndex: 0,
              text: "Updated B",
            },
          },
        ],
      },
    });
  });

  it("scopes all operations to element objectIds, never uses replaceAllText", async () => {
    mockGet.mockResolvedValue(
      makePresentation([{ objectId: "slide-1", elementIds: ["el-1"] }]),
    );

    await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-1",
            currentContent: "Current",
            newContent: "Updated",
            reason: "Tailor content",
          },
        ]),
      ],
    });

    const requests = mockBatchUpdate.mock.calls.flatMap(
      ([call]) => call.requestBody?.requests ?? [],
    );

    expect(requests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ replaceAllText: expect.anything() })]),
    );

    for (const request of requests) {
      if ("deleteText" in request) {
        expect(request.deleteText?.objectId).toBe("el-1");
      }

      if ("insertText" in request) {
        expect(request.insertText?.objectId).toBe("el-1");
      }
    }
  });

  it("re-reads presentation after each slide batchUpdate", async () => {
    mockGet
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-1", elementIds: ["el-1"] }]),
      )
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-2", elementIds: ["el-2"] }]),
      )
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-3", elementIds: ["el-3"] }]),
      );

    await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-1",
            currentContent: "Current 1",
            newContent: "Updated 1",
            reason: "Reason 1",
          },
        ]),
        makePlan("slide-db-2", "slide-2", [
          {
            elementId: "el-2",
            currentContent: "Current 2",
            newContent: "Updated 2",
            reason: "Reason 2",
          },
        ]),
        makePlan("slide-db-3", "slide-3", [
          {
            elementId: "el-3",
            currentContent: "Current 3",
            newContent: "Updated 3",
            reason: "Reason 3",
          },
        ]),
      ],
    });

    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(3);

    const getOrders = mockGet.mock.invocationCallOrder;
    const batchOrders = mockBatchUpdate.mock.invocationCallOrder;

    expect(getOrders[0]).toBeLessThan(batchOrders[0]);
    expect(batchOrders[0]).toBeLessThan(getOrders[1]);
    expect(batchOrders[1]).toBeLessThan(getOrders[2]);
  });

  it("skips failed slides and continues with remaining", async () => {
    mockGet
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-1", elementIds: ["el-1"] }]),
      )
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-2", elementIds: ["el-2"] }]),
      )
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-3", elementIds: ["el-3"] }]),
      );

    mockBatchUpdate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({});

    const result = await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-1",
            currentContent: "Current 1",
            newContent: "Updated 1",
            reason: "Reason 1",
          },
        ]),
        makePlan("slide-db-2", "slide-2", [
          {
            elementId: "el-2",
            currentContent: "Current 2",
            newContent: "Updated 2",
            reason: "Reason 2",
          },
        ]),
        makePlan("slide-db-3", "slide-3", [
          {
            elementId: "el-3",
            currentContent: "Current 3",
            newContent: "Updated 3",
            reason: "Reason 3",
          },
        ]),
      ],
    });

    expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalled();
    expect(result.results.map((entry) => entry.status)).toEqual([
      "success",
      "skipped",
      "success",
    ]);
    expect(result.totalApplied).toBe(2);
    expect(result.totalSkipped).toBe(1);
  });

  it("skips elements that no longer exist in presentation", async () => {
    mockGet.mockResolvedValue(
      makePresentation([{ objectId: "slide-1", elementIds: ["el-exists"] }]),
    );

    const result = await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-gone",
            currentContent: "Current missing",
            newContent: "Updated missing",
            reason: "Reason missing",
          },
          {
            elementId: "el-exists",
            currentContent: "Current existing",
            newContent: "Updated existing",
            reason: "Reason existing",
          },
        ]),
      ],
    });

    expect(console.warn).toHaveBeenCalled();
    expect(mockBatchUpdate).toHaveBeenCalledWith({
      presentationId: "presentation-1",
      requestBody: {
        requests: [
          {
            deleteText: {
              objectId: "el-exists",
              textRange: { type: "ALL" },
            },
          },
          {
            insertText: {
              objectId: "el-exists",
              insertionIndex: 0,
              text: "Updated existing",
            },
          },
        ],
      },
    });
    expect(result.totalApplied).toBe(1);
  });

  it("skips slides with zero modifications", async () => {
    const result = await executeModifications({
      presentationId: "presentation-1",
      plans: [makePlan("slide-db-1", "slide-1", [])],
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(result.results).toEqual([
      {
        slideId: "slide-db-1",
        slideObjectId: "slide-1",
        status: "no_modifications",
        modificationsApplied: 0,
      },
    ]);
  });

  it("trims trailing newlines from newContent", async () => {
    mockGet.mockResolvedValue(
      makePresentation([{ objectId: "slide-1", elementIds: ["el-1"] }]),
    );

    await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-1",
            currentContent: "Current",
            newContent: "Hello\n",
            reason: "Reason",
          },
        ]),
      ],
    });

    const firstCall = mockBatchUpdate.mock.calls[0]?.[0];
    const insertRequest = firstCall.requestBody?.requests?.find(
      (request: { insertText?: { text?: string } }) => request.insertText,
    );

    expect(insertRequest?.insertText?.text).toBe("Hello");
  });

  it("returns correct result counts", async () => {
    mockGet
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-1", elementIds: ["el-1", "el-2", "el-3"] }]),
      )
      .mockResolvedValueOnce(
        makePresentation([{ objectId: "slide-2", elementIds: ["el-4", "el-5", "el-6"] }]),
      )
      .mockResolvedValueOnce(makePresentation([]));

    const result = await executeModifications({
      presentationId: "presentation-1",
      plans: [
        makePlan("slide-db-1", "slide-1", [
          {
            elementId: "el-1",
            currentContent: "Current 1",
            newContent: "Updated 1",
            reason: "Reason 1",
          },
          {
            elementId: "el-2",
            currentContent: "Current 2",
            newContent: "Updated 2",
            reason: "Reason 2",
          },
          {
            elementId: "el-3",
            currentContent: "Current 3",
            newContent: "Updated 3",
            reason: "Reason 3",
          },
        ]),
        makePlan("slide-db-2", "slide-2", [
          {
            elementId: "el-4",
            currentContent: "Current 4",
            newContent: "Updated 4",
            reason: "Reason 4",
          },
          {
            elementId: "el-5",
            currentContent: "Current 5",
            newContent: "Updated 5",
            reason: "Reason 5",
          },
          {
            elementId: "el-6",
            currentContent: "Current 6",
            newContent: "Updated 6",
            reason: "Reason 6",
          },
        ]),
        makePlan("slide-db-3", "missing-slide", [
          {
            elementId: "el-7",
            currentContent: "Current 7",
            newContent: "Updated 7",
            reason: "Reason 7",
          },
        ]),
      ],
    });

    expect(result.totalApplied).toBe(6);
    expect(result.totalSkipped).toBe(1);
    expect(result.results).toEqual([
      {
        slideId: "slide-db-1",
        slideObjectId: "slide-1",
        status: "success",
        modificationsApplied: 3,
      },
      {
        slideId: "slide-db-2",
        slideObjectId: "slide-2",
        status: "success",
        modificationsApplied: 3,
      },
      {
        slideId: "slide-db-3",
        slideObjectId: "missing-slide",
        status: "skipped",
        modificationsApplied: 0,
        error: expect.stringContaining("missing-slide"),
      },
    ]);
  });
});
