import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateStatusBadge } from "../template-status-badge";
import { STATUS_CONFIG, type TemplateStatus } from "@/lib/template-utils";

describe("TMPL-02: TemplateStatusBadge renders all statuses", () => {
  const statuses: TemplateStatus[] = [
    "ready",
    "no_access",
    "not_ingested",
    "stale",
    "ingesting",
    "queued",
    "failed",
  ];

  statuses.forEach((status) => {
    it(`renders "${STATUS_CONFIG[status].label}" for status "${status}"`, () => {
      render(<TemplateStatusBadge status={status} />);
      expect(screen.getByText(STATUS_CONFIG[status].label)).toBeInTheDocument();
    });
  });
});
