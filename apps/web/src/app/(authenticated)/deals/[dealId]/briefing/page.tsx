import { notFound } from "next/navigation";
import { getDealAction, getInteractionsAction } from "@/lib/actions/deal-actions";
import { BriefingChatPanel } from "@/components/deals/briefing-chat-panel";
import { PriorBriefingsList } from "@/components/deals/prior-briefings-list";

export const dynamic = "force-dynamic";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDealAction(dealId);
  if (!deal) notFound();

  const interactions = await getInteractionsAction(dealId);

  const companyName = deal.company?.name ?? "this company";
  const industry = deal.company?.industry ?? "Technology";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Meeting Prep</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI-powered meeting preparation for{" "}
          <span className="font-medium text-slate-600">{companyName}</span>
        </p>
      </div>

      {/* AI Chat Panel */}
      <BriefingChatPanel
        dealId={dealId}
        companyName={companyName}
        industry={industry}
      />

      {/* Previous Briefings Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Previous Briefings
        </h2>
        <PriorBriefingsList interactions={interactions} dealId={dealId} />
      </div>
    </div>
  );
}
