import { notFound } from "next/navigation";
import Link from "next/link";
import { getDealAction } from "@/lib/actions/deal-actions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { User, Clock, ClipboardCheck } from "lucide-react";
import { TouchFlowCard } from "@/components/touch/touch-flow-card";
import { InteractionTimeline } from "@/components/timeline/interaction-timeline";
import { PreCallSection } from "@/components/pre-call/pre-call-section";

export const dynamic = "force-dynamic";

interface DealPageProps {
  params: Promise<{ dealId: string }>;
}

export default async function DealPage({ params }: DealPageProps) {
  const { dealId } = await params;
  const deal = await getDealAction(dealId);

  if (!deal) {
    notFound();
  }

  const company = deal.company;
  const interactions = deal.interactions ?? [];

  // Check for pending brief approval
  const pendingTouch4 = interactions.find(
    (i) =>
      i.touchType === "touch_4" &&
      (i.status === "pending_approval" || i.status === "pending_review")
  );
  const pendingBriefId = pendingTouch4?.brief?.id;

  // Check for pending asset review
  const pendingAssetReview = interactions.find(
    (i) =>
      i.touchType === "touch_4" && i.status === "pending_asset_review"
  );

  return (
    <div className="space-y-8">
      {/* Pending approval alert banner */}
      {pendingTouch4 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">
            Brief awaiting approval
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            A sales brief is waiting for review and approval before asset
            generation can begin.
            {pendingBriefId && (
              <Link
                href={`/deals/${dealId}/review/${pendingBriefId}`}
                className="ml-2 font-medium underline"
              >
                Review now
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending asset review alert banner */}
      {pendingAssetReview && (
        <Alert className="border-blue-200 bg-blue-50">
          <ClipboardCheck className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">
            Assets ready for review
          </AlertTitle>
          <AlertDescription className="text-blue-700">
            Generated assets (deck, talk track, FAQ) are ready for review before
            final delivery.
            <Link
              href={`/deals/${dealId}/asset-review/${pendingAssetReview.id}`}
              className="ml-2 font-medium underline"
            >
              Review now
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {company?.name ?? "Unknown"}
          </h1>
          <Badge variant="secondary">{company?.industry ?? ""}</Badge>
        </div>
        <p className="text-sm text-slate-500">{deal.name}</p>
        {deal.salespersonName && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="h-4 w-4" />
            <span>{deal.salespersonName}</span>
          </div>
        )}
      </div>

      {/* Prep Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Prep</h2>
        <PreCallSection
          dealId={deal.id}
          companyName={company?.name ?? ""}
          industry={company?.industry ?? ""}
          interactions={interactions}
        />
      </div>

      <Separator />

      {/* Engagement Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Engagement</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <TouchFlowCard
            dealId={deal.id}
            touchNumber={1}
            touchName="First Contact Pager"
            description="Generate a personalized one-pager with AI-crafted headline, value proposition, and key capabilities."
            available={true}
            companyName={company?.name ?? ""}
            industry={company?.industry ?? ""}
            salespersonName={deal.salespersonName ?? undefined}
            interactions={interactions.filter((i) => i.touchType === "touch_1")}
          />
          <TouchFlowCard
            dealId={deal.id}
            touchNumber={2}
            touchName="Meet Lumenalta Deck"
            description="AI-selected introduction slides customized with salesperson info and company branding."
            available={true}
            companyName={company?.name ?? ""}
            industry={company?.industry ?? ""}
            salespersonName={deal.salespersonName ?? undefined}
            interactions={interactions.filter((i) => i.touchType === "touch_2")}
          />
          <TouchFlowCard
            dealId={deal.id}
            touchNumber={3}
            touchName="Capability Alignment Deck"
            description="Capability-focused slides selected based on the prospect's industry and needs."
            available={true}
            companyName={company?.name ?? ""}
            industry={company?.industry ?? ""}
            interactions={interactions.filter((i) => i.touchType === "touch_3")}
          />
          <TouchFlowCard
            dealId={deal.id}
            touchNumber={4}
            touchName="Post-Call Brief"
            description="Process a meeting transcript to generate a Multi-Pillar Sales Brief with ROI framing."
            available={true}
            companyName={company?.name ?? ""}
            industry={company?.industry ?? ""}
            interactions={interactions.filter((i) => i.touchType === "touch_4")}
          />
        </div>
      </div>

      <Separator />

      {/* Interaction Timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Interaction History
        </h2>
        <InteractionTimeline interactions={interactions} />
      </div>
    </div>
  );
}
