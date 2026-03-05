export const SLIDES_URL_REGEX =
  /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

export function extractPresentationId(url: string): string | null {
  const match = url.match(SLIDES_URL_REGEX);
  return match ? match[1] : null;
}

export type TemplateStatus = "ready" | "no_access" | "not_ingested" | "stale";

export function getTemplateStatus(template: {
  accessStatus: string;
  lastIngestedAt: string | null;
  sourceModifiedAt: string | null;
}): TemplateStatus {
  if (template.accessStatus === "not_accessible") return "no_access";
  if (!template.lastIngestedAt) return "not_ingested";
  if (template.sourceModifiedAt && template.lastIngestedAt) {
    const modified = new Date(template.sourceModifiedAt);
    const ingested = new Date(template.lastIngestedAt);
    if (modified > ingested) return "stale";
  }
  return "ready";
}

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
};
