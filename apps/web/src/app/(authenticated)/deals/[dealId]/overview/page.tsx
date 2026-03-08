import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  ClipboardCheck,
  BarChart3,
  CalendarDays,
  Activity,
  Hash,
} from "lucide-react";
import { getDealAction, listKnownUsersAction } from "@/lib/actions/deal-actions";
import { DealStatusAction } from "@/components/deals/deal-status-action";
import { DealAssignmentPicker } from "@/components/deals/deal-assignment-picker";
import { StackedAvatars } from "@/components/deals/stacked-avatars";
import { InteractionTimeline } from "@/components/timeline/interaction-timeline";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { InteractionRecord } from "@/lib/api-client";

export const dynamic = "force-dynamic";

const TOUCH_TYPES = ["touch_1", "touch_2", "touch_3", "touch_4"] as const;
const COMPLETED_STATUSES = new Set([
  "approved",
  "edited",
  "overridden",
  "delivered",
]);

function countCompletedTouches(interactions: InteractionRecord[]): number {
  const completedTouches = new Set<string>();
  for (const interaction of interactions) {
    if (COMPLETED_STATUSES.has(interaction.status)) {
      completedTouches.add(interaction.touchType);
    }
  }
  return TOUCH_TYPES.filter((t) => completedTouches.has(t)).length;
}

function getLastActivityDate(interactions: InteractionRecord[]): string {
  if (interactions.length === 0) return "No activity yet";
  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return formatDistanceToNow(new Date(sorted[0].createdAt), {
    addSuffix: true,
  });
}

function parseCollaborators(
  collaboratorsJson: string
): Array<{ id?: string; email: string; name?: string }> {
  try {
    const parsed = JSON.parse(collaboratorsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const [deal, knownUsers] = await Promise.all([
    getDealAction(dealId),
    listKnownUsersAction(),
  ]);
  if (!deal) notFound();

  const interactions = deal.interactions ?? [];
  const collaborators = parseCollaborators(deal.collaborators);
  const allPeople = [
    ...(deal.ownerEmail
      ? [{ name: deal.ownerName ?? undefined, email: deal.ownerEmail }]
      : []),
    ...collaborators.map((c) => ({ name: c.name, email: c.email })),
  ];

  // Metrics
  const touchesCompleted = countCompletedTouches(interactions);
  const daysInPipeline = Math.floor(
    (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const lastActivity = getLastActivityDate(interactions);
  const totalInteractions = interactions.length;

  // Alert banners
  const pendingBrief = interactions.find(
    (i) =>
      i.touchType === "touch_4" &&
      (i.status === "pending_approval" || i.status === "pending_review")
  );
  const pendingAsset = interactions.find(
    (i) =>
      i.touchType === "touch_4" && i.status === "pending_asset_review"
  );

  return (
    <div className="space-y-6">
      {/* Deal Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {deal.company?.name ?? "Unknown Company"}
            </h1>
            <DealStatusAction dealId={dealId} currentStatus={deal.status} />
            {deal.company?.industry && (
              <Badge variant="secondary">{deal.company.industry}</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">{deal.name}</p>
        </div>

        <div className="flex items-center gap-3">
          {allPeople.length > 0 && (
            <StackedAvatars people={allPeople} max={3} />
          )}
          <DealAssignmentPicker
            dealId={dealId}
            currentOwnerId={deal.ownerId}
            currentOwnerEmail={deal.ownerEmail}
            currentOwnerName={deal.ownerName}
            currentCollaborators={collaborators}
            knownUsers={knownUsers}
          />
        </div>
      </div>

      {/* Alert Banners */}
      {(pendingBrief || pendingAsset) && (
        <div className="space-y-3">
          {pendingBrief && (
            <Alert className="border-amber-200 bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">
                Brief Pending Approval
              </AlertTitle>
              <AlertDescription className="text-amber-700">
                A proposal brief is waiting for your review.{" "}
                <Link
                  href={`/deals/${dealId}/review/${pendingBrief.id}`}
                  className="font-medium underline hover:text-amber-900"
                >
                  Review now
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {pendingAsset && (
            <Alert className="border-blue-200 bg-blue-50">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">
                Asset Pending Review
              </AlertTitle>
              <AlertDescription className="text-blue-700">
                A generated asset is ready for your review.{" "}
                <Link
                  href={`/deals/${dealId}/asset-review/${pendingAsset.id}`}
                  className="font-medium underline hover:text-blue-900"
                >
                  Review now
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<BarChart3 className="h-4 w-4 text-indigo-500" />}
          label="Touches Completed"
          value={`${touchesCompleted} / 4`}
        />
        <MetricCard
          icon={<CalendarDays className="h-4 w-4 text-emerald-500" />}
          label="Days in Pipeline"
          value={String(daysInPipeline)}
        />
        <MetricCard
          icon={<Activity className="h-4 w-4 text-amber-500" />}
          label="Last Activity"
          value={lastActivity}
        />
        <MetricCard
          icon={<Hash className="h-4 w-4 text-blue-500" />}
          label="Total Interactions"
          value={String(totalInteractions)}
        />
      </div>

      {/* Activity Timeline */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
        <InteractionTimeline interactions={interactions} />
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
