"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, type TemplateStatus } from "@/lib/template-utils";

interface TemplateStatusBadgeProps {
  status: TemplateStatus;
}

export function TemplateStatusBadge({ status }: TemplateStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
