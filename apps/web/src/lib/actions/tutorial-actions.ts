"use server";

import { listTutorials } from "@/lib/api-client";
import type { TutorialBrowseResponse } from "@/lib/api-client";

export type { TutorialBrowseResponse };

export async function listTutorialsAction(): Promise<TutorialBrowseResponse> {
  return listTutorials();
}
