import { listDealsAction } from "@/lib/actions/deal-actions";
import { DealDashboard } from "@/components/deals/deal-dashboard";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  let deals: Awaited<ReturnType<typeof listDealsAction>> = [];

  try {
    deals = await listDealsAction();
  } catch {
    // Agent service may be unavailable during development
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500">
            Manage your sales deals and generate GTM assets
          </p>
        </div>
        <CreateDealDialog>
          <Button className="cursor-pointer gap-2">
            <Plus className="h-4 w-4" />
            New Deal
          </Button>
        </CreateDealDialog>
      </div>

      <DealDashboard deals={deals} />
    </div>
  );
}
