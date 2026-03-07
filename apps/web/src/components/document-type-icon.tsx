import { cn } from "@/lib/utils";
import { getDocumentTypeConfig } from "@/lib/document-types";

interface DocumentTypeIconProps {
  mimeType?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: 16,
  md: 24,
  lg: 48,
} as const;

export function DocumentTypeIcon({
  mimeType,
  size = "md",
  className,
}: DocumentTypeIconProps) {
  const config = getDocumentTypeConfig(mimeType);
  const Icon = config.icon;
  const px = SIZE_MAP[size];

  if (size === "sm") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded",
          config.bgColor,
          className,
        )}
        style={{ width: 24, height: 24 }}
      >
        <Icon size={px} className={config.color} />
      </span>
    );
  }

  if (size === "lg") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center",
          className,
        )}
      >
        <Icon size={px} className={config.color} />
      </span>
    );
  }

  // md — icon only, no container
  return <Icon size={px} className={cn(config.color, className)} />;
}
