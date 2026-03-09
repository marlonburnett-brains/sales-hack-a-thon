/**
 * Generation Pipeline Types — Shared Contracts
 *
 * Core interfaces for the structure-driven deck generation pipeline
 * (Phases 51-57). These types are the contracts that enable parallel
 * development of Blueprint Resolver, Multi-Source Assembler,
 * Modification Planner, Section Matcher, and HITL Integration.
 *
 * Consumed by: packages/schemas, apps/agent, apps/web
 * LLM-safe: All fields required, no optionals, no unions (except explicit T | null).
 */

import { TOUCH_TYPES, type ArtifactType } from "../constants.ts";

// ────────────────────────────────────────────────────────────
// DealContext (FR-1.6)
// ────────────────────────────────────────────────────────────

/**
 * Contextual information about the deal used to drive generation decisions.
 * Kept separate from DeckCustomizations (salesperson info, tone, etc.)
 * to maintain a clean domain boundary.
 */
export interface DealContext {
  /** Unique identifier for the deal */
  dealId: string;
  /** Target company name */
  companyName: string;
  /** Industry vertical from INDUSTRIES constant */
  industry: string;
  /** Lumenalta solution pillars relevant to this deal */
  pillars: string[];
  /** Buyer persona (CTO, VP Engineering, etc.) */
  persona: string;
  /** Sales funnel stage (First Contact, Intro Conversation, etc.) */
  funnelStage: string;
  /** Slide IDs from prior touch points for continuity tracking */
  priorTouchSlideIds: string[];
}

// ────────────────────────────────────────────────────────────
// SectionSlot (FR-1.2)
// ────────────────────────────────────────────────────────────

/**
 * A slot in the deck blueprint representing one logical section.
 * Starts unfilled (selectedSlideId = null) and gets populated
 * by the Section Matcher and Modification Planner.
 *
 * Uses `T | null` instead of optional `?` for nullable fields
 * to make null-handling explicit at the type level.
 */
export interface SectionSlot {
  /** Section name matching DeckStructure section names */
  sectionName: string;
  /** Why this section exists in the deck narrative */
  purpose: string;
  /** Whether this section can be omitted from the final deck */
  isOptional: boolean;
  /** SlideEmbedding IDs that are candidates for this slot */
  candidateSlideIds: string[];
  /** Selected slide ID after Section Matcher runs, null if unfilled */
  selectedSlideId: string | null;
  /** Presentation ID containing the selected slide, null if unfilled */
  sourcePresentationId: string | null;
  /** Whether a modification plan has been generated for this slot */
  hasModificationPlan: boolean;
}

// ────────────────────────────────────────────────────────────
// GenerationBlueprint (FR-1.1)
// ────────────────────────────────────────────────────────────

/**
 * The master blueprint that drives the entire generation pipeline.
 * Created by the Blueprint Resolver from a DeckStructure and DealContext,
 * then progressively filled by downstream phases.
 */
export interface GenerationBlueprint {
  /** DeckStructure ID for traceability back to the inferred structure */
  deckStructureId: string;
  /** Touch type driving section selection and ordering */
  touchType: (typeof TOUCH_TYPES)[number];
  /** Artifact type (proposal, talk_track, faq), null for standard decks */
  artifactType: ArtifactType | null;
  /** Ordered section slots to be filled during generation */
  sections: SectionSlot[];
  /** Deal context informing content selection and modification */
  dealContext: DealContext;
  /** Rationale for the section ordering (from DeckStructure) */
  sequenceRationale: string;
}

// ────────────────────────────────────────────────────────────
// SlideSelectionEntry & SlideSelectionPlan (FR-1.3)
// ────────────────────────────────────────────────────────────

/**
 * A single slide selection mapping a section to a specific slide.
 * All fields are strings for serialization safety and HITL transport.
 */
export interface SlideSelectionEntry {
  /** Section name this selection fills */
  sectionName: string;
  /** Selected SlideEmbedding ID */
  slideId: string;
  /** Presentation ID containing the selected slide */
  sourcePresentationId: string;
  /** Template ID the presentation belongs to */
  templateId: string;
  /** Rationale for why this slide was chosen for the section */
  matchRationale: string;
}

/**
 * Complete slide selection plan mapping sections to slides.
 * Array-based (not Map/Record) for JSON serialization and HITL transport.
 */
export interface SlideSelectionPlan {
  /** Ordered list of slide selections, one per filled section */
  selections: SlideSelectionEntry[];
}
