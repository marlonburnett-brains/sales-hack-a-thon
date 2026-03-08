import {
  ARTIFACT_TYPES,
  type ArtifactType,
  TOUCH_TYPES,
} from "@lumenalta/schemas";

type TouchType = (typeof TOUCH_TYPES)[number];

const LIST_TOUCH_TYPES = TOUCH_TYPES.filter((touchType) => touchType !== "touch_4");
const CRON_TOUCH_TYPES = TOUCH_TYPES.filter(
  (touchType) => touchType !== "touch_4" && touchType !== "pre_call",
);

export type DeckStructureKey = {
  touchType: TouchType;
  artifactType: ArtifactType | null;
};

function isTouchType(value: string): value is TouchType {
  return TOUCH_TYPES.includes(value as TouchType);
}

function isTouch4(touchType: TouchType): touchType is "touch_4" {
  return touchType === "touch_4";
}

function isArtifactType(value: string): value is ArtifactType {
  return ARTIFACT_TYPES.includes(value as ArtifactType);
}

export function resolveDeckStructureKey(
  touchType: string,
  artifactType: ArtifactType | null = null,
): DeckStructureKey {
  if (!isTouchType(touchType)) {
    throw new Error(`Unsupported touchType: ${touchType}`);
  }

  if (!isTouch4(touchType)) {
    return { touchType, artifactType: null };
  }

  if (!artifactType) {
    throw new Error("artifactType is required for touch_4 deck structures");
  }

  if (!isArtifactType(artifactType)) {
    throw new Error(`Unsupported artifactType for touch_4: ${artifactType}`);
  }

  return { touchType, artifactType };
}

export function getDeckStructureListKeys(): DeckStructureKey[] {
  return [
    ...LIST_TOUCH_TYPES.map((touchType) => resolveDeckStructureKey(touchType)),
    ...ARTIFACT_TYPES.map((artifactType) =>
      resolveDeckStructureKey("touch_4", artifactType),
    ),
  ];
}

export function getDeckStructureCronKeys(): DeckStructureKey[] {
  return [
    ...CRON_TOUCH_TYPES.map((touchType) => resolveDeckStructureKey(touchType)),
    ...ARTIFACT_TYPES.map((artifactType) =>
      resolveDeckStructureKey("touch_4", artifactType),
    ),
  ];
}
