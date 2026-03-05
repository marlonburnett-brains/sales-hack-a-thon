"use server";

import { revalidatePath } from "next/cache";
import {
  createTemplate,
  listTemplates,
  deleteTemplate,
  checkTemplateStaleness,
} from "@/lib/api-client";
import type {
  Template,
  CreateTemplateResult,
  StalenessCheckResult,
} from "@/lib/api-client";

export type { Template, CreateTemplateResult, StalenessCheckResult };

export async function listTemplatesAction(): Promise<Template[]> {
  return listTemplates();
}

export async function createTemplateAction(data: {
  name: string;
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
