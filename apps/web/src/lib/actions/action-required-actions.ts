"use server";

import { revalidatePath } from "next/cache";
import {
  fetchActions,
  resolveAction,
  silenceAction,
  recheckAtlusAccess,
  submitAtlusCredentials,
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

export async function silenceActionAction(id: string): Promise<ActionRequiredItem> {
  const result = await silenceAction(id);
  revalidatePath("/actions");
  return result;
}

export async function recheckAtlusAccessAction(userId: string, email: string, googleAccessToken: string): Promise<{ result: string }> {
  const result = await recheckAtlusAccess(userId, email, googleAccessToken);
  revalidatePath("/actions");
  return result;
}

export async function submitAtlusCredentialsAction(userId: string, email: string, token: string): Promise<{ success: boolean; accessResult: string }> {
  const result = await submitAtlusCredentials(userId, email, token);
  revalidatePath("/actions");
  return result;
}
