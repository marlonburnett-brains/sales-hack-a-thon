import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
      <div className="space-y-6">
        <nav className="flex items-center gap-1 text-sm px-4 pt-3" aria-label="Breadcrumb">
          <Link
            href="/templates"
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            Templates
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-900">{templateName}</span>
        </nav>
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
    />
  );
}
