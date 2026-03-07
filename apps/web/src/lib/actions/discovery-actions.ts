"use server";

import {
  checkAtlusAccess,
  browseDiscovery,
  searchDiscovery,
  startDiscoveryIngestion,
  getDiscoveryIngestionProgress,
} from "@/lib/api-client";
import type {
  AccessCheckResult,
  BrowseResult,
  SearchResult,
  DiscoveryDocument,
  IngestionProgressResult,
} from "@/lib/api-client";

export type { AccessCheckResult, BrowseResult, SearchResult, DiscoveryDocument, IngestionProgressResult };

export async function checkAtlusAccessAction(): Promise<AccessCheckResult> {
  return checkAtlusAccess();
}

export async function browseDocumentsAction(params: { cursor?: string; limit?: number }): Promise<BrowseResult> {
  return browseDiscovery(params);
}

export async function searchDocumentsAction(query: string): Promise<SearchResult> {
  return searchDiscovery(query);
}

export async function startDiscoveryIngestionAction(items: DiscoveryDocument[]): Promise<{ batchId: string }> {
  return startDiscoveryIngestion(items);
}

export async function getDiscoveryIngestionProgressAction(batchId: string): Promise<IngestionProgressResult> {
  return getDiscoveryIngestionProgress(batchId);
}
