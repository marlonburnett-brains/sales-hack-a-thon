/**
 * Generation Logger — Real-Time Structured Log Store
 *
 * Uses an in-memory Map keyed by generation key (dealId:touchType) so logs
 * are available immediately during step execution, not just after step
 * completion. A separate GET endpoint exposes the logs for frontend polling.
 *
 * Each workflow step creates a logger via `createStepLogger(step, storeKey)`.
 * Every `logger.log()` call pushes to both the local entries array (for step
 * output) and the shared in-memory store (for real-time polling).
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface GenerationLogEntry {
  timestamp: string; // ISO string
  step: string; // e.g. "resolve-and-select-slides"
  message: string; // User-friendly message
  detail?: string; // Optional technical detail
}

// ────────────────────────────────────────────────────────────
// In-Memory Log Store
// ────────────────────────────────────────────────────────────

/** Global store: storeKey -> log entries. Cleared when generation completes. */
const logStore = new Map<string, GenerationLogEntry[]>();

/** Build a store key from deal + touch identifiers. */
export function buildLogKey(dealId: string, touchType: string): string {
  return `${dealId}:${touchType}`;
}

/** Get all logs for a given key (returns empty array if none). */
export function getLogs(key: string): GenerationLogEntry[] {
  return logStore.get(key) ?? [];
}

/** Clear logs for a given key (call after generation completes or suspends). */
export function clearLogs(key: string): void {
  logStore.delete(key);
}

/** Push a single entry to the store. */
function pushToStore(key: string, entry: GenerationLogEntry): void {
  let entries = logStore.get(key);
  if (!entries) {
    entries = [];
    logStore.set(key, entries);
  }
  entries.push(entry);
}

// ────────────────────────────────────────────────────────────
// Step Logger Factory
// ────────────────────────────────────────────────────────────

export interface StepLogger {
  log(message: string, detail?: string): void;
  entries: GenerationLogEntry[];
}

/**
 * Create a logger scoped to a single workflow step.
 *
 * @param step    Step identifier (e.g. "resolve-and-select-slides")
 * @param storeKey  Optional key for the global in-memory store.
 *                  When provided, every log() call also pushes to the
 *                  shared store for real-time polling access.
 */
export function createStepLogger(step: string, storeKey?: string): StepLogger {
  const entries: GenerationLogEntry[] = [];

  return {
    log(message: string, detail?: string) {
      const entry: GenerationLogEntry = {
        timestamp: new Date().toISOString(),
        step,
        message,
        detail,
      };
      entries.push(entry);
      if (storeKey) {
        pushToStore(storeKey, entry);
      }
    },
    entries,
  };
}
