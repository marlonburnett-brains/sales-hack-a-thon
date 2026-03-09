import {
  listDealsFilteredAction,
  listKnownUsersAction,
} from "@/lib/actions/deal-actions";
import { DealDashboard } from "@/components/deals/deal-dashboard";
import { DealTable } from "@/components/deals/deal-table";
import { DealStatusFilter } from "@/components/deals/deal-status-filter";
import { DealViewToggle } from "@/components/deals/deal-view-toggle";
import { DealAssigneeFilter } from "@/components/deals/deal-assignee-filter";
import { CreateDealDialog } from "@/components/deals/create-deal-dialog";
import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Deal, KnownUser } from "@/lib/api-client";

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
  let knownUsers: KnownUser[] = [];

  try {
    [deals, knownUsers] = await Promise.all([
      listDealsFilteredAction({ status, assignee, userId: user?.id }),
      listKnownUsersAction(),
    ]);
  } catch (err) {
    console.error("[deals-page] Failed to fetch deals:", err);
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
        <div className="flex items-center gap-3">
          <DealStatusFilter currentStatus={status} dealCount={deals.length} />
          <DealAssigneeFilter
            currentAssignee={assignee}
            knownUsers={knownUsers}
          />
        </div>
        <DealViewToggle currentView={view} />
      </div>

      {view === "grid" ? (
        <DealDashboard
          deals={deals}
          isFiltered={isFiltered}
          knownUsers={knownUsers}
        />
      ) : (
        <DealTable deals={deals} knownUsers={knownUsers} />
      )}
    </div>
  );
}
