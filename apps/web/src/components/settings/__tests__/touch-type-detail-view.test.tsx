import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckStructureDetail } from "@/lib/api-client";

const mockGetDeckStructureAction = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/actions/deck-structure-actions", () => ({
  getDeckStructureAction: (...args: unknown[]) =>
    mockGetDeckStructureAction(...args),
}));

import { TouchTypeDetailView } from "../touch-type-detail-view";
import { ChatBar } from "../chat-bar";

function makeDetail(overrides: Partial<DeckStructureDetail> = {}): DeckStructureDetail {
  return {
    touchType: "touch_4",
    artifactType: "proposal",
    structure: {
      sections: [],
      sequenceRationale: "",
    },
    exampleCount: 0,
    confidence: 32,
    confidenceColor: "red",
    confidenceLabel: "Low confidence",
    chatMessages: [],
    slideIdToThumbnail: {},
    inferredAt: null,
    lastChatAt: null,
    ...overrides,
  };
}

describe("TouchTypeDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mockGetDeckStructureAction.mockResolvedValue(makeDetail());
  });

  it("loads the matching Touch 4 artifact detail and shows artifact-specific empty-state copy with a Templates CTA", async () => {
    render(
      <TouchTypeDetailView
        touchType="touch_4"
        label="Touch 4"
        artifactType="faq"
        emptyStateTitle="No FAQ examples classified yet"
        emptyStateDescription="Classify FAQ examples on Templates to improve this structure."
      />,
    );

    await waitFor(() => {
      expect(mockGetDeckStructureAction).toHaveBeenCalledWith("touch_4", "faq");
    });

    expect(
      await screen.findByRole("heading", {
        name: "No FAQ examples classified yet",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Classify FAQ examples on Templates to improve this structure."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to templates/i })).toHaveAttribute(
      "href",
      "/templates",
    );
  });

  it("keeps the chat input enabled for empty Touch 4 artifact tabs", async () => {
    render(
      <TouchTypeDetailView
        touchType="touch_4"
        label="Touch 4"
        artifactType="proposal"
        emptyStateTitle="No Proposal examples classified yet"
        emptyStateDescription="Classify Proposal examples on Templates to improve this structure."
      />,
    );

    expect(
      await screen.findByLabelText(/chat message input/i),
    ).toBeEnabled();
    expect(
      screen.queryByText(/enable chat refinement/i),
    ).not.toBeInTheDocument();
  });

});

describe("ChatBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Updated structure"));
          controller.close();
        },
      }),
    });
  });

  it("includes artifactType in Touch 4 chat requests", async () => {
    const user = userEvent.setup();

    render(
      <ChatBar
        touchType="touch_4"
        artifactType="talk_track"
        onStructureUpdate={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/chat message input/i), "Tighten the opener");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/deck-structures/chat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            touchType: "touch_4",
            artifactType: "talk_track",
            message: "Tighten the opener",
          }),
        }),
      );
    });
  });

  it("applies streamed structure updates from the chat response", async () => {
    const user = userEvent.setup();
    const onStructureUpdate = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              "I'll add that section.\n---STRUCTURE_UPDATE---\n" +
                JSON.stringify({
                  updatedStructure: {
                    sections: [
                      {
                        order: 1,
                        name: "Title Slide",
                        purpose: "Open the presentation.",
                        isOptional: false,
                        variationCount: 2,
                        slideIds: ["title-1"],
                      },
                      {
                        order: 2,
                        name: "Introduction",
                        purpose: "Orient the audience before the divider slides.",
                        isOptional: false,
                        variationCount: 0,
                        slideIds: [],
                      },
                    ],
                    sequenceRationale:
                      "Lead with the title, then add a short introduction before the main body.",
                  },
                  diff: {
                    added: ["Introduction"],
                    modified: [],
                  },
                }),
            ),
          );
          controller.close();
        },
      }),
    });

    render(
      <ChatBar
        touchType="touch_4"
        artifactType="proposal"
        onStructureUpdate={onStructureUpdate}
      />,
    );

    await user.type(screen.getByLabelText(/chat message input/i), "Add an intro section");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(onStructureUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ name: "Introduction", order: 2 }),
          ]),
        }),
        expect.objectContaining({ added: ["Introduction"], modified: [] }),
      );
    });
  });
});
