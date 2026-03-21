import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import dynamicImport from "next/dynamic";
import { listTutorialsAction } from "@/lib/actions/tutorial-actions";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

export const dynamic = "force-dynamic";

const TutorialVideoPlayer = dynamicImport(
  () =>
    import("@/components/tutorials/tutorial-video-player").then(
      (m) => m.TutorialVideoPlayer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video w-full animate-pulse rounded-lg bg-slate-200" />
    ),
  },
);

interface TutorialSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TutorialSlugPage({ params }: TutorialSlugPageProps) {
  const { slug } = await params;

  let data: Awaited<ReturnType<typeof listTutorialsAction>> | null = null;

  try {
    data = await listTutorialsAction();
  } catch (err) {
    console.error("[tutorial-slug-page] Failed to fetch tutorials:", err);
  }

  if (!data) {
    notFound();
  }

  const allTutorials = data.categories.flatMap((c) => c.tutorials);
  const currentIndex = allTutorials.findIndex((t) => t.slug === slug);

  if (currentIndex === -1) {
    notFound();
  }

  const tutorial = allTutorials[currentIndex];
  const prevTutorial = currentIndex > 0 ? allTutorials[currentIndex - 1] : null;
  const nextTutorial =
    currentIndex < allTutorials.length - 1 ? allTutorials[currentIndex + 1] : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      {/* Back link */}
      <Link
        href="/tutorials"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tutorials
      </Link>

      <TutorialVideoPlayer
        tutorialId={tutorial.id}
        slug={tutorial.slug}
        gcsUrl={tutorial.gcsUrl}
        title={tutorial.title}
        description={tutorial.description}
        durationSec={tutorial.durationSec}
        initialWatched={tutorial.watched}
        initialLastPosition={tutorial.lastPosition}
        prevTutorial={
          prevTutorial ? { slug: prevTutorial.slug, title: prevTutorial.title } : null
        }
        nextTutorial={
          nextTutorial ? { slug: nextTutorial.slug, title: nextTutorial.title } : null
        }
      />

      <FeedbackWidget
        key={tutorial.id}
        sourceType="tutorial"
        sourceId={tutorial.id}
      />
    </div>
  );
}
