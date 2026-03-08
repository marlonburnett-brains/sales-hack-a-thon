import { notFound } from "next/navigation";
import { PersistentDealChat } from "@/components/deals/persistent-deal-chat";
import { getDealAction } from "@/lib/actions/deal-actions";
import { DealSidebar } from "@/components/deals/deal-sidebar";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export const dynamic = "force-dynamic";

export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDealAction(dealId);
  if (!deal) notFound();

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 flex min-h-[calc(100vh-3.5rem)]">
      <DealSidebar deal={deal} dealId={dealId} />
      <div className="flex-1 min-w-0 overflow-auto">
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <Breadcrumb
            items={[
              { label: "Deals", href: "/deals" },
              {
                label: deal.company?.name ?? "Deal",
                href: `/deals/${dealId}/overview`,
              },
            ]}
          />
        </div>
        <div className="px-6 py-4 pb-32">
          {children}
        </div>
      </div>
      <PersistentDealChat dealId={dealId} />
    </div>
  );
}
