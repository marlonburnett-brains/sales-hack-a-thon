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
  "pre_call",
] as const;

export const ARTIFACT_TYPES = ["proposal", "talk_track", "faq"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  proposal: "Proposal",
  talk_track: "Talk Track",
  faq: "FAQ",
};

/**
 * SUBSECTORS — Industry-specific subsector taxonomy
 *
 * 62 subsectors across all 11 industries. Used for transcript processing
 * (Touch 4) to refine LLM extraction and pillar mapping with
 * domain-specific context.
 *
 * Single source of truth: consumed by web form (cascading dropdown)
 * and agent workflow (prompt context).
 */
export const SUBSECTORS: Record<string, string[]> = {
  "Consumer Products": [
    "Retail & E-Commerce",
    "Consumer Electronics",
    "Food & Beverage",
    "Apparel & Fashion",
    "Consumer Health & Wellness",
    "Home & Personal Care",
  ],
  Education: [
    "Higher Education",
    "K-12",
    "EdTech Platforms",
    "Corporate Training",
    "Online Learning",
  ],
  "Financial Services & Insurance": [
    "Digital Banking",
    "Capital Markets",
    "Payments & Fintech",
    "Insurance Tech",
    "Wealth Management",
    "Lending & Credit",
    "Regulatory & Compliance",
  ],
  "Health Care": [
    "Telehealth",
    "Health Information Systems",
    "Pharmaceuticals",
    "Medical Devices",
    "Clinical Research",
    "Payer Solutions",
    "Population Health",
  ],
  "Industrial Goods": [
    "Manufacturing",
    "Energy & Utilities",
    "Mining & Resources",
    "Construction & Engineering",
    "Industrial Automation",
  ],
  "Private Equity": [
    "Portfolio Operations",
    "Due Diligence Tech",
    "Fund Administration",
    "Value Creation",
    "Digital Transformation",
  ],
  "Public Sector": [
    "Federal Government",
    "State & Local Government",
    "Defense & Intelligence",
    "Civic Tech",
    "Regulatory Agencies",
  ],
  "Technology, Media & Telecommunications": [
    "Enterprise Software",
    "Media & Entertainment",
    "Telecommunications",
    "Cybersecurity",
    "Cloud & Infrastructure",
    "Gaming",
    "Streaming & Content",
  ],
  "Transportation & Logistics": [
    "Supply Chain & Logistics",
    "Fleet Management",
    "Maritime & Shipping",
    "Aviation",
    "Last-Mile Delivery",
    "Rail & Transit",
  ],
  "Travel & Tourism": [
    "Hospitality",
    "Airlines & Aviation",
    "Online Travel",
    "Destination Management",
    "Travel Tech",
  ],
  "Professional Services": [
    "Management Consulting",
    "Legal Tech",
    "Accounting & Audit",
    "Staffing & Recruitment",
  ],
};

/**
 * SOLUTION_PILLARS — Lumenalta's 6 primary service categories
 *
 * Used in brief generation prompts so LLM maps transcript content
 * to Lumenalta-specific pillars rather than generic categories.
 */
export const SOLUTION_PILLARS = [
  "AI, ML & LLM",
  "Cloud & Infrastructure",
  "Data Modernization",
  "Platform & Application Development",
  "Tech Strategy & Advisory",
  "UX & UI Design",
] as const;

/**
 * ACTION_TYPES — Canonical action type identifiers
 *
 * Used by ActionRequired records across web and agent.
 * Single source of truth for action type strings.
 */
export const ACTION_TYPES = {
  REAUTH_NEEDED: 'reauth_needed',
  SHARE_WITH_SA: 'share_with_sa',
  DRIVE_ACCESS: 'drive_access',
  ATLUS_ACCOUNT_REQUIRED: 'atlus_account_required',
  ATLUS_PROJECT_REQUIRED: 'atlus_project_required',
} as const;
export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];
