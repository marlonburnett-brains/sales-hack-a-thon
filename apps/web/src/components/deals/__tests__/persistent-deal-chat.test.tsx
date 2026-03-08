import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DealChatRouteContext, DealChatSuggestion } from "@lumenalta/schemas";

const navState = vi.hoisted(() => ({
  pathname: "/deals/deal-1/overview",
  segments: ["overview"],
}));

const bootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSelectedLayoutSegments: () => navState.segments,
}));

vi.mock("@/lib/actions/deal-chat-actions", () => ({
  getDealChatBootstrap: (...args: unknown[]) => bootstrapMock(...args),
  confirmDealChatBinding: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

function makeSuggestions(prefix: string): DealChatSuggestion[] {
  return [
    {
      id: `${prefix}-1`,
      label: `${prefix} suggestion 1`,
      prompt: `${prefix} prompt 1`,
      kind: "question",
    },
    {
      id: `${prefix}-2`,
      label: `${prefix} suggestion 2`,
      prompt: `${prefix} prompt 2`,
      kind: "next_step",
    },
  ];
}

function getRouteContext(section: DealChatRouteContext["section"]): DealChatRouteContext {
  return {
    section,
    touchType: null,
    pathname: `/deals/deal-1/${section}`,
    pageLabel: section === "overview" ? "Overview" : "Briefing",
  };
}

describe("PersistentDealChat", () => {
  beforeEach(() => {
    cleanup();
    bootstrapMock.mockReset();
    bootstrapMock.mockResolvedValue({
      messages: [],
      greeting: "I can keep context as you move through this deal.",
      suggestions: makeSuggestions("Overview"),
    });
    navState.pathname = "/deals/deal-1/overview";
    navState.segments = ["overview"];
  });

  afterEach(() => {
    cleanup();
  });

  it("boots with a greeting and updates route suggestions without auto-posting on navigation", async () => {
    const { PersistentDealChat } = await import("../persistent-deal-chat");

    const { rerender } = render(<PersistentDealChat dealId="deal-1" />);

    await screen.findByText("I can keep context as you move through this deal.");
    expect(screen.getByText("Overview suggestion 1")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);

    bootstrapMock.mockResolvedValueOnce({
      messages: [],
      greeting: "I can keep context as you move through this deal.",
      suggestions: makeSuggestions("Briefing"),
    });
    navState.pathname = "/deals/deal-1/briefing";
    navState.segments = ["briefing"];

    rerender(<PersistentDealChat dealId="deal-1" />);

    await waitFor(() => {
      expect(screen.getByText("Briefing suggestion 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Overview suggestion 1")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("starts as a collapsed dock teaser and can switch into side panel mode", async () => {
    const user = userEvent.setup();
    const { PersistentDealChat } = await import("../persistent-deal-chat");

    render(<PersistentDealChat dealId="deal-1" />);

    await screen.findByRole("button", { name: /open deal assistant/i });
    expect(screen.queryByLabelText(/deal assistant thread/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open deal assistant/i }));
    expect(await screen.findByLabelText(/deal assistant thread/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch to side panel/i }));
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
  });
});
