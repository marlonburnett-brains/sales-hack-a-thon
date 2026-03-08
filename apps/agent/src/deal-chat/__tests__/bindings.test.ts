import { describe, expect, it } from "vitest";

import type { DealChatRouteContext } from "@lumenalta/schemas";

import { detectDealContextNeedsReview, inferDealContextBinding } from "../bindings";

const briefingRoute: DealChatRouteContext = {
  section: "briefing",
  touchType: null,
  pathname: "/deals/deal-1/briefing",
  pageLabel: "Briefing",
};

describe("deal chat bindings", () => {
  it("prefers current context, then recent chat, then touch history for its best guess", () => {
    const routeMatch = inferDealContextBinding({
      routeContext: {
        section: "touch",
        touchType: "touch_3",
        pathname: "/deals/deal-1/touch-3",
        pageLabel: "Touch 3",
      },
      source: {
        id: null,
        sourceType: "note",
        touchType: null,
        title: null,
        rawText: "The buyer wants more concrete delivery milestones.",
        refinedText: null,
        routeContext: briefingRoute,
      },
      recentBindings: [
        {
          touchType: "touch_2",
          interactionId: "interaction-2",
          createdAt: new Date("2026-03-08T22:00:00Z"),
          reason: "Recent seller save",
        },
      ],
      interactions: [
        {
          id: "interaction-1",
          touchType: "touch_1",
          updatedAt: new Date("2026-03-08T21:00:00Z"),
        },
      ],
    });

    const recentMatch = inferDealContextBinding({
      routeContext: briefingRoute,
      source: {
        id: null,
        sourceType: "note",
        touchType: null,
        title: null,
        rawText: "Their champion asked for another proof point on delivery.",
        refinedText: null,
        routeContext: briefingRoute,
      },
      recentBindings: [
        {
          touchType: "touch_2",
          interactionId: "interaction-2",
          createdAt: new Date("2026-03-08T22:00:00Z"),
          reason: "Recent seller save",
        },
      ],
      interactions: [
        {
          id: "interaction-1",
          touchType: "touch_1",
          updatedAt: new Date("2026-03-08T21:00:00Z"),
        },
      ],
    });

    const historyMatch = inferDealContextBinding({
      routeContext: briefingRoute,
      source: {
        id: null,
        sourceType: "note",
        touchType: null,
        title: null,
        rawText: "Keep the next capability discussion anchored in outcomes.",
        refinedText: null,
        routeContext: briefingRoute,
      },
      recentBindings: [],
      interactions: [
        {
          id: "interaction-3",
          touchType: "touch_3",
          updatedAt: new Date("2026-03-08T22:30:00Z"),
        },
        {
          id: "interaction-1",
          touchType: "touch_1",
          updatedAt: new Date("2026-03-08T20:30:00Z"),
        },
      ],
    });

    expect(routeMatch.touchType).toBe("touch_3");
    expect(routeMatch.interactionId).toBeNull();
    expect(recentMatch.touchType).toBe("touch_2");
    expect(recentMatch.interactionId).toBe("interaction-2");
    expect(historyMatch.touchType).toBe("touch_3");
    expect(historyMatch.interactionId).toBe("interaction-3");
  });

  it("allows overview or briefing saves to stay generic but requires confirmation when the target is ambiguous", () => {
    const result = inferDealContextBinding({
      routeContext: briefingRoute,
      source: {
        id: null,
        sourceType: "transcript",
        touchType: null,
        title: null,
        rawText: "Quick notes from today: ROI, data migration risk, and who should join the next call.",
        refinedText: null,
        routeContext: briefingRoute,
      },
      recentBindings: [
        {
          touchType: "touch_2",
          interactionId: "interaction-2",
          createdAt: new Date("2026-03-08T22:00:00Z"),
          reason: "Recent seller save",
        },
      ],
      interactions: [
        {
          id: "interaction-3",
          touchType: "touch_3",
          updatedAt: new Date("2026-03-08T22:30:00Z"),
        },
      ],
    });

    expect(result.touchType).toBeNull();
    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain("general deal notes");
  });

  it("flags obviously partial or messy transcript-like input for review before save", () => {
    const review = detectDealContextNeedsReview({
      sourceType: "transcript",
      rawText: "... joining late ... ??? can you hear me ... [inaudible] ...", 
    });

    expect(review.required).toBe(true);
    expect(review.reason).toContain("messy");
    expect(review.suggestedPrompt).toContain("clean up");
  });
});
