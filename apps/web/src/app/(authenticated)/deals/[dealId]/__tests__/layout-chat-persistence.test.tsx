import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navState = vi.hoisted(() => ({
  pathname: "/deals/deal-1/overview",
  segments: ["overview"] as string[],
}));

const getDealActionMock = vi.hoisted(() => vi.fn());
const bootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  usePathname: () => navState.pathname,
  useSelectedLayoutSegments: () => navState.segments,
}));

vi.mock("@/lib/actions/deal-actions", () => ({
  getDealAction: (...args: unknown[]) => getDealActionMock(...args),
}));

vi.mock("@/lib/actions/deal-chat-actions", () => ({
  getDealChatBootstrap: (...args: unknown[]) => bootstrapMock(...args),
  confirmDealChatBinding: vi.fn(),
}));

vi.mock("@/components/deals/deal-sidebar", () => ({
  DealSidebar: ({ dealId }: { dealId: string }) => <aside data-testid="deal-sidebar">{dealId}</aside>,
}));

vi.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: ({ items }: { items: Array<{ label: string }> }) => (
    <div data-testid="deal-breadcrumb">{items.map((item) => item.label).join(" / ")}</div>
  ),
}));

describe("DealLayout persistent chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navState.pathname = "/deals/deal-1/overview";
    navState.segments = ["overview"];
    getDealActionMock.mockResolvedValue({
      id: "deal-1",
      company: { name: "Acme Corp" },
    });
    bootstrapMock
      .mockResolvedValueOnce({
        messages: [],
        greeting: "Ready for overview context.",
        suggestions: [
          { id: "overview-1", label: "Overview suggestion", prompt: "Overview suggestion", kind: "question" },
          { id: "overview-2", label: "Summarize the deal", prompt: "Summarize the deal", kind: "next_step" },
        ],
      })
      .mockResolvedValueOnce({
        messages: [],
        greeting: "Ready for briefing context.",
        suggestions: [
          { id: "briefing-1", label: "Briefing suggestion", prompt: "Briefing suggestion", kind: "question" },
          { id: "briefing-2", label: "Prep the stakeholders", prompt: "Prep the stakeholders", kind: "next_step" },
        ],
      });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          "Overview answer\n---DEAL_CHAT_META---\n{\"response\":{\"directAnswer\":\"Overview answer\",\"supportingBullets\":[],\"missingInfoCallouts\":[],\"nextSteps\":[],\"knowledgeMatches\":[]},\"suggestions\":[],\"binding\":null,\"refineBeforeSave\":null,\"confirmationChips\":[],\"promptVersion\":{\"agentId\":\"deal-chat-assistant\",\"id\":\"version-1\",\"version\":1,\"publishedAt\":\"2026-03-08T23:00:00.000Z\",\"publishedBy\":\"planner\"}}",
          { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
        ),
      ),
    );
  });

  it("keeps one chat thread alive across deal sub-routes while refreshing route cues and suggestions", async () => {
    const DealLayout = (await import("../layout")).default;
    const user = userEvent.setup();

    const { rerender } = render(
      await DealLayout({
        children: <div data-testid="route-content">Overview page</div>,
        params: Promise.resolve({ dealId: "deal-1" }),
      }),
    );

    await screen.findByText("Overview suggestion");
    await user.click(screen.getByRole("button", { name: /open deal assistant/i }));
    await user.type(screen.getByLabelText(/chat message input/i), "What changed on this deal?");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Overview answer")).toBeInTheDocument();

    navState.pathname = "/deals/deal-1/briefing";
    navState.segments = ["briefing"];

    rerender(
      await DealLayout({
        children: <div data-testid="route-content">Briefing page</div>,
        params: Promise.resolve({ dealId: "deal-1" }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Briefing suggestion")).toBeInTheDocument();
    });
    expect(screen.getByText("Overview answer")).toBeInTheDocument();
    expect(screen.getAllByText("Briefing").length).toBeGreaterThan(0);
    expect(screen.getByTestId("route-content")).toHaveTextContent("Briefing page");
  });
});
