import type { DealChatRouteContext, DealChatTouchType } from "@lumenalta/schemas";

import { prisma } from "../lib/db";

type DealChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  metaJson: string | null;
  createdAt: Date;
};

type DealChatInteractionSummary = {
  id: string;
  touchType: DealChatTouchType;
  status: string;
  updatedAt: Date;
  createdAt: Date;
};

type DealChatSourceSummary = {
  id: string;
  sourceType: string;
  touchType: string | null;
  originPage: string;
  rawText: string;
  refinedText: string | null;
  status: string;
  bindingMetaJson: string | null;
  createdAt: Date;
};

export type LoadedDealChatContext = {
  deal: {
    id: string;
    name: string;
    company: {
      name: string;
      industry: string;
    };
  };
  interactions: DealChatInteractionSummary[];
  sources: DealChatSourceSummary[];
  recentMessages: DealChatHistoryMessage[];
  promptSummary: string | null;
  routeContext: DealChatRouteContext;
};

export async function loadDealChatContext(params: {
  dealId: string;
  routeContext: DealChatRouteContext;
  messageLimit?: number;
  sourceLimit?: number;
}): Promise<LoadedDealChatContext> {
  const messageLimit = params.messageLimit ?? 8;
  const sourceLimit = params.sourceLimit ?? 6;

  const deal = await prisma.deal.findUnique({
    where: { id: params.dealId },
    include: {
      company: {
        select: {
          name: true,
          industry: true,
        },
      },
      interactions: {
        select: {
          id: true,
          touchType: true,
          status: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      contextSources: {
        select: {
          id: true,
          sourceType: true,
          touchType: true,
          originPage: true,
          rawText: true,
          refinedText: true,
          status: true,
          bindingMetaJson: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: sourceLimit,
      },
      chatThread: {
        select: {
          promptSummary: true,
          messages: {
            select: {
              role: true,
              content: true,
              metaJson: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: messageLimit,
          },
        },
      },
    },
  });

  if (!deal) {
    throw new Error(`Deal ${params.dealId} not found`);
  }

  return {
    deal: {
      id: deal.id,
      name: deal.name,
      company: {
        name: deal.company.name,
        industry: deal.company.industry,
      },
    },
    interactions: deal.interactions as DealChatInteractionSummary[],
    sources: deal.contextSources as DealChatSourceSummary[],
    recentMessages: [...(deal.chatThread?.messages ?? [])].reverse() as DealChatHistoryMessage[],
    promptSummary: deal.chatThread?.promptSummary ?? null,
    routeContext: params.routeContext,
  };
}
