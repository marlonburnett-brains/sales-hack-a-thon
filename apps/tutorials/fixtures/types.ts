import { z } from "zod";

/**
 * Fixture Validation Schemas
 *
 * These Zod schemas mirror the API response shapes from apps/web/src/lib/api-client.ts.
 * Fixture factories validate their output against these schemas to ensure fixture data
 * matches what the real API returns -- the primary defense against stale fixture data.
 */

// ────────────────────────────────────────────────────────────
// Company
// ────────────────────────────────────────────────────────────

export const CompanyFixtureSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string(),
  logoUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CompanyFixture = z.infer<typeof CompanyFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Deal
// ────────────────────────────────────────────────────────────

export const DealFixtureSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  salespersonName: z.string().nullable(),
  salespersonPhoto: z.string().nullable(),
  driveFolderId: z.string().nullable(),
  status: z.enum(["open", "won", "lost", "abandoned"]),
  ownerId: z.string().nullable(),
  ownerEmail: z.string().nullable(),
  ownerName: z.string().nullable(),
  collaborators: z.string(), // JSON string
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DealFixture = z.infer<typeof DealFixtureSchema>;

// ────────────────────────────────────────────────────────────
// User (KnownUser from api-client)
// ────────────────────────────────────────────────────────────

export const UserFixtureSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

export type UserFixture = z.infer<typeof UserFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Template
// ────────────────────────────────────────────────────────────

export const TemplateFixtureSchema = z.object({
  id: z.string(),
  name: z.string(),
  presentationId: z.string(),
  googleSlidesUrl: z.string(),
  touchTypes: z.string(), // JSON array string
  artifactType: z.string().nullable(),
  accessStatus: z.string(),
  lastIngestedAt: z.string().nullable(),
  sourceModifiedAt: z.string().nullable(),
  slideCount: z.number(),
  ingestionStatus: z.string(),
  ingestionProgress: z.string().nullable(),
  contentClassification: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TemplateFixture = z.infer<typeof TemplateFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Slide
// ────────────────────────────────────────────────────────────

export const SlideElementFixtureSchema = z.object({
  id: z.string(),
  elementId: z.string(),
  elementType: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
  contentText: z.string(),
  fontSize: z.number().nullable(),
  fontColor: z.string().nullable(),
  isBold: z.boolean(),
});

export const SlideFixtureSchema = z.object({
  id: z.string(),
  slideIndex: z.number(),
  slideObjectId: z.string().nullable(),
  contentText: z.string(),
  classificationJson: z.string().nullable(),
  confidence: z.number().nullable(),
  needsReReview: z.boolean(),
  reviewStatus: z.string(),
  industry: z.string().nullable(),
  solutionPillar: z.string().nullable(),
  persona: z.string().nullable(),
  funnelStage: z.string().nullable(),
  contentType: z.string().nullable(),
  description: z.string().nullable(),
  elements: z.array(SlideElementFixtureSchema),
});

export type SlideFixture = z.infer<typeof SlideFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Interaction
// ────────────────────────────────────────────────────────────

export const InteractionFixtureSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  touchType: z.string(),
  status: z.string(),
  inputs: z.string(),
  decision: z.string().nullable(),
  generatedContent: z.string().nullable(),
  outputRefs: z.string().nullable(),
  driveFileId: z.string().nullable(),
  hitlStage: z.string().nullable(),
  stageContent: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type InteractionFixture = z.infer<typeof InteractionFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Token Check
// ────────────────────────────────────────────────────────────

export const TokenCheckFixtureSchema = z.object({
  hasToken: z.boolean(),
});

export type TokenCheckFixture = z.infer<typeof TokenCheckFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Fixture Set (aggregate of all fixture categories)
// ────────────────────────────────────────────────────────────

export const FixtureSetSchema = z.object({
  companies: z.array(CompanyFixtureSchema),
  deals: z.array(DealFixtureSchema),
  users: z.array(UserFixtureSchema),
  templates: z.array(TemplateFixtureSchema).optional(),
  slides: z.array(SlideFixtureSchema).optional(),
  interactions: z.array(InteractionFixtureSchema).optional(),
  tokenCheck: TokenCheckFixtureSchema.optional(),
});

export type FixtureSet = z.infer<typeof FixtureSetSchema>;

// ────────────────────────────────────────────────────────────
// Stage Fixture (partial FixtureSet override for a specific HITL stage)
// ────────────────────────────────────────────────────────────

/**
 * Stage fixtures are partial overrides applied on top of the base FixtureSet
 * when the mock server is set to a specific stage (e.g., "skeleton", "hifi").
 * Each field is optional; only the fields present in the stage file are merged.
 * `.passthrough()` allows additional ad-hoc fields for stage-specific data.
 */
export const StageFixtureSchema = z
  .object({
    companies: z.array(CompanyFixtureSchema).optional(),
    deals: z.array(DealFixtureSchema).optional(),
    users: z.array(UserFixtureSchema).optional(),
    templates: z.array(TemplateFixtureSchema).optional(),
    slides: z.array(SlideFixtureSchema).optional(),
    interactions: z.array(InteractionFixtureSchema).optional(),
    tokenCheck: TokenCheckFixtureSchema.optional(),
  })
  .passthrough();

export type StageFixture = z.infer<typeof StageFixtureSchema>;

// ────────────────────────────────────────────────────────────
// Sequence (ordered polling responses for async flow simulation)
// ────────────────────────────────────────────────────────────

/**
 * Each sequence response is a flexible object representing one polling response.
 * Common fields: status, runId, steps, result -- but shape varies by endpoint.
 * `.passthrough()` allows any additional fields the specific endpoint needs.
 */
export const SequenceResponseSchema = z
  .object({
    status: z.string().optional(),
    runId: z.string().optional(),
    steps: z.record(z.unknown()).optional(),
    result: z.record(z.unknown()).optional(),
  })
  .passthrough();

/**
 * A sequence file is an ordered array of responses. The mock server serves
 * them in order, repeating the last response after exhaustion.
 */
export const SequenceFileSchema = z.array(SequenceResponseSchema).min(1);

export type SequenceResponse = z.infer<typeof SequenceResponseSchema>;
export type SequenceFile = z.infer<typeof SequenceFileSchema>;
