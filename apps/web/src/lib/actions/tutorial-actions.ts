"use server";

import { revalidatePath } from "next/cache";
import { listTutorials } from "@/lib/api-client";
import type { TutorialBrowseResponse } from "@/lib/api-client";
import { env } from "@/env";
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";

export type { TutorialBrowseResponse };

async function agentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(`${env.AGENT_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function listTutorialsAction(): Promise<TutorialBrowseResponse> {
  return listTutorials();
}

export async function updateTutorialProgressAction(
  tutorialId: string,
  lastPosition: number,
): Promise<void> {
  await agentFetch(`/tutorials/${tutorialId}/progress`, {
    method: "PATCH",
    body: JSON.stringify({ lastPosition }),
  });
}

export async function markTutorialWatchedAction(
  tutorialId: string,
  lastPosition: number,
): Promise<void> {
  await agentFetch(`/tutorials/${tutorialId}/watched`, {
    method: "PATCH",
    body: JSON.stringify({ lastPosition }),
  });
  revalidatePath("/tutorials");
}
