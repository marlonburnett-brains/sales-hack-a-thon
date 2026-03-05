import { listTemplatesAction } from "@/lib/actions/template-actions";
import { TemplatesPageClient } from "./templates-page-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: Awaited<ReturnType<typeof listTemplatesAction>> = [];

  try {
    templates = await listTemplatesAction();
  } catch {
    // Agent service may be unavailable during development
  }

  return <TemplatesPageClient initialTemplates={templates} />;
}
