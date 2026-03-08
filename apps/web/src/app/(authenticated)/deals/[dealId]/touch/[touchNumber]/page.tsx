import { notFound } from "next/navigation";
import { getDealAction, getInteractionsAction } from "@/lib/actions/deal-actions";
import { TouchPageClient } from "./touch-page-client";

export const dynamic = "force-dynamic";

const VALID_TOUCH_NUMBERS = ["1", "2", "3", "4"];

const TOUCH_NAMES: Record<string, string> = {
  "1": "First Contact Pager",
  "2": "Meet Lumenalta",
  "3": "Capability Alignment",
  "4": "Sales Proposal",
};

export default async function TouchPage({
  params,
}: {
  params: Promise<{ dealId: string; touchNumber: string }>;
}) {
  const { dealId, touchNumber } = await params;

  if (!VALID_TOUCH_NUMBERS.includes(touchNumber)) {
    notFound();
  }

  const deal = await getDealAction(dealId);
  if (!deal) {
    notFound();
  }

  const touchType = `touch_${touchNumber}`;
  const touchNum = parseInt(touchNumber, 10);
  const touchName = TOUCH_NAMES[touchNumber] ?? `Touch ${touchNumber}`;

  // Fetch interactions for this touch type, sorted by createdAt desc
  const allInteractions = await getInteractionsAction(dealId);
  const touchInteractions = allInteractions
    .filter((i) => i.touchType === touchType)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return (
    <TouchPageClient
      dealId={dealId}
      touchNumber={touchNum}
      touchType={touchType}
      touchName={touchName}
      companyName={deal.company?.name ?? deal.name}
      industry={deal.company?.industry ?? "Technology"}
      interactions={touchInteractions}
    />
  );
}
