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
    }
  } catch {
    // Agent service may be unavailable during development
  }

  if (slides.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold text-slate-900">{templateName}</h1>
        <p className="text-sm text-slate-500">
          No ingested slides. Trigger ingestion from the Templates page.
        </p>
      </div>
    );
  }

  return (
    <SlideViewerClient
      templateId={id}
      templateName={templateName}
      initialSlides={slides}
      initialThumbnails={thumbnails.thumbnails}
    />
  );
}
