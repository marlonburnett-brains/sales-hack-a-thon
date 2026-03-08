import { notFound } from "next/navigation";
import { getDealAction, getInteractionsAction } from "@/lib/actions/deal-actions";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Meeting Prep</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shared deal context for{" "}
          <span className="font-medium text-slate-600">{companyName}</span>
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            Shared assistant
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Use the persistent deal assistant for briefing work too.
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            The docked assistant now follows you across overview, briefing, and touch pages so you can ask for stakeholder prep, capture notes, or compare similar cases without starting over.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-700">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              Ask for a tailored prep angle
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              Save messy notes for the right touch
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              Request similar case matches
            </span>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Previous Briefings
        </h2>
        <PriorBriefingsList interactions={interactions} dealId={dealId} />
      </div>
    </div>
  );
}
