import { type ArtifactType } from "@lumenalta/schemas";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  getDeckStructureCronKeys,
  getDeckStructureListKeys,
  resolveDeckStructureKey,
} from "../deck-structure-key";

const _resolveDeckStructureKeyRejectsBroadArtifactString:
  string extends Parameters<typeof resolveDeckStructureKey>[1] ? never : true =
  true;

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

  it("forces non-touch_4 keys back to a null artifact", () => {
    expect(resolveDeckStructureKey("touch_1", "proposal")).toEqual({
      touchType: "touch_1",
      artifactType: null,
    });
  });

  it("accepts the shared ArtifactType contract at the helper boundary", () => {
    expectTypeOf(resolveDeckStructureKey).parameters.toEqualTypeOf<
      [touchType: string, artifactType?: ArtifactType | null]
    >();
    expect(_resolveDeckStructureKeyRejectsBroadArtifactString).toBe(true);
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
