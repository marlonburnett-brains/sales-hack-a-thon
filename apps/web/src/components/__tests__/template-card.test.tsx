import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
const mockGetIngestionProgressAction = vi.fn();
vi.mock("@/lib/actions/template-actions", () => ({
  deleteTemplateAction: (...args: unknown[]) => mockDeleteTemplateAction(...args),
  getIngestionProgressAction: (...args: unknown[]) =>
    mockGetIngestionProgressAction(...args),
}));

vi.mock("@/components/template-status-badge", () => ({
  TemplateStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

import { TemplateCard } from "../template-card";
import type { Template } from "@/lib/api-client";

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "t1",
    name: "Test Template",
    presentationId: "pres123",
    googleSlidesUrl: "https://docs.google.com/presentation/d/pres123/edit",
    touchTypes: JSON.stringify(["touch_1", "touch_2"]),
    accessStatus: "accessible",
    lastIngestedAt: "2026-03-01T00:00:00Z",
    sourceModifiedAt: "2026-02-28T00:00:00Z",
    slideCount: 10,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TMPL-02: Template card with status badges
// ---------------------------------------------------------------------------

describe("TMPL-02: Template card with status badges", () => {
  beforeEach(() => {
    mockDeleteTemplateAction.mockReset();
    mockGetIngestionProgressAction.mockReset();
  });

  it("renders template name", () => {
    render(<TemplateCard template={makeTemplate()} />);
    expect(screen.getByText("Test Template")).toBeInTheDocument();
  });

  it("renders status badge with correct status", () => {
    render(<TemplateCard template={makeTemplate()} />);
    const badges = screen.getAllByTestId("status-badge");
    expect(badges[0]).toHaveTextContent("ready");
  });

  it("renders touch type chips", () => {
    render(<TemplateCard template={makeTemplate()} />);
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("renders slide count", () => {
    render(<TemplateCard template={makeTemplate({ slideCount: 15 })} />);
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("shows 'no_access' status and access alert for inaccessible templates", () => {
    render(
      <TemplateCard
        template={makeTemplate({ accessStatus: "not_accessible" })}
      />
    );

    const badges = screen.getAllByTestId("status-badge");
    expect(badges[0]).toHaveTextContent("no_access");
    expect(
      screen.getByText("Share file to enable ingestion")
    ).toBeInTheDocument();
  });

  it("shows 'not_ingested' for templates without lastIngestedAt", () => {
    render(
      <TemplateCard
        template={makeTemplate({ lastIngestedAt: null })}
      />
    );

    const badges = screen.getAllByTestId("status-badge");
    expect(badges[0]).toHaveTextContent("not_ingested");
  });
});

// ---------------------------------------------------------------------------
// TMPL-03: Delete template with confirmation
// ---------------------------------------------------------------------------

describe("TMPL-03: Delete template with confirmation dialog", () => {
  beforeEach(() => {
    mockDeleteTemplateAction.mockReset();
    mockGetIngestionProgressAction.mockReset();
  });

  it("shows delete option in kebab menu", async () => {
    const user = userEvent.setup();
    render(<TemplateCard template={makeTemplate()} />);

    await user.click(screen.getByLabelText("Template actions"));

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
  });

  it("opens confirmation dialog when delete is clicked", async () => {
    const user = userEvent.setup();
    render(<TemplateCard template={makeTemplate()} />);

    await user.click(screen.getByLabelText("Template actions"));
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete template")).toBeInTheDocument();
      expect(
        screen.getByText(/This will also remove all ingested slides/)
      ).toBeInTheDocument();
    });
  });

  it("calls deleteTemplateAction when deletion is confirmed", async () => {
    mockDeleteTemplateAction.mockResolvedValue({ success: true });
    const onDeleted = vi.fn();
    const user = userEvent.setup();

    render(
      <TemplateCard template={makeTemplate()} onDeleted={onDeleted} />
    );

    await user.click(screen.getByLabelText("Template actions"));
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete template")).toBeInTheDocument();
    });

    // The AlertDialog confirm button
    const confirmBtns = screen.getAllByText("Delete");
    const confirmBtn = confirmBtns[confirmBtns.length - 1]!;
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteTemplateAction).toHaveBeenCalledWith("t1");
    });
  });
});
