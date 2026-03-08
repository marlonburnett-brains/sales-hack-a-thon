"use server";

import { revalidatePath } from "next/cache";
import {
  createCompany,
  createDeal,
  getDeal,
  getInteractions,
  listDeals,
  listDealsFiltered,
  updateDealStatus,
  updateDealAssignment,
  listKnownUsers,
} from "@/lib/api-client";
import type { Company, Deal, InteractionRecord, KnownUser } from "@/lib/api-client";

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

export async function listDealsFilteredAction(params: {
  status?: string;
  assignee?: string;
  userId?: string;
}): Promise<Deal[]> {
  return listDealsFiltered(params);
}

export async function updateDealStatusAction(
  dealId: string,
  status: string,
): Promise<Deal> {
  const deal = await updateDealStatus(dealId, status);
  revalidatePath("/deals");
  return deal;
}

export async function updateDealAssignmentAction(
  dealId: string,
  data: {
    ownerId?: string;
    ownerEmail?: string;
    ownerName?: string;
    collaborators?: Array<{ id?: string; email: string; name?: string }>;
  },
): Promise<Deal> {
  const deal = await updateDealAssignment(dealId, data);
  revalidatePath("/deals");
  return deal;
}

export async function listKnownUsersAction(): Promise<KnownUser[]> {
  return listKnownUsers();
}
