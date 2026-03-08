"use server";

import { revalidatePath } from "next/cache";
import type { DealChatRouteContext } from "@lumenalta/schemas";

import {
  confirmDealChatBinding as confirmDealChatBindingRequest,
  getDealChatBootstrap as getDealChatBootstrapRequest,
  type DealChatBindingRequest,
  type DealChatBindingResult,
  type DealChatBootstrapData,
} from "@/lib/api-client";

export async function getDealChatBootstrap(
  dealId: string,
  routeContext: DealChatRouteContext,
): Promise<DealChatBootstrapData> {
  return getDealChatBootstrapRequest(dealId, routeContext);
}

export async function confirmDealChatBinding(
  dealId: string,
  input: DealChatBindingRequest,
): Promise<DealChatBindingResult> {
  const result = await confirmDealChatBindingRequest(dealId, input);
  const dealPath = `/deals/${dealId}`;

  revalidatePath(dealPath);

  const currentPath = input.source.routeContext.pathname;
  if (currentPath && currentPath !== dealPath) {
    revalidatePath(currentPath);
  }

  return result;
}
