import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockNotFound = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("@/components/settings/touch-4-artifact-tabs", () => ({
  Touch4ArtifactTabs: ({
    touchType,
    label,
  }: {
    touchType: string;
    label: string;
  }) => <div data-testid="touch-4-tabs">{touchType}:{label}</div>,
}));

vi.mock("@/components/settings/touch-type-detail-view", () => ({
  TouchTypeDetailView: ({
    touchType,
    label,
  }: {
    touchType: string;
    label: string;
  }) => <div data-testid="touch-type-detail-view">{touchType}:{label}</div>,
}));

import TouchTypePage from "../page";

describe("TouchTypePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Touch 4 artifact tab shell for the touch-4 route", async () => {
    const page = await TouchTypePage({
      params: Promise.resolve({ touchType: "touch-4" }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: /touch 4 deck structure/i })).toBeInTheDocument();
    expect(screen.getByTestId("touch-4-tabs")).toHaveTextContent("touch_4:Touch 4");
    expect(screen.queryByTestId("touch-type-detail-view")).not.toBeInTheDocument();
  });

  it("keeps Touch 1-3 routes on the existing detail view", async () => {
    const page = await TouchTypePage({
      params: Promise.resolve({ touchType: "touch-2" }),
    });

    render(page);

    expect(screen.getByTestId("touch-type-detail-view")).toHaveTextContent(
      "touch_2:Touch 2",
    );
    expect(screen.queryByTestId("touch-4-tabs")).not.toBeInTheDocument();
  });
});
