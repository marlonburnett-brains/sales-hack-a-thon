"use server";

import { revalidatePath } from "next/cache";
import {
  fetchActions,
  resolveAction,
  silenceAction,
} from "@/lib/api-client";
import { createClient } from "@/lib/supabase/server";
import type { ActionRequiredItem } from "@/lib/api-client";

export type { ActionRequiredItem };

export async function listActionsAction(): Promise<ActionRequiredItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return fetchActions(user?.id);
}

export async function resolveActionAction(id: string): Promise<ActionRequiredItem> {
  const result = await resolveAction(id);
  revalidatePath("/actions");
  return result;
}

export async function silenceActionAction(id: string): Promise<ActionRequiredItem> {
  const result = await silenceAction(id);
  revalidatePath("/actions");
  return result;
}

