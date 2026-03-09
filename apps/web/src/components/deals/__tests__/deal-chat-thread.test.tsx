import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DealChatMeta, DealChatRouteContext, DealChatSuggestion } from "@lumenalta/schemas";

const confirmBindingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/deal-chat-actions", () => ({
  confirmDealChatBinding: (...args: unknown[]) => confirmBindingMock(...args),
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const routeContext: DealChatRouteContext = {
  section: "briefing",
  touchType: null,
  pathname: "/deals/deal-1/briefing",
  pageLabel: "Briefing",
};

function makeSuggestion(id: string, label: string): DealChatSuggestion {
  return {
    id,
    label,
    prompt: label,
    kind: "question",
  };
}

function makeMeta(): DealChatMeta {
  return {
    response: {
      directAnswer: "Here is the grounded answer.",
      supportingBullets: ["Supporting detail"],
      missingInfoCallouts: [],
      nextSteps: ["Confirm the save target"],
      knowledgeMatches: [
        {
          id: "match-1",
          title: "Relevant case study",
          whyFit: "Same stakeholder motion",
          summary: "Used a similar rollout path.",
          sourceLabel: "Knowledge base",
          touchType: "touch_2",
        },
      ],
    },
    suggestions: [makeSuggestion("suggestion-1", "Ask about follow-up")],
    binding: {
      status: "needs_confirmation",
      source: {
        id: null,
        sourceType: "transcript",
        touchType: null,
        title: null,
        rawText: "speaker one ??? joined late",
        refinedText: "Speaker one joined late and asked about timing.",
        routeContext,
      },
      guessedTouchType: "touch_2",
      confirmationLabel: "Save to Touch 2 transcript?",
      reason: "Current page is closest to touch 2.",
    },
    refineBeforeSave: {
      required: true,
      reason: "Transcript needs cleanup before save.",
      suggestedPrompt: "Clean up the speaker names before saving.",
      draftText: "Speaker one joined late and asked about timing.",
    },
    confirmationChips: [
      {
        id: "chip-1",
        label: "Saved to general notes",
        tone: "info",
        sourceType: "note",
        touchType: null,
      },
    ],
    promptVersion: {
      agentId: "deal-chat-assistant",
      id: "version-1",
      version: 1,
      publishedAt: "2026-03-08T23:00:00.000Z",
      publishedBy: "planner",
    },
  };
}

