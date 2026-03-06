"use server";

import { revalidatePath } from "next/cache";
import {
  createTemplate,
  listTemplates,
  deleteTemplate,
  checkTemplateStaleness,
  triggerIngestion,
  getIngestionProgress,
} from "@/lib/api-client";
import type {
  Template,
  CreateTemplateResult,
  StalenessCheckResult,
  IngestionProgress,
} from "@/lib/api-client";

export type { Template, CreateTemplateResult, StalenessCheckResult };

export async function listTemplatesAction(): Promise<Template[]> {
  return listTemplates();
}

export async function createTemplateAction(data: {
  googleSlidesUrl: string;
  presentationId: string;
  touchTypes: string[];
}): Promise<CreateTemplateResult> {
  const result = await createTemplate(data);
  revalidatePath("/templates");
  return result;
}

export async function deleteTemplateAction(
  id: string
): Promise<{ success: boolean }> {
  const result = await deleteTemplate(id);
  revalidatePath("/templates");
  return result;
}

export async function checkStalenessAction(
  id: string
): Promise<StalenessCheckResult> {
  return checkTemplateStaleness(id);
}

export async function triggerIngestionAction(
  templateId: string
): Promise<{ queued: boolean }> {
  const result = await triggerIngestion(templateId);
  revalidatePath("/templates");
  return result;
}

export async function getIngestionProgressAction(
  templateId: string
): Promise<IngestionProgress> {
  return getIngestionProgress(templateId);
}
