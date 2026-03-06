/**
 * Sequential Ingestion Queue
 *
 * Ensures only one template is ingested at a time to prevent
 * Google API rate limit issues from concurrent ingestions.
 * Deduplicates enqueue requests for the same templateId.
 */

import { PrismaClient } from "@prisma/client";
import { ingestTemplate } from "./ingest-template";
import { getPooledGoogleAuth, type GoogleAuthOptions } from "../lib/google-auth";

const prisma = new PrismaClient();

class IngestionQueue {
  private queue: string[] = [];
  private processing = false;

  /**
   * Add a template to the ingestion queue.
   * Skips if the templateId is already queued.
   */
  enqueue(templateId: string): void {
    if (this.queue.includes(templateId)) {
      console.log(
        `[queue] Template ${templateId} already in queue, skipping`
      );
      return;
    }
    this.queue.push(templateId);
    console.log(
      `[queue] Enqueued template ${templateId} (queue size: ${this.queue.length})`
    );
    if (!this.processing) {
      void this.processNext();
    }
  }

  /**
   * Check if the queue is currently processing a template.
   */
  isProcessing(): boolean {
    return this.processing;
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const templateId = this.queue.shift()!;

    console.log(`[queue] Processing template ${templateId}...`);
    try {
      const { accessToken, source } = await getPooledGoogleAuth();
      console.log(`[queue] Processing template ${templateId} with ${source} auth`);
      const authOptions: GoogleAuthOptions | undefined = accessToken ? { accessToken } : undefined;
      await ingestTemplate(templateId, authOptions);
      console.log(`[queue] Completed template ${templateId}`);
    } catch (err) {
      console.error(`[queue] Ingestion failed for ${templateId}:`, err);
    }

    // Process next item in queue
    void this.processNext();
  }
}

/** Singleton ingestion queue instance */
export const ingestionQueue = new IngestionQueue();

/**
 * Clear stale ingestion states on startup.
 * Handles crash recovery: if the agent process crashed mid-ingestion,
 * templates may be stuck in "ingesting" or "queued" state.
 */
export async function clearStaleIngestions(): Promise<void> {
  const stale = await prisma.template.findMany({
    where: {
      ingestionStatus: { not: "idle" },
    },
    select: { id: true, name: true, ingestionStatus: true },
  });

  if (stale.length > 0) {
    console.log(
      `[queue] Clearing ${stale.length} stale ingestion(s):`,
      stale.map((t) => `${t.name} (${t.ingestionStatus})`).join(", ")
    );
    await prisma.template.updateMany({
      where: {
        ingestionStatus: { not: "idle" },
      },
      data: {
        ingestionStatus: "idle",
        ingestionProgress: null,
      },
    });
  }
}
