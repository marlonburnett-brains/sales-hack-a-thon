import { notFound } from "next/navigation";
import { getBriefReviewAction } from "@/lib/actions/touch-actions";
import { BriefReviewClient } from "./brief-review-client";

export const dynamic = "force-dynamic";

interface BriefReviewPageProps {
  params: Promise<{ dealId: string; briefId: string }>;
}

export default async function BriefReviewPage({
  params,
}: BriefReviewPageProps) {
  const { dealId, briefId } = await params;

  try {
    const reviewData = await getBriefReviewAction(briefId);
    return (
      <BriefReviewClient
        reviewData={reviewData}
        dealId={dealId}
        briefId={briefId}
      />
    );
  } catch {
    notFound();
  }
}
