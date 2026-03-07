import {
  Presentation,
  FileText,
  Sheet,
  File,
  type LucideIcon,
} from "lucide-react";

export interface DocumentTypeConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
}

export const DOCUMENT_TYPE_CONFIG: Record<string, DocumentTypeConfig> = {
  "application/vnd.google-apps.presentation": {
    icon: Presentation,
    label: "Google Slides",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  "application/vnd.google-apps.document": {
    icon: FileText,
    label: "Google Docs",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  "application/vnd.google-apps.spreadsheet": {
    icon: Sheet,
    label: "Google Sheets",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  "application/pdf": {
    icon: File,
    label: "PDF",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
};

const SLIDES_MIME = "application/vnd.google-apps.presentation";
const FALLBACK_MIME = "application/pdf";

/**
 * Returns icon/color config for a given MIME type.
 * Falls back to PDF config for unknown types, Slides config for undefined.
 */
export function getDocumentTypeConfig(mimeType?: string): DocumentTypeConfig {
  if (!mimeType) return DOCUMENT_TYPE_CONFIG[SLIDES_MIME];
  return DOCUMENT_TYPE_CONFIG[mimeType] ?? DOCUMENT_TYPE_CONFIG[FALLBACK_MIME];
}

/**
 * Returns true only for Google Slides MIME type (the only ingestible type).
 */
export function isIngestible(mimeType?: string): boolean {
  return mimeType === SLIDES_MIME;
}
