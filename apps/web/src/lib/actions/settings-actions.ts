"use server";

import { env } from "@/env";

/**
 * Server actions for reading/writing UserSetting via the agent API.
 * UserSetting is a key-value store with @@unique([userId, key]).
 */

async function agentFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${env.AGENT_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AGENT_API_KEY}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get the user's configured Drive root folder.
 * Returns both folder ID and display name, or null if not set.
 */
export async function getDriveRootFolder(
  userId: string,
): Promise<{ folderId: string | null; folderName: string | null }> {
  const [folderIdRes, folderNameRes] = await Promise.all([
    agentFetch<{ value: string | null }>(
      `/user-settings/${userId}/drive_root_folder_id`,
    ),
    agentFetch<{ value: string | null }>(
      `/user-settings/${userId}/drive_root_folder_name`,
    ),
  ]);

  return {
    folderId: folderIdRes.value,
    folderName: folderNameRes.value,
  };
}

/**
 * Persist the user's chosen Drive root folder.
 * Upserts both drive_root_folder_id and drive_root_folder_name settings.
 */
export async function setDriveRootFolder(
  userId: string,
  folderId: string,
  folderName: string,
): Promise<void> {
  await Promise.all([
    agentFetch(`/user-settings/${userId}/drive_root_folder_id`, {
      method: "PUT",
      body: JSON.stringify({ value: folderId }),
    }),
    agentFetch(`/user-settings/${userId}/drive_root_folder_name`, {
      method: "PUT",
      body: JSON.stringify({ value: folderName }),
    }),
  ]);
}
