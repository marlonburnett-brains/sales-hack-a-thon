import { describe, expect, it } from "vitest";

import {
  getDeckStructureCronKeys,
  getDeckStructureListKeys,
  resolveDeckStructureKey,
} from "../deck-structure-key";

describe("Phase 36 deck structure key contract", () => {
  it("resolves touch_4 artifact-qualified keys", () => {
    expect(resolveDeckStructureKey("touch_4", "proposal")).toEqual({
      touchType: "touch_4",
      artifactType: "proposal",
    });
  });

  it("requires artifactType for touch_4", () => {
    expect(() => resolveDeckStructureKey("touch_4")).toThrow(
      /artifactType.*touch_4/i,
    );
  });

  it("returns the full API/list key contract", () => {
    expect(getDeckStructureListKeys()).toEqual([
      { touchType: "touch_1", artifactType: null },
      { touchType: "touch_2", artifactType: null },
      { touchType: "touch_3", artifactType: null },
      { touchType: "pre_call", artifactType: null },
      { touchType: "touch_4", artifactType: "proposal" },
      { touchType: "touch_4", artifactType: "talk_track" },
      { touchType: "touch_4", artifactType: "faq" },
    ]);
  });

  it("returns the six-key cron contract without pre_call", () => {
    expect(getDeckStructureCronKeys()).toEqual([
      { touchType: "touch_1", artifactType: null },
      { touchType: "touch_2", artifactType: null },
      { touchType: "touch_3", artifactType: null },
      { touchType: "touch_4", artifactType: "proposal" },
      { touchType: "touch_4", artifactType: "talk_track" },
      { touchType: "touch_4", artifactType: "faq" },
    ]);
  });
});
