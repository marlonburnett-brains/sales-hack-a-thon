import { listDealsFilteredAction } from "@/lib/actions/deal-actions";
import { DealDashboard } from "@/components/deals/deal-dashboard";
import { DealTable } from "@/components/deals/deal-table";
import { DealStatusFilter } from "@/components/deals/deal-status-filter";
import { DealViewToggle } from "@/components/deals/deal-view-toggle";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";
import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Deal } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status =
    typeof params.status === "string" ? params.status : "open";
  const assignee =
    typeof params.assignee === "string" ? params.assignee : "all";
  const view =
    typeof params.view === "string" ? params.view : "grid";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let deals: Deal[] = [];

  try {
    deals = await listDealsFilteredAction({
      status,
      assignee,
      userId: user?.id,
    });
  } catch {
    // Agent service may be unavailable during development
  }

  const isFiltered = status !== "all" || assignee !== "all";

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

      <div className="flex items-center justify-between">
        <DealStatusFilter currentStatus={status} dealCount={deals.length} />
        <DealViewToggle currentView={view} />
      </div>

      {view === "grid" ? (
        <DealDashboard deals={deals} isFiltered={isFiltered} />
      ) : (
        <DealTable deals={deals} />
      )}
    </div>
  );
}
