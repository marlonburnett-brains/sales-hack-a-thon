import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockCreateTemplateAction = vi.fn();
vi.mock("@/lib/actions/template-actions", () => ({
  createTemplateAction: (...args: unknown[]) => mockCreateTemplateAction(...args),
}));

import { TemplateForm } from "../template-form";

async function openDialog() {
  const user = userEvent.setup();
  // Get the dialog trigger (has aria-haspopup="dialog")
  const triggers = screen.getAllByRole("button", { name: /add template/i });
  const trigger = triggers.find(
    (b) => b.getAttribute("aria-haspopup") === "dialog"
  ) || triggers[0]!;
  await user.click(trigger);
  await waitFor(() => {
    expect(screen.getByText("Display Name")).toBeInTheDocument();
  });
  return user;
}

function getSubmitButton() {
  const buttons = screen.getAllByRole("button", { name: /add template/i });
  return buttons.find((b) => b.getAttribute("type") === "submit")!;
}

// ---------------------------------------------------------------------------
// TMPL-01: Add template dialog with validation
// ---------------------------------------------------------------------------

describe("TMPL-01: Add template dialog with URL validation", () => {
  beforeEach(() => {
    mockCreateTemplateAction.mockReset();
  });

  it("renders trigger button and opens dialog on click", async () => {
    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    await openDialog();

    expect(screen.getByText("Display Name")).toBeInTheDocument();
    expect(screen.getByText("Google Slides URL")).toBeInTheDocument();
    expect(screen.getByText("Touch Types")).toBeInTheDocument();
  });

  it("shows form fields: name, URL, and touch type chips", async () => {
    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    await openDialog();

    expect(screen.getByPlaceholderText("e.g. Q1 Proposal Deck")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("https://docs.google.com/presentation/d/...")
    ).toBeInTheDocument();
    expect(screen.getByText("Touch 1")).toBeInTheDocument();
    expect(screen.getByText("Touch 4+")).toBeInTheDocument();
  });

  it("shows validation error when URL is invalid and form is submitted", async () => {
    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    const user = await openDialog();

    await user.type(
      screen.getByPlaceholderText("e.g. Q1 Proposal Deck"),
      "My Deck"
    );
    await user.type(
      screen.getByPlaceholderText("https://docs.google.com/presentation/d/..."),
      "https://example.com/not-slides"
    );
    await user.click(screen.getByText("Touch 1"));

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText("Must be a valid Google Slides URL")).toBeInTheDocument();
    });
  });

  it("calls createTemplateAction on valid submission", async () => {
    mockCreateTemplateAction.mockResolvedValue({
      template: { id: "t1", accessStatus: "accessible" },
      serviceAccountEmail: null,
    });

    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    const user = await openDialog();

    await user.type(
      screen.getByPlaceholderText("e.g. Q1 Proposal Deck"),
      "My Deck"
    );
    await user.type(
      screen.getByPlaceholderText("https://docs.google.com/presentation/d/..."),
      "https://docs.google.com/presentation/d/abc123xyz/edit"
    );
    await user.click(screen.getByText("Touch 1"));

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(mockCreateTemplateAction).toHaveBeenCalledWith({
        name: "My Deck",
        googleSlidesUrl:
          "https://docs.google.com/presentation/d/abc123xyz/edit",
        presentationId: "abc123xyz",
        touchTypes: ["touch_1"],
      });
    });
  });

  it("shows service account email alert when file is not shared", async () => {
    mockCreateTemplateAction.mockResolvedValue({
      template: { id: "t1", accessStatus: "not_accessible" },
      serviceAccountEmail: "sa@project.iam.gserviceaccount.com",
    });

    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    const user = await openDialog();

    await user.type(
      screen.getByPlaceholderText("e.g. Q1 Proposal Deck"),
      "Deck"
    );
    await user.type(
      screen.getByPlaceholderText("https://docs.google.com/presentation/d/..."),
      "https://docs.google.com/presentation/d/abc123/edit"
    );
    await user.click(screen.getByText("Touch 1"));

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.getByText("File not shared with service account")
      ).toBeInTheDocument();
      expect(
        screen.getByText("sa@project.iam.gserviceaccount.com")
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// TMPL-04: Touch type chip assignment
// ---------------------------------------------------------------------------

describe("TMPL-04: Touch type chip assignment", () => {
  beforeEach(() => {
    mockCreateTemplateAction.mockReset();
  });

  it("toggles touch type chips on click", async () => {
    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    const user = await openDialog();

    const touch1 = screen.getByText("Touch 1");
    const touch3 = screen.getByText("Touch 3");

    await user.click(touch1);
    expect(touch1.className).toContain("bg-blue-100");

    await user.click(touch3);
    expect(touch3.className).toContain("bg-blue-100");

    await user.click(touch1);
    expect(touch1.className).not.toContain("bg-blue-100");
    expect(touch3.className).toContain("bg-blue-100");
  });

  it("submits successfully without selecting any touch type", async () => {
    mockCreateTemplateAction.mockResolvedValue({
      template: { id: "t1", accessStatus: "accessible" },
      serviceAccountEmail: null,
    });

    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    const user = await openDialog();

    await user.type(
      screen.getByPlaceholderText("e.g. Q1 Proposal Deck"),
      "Deck"
    );
    await user.type(
      screen.getByPlaceholderText("https://docs.google.com/presentation/d/..."),
      "https://docs.google.com/presentation/d/abc123/edit"
    );

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(mockCreateTemplateAction).toHaveBeenCalledWith({
        name: "Deck",
        googleSlidesUrl: "https://docs.google.com/presentation/d/abc123/edit",
        presentationId: "abc123",
        touchTypes: [],
      });
    });
  });

  it("submits with multiple touch types selected", async () => {
    mockCreateTemplateAction.mockResolvedValue({
      template: { id: "t2", accessStatus: "accessible" },
      serviceAccountEmail: null,
    });

    render(
      <TemplateForm>
        <button>Add Template</button>
      </TemplateForm>
    );

    const user = await openDialog();

    await user.type(
      screen.getByPlaceholderText("e.g. Q1 Proposal Deck"),
      "Multi Touch Deck"
    );
    await user.type(
      screen.getByPlaceholderText("https://docs.google.com/presentation/d/..."),
      "https://docs.google.com/presentation/d/xyz789/edit"
    );

    await user.click(screen.getByText("Touch 2"));
    await user.click(screen.getByText("Touch 3"));

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(mockCreateTemplateAction).toHaveBeenCalledWith({
        name: "Multi Touch Deck",
        googleSlidesUrl: "https://docs.google.com/presentation/d/xyz789/edit",
        presentationId: "xyz789",
        touchTypes: ["touch_2", "touch_3"],
      });
    });
  });
});
