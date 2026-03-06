import { listTemplatesAction } from "@/lib/actions/template-actions";
import {
  listSlidesAction,
  getSlideThumbnailsAction,
} from "@/lib/actions/slide-actions";
import type { SlideData, SlideThumbnail } from "@/lib/actions/slide-actions";
import { SlideLibraryClient } from "./slide-library-client";

export const dynamic = "force-dynamic";

export interface EnrichedSlide extends SlideData {
  templateId: string;
  templateName: string;
}

export default async function SlideLibraryPage() {
  const allSlides: EnrichedSlide[] = [];
  let allThumbnails: SlideThumbnail[] = [];
  const templateNames = new Map<string, string>();

  try {
    const templates = await listTemplatesAction();
    const templatesWithSlides = templates.filter((t) => t.slideCount > 0);

    if (templatesWithSlides.length > 0) {
      const [slidesResults, thumbnailResults] = await Promise.all([
        Promise.all(
          templatesWithSlides.map((t) =>
            listSlidesAction(t.id).catch(() => [] as SlideData[])
          )
        ),
        Promise.all(
          templatesWithSlides.map((t) =>
            getSlideThumbnailsAction(t.id).catch(() => ({
              thumbnails: [] as SlideThumbnail[],
            }))
          )
        ),
      ]);

      for (let i = 0; i < templatesWithSlides.length; i++) {
        const template = templatesWithSlides[i];
        templateNames.set(template.id, template.name);

        const slides = slidesResults[i];
        for (const slide of slides) {
          allSlides.push({
            ...slide,
            templateId: template.id,
            templateName: template.name,
          });
        }

        const thumbs = thumbnailResults[i].thumbnails;
        allThumbnails = allThumbnails.concat(thumbs);
      }
    }
  } catch {
    // Agent service may be unavailable during development
  }

  if (allSlides.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold text-slate-900">Slide Library</h1>
        <p className="text-sm text-slate-500">
          No ingested slides yet. Add and ingest templates first.
        </p>
      </div>
    );
  }

  return (
    <SlideLibraryClient
      slides={allSlides}
      thumbnails={allThumbnails}
      templateNames={Object.fromEntries(templateNames)}
    />
  );
}