describe("DealChatThread", () => {
  beforeEach(() => {
    cleanup();
    confirmBindingMock.mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("parses streamed meta and renders suggestions, confirmation chips, and match cards inline", async () => {
    const meta = makeMeta();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `Grounded answer\n---DEAL_CHAT_META---\n${JSON.stringify(meta)}`,
          { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
        ),
      ),
    );

    const user = userEvent.setup();
    const { DealChatThread } = await import("../deal-chat-thread");

    render(
      <DealChatThread
        dealId="deal-1"
        routeContext={routeContext}
        initialMessages={[]}
        greeting="Ask about this deal."
        suggestions={[makeSuggestion("intro", "Generate a briefing")]} 
      />,
    );

    await user.type(screen.getByLabelText(/chat message input/i), "What changed?");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Grounded answer")).toBeInTheDocument();
    expect(screen.getByText("Ask about follow-up")).toBeInTheDocument();
    expect(screen.getByText("Saved to general notes")).toBeInTheDocument();
    expect(screen.getByText("Relevant case study")).toBeInTheDocument();
    expect(screen.getByText("Save to Touch 2 transcript?")).toBeInTheDocument();
  });

  it("keeps confirmation actions and refine-before-save affordances inline without losing the thread", async () => {
    const meta = makeMeta();
    confirmBindingMock.mockResolvedValue({
      source: {
        id: "source-1",
        dealId: "deal-1",
        sourceType: "transcript",
        touchType: "touch_2",
        interactionId: null,
        originPage: "Briefing",
        rawText: meta.binding!.source.rawText,
        refinedText: meta.binding!.source.refinedText,
        status: "saved",
        bindingMetaJson: null,
        createdAt: "2026-03-08T23:00:00.000Z",
        updatedAt: "2026-03-08T23:00:01.000Z",
      },
      confirmationChip: {
        id: "chip-2",
        label: "Saved to Touch 2 transcript",
        tone: "success",
        sourceType: "transcript",
        touchType: "touch_2",
      },
    });

    const { DealChatThread } = await import("../deal-chat-thread");
    const user = userEvent.setup();

    render(
      <DealChatThread
        dealId="deal-1"
        routeContext={routeContext}
        initialMessages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "Please confirm where to save this.",
            meta,
            createdAt: "2026-03-08T23:00:00.000Z",
          },
        ]}
        greeting={null}
        suggestions={[]}
      />,
    );

    expect(screen.getByDisplayValue("Speaker one joined late and asked about timing.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save to touch 2/i }));

    await waitFor(() => {
      expect(confirmBindingMock).toHaveBeenCalledWith(
        "deal-1",
        expect.objectContaining({
          action: "confirm",
          touchType: "touch_2",
          refinedText: "Speaker one joined late and asked about timing.",
        }),
      );
    });
    expect(screen.getByText("Please confirm where to save this.")).toBeInTheDocument();
    expect(screen.getByText("Saved to Touch 2 transcript")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as general note/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose another touch/i })).toBeInTheDocument();
  });

  it("exposes a transcript upload control and lets sellers clear a selected file before sending", async () => {
    const { DealChatThread } = await import("../deal-chat-thread");
    const user = userEvent.setup();
    const file = new File(["speaker one joined late"], "briefing-call.txt", {
      type: "text/plain",
    });

    render(
      <DealChatThread
        dealId="deal-1"
        routeContext={routeContext}
        initialMessages={[]}
        greeting={null}
        suggestions={[]}
      />,
    );

    const input = screen.getByLabelText(/upload transcript/i);
    await user.upload(input, file);

    expect(screen.getByText("briefing-call.txt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove transcript/i }));

    expect(screen.queryByText("briefing-call.txt")).not.toBeInTheDocument();
  });

  it("reads uploaded transcript text client-side and posts transcriptUpload through the existing chat route", async () => {
    const meta = makeMeta();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `Grounded answer\n---DEAL_CHAT_META---\n${JSON.stringify(meta)}`,
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { DealChatThread } = await import("../deal-chat-thread");
    const user = userEvent.setup();
    const file = new File(["speaker one joined late"], "briefing-call.txt", {
      type: "text/plain",
    });

    render(
      <DealChatThread
        dealId="deal-1"
        routeContext={routeContext}
        initialMessages={[]}
        greeting={null}
        suggestions={[]}
      />,
    );

    await user.upload(screen.getByLabelText(/upload transcript/i), file);
    await user.type(screen.getByLabelText(/chat message input/i), "Please save this transcript.");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/deals/deal-1/chat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            dealId: "deal-1",
            message: "Please save this transcript.",
            transcriptUpload: {
              fileName: "briefing-call.txt",
              mimeType: "text/plain",
              text: "speaker one joined late",
            },
            routeContext,
          }),
        }),
      );
    });

    expect(await screen.findByText(/uploaded transcript: briefing-call.txt/i)).toBeInTheDocument();
    expect(screen.getByText("Save to Touch 2 transcript?")).toBeInTheDocument();
  });

  it("shows clear feedback for unsupported transcript uploads", async () => {
    const { DealChatThread } = await import("../deal-chat-thread");
    const user = userEvent.setup();
    const file = new File(["pdf bytes"], "briefing-call.pdf", {
      type: "application/pdf",
    });

    render(
      <DealChatThread
        dealId="deal-1"
        routeContext={routeContext}
        initialMessages={[]}
        greeting={null}
        suggestions={[]}
      />,
    );

    await user.upload(screen.getByLabelText(/upload transcript/i), file);

    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/supported transcript/i));
  });
});
