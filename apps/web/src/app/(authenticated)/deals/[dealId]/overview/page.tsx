export const dynamic = "force-dynamic";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
      <p className="text-sm text-slate-500">
        Overview content coming in Plan 02. Deal ID: {dealId}
      </p>
    </div>
  );
}
