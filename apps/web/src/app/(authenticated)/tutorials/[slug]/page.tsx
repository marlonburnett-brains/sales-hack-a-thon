import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { listTutorialsAction } from "@/lib/actions/tutorial-actions";

export const dynamic = "force-dynamic";

interface TutorialSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TutorialSlugPage({ params }: TutorialSlugPageProps) {
  const { slug } = await params;

  let tutorial: {
    title: string;
    description: string;
    durationSec: number;
  } | null = null;

  try {
    const data = await listTutorialsAction();
    for (const category of data.categories) {
      const found = category.tutorials.find((t) => t.slug === slug);
      if (found) {
        tutorial = found;
        break;
      }
    }
  } catch (err) {
    console.error("[tutorial-slug-page] Failed to fetch tutorials:", err);
  }

  if (!tutorial) {
    notFound();
  }

  const minutes = Math.floor(tutorial.durationSec / 60);
  const seconds = tutorial.durationSec % 60;
  const durationLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* Back link */}
      <Link
        href="/tutorials"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tutorials
      </Link>

      {/* Tutorial info */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-8 w-8 text-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{tutorial.title}</h1>
            <p className="text-sm text-slate-500">{durationLabel}</p>
          </div>
        </div>
        <p className="text-slate-600">{tutorial.description}</p>
      </div>

      {/* Placeholder notice */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 text-center">
        <PlayCircle className="mx-auto mb-3 h-12 w-12 text-indigo-400" />
        <h2 className="text-base font-semibold text-indigo-900">
          Video playback coming soon
        </h2>
        <p className="mt-1 text-sm text-indigo-700">
          Full tutorial playback ships in the next phase. Check back shortly.
        </p>
      </div>
    </div>
  );
}
