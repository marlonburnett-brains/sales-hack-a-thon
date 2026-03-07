"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, type TemplateStatus } from "@/lib/template-utils";

interface IngestionStatusBadgeProps {
  status: TemplateStatus;
}

/**
 * Shared status badge for ingestion status display.
 * Same rendering as TemplateStatusBadge but importable from a neutral path.
 */
export function IngestionStatusBadge({ status }: IngestionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
