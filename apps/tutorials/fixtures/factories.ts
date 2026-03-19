import { z } from "zod";
import {
  CompanyFixtureSchema,
  DealFixtureSchema,
  UserFixtureSchema,
  TemplateFixtureSchema,
  SlideFixtureSchema,
  InteractionFixtureSchema,
  type CompanyFixture,
  type DealFixture,
  type UserFixture,
  type TemplateFixture,
  type SlideFixture,
  type InteractionFixture,
  type FixtureSet,
} from "./types.js";

/**
 * Fixture Factories
 *
 * Factory functions that produce Zod-validated fixture data matching
 * the shapes returned by the real agent API (api-client.ts).
 *
 * All data is production-realistic: plausible company names, realistic
 * deal amounts, real-sounding user names, consistent fictional company
 * (Meridian Dynamics) across all tutorials.
 */

// ────────────────────────────────────────────────────────────
// Shared Constants
// ────────────────────────────────────────────────────────────

/** The primary fictional company used across all tutorials */
export const TUTORIAL_COMPANY: CompanyFixture = {
  id: "comp-meridian-001",
  name: "Meridian Dynamics",
  industry: "Technology Consulting",
  logoUrl: null,
  createdAt: "2026-01-15T10:00:00.000Z",
  updatedAt: "2026-01-15T10:00:00.000Z",
};

/** The primary tutorial user */
export const TUTORIAL_USER: UserFixture = {
  id: "user-tutorial-001",
  email: "sarah.chen@lumenalta.com",
  name: "Sarah Chen",
};

// ────────────────────────────────────────────────────────────
// Generic Factory Helper
// ────────────────────────────────────────────────────────────

function createFactory<T>(
  schema: z.ZodType<T>,
  defaults: T
): (overrides?: Partial<T>) => T {
  return (overrides: Partial<T> = {}): T => {
    const merged = { ...defaults, ...overrides };
    return schema.parse(merged);
  };
}

// ────────────────────────────────────────────────────────────
// Company Factory
// ────────────────────────────────────────────────────────────

export const createCompanyFixture = createFactory(
  CompanyFixtureSchema,
  TUTORIAL_COMPANY
);

// ────────────────────────────────────────────────────────────
// Deal Factory
// ────────────────────────────────────────────────────────────

const DEFAULT_DEAL: DealFixture = {
  id: "deal-001",
  companyId: TUTORIAL_COMPANY.id,
  name: "Q2 Digital Transformation Initiative",
  salespersonName: "Sarah Chen",
  salespersonPhoto: null,
  driveFolderId: null,
  status: "open",
  ownerId: TUTORIAL_USER.id,
  ownerEmail: TUTORIAL_USER.email,
  ownerName: TUTORIAL_USER.name,
  collaborators: "[]",
  createdAt: "2026-02-10T14:30:00.000Z",
  updatedAt: "2026-02-10T14:30:00.000Z",
};

export const createDealFixture = createFactory(DealFixtureSchema, DEFAULT_DEAL);

// ────────────────────────────────────────────────────────────
// User Factory
// ────────────────────────────────────────────────────────────

export const createUserFixture = createFactory(
  UserFixtureSchema,
  TUTORIAL_USER
);

// ────────────────────────────────────────────────────────────
// Template Factory
// ────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE: TemplateFixture = {
  id: "tmpl-001",
  name: "Executive Briefing Deck",
  presentationId: "pres-1abc2def3ghi",
  googleSlidesUrl:
    "https://docs.google.com/presentation/d/pres-1abc2def3ghi/edit",
  touchTypes: '["touch-1"]',
  artifactType: "deck",
  accessStatus: "accessible",
  lastIngestedAt: "2026-02-01T09:00:00.000Z",
  sourceModifiedAt: "2026-01-28T16:00:00.000Z",
  slideCount: 12,
  ingestionStatus: "idle",
  ingestionProgress: null,
  contentClassification: "template",
  createdAt: "2026-01-20T11:00:00.000Z",
  updatedAt: "2026-02-01T09:00:00.000Z",
};

export const createTemplateFixture = createFactory(
  TemplateFixtureSchema,
  DEFAULT_TEMPLATE
);

// ────────────────────────────────────────────────────────────
// Slide Factory
// ────────────────────────────────────────────────────────────

const DEFAULT_SLIDE: SlideFixture = {
  id: "slide-001",
  slideIndex: 0,
  slideObjectId: "g_abc123",
  contentText: "Executive Briefing",
  classificationJson: null,
  confidence: null,
  needsReReview: false,
  reviewStatus: "unreviewed",
  industry: null,
  solutionPillar: null,
  persona: null,
  funnelStage: null,
  contentType: null,
  description: null,
  elements: [],
};

export const createSlideFixture = createFactory(
  SlideFixtureSchema,
  DEFAULT_SLIDE
);

// ────────────────────────────────────────────────────────────
// Interaction Factory
// ────────────────────────────────────────────────────────────

const DEFAULT_INTERACTION: InteractionFixture = {
  id: "int-001",
  dealId: "deal-001",
  touchType: "touch_4",
  status: "in_progress",
  inputs: "{}",
  decision: null,
  generatedContent: null,
  outputRefs: null,
  driveFileId: null,
  hitlStage: "idle",
  stageContent: null,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
};

