/**
 * Auto-Infer Cron Job — Deck Structure Change Detection
 *
 * Periodically checks all touch types for data changes (new/modified
 * classified examples) and triggers re-inference when the underlying
 * data hash changes. Respects active chat session protection by
 * skipping touch types with recent chat activity.
 */

import { prisma } from "../lib/db";
import { getDeckStructureCronKeys } from "./deck-structure-key";
import { inferDeckStructure, computeDataHash } from "./infer-deck-structure";

const INFERENCE_INTERVAL = 600_000; // 10 minutes
const ACTIVE_SESSION_WINDOW = 30 * 60 * 1000; // 30 minutes

/**
 * Start the deck inference cron job.
 * Runs an initial inference pass immediately, then sets up a periodic timer.
 */
export function startDeckInferenceCron(): void {
  // Initial pass on startup (delayed slightly to let DB connections settle)
  setTimeout(() => {
    void runInferenceCycle();
  }, 15_000);

  // Periodic timer
  setInterval(() => {
    void runInferenceCycle();
  }, INFERENCE_INTERVAL);

  console.log(
    "[deck-infer-cron] Background deck inference started (interval: 10m)",
  );
}

/**
 * Run one full inference cycle across all deck structure keys.
 */
async function runInferenceCycle(): Promise<void> {
  console.log("[deck-infer-cron] Starting inference cycle...");

  for (const key of getDeckStructureCronKeys()) {
    const keyLabel = `${key.touchType}${key.artifactType ? `/${key.artifactType}` : ""}`;

    try {
      // 1. Compute current data hash
      const currentHash = await computeDataHash(key);

      // 2. Load existing structure
      const existing = await prisma.deckStructure.findFirst({
        where: {
          touchType: key.touchType,
          artifactType: key.artifactType,
        },
      });

      // 3. Check if re-inference is needed
      if (existing && existing.dataHash === currentHash) {
        // No data change — skip
        continue;
      }

      // 4. Active session protection: skip if chatted within last 30 minutes
      if (existing?.lastChatAt) {
        const msSinceLastChat =
          Date.now() - existing.lastChatAt.getTime();
        if (msSinceLastChat < ACTIVE_SESSION_WINDOW) {
          console.log(
            `[deck-infer-cron] Skipping ${keyLabel} — active chat session (${Math.round(msSinceLastChat / 60_000)}m ago)`,
          );
          continue;
        }
      }

      // 5. Run inference
      console.log(
        `[deck-infer-cron] Re-inferring ${keyLabel} (hash changed: ${existing?.dataHash?.substring(0, 8) ?? "none"} -> ${currentHash.substring(0, 8)})`,
      );

      const result = await inferDeckStructure(key, existing?.chatContextJson ?? undefined);

      console.log(
        `[deck-infer-cron] ${keyLabel}: ${result.sections.length} sections inferred`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[deck-infer-cron] Error inferring ${keyLabel}: ${message}`,
      );
    }
  }

  console.log("[deck-infer-cron] Inference cycle complete");
}
