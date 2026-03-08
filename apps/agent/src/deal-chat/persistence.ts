import type { DealChatRouteContext, DealChatTouchType, DealContextSource } from "@lumenalta/schemas";

import { prisma } from "../lib/db";

type DealChatRole = "user" | "assistant";

type AppendDealChatMessageInput = {
  dealId: string;
  role: DealChatRole;
  content: string;
  routeContext: DealChatRouteContext;
  metaJson?: string;
};

type SaveDealContextSourceInput = {
  dealId: string;
  source: DealContextSource;
  status?: "pending_confirmation" | "saved";
  interactionId?: string | null;
  bindingMeta?: Record<string, unknown> | null;
};

type ConfirmDealContextSourceInput = {
  touchType: DealChatTouchType | null;
  interactionId?: string | null;
  refinedText?: string | null;
  bindingMeta?: Record<string, unknown> | null;
};

export async function getOrCreateDealChatThread(dealId: string) {
  const existing = await prisma.dealChatThread.findUnique({
    where: { dealId },
  });

  if (existing) {
    return existing;
  }

  return prisma.dealChatThread.create({
    data: { dealId },
  });
}

export async function appendDealChatMessage(input: AppendDealChatMessageInput) {
  const thread = await getOrCreateDealChatThread(input.dealId);

  return prisma.dealChatMessage.create({
    data: {
      threadId: thread.id,
      role: input.role,
      content: input.content,
      routeSection: input.routeContext.section,
      routeTouchType: input.routeContext.touchType,
      routePathname: input.routeContext.pathname,
      routePageLabel: input.routeContext.pageLabel,
      metaJson: input.metaJson ?? null,
    },
  });
}

export async function getDealChatMessages(dealId: string) {
  const thread = await prisma.dealChatThread.findUnique({
    where: { dealId },
  });

  if (!thread) {
    return [];
  }

  return prisma.dealChatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateDealChatPromptSummary(dealId: string, promptSummary: string | null) {
  await getOrCreateDealChatThread(dealId);

  return prisma.dealChatThread.update({
    where: { dealId },
    data: { promptSummary },
  });
}

export async function saveDealContextSource(input: SaveDealContextSourceInput) {
  return prisma.dealContextSource.create({
    data: {
      dealId: input.dealId,
      sourceType: input.source.sourceType,
      touchType: input.source.touchType,
      interactionId: input.interactionId ?? null,
      originPage: input.source.routeContext.pageLabel,
      rawText: input.source.rawText,
      refinedText: input.source.refinedText,
      status: input.status ?? "pending_confirmation",
      bindingMetaJson: input.bindingMeta ? JSON.stringify(input.bindingMeta) : null,
    },
  });
}

export async function confirmDealContextSource(
  sourceId: string,
  input: ConfirmDealContextSourceInput,
) {
  return prisma.dealContextSource.update({
    where: { id: sourceId },
    data: {
      touchType: input.touchType,
      interactionId: input.interactionId ?? null,
      refinedText: input.refinedText ?? null,
      status: "saved",
      bindingMetaJson: input.bindingMeta ? JSON.stringify(input.bindingMeta) : undefined,
    },
  });
}
