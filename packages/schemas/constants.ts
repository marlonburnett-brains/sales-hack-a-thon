/**
 * Domain Constants — Single Source of Truth
 *
 * All domain enumerations used across the Lumenalta GTM pipeline.
 * Consolidated from apps/agent/src/ingestion/classify-metadata.ts (Phase 2)
 * into the shared @lumenalta/schemas package.
 *
 * Consumed by: LLM schemas, app schemas, ingestion scripts, validation scripts
 */

export const INDUSTRIES = [
  "Consumer Products",
  "Education",
  "Financial Services & Insurance",
  "Health Care",
  "Industrial Goods",
  "Private Equity",
  "Public Sector",
  "Technology, Media & Telecommunications",
  "Transportation & Logistics",
  "Travel & Tourism",
  "Professional Services",
] as const;

export const FUNNEL_STAGES = [
  "First Contact",
  "Intro Conversation",
  "Capability Alignment",
  "Solution Proposal",
] as const;

export const CONTENT_TYPES = [
  "template",
  "example",
  "case_study",
  "brand_guide",
  "resource",
] as const;

export const SLIDE_CATEGORIES = [
  "title",
  "divider",
  "industry_overview",
  "capability_description",
  "case_study_problem",
  "case_study_solution",
  "case_study_outcome",
  "team_intro",
  "methodology",
  "timeline",
  "pricing",
  "next_steps",
  "appendix",
  "other",
] as const;

export const BUYER_PERSONAS = [
  "CIO",
  "CTO",
  "CFO",
  "VP Engineering",
  "VP Data",
  "VP Product",
  "VP Operations",
  "CEO",
  "General",
] as const;

export const TOUCH_TYPES = [
  "touch_1",
  "touch_2",
  "touch_3",
  "touch_4",
] as const;
