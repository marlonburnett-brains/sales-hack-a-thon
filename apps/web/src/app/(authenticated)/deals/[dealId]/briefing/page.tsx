export const dynamic = "force-dynamic";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Briefing</h1>
      <p className="text-sm text-slate-500">
        Briefing content coming in Plan 03. Deal ID: {dealId}
      </p>
    </div>
  );
}
