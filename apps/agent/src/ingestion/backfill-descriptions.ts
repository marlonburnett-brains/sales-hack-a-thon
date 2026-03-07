/**
 * Startup Backfill Detection
 *
 * On agent startup, detects slides with missing AI descriptions or
 * element maps and queues their templates for re-ingestion.
 *
 * The re-ingestion will use the smart-merge needsDescription path
 * to generate descriptions and extract elements without re-running
 * classification or re-embedding unchanged slides.
 */

import { prisma } from "../lib/db";
import { ingestionQueue } from "./ingestion-queue";

/**
 * Detect templates with slides missing descriptions or element maps
 * and queue them for backfill via the ingestion queue.
 *
 * Queries:
 * 1. Templates with non-archived slides that have NULL description
 * 2. Templates with non-archived slides that have no SlideElement rows
 *
 * Orders by lastIngestedAt DESC (most recent first) per research recommendation.
 */
export async function detectAndQueueBackfill(): Promise<void> {
  // Find templates with slides missing descriptions
  const missingDescriptions = await prisma.$queryRaw<
    { templateId: string }[]
  >`
    SELECT DISTINCT se."templateId"
    FROM "SlideEmbedding" se
    JOIN "Template" t ON t.id = se."templateId"
    WHERE se.archived = false
      AND se.description IS NULL
    ORDER BY se."templateId"
  `;

  // Find templates with slides that have no element map rows
  const missingElements = await prisma.$queryRaw<
    { templateId: string }[]
  >`
    SELECT DISTINCT se."templateId"
    FROM "SlideEmbedding" se
    LEFT JOIN "SlideElement" el ON el."slideId" = se.id
    WHERE se.archived = false
      AND el.id IS NULL
    ORDER BY se."templateId"
  `;

  // Deduplicate template IDs
  const templateIds = new Set<string>();
  for (const row of missingDescriptions) templateIds.add(row.templateId);
  for (const row of missingElements) templateIds.add(row.templateId);

  if (templateIds.size === 0) {
    console.log("[backfill] No templates need description/element backfill");
    return;
  }

  // Order by most recently ingested first
  const templates = await prisma.template.findMany({
    where: { id: { in: [...templateIds] } },
    select: { id: true, name: true, lastIngestedAt: true },
    orderBy: { lastIngestedAt: "desc" },
  });

  for (const template of templates) {
    ingestionQueue.enqueue(template.id);
  }

  console.log(
    `[backfill] Queued ${templates.length} templates for description/element backfill`
  );
}
