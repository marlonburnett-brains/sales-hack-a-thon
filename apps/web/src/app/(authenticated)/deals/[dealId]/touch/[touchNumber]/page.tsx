import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const VALID_TOUCH_NUMBERS = ["1", "2", "3", "4"];

export default async function TouchPage({
  params,
}: {
  params: Promise<{ dealId: string; touchNumber: string }>;
}) {
  const { dealId, touchNumber } = await params;

  if (!VALID_TOUCH_NUMBERS.includes(touchNumber)) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">
        Touch {touchNumber}
      </h1>
      <p className="text-sm text-slate-500">
        Touch workflow coming in Phase 46. Deal ID: {dealId}
      </p>
    </div>
  );
}
