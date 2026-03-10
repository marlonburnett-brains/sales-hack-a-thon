/**
 * Generation Logger — Structured Log Accumulator for Workflow Steps
 *
 * Provides a typed LogEntry interface and helper to create per-step log arrays.
 * Each workflow step creates a local logs array using `createStepLogger()`,
 * pushes entries during execution, and includes the array in its output.
 * The polling endpoint already returns step outputs, so logs flow to the
 * client automatically via the existing 2-second polling cycle.
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
// Step Logger Factory
// ────────────────────────────────────────────────────────────

export interface StepLogger {
  log(message: string, detail?: string): void;
  entries: GenerationLogEntry[];
}

/**
 * Create a logger scoped to a single workflow step.
 * The returned `entries` array accumulates log entries and should be
 * included in the step's output as `logs`.
 */
export function createStepLogger(step: string): StepLogger {
  const entries: GenerationLogEntry[] = [];

  return {
    log(message: string, detail?: string) {
      entries.push({
        timestamp: new Date().toISOString(),
        step,
        message,
        detail,
      });
    },
    entries,
  };
}
