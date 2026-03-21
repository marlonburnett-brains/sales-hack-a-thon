"use server";

import { env } from "@/env";
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";

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

export async function submitFeedbackAction(payload: {
  sourceType: string;
  sourceId: string;
  feedbackType: "tutorial_feedback" | "feature_feedback";
  comment: string;
}): Promise<void> {
  await agentFetch<{ ok: boolean }>("/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
