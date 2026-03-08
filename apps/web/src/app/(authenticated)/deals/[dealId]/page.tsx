import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  redirect(`/deals/${dealId}/overview`);
}
