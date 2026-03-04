import { notFound } from "next/navigation";
import { getAssetReviewAction } from "@/lib/actions/touch-actions";
import { AssetReviewClient } from "./asset-review-client";

export const dynamic = "force-dynamic";

interface AssetReviewPageProps {
  params: Promise<{ dealId: string; interactionId: string }>;
}

export default async function AssetReviewPage({
  params,
}: AssetReviewPageProps) {
  const { dealId, interactionId } = await params;

  try {
    const reviewData = await getAssetReviewAction(interactionId);
    return (
      <AssetReviewClient
        reviewData={reviewData}
        dealId={dealId}
        interactionId={interactionId}
      />
    );
  } catch {
    notFound();
  }
}
