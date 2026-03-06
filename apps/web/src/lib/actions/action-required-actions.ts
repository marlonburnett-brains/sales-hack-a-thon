"use server";

import { revalidatePath } from "next/cache";
import {
  fetchActions,
  resolveAction,
} from "@/lib/api-client";
import type { ActionRequiredItem } from "@/lib/api-client";

export type { ActionRequiredItem };

export async function listActionsAction(): Promise<ActionRequiredItem[]> {
  return fetchActions();
}

export async function resolveActionAction(id: string): Promise<ActionRequiredItem> {
  const result = await resolveAction(id);
  revalidatePath("/actions");
  return result;
}
