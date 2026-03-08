import { describe, expect, it } from "vitest";

import { AGENT_CATALOG, AGENT_IDS } from "@lumenalta/schemas";

describe("AGENT_CATALOG", () => {
  it("covers every current prompt-bearing responsibility with stable ids and plain-language names", () => {
    expect(AGENT_CATALOG).toHaveLength(20);

    expect(AGENT_IDS).toEqual([
      "company-researcher",
      "value-hypothesis-strategist",
      "discovery-question-strategist",
      "first-contact-pager-writer",
      "deck-slide-selector",
      "transcript-extractor",
      "sales-brief-strategist",
      "roi-framing-analyst",
      "proposal-slide-selector",
      "proposal-copywriter",
      "buyer-faq-strategist",
      "deal-chat-assistant",
      "knowledge-result-extractor",
      "deck-structure-analyst",
      "deck-structure-refinement-assistant",
      "slide-metadata-classifier",
      "slide-description-writer",
      "template-classification-analyst",
      "solution-pillar-taxonomist",
      "schema-validation-auditor",
    ]);

    for (const entry of AGENT_CATALOG) {
      expect(entry.name).toMatch(/^[A-Z][A-Za-z0-9&/\- ]+$/);
      expect(entry.name).not.toContain(entry.agentId);
      expect(entry.responsibility.length).toBeGreaterThan(20);
      expect(entry.sourceSites.length).toBeGreaterThan(0);
      expect(entry.sourceSites[0]).toMatch(/^apps\/agent\/(src|prisma)\//);
    }
  });

  it("keeps deck-structure inference and chat refinement as separate agents", () => {
    const analyst = AGENT_CATALOG.find(
      (entry) => entry.agentId === "deck-structure-analyst",
    );
    const refinementAssistant = AGENT_CATALOG.find(
      (entry) => entry.agentId === "deck-structure-refinement-assistant",
    );

    expect(analyst?.name).toBe("Deck Structure Analyst");
    expect(analyst?.family).toBe("deck-intelligence");
    expect(analyst?.isShared).toBe(true);

    expect(refinementAssistant?.name).toBe(
      "Deck Structure Refinement Assistant",
    );
    expect(refinementAssistant?.family).toBe("deck-intelligence");
    expect(refinementAssistant?.isShared).toBe(true);
  });

  it("uses shared job families for repeated responsibilities instead of duplicating them per touch", () => {
    const deckSelector = AGENT_CATALOG.find(
      (entry) => entry.agentId === "deck-slide-selector",
    );

    expect(deckSelector).toMatchObject({
      name: "Deck Slide Selector",
      family: "deck-selection",
      isShared: true,
      touchTypes: ["touch_2", "touch_3"],
    });

    expect(
      AGENT_CATALOG.some(
        (entry) => String(entry.agentId) === "touch-2-slide-selector",
      ),
    ).toBe(false);
    expect(
      AGENT_CATALOG.some(
        (entry) => String(entry.agentId) === "touch-3-slide-selector",
      ),
    ).toBe(false);
  });

  it("adds a governed deal-chat assistant instead of separate per-page chat agents", () => {
    const dealChatAssistant = AGENT_CATALOG.find(
      (entry) => entry.agentId === "deal-chat-assistant",
    );

    expect(dealChatAssistant).toMatchObject({
      name: "Deal Chat Assistant",
      family: "deal-chat",
      isShared: true,
      touchTypes: ["pre_call", "touch_1", "touch_2", "touch_3", "touch_4"],
    });
    expect(dealChatAssistant?.responsibility).toContain("knowledge-base questions");

    expect(
      AGENT_CATALOG.some(
        (entry) => String(entry.agentId) === "briefing-chat-assistant",
      ),
    ).toBe(false);
    expect(
      AGENT_CATALOG.some(
        (entry) => String(entry.agentId) === "transcript-cleanup-assistant",
      ),
    ).toBe(false);
  });
});
