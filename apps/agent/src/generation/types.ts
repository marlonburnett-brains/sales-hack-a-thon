/**
 * Agent-Only Generation Types — Multi-Source Assembly
 *
 * Types specific to the agent's multi-source deck assembly pipeline.
 * These are NOT shared via @lumenalta/schemas because they represent
 * internal agent implementation details (presentation manipulation).
 *
 * Import direction: apps/agent -> @lumenalta/schemas (one-way only).
 */

// ────────────────────────────────────────────────────────────
// SecondarySource (helper for FR-1.4)
// ────────────────────────────────────────────────────────────

/**
 * A secondary presentation source from which specific slides
 * are extracted and injected into the primary presentation.
 */
export interface SecondarySource {
  /** Template ID the secondary presentation belongs to */
  templateId: string;
  /** Google Drive presentation ID */
  presentationId: string;
  /** Slide IDs to extract from this secondary source */
  slideIds: string[];
}

// ────────────────────────────────────────────────────────────
// MultiSourcePlan (FR-1.4)
// ────────────────────────────────────────────────────────────

/**
 * Plan for assembling a deck from multiple source presentations.
 * Uses a primary copy-and-prune strategy with secondary slide injection.
 *
 * The primary source is copied wholesale, then pruned (deleteSlideIds removed).
 * Secondary sources contribute individual slides that are injected into
 * the primary at positions determined by finalSlideOrder.
 */
export interface MultiSourcePlan {
  /** Primary presentation: copied in full, then pruned */
  primarySource: {
    /** Template ID the primary presentation belongs to */
    templateId: string;
    /** Google Drive presentation ID to copy */
    presentationId: string;
    /** Slide IDs to keep from the primary presentation */
    keepSlideIds: string[];
    /** Slide IDs to delete from the primary presentation copy */
    deleteSlideIds: string[];
  };
  /** Secondary presentations providing additional slides */
  secondarySources: SecondarySource[];
  /** Final ordered list of slide IDs after assembly (across all sources) */
  finalSlideOrder: string[];
}
