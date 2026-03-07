import { notFound } from "next/navigation";
import { TouchTypeDetailView } from "@/components/settings/touch-type-detail-view";

const VALID_SLUGS: Record<string, string> = {
  "touch-1": "touch_1",
  "touch-2": "touch_2",
  "touch-3": "touch_3",
  "touch-4": "touch_4",
  "pre-call": "pre_call",
};

const SLUG_LABELS: Record<string, string> = {
  "touch-1": "Touch 1",
  "touch-2": "Touch 2",
  "touch-3": "Touch 3",
  "touch-4": "Touch 4",
  "pre-call": "Pre-Call",
};

interface Props {
  params: Promise<{ touchType: string }>;
}

export default async function TouchTypePage({ params }: Props) {
  const { touchType: slug } = await params;
  const touchType = VALID_SLUGS[slug];

  if (!touchType) {
    notFound();
  }

  const label = SLUG_LABELS[slug] ?? slug;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        {label} Deck Structure
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        AI-inferred section patterns for {label} presentations, based on
        classified examples.
      </p>
      <TouchTypeDetailView touchType={touchType} label={label} />
    </div>
  );
}
