import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetDeckStructureCronKeys,
  mockComputeDataHash,
  mockInferDeckStructure,
  mockFindFirst,
  mockSetTimeout,
  mockSetInterval,
  mockConsoleError,
  mockConsoleLog,
} = vi.hoisted(() => ({
  mockGetDeckStructureCronKeys: vi.fn(),
  mockComputeDataHash: vi.fn(),
  mockInferDeckStructure: vi.fn(),
  mockFindFirst: vi.fn(),
  mockSetTimeout: vi.fn(),
  mockSetInterval: vi.fn(),
  mockConsoleError: vi.fn(),
  mockConsoleLog: vi.fn(),
}));

vi.mock("../deck-structure-key", () => ({
  getDeckStructureCronKeys: mockGetDeckStructureCronKeys,
}));

vi.mock("../infer-deck-structure", () => ({
  computeDataHash: mockComputeDataHash,
  inferDeckStructure: mockInferDeckStructure,
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    deckStructure: {
      findFirst: mockFindFirst,
    },
  },
}));

describe("Phase 36 cron deck keys", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetDeckStructureCronKeys.mockReturnValue([
      { touchType: "touch_1", artifactType: null },
      { touchType: "touch_2", artifactType: null },
      { touchType: "touch_3", artifactType: null },
      { touchType: "touch_4", artifactType: "proposal" },
      { touchType: "touch_4", artifactType: "talk_track" },
      { touchType: "touch_4", artifactType: "faq" },
    ]);
    mockComputeDataHash.mockResolvedValue("hash-next");
    mockInferDeckStructure.mockResolvedValue({ sections: [], sequenceRationale: "" });
    mockFindFirst.mockResolvedValue(null);

    vi.stubGlobal("setTimeout", mockSetTimeout);
    vi.stubGlobal("setInterval", mockSetInterval);
    vi.stubGlobal("console", {
      ...console,
      log: mockConsoleLog,
      error: mockConsoleError,
    });
  });

  async function startAndRunOnce() {
    const mod = await import("../auto-infer-cron");
    mod.startDeckInferenceCron();

    const startupCallback = mockSetTimeout.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(startupCallback).toBeTypeOf("function");
    startupCallback?.();

    for (let i = 0; i < 25; i += 1) {
      await Promise.resolve();
    }
  }

  it("iterates exactly the six cron keys and excludes pre_call", async () => {
    await startAndRunOnce();

    expect(mockGetDeckStructureCronKeys).toHaveBeenCalledTimes(1);
    expect(mockComputeDataHash).toHaveBeenCalledTimes(6);
    expect(mockComputeDataHash).toHaveBeenNthCalledWith(1, { touchType: "touch_1", artifactType: null });
    expect(mockComputeDataHash).toHaveBeenNthCalledWith(6, { touchType: "touch_4", artifactType: "faq" });
    expect(mockComputeDataHash).not.toHaveBeenCalledWith(
      expect.objectContaining({ touchType: "pre_call" }),
    );
  });

  it("checks active chat protection per matching artifact row", async () => {
    const recent = new Date(Date.now() - 5 * 60_000);
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ dataHash: "old", lastChatAt: recent, chatContextJson: "proposal chat" })
      .mockResolvedValueOnce({ dataHash: "old", lastChatAt: null, chatContextJson: "talk track chat" })
      .mockResolvedValueOnce({ dataHash: "old", lastChatAt: null, chatContextJson: "faq chat" });

    await startAndRunOnce();

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { touchType: "touch_4", artifactType: "proposal" },
      }),
    );
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { touchType: "touch_4", artifactType: "talk_track" },
      }),
    );
    expect(mockInferDeckStructure).not.toHaveBeenCalledWith(
      { touchType: "touch_4", artifactType: "proposal" },
      expect.anything(),
    );
    expect(mockInferDeckStructure).toHaveBeenCalledWith(
      { touchType: "touch_4", artifactType: "talk_track" },
      "talk track chat",
    );
  });

  it("logs a failing key and continues the loop", async () => {
    mockInferDeckStructure
      .mockResolvedValueOnce({ sections: [], sequenceRationale: "" })
      .mockResolvedValueOnce({ sections: [], sequenceRationale: "" })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ sections: [], sequenceRationale: "" })
      .mockResolvedValueOnce({ sections: [], sequenceRationale: "" })
      .mockResolvedValueOnce({ sections: [], sequenceRationale: "" });

    await startAndRunOnce();

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error inferring touch_3"),
    );
    expect(mockInferDeckStructure).toHaveBeenCalledTimes(6);
    expect(mockInferDeckStructure).toHaveBeenLastCalledWith(
      { touchType: "touch_4", artifactType: "faq" },
      undefined,
    );
  });
});
