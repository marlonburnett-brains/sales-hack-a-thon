import {
  ARTIFACT_TYPE_LABELS,
  type ArtifactType,
} from "@lumenalta/schemas";

export const SLIDES_URL_REGEX =
  /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

export function extractPresentationId(url: string): string | null {
  const match = url.match(SLIDES_URL_REGEX);
  return match ? match[1] : null;
}

export type TemplateStatus =
  | "ready"
  | "no_access"
  | "not_ingested"
  | "stale"
  | "ingesting"
  | "queued"
  | "failed"
  | "classify";

export function getTemplateStatus(template: {
  accessStatus: string;
  lastIngestedAt: string | null;
  sourceModifiedAt: string | null;
  ingestionStatus?: string;
  slideCount?: number;
  contentClassification?: string | null;
}): TemplateStatus {
  // Check ingestion status first (takes priority during active ingestion)
  if (template.ingestionStatus === "ingesting") return "ingesting";
  if (template.ingestionStatus === "queued") return "queued";
  if (template.ingestionStatus === "failed") return "failed";

  if (template.accessStatus === "not_accessible") return "no_access";
  if (!template.lastIngestedAt) return "not_ingested";

  // If ingestion ran but produced zero slides, treat as failed.
  // This catches cases where per-slide processing errors caused all
  // slides to be skipped (e.g., Vertex AI configuration issues).
  if (
    template.slideCount !== undefined &&
    template.slideCount === 0 &&
    template.ingestionStatus === "idle"
  ) {
    return "failed";
  }

  if (template.sourceModifiedAt && template.lastIngestedAt) {
    const modified = new Date(template.sourceModifiedAt);
    const ingested = new Date(template.lastIngestedAt);
    if (modified > ingested) return "stale";
  }

  // Ingested but not yet classified -- prompt user to classify
  if (template.contentClassification == null) return "classify";

  return "ready";
}

export type ContentClassification = "template" | "example";

export function getClassificationLabel(
  classification: string | null | undefined,
  touchTypes?: string[],
  artifactType?: ArtifactType | null,
): string {
  if (!classification) return "Unclassified";
  if (classification === "template") return "Template";
  if (classification === "example") {
    const touches = touchTypes ?? [];
    if (touches.length > 0) {
      if (touches.length === 1 && touches[0] === "touch_4" && artifactType) {
        return `Example (Touch 4+ - ${ARTIFACT_TYPE_LABELS[artifactType]})`;
      }
      const labels = touches.map((t) => TOUCH_LABEL_MAP[t] ?? t);
      return `Example (${labels.join(", ")})`;
    }
    return "Example";
  }
  return classification;
}

const TOUCH_LABEL_MAP: Record<string, string> = {
  touch_1: "Touch 1",
  touch_2: "Touch 2",
  touch_3: "Touch 3",
  touch_4: "Touch 4+",
};

export const TOUCH_TYPES = [
  { value: "touch_1", label: "Touch 1" },
  { value: "touch_2", label: "Touch 2" },
  { value: "touch_3", label: "Touch 3" },
  { value: "touch_4", label: "Touch 4+" },
] as const;

export const STATUS_CONFIG: Record<
  TemplateStatus,
  { label: string; className: string }
> = {
  ready: {
    label: "Ready",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  no_access: {
    label: "No Access",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  not_ingested: {
    label: "Not Ingested",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  stale: {
    label: "Stale",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  ingesting: {
    label: "Ingesting...",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200 animate-pulse",
  },
  queued: {
    label: "Queued",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  classify: {
    label: "Classify",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
};
