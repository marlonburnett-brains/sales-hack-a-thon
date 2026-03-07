import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/templates",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => {
    return React.createElement("a", { href, ...props }, children);
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockDeleteTemplateAction = vi.fn();
const mockGetIngestionProgressAction = vi.fn();
const mockClassifyTemplateAction = vi.fn();
const mockTriggerIngestionAction = vi.fn();
const mockCheckStalenessAction = vi.fn();
vi.mock("@/lib/actions/template-actions", () => ({
  deleteTemplateAction: (...args: unknown[]) => mockDeleteTemplateAction(...args),
  getIngestionProgressAction: (...args: unknown[]) =>
    mockGetIngestionProgressAction(...args),
  classifyTemplateAction: (...args: unknown[]) =>
    mockClassifyTemplateAction(...args),
  triggerIngestionAction: (...args: unknown[]) =>
    mockTriggerIngestionAction(...args),
  checkStalenessAction: (...args: unknown[]) =>
    mockCheckStalenessAction(...args),
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
    ingestionStatus: "idle",
    ingestionProgress: null,
    contentClassification: null,
    artifactType: null,
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
    cleanup();
    mockDeleteTemplateAction.mockReset();
    mockGetIngestionProgressAction.mockReset();
    mockClassifyTemplateAction.mockReset();
    mockTriggerIngestionAction.mockReset();
    mockCheckStalenessAction.mockReset();
  });

  it("renders template name", () => {
    render(<TemplateCard template={makeTemplate()} />);
    expect(screen.getByText("Test Template")).toBeInTheDocument();
  });

  it("renders status badge with correct status", () => {
    render(<TemplateCard template={makeTemplate()} />);
    expect(screen.getByText("Classify")).toBeInTheDocument();
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

    expect(screen.getByText("No Access")).toBeInTheDocument();
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

    expect(screen.getByText("Not Ingested")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TMPL-03: Delete template with confirmation
// ---------------------------------------------------------------------------

describe("TMPL-03: Delete template with confirmation dialog", () => {
  beforeEach(() => {
    cleanup();
    mockDeleteTemplateAction.mockReset();
    mockGetIngestionProgressAction.mockReset();
    mockClassifyTemplateAction.mockReset();
    mockTriggerIngestionAction.mockReset();
    mockCheckStalenessAction.mockReset();
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

describe("CLSF-01: Template card Touch 4 artifact flow", () => {
  beforeEach(() => {
    cleanup();
    mockDeleteTemplateAction.mockReset();
    mockGetIngestionProgressAction.mockReset();
    mockClassifyTemplateAction.mockReset();
    mockTriggerIngestionAction.mockReset();
    mockCheckStalenessAction.mockReset();
  });

  it("shows artifact radios only for Example Touch 4, blocks save until selected, and renders the saved artifact badge", async () => {
    mockClassifyTemplateAction.mockResolvedValue({ success: true });
    const onRefresh = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <TemplateCard template={makeTemplate()} onRefresh={onRefresh} />
    );

    await user.click(screen.getByLabelText("Template actions"));
    await user.click(await screen.findByRole("menuitem", { name: /^classify$/i }));

    expect(screen.queryByRole("radiogroup", { name: /artifact type/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Example" }));
    await user.click(screen.getByRole("radio", { name: /touch 4\+/i }));

    expect(screen.getByRole("radiogroup", { name: /artifact type/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /proposal/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /talk track/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /faq/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/select an artifact type for touch 4 examples/i)).toBeInTheDocument();
    expect(mockClassifyTemplateAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: /proposal/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockClassifyTemplateAction).toHaveBeenCalledWith(
        "t1",
        "example",
        ["touch_4"],
        "proposal",
      );
    });

    rerender(
      <TemplateCard
        template={makeTemplate({
          contentClassification: "example",
          touchTypes: JSON.stringify(["touch_4"]),
          artifactType: "proposal",
        })}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("Example (Touch 4+ - Proposal)")).toBeInTheDocument();
  });

  it("uses radio inputs for example touch selection so only one touch can be chosen", async () => {
    const user = userEvent.setup();

    render(<TemplateCard template={makeTemplate()} />);

    await user.click(screen.getByLabelText("Template actions"));
    await user.click(await screen.findByRole("menuitem", { name: /^classify$/i }));
    await user.click(screen.getByRole("button", { name: "Example" }));

    const dialog = screen.getByRole("dialog", { name: /classify presentation/i });

    expect(within(dialog).getAllByRole("radio")).toHaveLength(4);
    expect(within(dialog).queryAllByRole("checkbox")).toHaveLength(0);
  });
});
