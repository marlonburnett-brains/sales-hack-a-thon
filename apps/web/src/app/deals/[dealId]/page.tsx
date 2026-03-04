import { notFound } from "next/navigation";
import { getDealAction } from "@/lib/actions/deal-actions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User } from "lucide-react";
import { TouchFlowCard } from "@/components/touch/touch-flow-card";
import { InteractionTimeline } from "@/components/timeline/interaction-timeline";

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

  return (
    <div className="space-y-8">
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

      {/* Touch Flow Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
