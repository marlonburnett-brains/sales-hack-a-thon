import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/templates",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => {
    const React = require("react");
    return React.createElement("a", { href, ...props }, children);
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockDeleteTemplateAction = vi.fn();
vi.mock("@/lib/actions/template-actions", () => ({
  deleteTemplateAction: (...args: unknown[]) => mockDeleteTemplateAction(...args),
}));

vi.mock("@/components/template-status-badge", () => ({
  TemplateStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

import { TemplateTable } from "../template-table";
import type { Template } from "@/lib/api-client";

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "t1",
    name: "Alpha Template",
    presentationId: "pres1",
    googleSlidesUrl: "https://docs.google.com/presentation/d/pres1/edit",
    touchTypes: JSON.stringify(["touch_1"]),
    accessStatus: "accessible",
    lastIngestedAt: "2026-03-01T00:00:00Z",
    sourceModifiedAt: "2026-02-28T00:00:00Z",
    slideCount: 5,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("TMPL-02: Template table view", () => {
  beforeEach(() => {
    mockDeleteTemplateAction.mockReset();
  });

  it("renders table with column headers", () => {
    render(<TemplateTable templates={[makeTemplate()]} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Touch Types")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders template rows with name and status", () => {
    render(
      <TemplateTable
        templates={[
          makeTemplate({ id: "t1", name: "Alpha" }),
          makeTemplate({ id: "t2", name: "Beta" }),
        ]}
      />
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("sorts templates by name when header is clicked", () => {
    const templates = [
      makeTemplate({ id: "t1", name: "Zulu" }),
      makeTemplate({ id: "t2", name: "Alpha" }),
    ];

    render(<TemplateTable templates={templates} />);

    // Default sort: asc by name
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alpha");
    expect(rows[2]).toHaveTextContent("Zulu");

    // Click Name header to reverse sort
    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);
    const rowsAfter = screen.getAllByRole("row");
    expect(rowsAfter[1]).toHaveTextContent("Zulu");
    expect(rowsAfter[2]).toHaveTextContent("Alpha");
  });

  it("renders delete button for each template", () => {
    render(
      <TemplateTable
        templates={[makeTemplate({ id: "t1", name: "My Template" })]}
      />
    );

    expect(screen.getByLabelText("Delete My Template")).toBeInTheDocument();
  });

  it("shows confirmation dialog and calls delete action", async () => {
    mockDeleteTemplateAction.mockResolvedValue({ success: true });
    const onDeleted = vi.fn();

    render(
      <TemplateTable
        templates={[makeTemplate({ id: "t1", name: "My Template" })]}
        onDeleted={onDeleted}
      />
    );

    fireEvent.click(screen.getByLabelText("Delete My Template"));

    expect(screen.getByText("Delete template")).toBeInTheDocument();

    const deleteButtons = screen.getAllByText("Delete");
    const confirmBtn = deleteButtons[deleteButtons.length - 1]!;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteTemplateAction).toHaveBeenCalledWith("t1");
    });
  });
});
