import type { ArtifactType } from "@lumenalta/schemas";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  listSlidesAction,
  getSlideThumbnailsAction,
} from "@/lib/actions/slide-actions";
import { listTemplatesAction } from "@/lib/actions/template-actions";
import { SlideViewerClient } from "./slide-viewer-client";

export const dynamic = "force-dynamic";

export default async function SlidesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let slides: Awaited<ReturnType<typeof listSlidesAction>> = [];
  let thumbnails: Awaited<ReturnType<typeof getSlideThumbnailsAction>> = {
    thumbnails: [],
  };
  let templateName = "Template";
  let contentClassification: string | null = null;
  let touchTypes: string[] = [];
  let artifactType: ArtifactType | null = null;

  try {
    const [slidesResult, thumbnailsResult, templates] = await Promise.all([
      listSlidesAction(id),
      getSlideThumbnailsAction(id),
      listTemplatesAction(),
    ]);
    slides = slidesResult;
    thumbnails = thumbnailsResult;
    const template = templates.find((t) => t.id === id);
    if (template) {
      templateName = template.name;
      contentClassification = template.contentClassification;
      artifactType = template.artifactType;
      try {
        touchTypes = JSON.parse(template.touchTypes);
      } catch {
        touchTypes = [];
      }
    }
  } catch {
    // Agent service may be unavailable during development
  }

  if (slides.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[{ label: "Templates", href: "/templates" }]}
          current={templateName}
          className="px-4 pt-3"
        />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-sm text-slate-500">
            No ingested slides. Trigger ingestion from the Templates page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SlideViewerClient
      templateId={id}
      templateName={templateName}
      initialSlides={slides}
      initialThumbnails={thumbnails.thumbnails}
      contentClassification={contentClassification}
      touchTypes={touchTypes}
      artifactType={artifactType}
    />
  );
}
