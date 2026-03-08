import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DealChatRouteContext } from "@lumenalta/schemas";

const { prismaMock, resetPrismaMock } = vi.hoisted(() => {
  const state = {
    threadSeq: 1,
    messageSeq: 1,
    sourceSeq: 1,
    threads: new Map<string, any>(),
    messages: [] as any[],
    sources: new Map<string, any>(),
  };

  const nextDate = () => new Date(`2026-03-08T23:00:${String(state.messageSeq).padStart(2, "0")}Z`);

  const prisma = {
    dealChatThread: {
      async findUnique({ where }: { where: { dealId?: string; id?: string } }) {
        if (where.dealId) {
          return state.threads.get(where.dealId) ?? null;
        }

        return [...state.threads.values()].find((thread) => thread.id === where.id) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const thread = {
          id: `thread-${state.threadSeq++}`,
          promptSummary: null,
          createdAt: nextDate(),
          updatedAt: nextDate(),
          ...data,
        };

        state.threads.set(String(thread.dealId), thread);
        return thread;
      },
      async update({ where, data }: { where: { id?: string; dealId?: string }; data: Record<string, unknown> }) {
        const thread = where.dealId
          ? state.threads.get(where.dealId)
          : [...state.threads.values()].find((entry) => entry.id === where.id);

        if (!thread) {
          throw new Error("missing thread");
        }

        Object.assign(thread, data, { updatedAt: nextDate() });
        return thread;
      },
    },
    dealChatMessage: {
      async create({ data }: { data: Record<string, unknown> }) {
        const message = {
          id: `message-${state.messageSeq++}`,
          createdAt: nextDate(),
          ...data,
        };

        state.messages.push(message);
        return message;
      },
      async findMany({ where }: { where: { threadId: string } }) {
        return state.messages.filter((message) => message.threadId === where.threadId);
      },
    },
    dealContextSource: {
      async create({ data }: { data: Record<string, unknown> }) {
        const source = {
          id: `source-${state.sourceSeq++}`,
          createdAt: nextDate(),
          updatedAt: nextDate(),
          refinedText: null,
          interactionId: null,
          bindingMetaJson: null,
          ...data,
        };

        state.sources.set(source.id, source);
        return source;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const source = state.sources.get(where.id);
        if (!source) {
          throw new Error("missing source");
        }

        Object.assign(source, data, { updatedAt: nextDate() });
        return source;
      },
    },
    snapshot() {
      return {
        threads: [...state.threads.values()],
        messages: [...state.messages],
        sources: [...state.sources.values()],
      };
    },
  };

  return {
    prismaMock: prisma,
    resetPrismaMock() {
      state.threadSeq = 1;
      state.messageSeq = 1;
      state.sourceSeq = 1;
      state.threads.clear();
      state.messages.length = 0;
      state.sources.clear();
    },
  };
});

vi.mock("../../lib/db", () => ({
  prisma: prismaMock,
}));

const overviewRoute: DealChatRouteContext = {
  section: "overview",
  touchType: null,
  pathname: "/deals/deal-1",
  pageLabel: "Overview",
};

describe("deal chat persistence", () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it("returns the same thread for repeated calls on one deal", async () => {
    const { getOrCreateDealChatThread } = await import("../persistence");

    const first = await getOrCreateDealChatThread("deal-1");
    const second = await getOrCreateDealChatThread("deal-1");

    expect(first.id).toBe(second.id);
    expect(prismaMock.snapshot().threads).toHaveLength(1);
  });

  it("keeps full message history while prompt summaries stay on the thread", async () => {
    const {
      appendDealChatMessage,
      getDealChatMessages,
      getOrCreateDealChatThread,
      updateDealChatPromptSummary,
    } = await import("../persistence");

    await getOrCreateDealChatThread("deal-1");
    await appendDealChatMessage({
      dealId: "deal-1",
      role: "user",
      content: "Here are my latest notes.",
      routeContext: overviewRoute,
    });
    await appendDealChatMessage({
      dealId: "deal-1",
      role: "assistant",
      content: "Saved. Want me to organize them by touch?",
      routeContext: overviewRoute,
      metaJson: JSON.stringify({ suggestions: ["Bind to Touch 2"] }),
    });
    await updateDealChatPromptSummary("deal-1", "Seller saved overview notes and asked for a touch suggestion.");

    const messages = await getDealChatMessages("deal-1");
    const snapshot = prismaMock.snapshot();

    expect(messages).toHaveLength(2);
    expect(messages.map((message: { content: string }) => message.content)).toEqual([
      "Here are my latest notes.",
      "Saved. Want me to organize them by touch?",
    ]);
    expect(snapshot.threads[0]?.promptSummary).toBe(
      "Seller saved overview notes and asked for a touch suggestion.",
    );
  });

  it("saves generic sources with origin metadata without requiring a fake interaction", async () => {
    const { confirmDealContextSource, saveDealContextSource } = await import("../persistence");

    const saved = await saveDealContextSource({
      dealId: "deal-1",
      source: {
        id: null,
        sourceType: "note",
        touchType: null,
        title: null,
        rawText: "Need a clearer ROI frame before the next call.",
        refinedText: null,
        routeContext: overviewRoute,
      },
      status: "pending_confirmation",
      bindingMeta: {
        origin: "overview",
        guessedTouchType: null,
      },
    });

    const confirmed = await confirmDealContextSource(saved.id, {
      touchType: null,
      interactionId: null,
      refinedText: "Need a clearer ROI frame before the next call.",
    });

    expect(saved.originPage).toBe("Overview");
    expect(saved.interactionId).toBeNull();
    expect(confirmed.status).toBe("saved");
    expect(confirmed.touchType).toBeNull();
  });
});
