/**
 * Content Source Sync
 *
 * Updates ContentSource records in the database based on discovery
 * and ingestion results. Called by the ingestion pipeline after each phase.
 *
 * Matching logic: uses the same name-pattern matching as CONTENT_TYPE_OVERRIDES
 * to link discovered presentations to their known ContentSource records.
 */

import { PrismaClient } from "@prisma/client";
import type { DrivePresentation } from "./discover-content";

const prisma = new PrismaClient();

/** Patterns matching CONTENT_TYPE_OVERRIDES in run-ingestion.ts */
const NAME_PATTERNS: Array<{ pattern: string; sourceName: string }> = [
  { pattern: "two pager", sourceName: "Two Pager Template" },
  { pattern: "meet lumenalta", sourceName: "Meet Lumenalta" },
  { pattern: "nbcuniversal", sourceName: "NBCUniversal" },
  { pattern: "bleecker street", sourceName: "Bleecker Street Group" },
  { pattern: "master solutions", sourceName: "Master Solutions" },
  { pattern: "2026 gtm solutions", sourceName: "2026 GTM Solutions" },
  { pattern: "200a master deck", sourceName: "200A Master Deck" },
  { pattern: "alaska airlines", sourceName: "Alaska Airlines" },
  { pattern: "mastercontrol", sourceName: "MasterControl" },
  { pattern: "encompass", sourceName: "Encompass" },
  { pattern: "wsa", sourceName: "WSA" },
  { pattern: "satellite industries", sourceName: "Satellite Industries" },
  { pattern: "gravie", sourceName: "Gravie" },
  { pattern: "branded basics", sourceName: "Branded Basics" },
  { pattern: "l2 capability", sourceName: "L2 Capability Decks" },
  { pattern: "1-2 pager", sourceName: "1-2 Pager Templates" },
  { pattern: "case stud", sourceName: "Case Study Decks" },
];

/**
 * Find the matching ContentSource name for a presentation/folder name.
 */
function matchSourceName(name: string): string | null {
  const lower = name.toLowerCase();
  for (const { pattern, sourceName } of NAME_PATTERNS) {
    if (lower.includes(pattern)) return sourceName;
  }
  return null;
}

/**
 * Update ContentSource records after discovery phase.
 * Marks matched presentations as accessible with their Drive IDs.
 */
export async function syncDiscoveredSources(
  presentations: DrivePresentation[]
): Promise<{ matched: number; unmatched: string[] }> {
  let matched = 0;
  const unmatched: string[] = [];
  const now = new Date();

  for (const pres of presentations) {
    const sourceName = matchSourceName(pres.name);
    if (!sourceName) {
      unmatched.push(pres.name);
      continue;
    }

    await prisma.contentSource.upsert({
      where: { name: sourceName },
      update: {
        accessStatus: "accessible",
        driveFileId: pres.id,
        folderPath: pres.folderPath || null,
        lastCheckedAt: now,
        errorMessage: null,
      },
      create: {
        name: sourceName,
        sourceType: "presentation",
        accessStatus: "accessible",
        driveFileId: pres.id,
        folderPath: pres.folderPath || null,
        lastCheckedAt: now,
      },
    });
    matched++;
  }

  return { matched, unmatched };
}

/**
 * Record an inaccessible folder/shortcut target.
 */
export async function markSourceInaccessible(
  folderPath: string,
  errorMessage: string
): Promise<void> {
  const sourceName = matchSourceName(folderPath);
  if (!sourceName) return;

  await prisma.contentSource.upsert({
    where: { name: sourceName },
    update: {
      accessStatus: "not_accessible",
      lastCheckedAt: new Date(),
      errorMessage,
    },
    create: {
      name: sourceName,
      sourceType: "folder",
      accessStatus: "not_accessible",
      lastCheckedAt: new Date(),
      errorMessage,
    },
  });
}

/**
 * Update slide counts and ingestion counts from manifest data.
 */
export async function syncIngestionCounts(
  manifest: Array<{
    presentationName: string;
    status: string;
  }>
): Promise<void> {
  // Group by presentation name -> source name
  const countsBySource = new Map<string, { slides: number; ingested: number }>();

  for (const entry of manifest) {
    const sourceName = matchSourceName(entry.presentationName);
    if (!sourceName) continue;

    const counts = countsBySource.get(sourceName) ?? { slides: 0, ingested: 0 };
    counts.slides++;
    if (entry.status === "ingested") counts.ingested++;
    countsBySource.set(sourceName, counts);
  }

  for (const [sourceName, counts] of countsBySource) {
    await prisma.contentSource.update({
      where: { name: sourceName },
      data: {
        slideCount: counts.slides,
        ingestedCount: counts.ingested,
      },
    }).catch(() => {
      // Source may not exist if discovered presentation didn't match any seeded name
    });
  }
}

/**
 * Get a summary of all content source statuses for logging/dashboard.
 */
export async function getContentSourceSummary(): Promise<{
  total: number;
  accessible: number;
  notAccessible: number;
  pendingAccess: number;
  sources: Array<{ name: string; accessStatus: string; slideCount: number; ingestedCount: number; errorMessage: string | null }>;
}> {
  const sources = await prisma.contentSource.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      accessStatus: true,
      slideCount: true,
      ingestedCount: true,
      errorMessage: true,
    },
  });

  return {
    total: sources.length,
    accessible: sources.filter((s) => s.accessStatus === "accessible").length,
    notAccessible: sources.filter((s) => s.accessStatus === "not_accessible").length,
    pendingAccess: sources.filter((s) => s.accessStatus === "pending_access").length,
    sources,
  };
}
