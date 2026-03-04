"use server";

import { revalidatePath } from "next/cache";
import {
  createCompany,
  createDeal,
  getDeal,
  getInteractions,
  listDeals,
} from "@/lib/api-client";
import type { Company, Deal, InteractionRecord } from "@/lib/api-client";

export async function createDealAction(formData: {
  companyName: string;
  industry: string;
  dealName: string;
  salespersonName?: string;
  salespersonPhoto?: string;
  logoUrl?: string;
}): Promise<Deal> {
  // Create or upsert company
  const company: Company = await createCompany({
    name: formData.companyName,
    industry: formData.industry,
    logoUrl: formData.logoUrl,
  });

  // Create deal linked to company
  const deal = await createDeal({
    companyId: company.id,
    name: formData.dealName,
    salespersonName: formData.salespersonName,
    salespersonPhoto: formData.salespersonPhoto,
  });

  revalidatePath("/deals");
  return deal;
}

export async function listDealsAction(): Promise<Deal[]> {
  return listDeals();
}

export async function getDealAction(dealId: string): Promise<Deal | null> {
  try {
    return await getDeal(dealId);
  } catch {
    return null;
  }
}

export async function getInteractionsAction(
  dealId: string
): Promise<InteractionRecord[]> {
  return getInteractions(dealId);
}