export const createInteractionFixture = createFactory(
  InteractionFixtureSchema,
  DEFAULT_INTERACTION
);

// ────────────────────────────────────────────────────────────
// Shared Fixture Set Generator
// ────────────────────────────────────────────────────────────

/**
 * Generate the full shared fixture set used across all tutorials.
 * Contains production-realistic data: plausible company names,
 * realistic deal amounts, real-sounding user names.
 */
export function createSharedFixtures(): FixtureSet {
  const users: UserFixture[] = [
    createUserFixture({
      id: "user-tutorial-001",
      email: "sarah.chen@lumenalta.com",
      name: "Sarah Chen",
    }),
    createUserFixture({
      id: "user-tutorial-002",
      email: "james.mitchell@lumenalta.com",
      name: "James Mitchell",
    }),
    createUserFixture({
      id: "user-tutorial-003",
      email: "priya.sharma@lumenalta.com",
      name: "Priya Sharma",
    }),
    createUserFixture({
      id: "user-tutorial-004",
      email: "marcus.rodriguez@lumenalta.com",
      name: "Marcus Rodriguez",
    }),
  ];

  const companies: CompanyFixture[] = [
    createCompanyFixture(), // Meridian Dynamics (primary)
    createCompanyFixture({
      id: "comp-nexus-002",
      name: "Nexus Health Systems",
      industry: "Healthcare",
      createdAt: "2026-01-20T08:00:00.000Z",
      updatedAt: "2026-01-20T08:00:00.000Z",
    }),
    createCompanyFixture({
      id: "comp-atlas-003",
      name: "Atlas Financial Group",
      industry: "Financial Services",
      createdAt: "2026-01-22T11:30:00.000Z",
      updatedAt: "2026-01-22T11:30:00.000Z",
    }),
    createCompanyFixture({
      id: "comp-verde-004",
      name: "Verde Energy Solutions",
      industry: "Energy",
      createdAt: "2026-02-01T09:15:00.000Z",
      updatedAt: "2026-02-01T09:15:00.000Z",
    }),
    createCompanyFixture({
      id: "comp-pinnacle-005",
      name: "Pinnacle Retail Corp",
      industry: "Retail",
      createdAt: "2026-02-05T14:00:00.000Z",
      updatedAt: "2026-02-05T14:00:00.000Z",
    }),
    createCompanyFixture({
      id: "comp-horizon-006",
      name: "Horizon Logistics",
      industry: "Supply Chain & Logistics",
      createdAt: "2026-02-08T10:45:00.000Z",
      updatedAt: "2026-02-08T10:45:00.000Z",
    }),
  ];

  const deals: DealFixture[] = [
    createDealFixture({
      id: "deal-001",
      companyId: "comp-meridian-001",
      name: "Q2 Digital Transformation Initiative",
      salespersonName: "Sarah Chen",
      ownerId: "user-tutorial-001",
      ownerEmail: "sarah.chen@lumenalta.com",
      ownerName: "Sarah Chen",
      status: "open",
      collaborators: JSON.stringify([
        { id: "user-tutorial-002", email: "james.mitchell@lumenalta.com", name: "James Mitchell" },
      ]),
      createdAt: "2026-02-10T14:30:00.000Z",
      updatedAt: "2026-03-05T09:00:00.000Z",
    }),
    createDealFixture({
      id: "deal-002",
      companyId: "comp-nexus-002",
      name: "Patient Portal Modernization",
      salespersonName: "James Mitchell",
      ownerId: "user-tutorial-002",
      ownerEmail: "james.mitchell@lumenalta.com",
      ownerName: "James Mitchell",
      status: "open",
      collaborators: "[]",
      createdAt: "2026-02-15T10:00:00.000Z",
      updatedAt: "2026-03-01T16:20:00.000Z",
    }),
    createDealFixture({
      id: "deal-003",
      companyId: "comp-atlas-003",
      name: "Compliance Automation Platform",
      salespersonName: "Priya Sharma",
      ownerId: "user-tutorial-003",
      ownerEmail: "priya.sharma@lumenalta.com",
      ownerName: "Priya Sharma",
      status: "won",
      collaborators: JSON.stringify([
        { id: "user-tutorial-001", email: "sarah.chen@lumenalta.com", name: "Sarah Chen" },
      ]),
      createdAt: "2026-01-25T09:00:00.000Z",
      updatedAt: "2026-02-28T11:30:00.000Z",
    }),
    createDealFixture({
      id: "deal-004",
      companyId: "comp-verde-004",
      name: "Smart Grid Analytics Dashboard",
      salespersonName: "Marcus Rodriguez",
      ownerId: "user-tutorial-004",
      ownerEmail: "marcus.rodriguez@lumenalta.com",
      ownerName: "Marcus Rodriguez",
      status: "open",
      collaborators: "[]",
      createdAt: "2026-03-01T13:45:00.000Z",
      updatedAt: "2026-03-10T08:15:00.000Z",
    }),
  ];

  return { companies, deals, users };
}
